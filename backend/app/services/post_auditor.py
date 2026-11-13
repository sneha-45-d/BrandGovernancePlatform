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


def heuristic_audit(caption: str, brand_name: str = '') -> dict[str, Any]:
    text_lower = caption.lower()
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

    safety_score = max(0, 100 - deductions)

    if safety_score >= 85 and not violations:
        risk_level = 'safe'
        is_harmful = False
        summary = 'Post appears clean and aligned with standard brand safety guidelines.'
    elif safety_score >= 70:
        risk_level = 'low'
        is_harmful = False
        summary = 'Minor wording issues detected. Adjust to ensure total clarity and compliance.'
    elif safety_score >= 50:
        risk_level = 'medium'
        is_harmful = True
        summary = 'Elevated brand risk. Several statements may be interpreted as exaggerated or misleading marketing.'
    elif safety_score >= 30:
        risk_level = 'high'
        is_harmful = True
        summary = 'High risk: Significant false marketing or reputation-damaging claims found.'
    else:
        risk_level = 'critical'
        is_harmful = True
        summary = 'Critical violation: This post violates major marketing ethics and could invite PR fallout or legal action.'

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
        removal_reason = 'Contains exaggerated phrasing or unsubstantiated claims. Recommended to revise caption to comply with brand standards.'
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
    }


async def audit_post_with_gemini(
    caption: str,
    brand_name: str = '',
    platform: str = 'x',
    competitors: list[str] | None = None,
    metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.info('Gemini API key not configured; using heuristic auditor fallback')
        return heuristic_audit(caption, brand_name, metrics=metrics, platform=platform)

    competitor_str = ', '.join(competitors) if competitors else 'None specified'
    m = metrics or {}
    views = m.get('views', 0)
    likes = m.get('likes', 0)
    comments = m.get('comments', 0)
    shares = m.get('shares', 0)
    eng_rate = m.get('engagement_rate', 0.0)

    prompt = f"""You are an elite Brand Safety and Social Media Performance Auditor.
Analyze the following social media post drafted or published by the brand '{brand_name or "Our Brand"}' on {platform.title()}.

Live Performance Metrics:
- Views / Impressions: {views}
- Likes / Reactions: {likes}
- Comments: {comments}
- Shares / Retweets: {shares}
- Calculated Engagement Rate: {eng_rate}%

Check for:
1. FALSE MARKETING & EXAGGERATED CLAIMS: Unsubstantiated claims (e.g. "100% cure", "guaranteed rich", fake stats, deceptive promises).
2. BRAND IDENTITY HARM: Toxic tone, offensive wording, divisive language, reckless attacks, PR liability.
3. REGULATORY COMPLIANCE: Missing disclaimers (#ad, sponsored disclosures, medical/financial warnings where needed).
4. COMPETITOR CLASHES / TRADEMARK: Disparaging competitors ({competitor_str}) or IP infringement.
5. TONE VIOLATIONS: Inappropriate aggression, unprofessionalism, or deceitful urgency.
6. ENGAGEMENT QUALITY: Does high/low engagement reflect genuine approval, clickbait drop-off, or audience skepticism?

Scoring & Action Rules:
- safety_score: 0-100 integer (100 = flawless, perfectly compliant; <40 = severely hazardous/illegal claim).
- risk_level: must be exactly one of: "safe", "low", "medium", "high", "critical".
- is_harmful: boolean true if severe brand harm or false marketing exists.
- action_recommendation: exactly one of:
    * "remove_immediately": If the post has critical/high violations, deceptive guarantees, or severe brand reputation damage.
    * "revise": If the post has minor/medium issues that can be fixed with revised caption copy.
    * "keep": If the post is compliant, brand-safe, and performing well.
- removal_reason: Clear 1-2 sentence explanation of why this post should be taken down from social media (empty string if action is keep).
- violations: list of specific violations found with category, severity, flagged_text, and fix_recommendation.
- positive_aspects: list of what the post does well (e.g. hook, clarity, CTA).
- reputation_impact: clear 1-2 sentence analysis of potential brand harm or benefit.
- suggested_revision: safe, professional rewrite that retains promotional impact WITHOUT any false claims or risk.
- engagement_assessment: 1-2 sentence evaluation of views, likes, comments, and engagement rate.

Post to audit:
\"\"\"{caption}\"\"\"
"""
    try:
        client = get_genai_client(api_key)

        def generate():
            return client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PostAuditResult,
                    temperature=0.2,
                ),
            )

        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(loop.run_in_executor(None, generate), timeout=8.0)
        payload = json.loads(response.text)
        validated = PostAuditResult.model_validate(payload)
        return validated.model_dump()
    except Exception as exc:
        logger.warning('Gemini post audit failed or timed out: %s. Using heuristic auditor.', exc)
        return heuristic_audit(caption, brand_name, metrics=metrics, platform=platform)


async def audit_and_save_post(user_id: str, post_id: str) -> dict[str, Any]:
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

    audit_result = await audit_post_with_gemini(
        caption=caption,
        brand_name=brand_name,
        platform=platform,
        competitors=competitor_names,
        metrics=metrics,
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
