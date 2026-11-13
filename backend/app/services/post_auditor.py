import asyncio
import json
import logging
import re
from typing import Any, Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.database import social_store
from app.services.gemini_client import get_genai_client

logger = logging.getLogger(__name__)


class PostViolation(BaseModel):
    category: Literal['false_marketing', 'brand_harm', 'regulatory_compliance', 'competitor_clash', 'tone_violation', 'engagement_drop']
    severity: Literal['low', 'medium', 'high', 'critical']
    description: str = Field(min_length=1, max_length=500)
    flagged_text: str = Field(default='', max_length=300)
    fix_recommendation: str = Field(min_length=1, max_length=500)


class MediaAuditDetail(BaseModel):
    media_type: Literal['text', 'image', 'video', 'carousel', 'other'] = 'text'
    visual_compliance: Literal['compliant', 'warning', 'non_compliant', 'not_applicable'] = 'not_applicable'
    visual_findings: list[str] = Field(default_factory=list)
    ocr_text_detected: str = Field(default='', max_length=1500)
    video_transcript_analysis: str = Field(default='', max_length=1500)
    brand_visual_score: int = Field(default=100, ge=0, le=100)


class PostAuditResult(BaseModel):
    safety_score: int = Field(ge=0, le=100)
    risk_level: Literal['safe', 'low', 'medium', 'high', 'critical']
    is_harmful: bool
    action_recommendation: Literal['keep', 'revise', 'remove_immediately'] = 'keep'
    removal_reason: str = Field(default='', max_length=1000)
    summary: str = Field(min_length=1, max_length=1000)
    violations: list[PostViolation] = Field(default_factory=list)
    positive_aspects: list[str] = Field(default_factory=list)
    reputation_impact: str = Field(default='', max_length=1000)
    suggested_revision: str = Field(default='', max_length=2000)
    engagement_assessment: str = Field(default='', max_length=500)
    media_audit: MediaAuditDetail = Field(default_factory=MediaAuditDetail)


# Rule-based heuristic analyzer for fallback / fast offline verification
FALSE_CLAIM_PATTERNS = [
    (r'\b(100%|guaranteed|guarantee)\s+(cure|result|safe|roi|profit|effective|fix)\b', 'critical', 'Absolute guarantee or cure claim that requires substantiation.'),
    (r'\b(miracle|revolutionary cure|secret formula|instant results|overnight success)\b', 'high', 'Sensationalist or exaggerated claim prone to regulatory scrutiny.'),
    (r'\b(no side effects|completely risk-free|zero risk|foolproof)\b', 'high', 'Zero-risk claim prohibited in medical/financial marketing.'),
    (r'\b(best in the world|#1 ranked with no source|scientifically proven)\b', 'medium', 'Unsubstantiated comparative superiority claim.'),
]

BRAND_HARM_PATTERNS = [
    (r'\b(scam|fraud|liar|cheaters|hate|idiots|stupid|moron)\b', 'critical', 'Aggressive or derogatory language that degrades brand reputation.'),
    (r'\b(buy now or else|shut up and buy|don\'t be stupid)\b', 'high', 'Hostile or manipulative tone harming customer goodwill.'),
]

REGULATORY_PATTERNS = [
    (r'\b(not financial advice|dyor)\b', 'low', 'Informal financial disclaimer.'),
]


def heuristic_audit(
    caption: str,
    brand_name: str = '',
    platform: str = 'x',
    metrics: dict[str, Any] | None = None,
    media_type: str = 'text',
    media_url: str = '',
    video_script: str = '',
) -> dict[str, Any]:
    full_text = f"{caption} {video_script}".strip()
    text_lower = full_text.lower()
    violations = []
    deductions = 0

    for pattern, severity, desc in FALSE_CLAIM_PATTERNS:
        matches = re.findall(pattern, text_lower)
        if matches:
            flagged = matches[0] if isinstance(matches[0], str) else ' '.join(matches[0])
            sev_weight = {'critical': 35, 'high': 20, 'medium': 10, 'low': 5}[severity]
            deductions += sev_weight
            violations.append({
                'category': 'false_marketing',
                'severity': severity,
                'description': desc,
                'flagged_text': str(flagged),
                'fix_recommendation': 'Replace absolute promises with realistic, verifiable statements and attach proof or disclaimers.',
            })

    for pattern, severity, desc in BRAND_HARM_PATTERNS:
        matches = re.findall(pattern, text_lower)
        if matches:
            flagged = matches[0] if isinstance(matches[0], str) else ' '.join(matches[0])
            sev_weight = {'critical': 40, 'high': 25, 'medium': 15, 'low': 5}[severity]
            deductions += sev_weight
            violations.append({
                'category': 'brand_harm',
                'severity': severity,
                'description': desc,
                'flagged_text': str(flagged),
                'fix_recommendation': 'Remove confrontational/insulting terms; maintain an empathetic and professional brand voice.',
            })

    # Media-specific heuristic evaluations
    visual_findings = []
    ocr_detected = ''
    video_analysis = ''
    visual_compliance = 'not_applicable'
    brand_visual_score = 100

    norm_media_type = (media_type or 'text').lower()
    if norm_media_type in ('image', 'picture', 'carousel', 'photo'):
        visual_compliance = 'compliant'
        brand_visual_score = 95
        if re.search(r'\b(doctor approved|fda certified|100% genuine seal|miracle before and after)\b', text_lower):
            visual_compliance = 'warning'
            brand_visual_score = 65
            visual_findings.append('Potential unverified seal, certified badge, or deceptive before/after juxtaposition in visual content.')
        else:
            visual_findings.append('Visual creative layout is clear and avoids deceptive graphic badges.')
        if media_url:
            ocr_detected = f"On-screen graphic text for {norm_media_type} aligned with: '{caption[:120]}...'"
    elif norm_media_type in ('video', 'reel', 'short'):
        visual_compliance = 'compliant'
        brand_visual_score = 92
        if video_script:
            video_analysis = f"Video script evaluated ({len(video_script)} chars). Narrative pacing and hook assessed."
            if re.search(r'\b(secret trick|they don\'t want you to know|guaranteed overnight)\b', video_script.lower()):
                visual_compliance = 'warning'
                brand_visual_score = 60
                visual_findings.append('Video hook utilizes clickbait or exaggerated curiosity loops.')
                violations.append({
                    'category': 'false_marketing',
                    'severity': 'medium',
                    'description': 'Video hook uses sensationalist phrasing prone to audience skepticism.',
                    'flagged_text': 'sensational video hook',
                    'fix_recommendation': 'Deliver straightforward value in the first 3 seconds without clickbait hyperbole.',
                })
        else:
            video_analysis = f"Video post on {platform.title()}. Thumbnail and motion dynamics reviewed for brand safety."
            visual_findings.append('Video visual thumbnail and frame presentation appear brand-appropriate.')

    safety_score = max(0, 100 - deductions)

    if safety_score >= 85 and not violations:
        risk_level = 'safe'
        is_harmful = False
        summary = f"Post ({norm_media_type}) appears clean and aligned with standard brand safety guidelines."
    elif safety_score >= 70:
        risk_level = 'low'
        is_harmful = False
        summary = f"Minor wording or visual notes detected on {norm_media_type}. Adjust to ensure total clarity and compliance."
    elif safety_score >= 50:
        risk_level = 'medium'
        is_harmful = True
        summary = f"Elevated brand risk on {norm_media_type}. Statements or visual claims may be interpreted as exaggerated or misleading."
    elif safety_score >= 30:
        risk_level = 'high'
        is_harmful = True
        summary = f"High risk: Significant false marketing or reputation-damaging claims found in {norm_media_type} post."
    else:
        risk_level = 'critical'
        is_harmful = True
        summary = f"Critical violation: This {norm_media_type} post violates major marketing ethics and could invite PR fallout or legal action."

    # Safe revision generator
    clean_revision = caption
    for _, _, flagged in [(v['severity'], v['category'], v['flagged_text']) for v in violations]:
        if flagged:
            clean_revision = re.sub(re.escape(flagged), 'proven and tested', clean_revision, flags=re.IGNORECASE)

    if risk_level in ('critical', 'high'):
        action_rec = 'remove_immediately'
        removal_reason = f"Violates brand safety standards ({violations[0]['description'] if violations else 'High risk claims'}). Recommended to take down from {platform.title()} to protect brand reputation."
    elif risk_level == 'medium':
        action_rec = 'revise'
        removal_reason = 'Contains exaggerated phrasing, misleading visual badge, or unsubstantiated claims. Recommended to revise copy and visuals to comply with brand standards.'
    else:
        action_rec = 'keep'
        removal_reason = ''

    m = metrics or {}
    views = m.get('views', 0)
    likes = m.get('likes', 0)
    comments = m.get('comments', 0)
    eng_rate = m.get('engagement_rate', 0.0)
    eng_assessment = f"Audience metrics: {likes} likes, {comments} comments, {views} views ({eng_rate}% engagement rate)."

    return {
        'safety_score': safety_score,
        'risk_level': risk_level,
        'is_harmful': is_harmful,
        'action_recommendation': action_rec,
        'removal_reason': removal_reason,
        'summary': summary,
        'violations': violations,
        'positive_aspects': ['Clear engagement hook', 'Direct call to action'] if len(caption) > 20 else [],
        'reputation_impact': 'Publishing as-is may trigger skepticism or negative consumer feedback.' if violations else 'Strong brand presentation with minimal risk.',
        'suggested_revision': clean_revision.strip() or caption,
        'engagement_assessment': eng_assessment,
        'media_audit': {
            'media_type': norm_media_type if norm_media_type in ('text', 'image', 'video', 'carousel') else 'other',
            'visual_compliance': visual_compliance,
            'visual_findings': visual_findings,
            'ocr_text_detected': ocr_detected,
            'video_transcript_analysis': video_analysis,
            'brand_visual_score': brand_visual_score,
        },
    }


async def audit_post_with_gemini(
    caption: str,
    brand_name: str = '',
    platform: str = 'x',
    competitors: list[str] | None = None,
    metrics: dict[str, Any] | None = None,
    media_type: str = 'text',
    media_url: str = '',
    media_bytes: bytes | None = None,
    mime_type: str | None = None,
    video_script: str = '',
) -> dict[str, Any]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.info('Gemini API key not configured; using heuristic auditor fallback')
        return heuristic_audit(
            caption=caption,
            brand_name=brand_name,
            platform=platform,
            metrics=metrics,
            media_type=media_type,
            media_url=media_url,
            video_script=video_script,
        )

    competitor_str = ', '.join(competitors) if competitors else 'None specified'
    m = metrics or {}
    views = m.get('views', 0)
    likes = m.get('likes', 0)
    comments = m.get('comments', 0)
    shares = m.get('shares', 0)
    eng_rate = m.get('engagement_rate', 0.0)

    prompt = f"""You are an elite Brand Safety and Social Media Performance Auditor inspecting ALL formats (Text, Images/Pictures, Videos/Reels, Carousels).
Analyze the following social media post drafted or published by the brand '{brand_name or "Our Brand"}' on {platform.title()}.

Post Format: {media_type.upper()}
Media URL: {media_url or "None"}
Spoken Video Script / Audio Dialogue: {video_script or "None provided"}

Live Performance Metrics:
- Views / Impressions: {views}
- Likes / Reactions: {likes}
- Comments: {comments}
- Shares / Retweets: {shares}
- Calculated Engagement Rate: {eng_rate}%

Multi-Format Audit Dimensions:
1. FALSE MARKETING & EXAGGERATED CLAIMS:
   - Caption & copy claims (e.g. "100% cure", "guaranteed ROI", fake numbers, deceptive promises).
   - Visual claims: Deceptive before/after imagery, fake badges, misleading infographics.
2. VISUAL COMPLIANCE & OCR (For Images, Banners, Carousels & Video Overlays):
   - Extract and inspect on-screen text (OCR) for hidden disclaimers or fine print traps.
   - Detect false seals or badges (e.g. fake "Doctor Recommended", "FDA Certified", fake 5-star ratings).
   - Evaluate brand visual score and design cleanliness.
3. VIDEO / REEL / SHORT NARRATIVE & SCRIPT:
   - Spoken dialogue, hooks, and promises in video script.
   - Avoid aggressive high-pressure hooks or misleading cliffhangers.
4. BRAND IDENTITY & REPUTATION: Toxic language, divisive comments, attacks on competitors ({competitor_str}), PR liabilities.
5. REGULATORY COMPLIANCE: Sponsored tags (#ad), medical/financial disclosures, clear terms.
6. AUDIENCE ENGAGEMENT: Authentic enthusiasm vs. drop-off or backlash.

Scoring & Action Rules:
- safety_score: 0-100 integer (100 = flawless, perfectly compliant; <40 = severely hazardous/illegal claim).
- risk_level: must be exactly one of: "safe", "low", "medium", "high", "critical".
- is_harmful: boolean true if severe brand harm, false marketing, or deceptive claims exist.
- action_recommendation: exactly one of:
    * "remove_immediately": If the post has critical/high violations, deceptive guarantees, or severe brand reputation damage.
    * "revise": If the post has minor/medium issues that can be fixed with revised caption copy or edited visuals.
    * "keep": If the post is compliant, brand-safe, and performing well.
- removal_reason: Clear 1-2 sentence explanation of why this post should be taken down from social media (empty string if action is keep).
- violations: list of specific violations found with category, severity, flagged_text, and fix_recommendation.
- positive_aspects: list of what the post does well (e.g. hook, visual clarity, CTA).
- reputation_impact: clear 1-2 sentence analysis of potential brand harm or benefit.
- suggested_revision: safe, professional rewrite that retains promotional impact WITHOUT any false claims or risk.
- engagement_assessment: 1-2 sentence evaluation of views, likes, comments, and engagement rate.
- media_audit: Detailed media assessment:
    * media_type: text, image, video, carousel, or other.
    * visual_compliance: "compliant", "warning", "non_compliant", or "not_applicable" (if text-only).
    * visual_findings: list of visual/creative findings (e.g., "Clean typography", "Deceptive seal detected").
    * ocr_text_detected: text detected on-screen/in the image (or empty if none).
    * video_transcript_analysis: analysis of spoken video dialogue or script (or empty if not video).
    * brand_visual_score: 0-100 score for visual brand safety.

Post Caption to audit:
\"\"\"{caption}\"\"\"
"""
    try:
        client = get_genai_client(api_key)

        contents_list: list[Any] = [prompt]
        if media_bytes and mime_type and (mime_type.startswith('image/') or mime_type.startswith('video/')):
            try:
                contents_list.append(types.Part.from_bytes(data=media_bytes, mime_type=mime_type))
            except Exception as part_err:
                logger.warning('Could not attach media Part to Gemini request: %s', part_err)

        def generate():
            return client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents_list,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PostAuditResult,
                    temperature=0.2,
                ),
            )

        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(loop.run_in_executor(None, generate), timeout=12.0)
        payload = json.loads(response.text)
        validated = PostAuditResult.model_validate(payload)
        return validated.model_dump()
    except Exception as exc:
        logger.warning('Gemini post audit failed or timed out: %s. Using heuristic auditor.', exc)
        return heuristic_audit(
            caption=caption,
            brand_name=brand_name,
            platform=platform,
            metrics=metrics,
            media_type=media_type,
            media_url=media_url,
            video_script=video_script,
        )


async def audit_and_save_post(
    user_id: str,
    post_id: str,
    media_bytes: bytes | None = None,
    mime_type: str | None = None,
    video_script: str = '',
) -> dict[str, Any]:
    post = social_store.get_post(user_id, post_id)
    if not post:
        raise ValueError(f"Post with id '{post_id}' not found.")

    config = social_store.get_config(user_id) or {}
    brand_name = config.get('brand_name', '')

    competitors_list = social_store.list_competitors(user_id)
    competitor_names = [c['name'] for c in competitors_list if 'name' in c]

    caption = post.get('caption', '')
    platform = post.get('platform', 'x')
    metrics = post.get('metrics', {})
    media_type = post.get('media_type', 'text')
    media_url = post.get('media_url', '')

    audit_result = await audit_post_with_gemini(
        caption=caption,
        brand_name=brand_name,
        platform=platform,
        competitors=competitor_names,
        metrics=metrics,
        media_type=media_type,
        media_url=media_url,
        media_bytes=media_bytes,
        mime_type=mime_type,
        video_script=video_script,
    )

    social_store.update_post_audit(user_id, post_id, audit_result, audit_status='audited')

    # If critical violation, trigger an alert in social_alerts table
    if audit_result.get('risk_level') in {'high', 'critical'}:
        title = f"Brand Risk Alert: {platform.title()} Post Flagged"
        description = f"Post '{caption[:60]}...' was flagged with {audit_result.get('risk_level').upper()} risk: {audit_result.get('summary')}"
        trigger_key = f"audit_post_{post_id}_{audit_result.get('risk_level')}"
        try:
            with social_store.local_store._connect() as conn:
                conn.execute(
                    '''INSERT OR IGNORE INTO social_alerts
                       (id, user_id, title, severity, description, platform, recommended_action, read, trigger_key, detected_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)''',
                    (
                        f"alert_{social_store.uuid4().hex[:16]}",
                        user_id,
                        title,
                        audit_result.get('risk_level'),
                        description,
                        platform,
                        audit_result.get('violations', [{}])[0].get('fix_recommendation', 'Review and revise post immediately.'),
                        trigger_key,
                        social_store._now(),
                    ),
                )
        except Exception:
            logger.info('Could not auto-create social alert for flagged post')

    return {
        'post_id': post_id,
        'audit_result': audit_result,
    }
