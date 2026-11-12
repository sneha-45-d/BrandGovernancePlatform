import asyncio
import json
import logging
from typing import Any, Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings
from app.database import social_store

logger = logging.getLogger(__name__)


class ImprovementAction(BaseModel):
    area: str = Field(min_length=1, max_length=100)
    issue: str = Field(min_length=1, max_length=300)
    actionable_fix: str = Field(min_length=1, max_length=400)
    priority: Literal['high', 'medium', 'low']


class RecommendedPost(BaseModel):
    platform: Literal['x', 'instagram', 'linkedin', 'facebook', 'youtube']
    headline: str = Field(min_length=1, max_length=150)
    content_draft: str = Field(min_length=10, max_length=1500)
    post_type: Literal['educational', 'storytelling', 'behind_the_scenes', 'product_showcase', 'interactive_poll']
    best_time_to_post: str = Field(min_length=1, max_length=100)
    strategic_reason: str = Field(min_length=1, max_length=400)


class AvoidItem(BaseModel):
    topic_or_phrase: str = Field(min_length=1, max_length=150)
    reason: str = Field(min_length=1, max_length=300)
    alternative_angle: str = Field(min_length=1, max_length=300)


class ContentPillar(BaseModel):
    pillar_name: str = Field(min_length=1, max_length=100)
    percentage: int = Field(ge=0, le=100)
    description: str = Field(min_length=1, max_length=300)


class StrategyRecommendations(BaseModel):
    brand_health_score: int = Field(ge=0, le=100)
    summary: str = Field(min_length=1, max_length=1000)
    what_to_improve: list[ImprovementAction] = Field(default_factory=list)
    recommended_posts: list[RecommendedPost] = Field(default_factory=list)
    what_to_avoid: list[AvoidItem] = Field(default_factory=list)
    content_pillars: list[ContentPillar] = Field(default_factory=list)
    trending_hooks: list[str] = Field(default_factory=list)


def build_fallback_strategy(
    brand_name: str,
    keywords: list[str],
    audit_summary: dict[str, Any],
    sentiment_ratio: dict[str, int],
) -> dict[str, Any]:
    b_name = brand_name or 'Your Brand'
    kw_str = ', '.join(keywords) if keywords else 'quality products'

    avg_score = audit_summary.get('average_safety_score', 85)
    crit_count = audit_summary.get('critical_count', 0)

    improvements = []
    if crit_count > 0:
        improvements.append({
            'area': 'Compliance & Claim Verification',
            'issue': f'{crit_count} recent posts were flagged for exaggerated or unsubstantiated claims.',
            'actionable_fix': 'Replace absolute guarantees with transparent data, third-party tests, and customer testimonials.',
            'priority': 'high',
        })
    else:
        improvements.append({
            'area': 'Audience Engagement & Social Proof',
            'issue': 'Passive posting without interactive hooks reduces comment velocity.',
            'actionable_fix': 'End posts with open-ended questions and run weekly community feedback polls.',
            'priority': 'medium',
        })

    improvements.append({
        'area': 'Content Consistency across Channels',
        'issue': 'Repurposing identical copy across X, Instagram, and LinkedIn dilutes platform-specific reach.',
        'actionable_fix': 'Use snappy conversational threads on X, visual carousels on Instagram, and case study takeaways on LinkedIn.',
        'priority': 'medium',
    })

    rec_posts = [
        {
            'platform': 'x',
            'headline': f"Debunking Common Myths in {keywords[0] if keywords else 'our industry'}",
            'content_draft': f"Most brands promise overnight miracles. Here is the unvarnished truth about what actually works:\n\n1. Consistency beats hype.\n2. Genuine transparency wins long-term trust.\n\nAt {b_name}, we share the full testing behind every release.\n\nWhat is the biggest claim you wish companies stopped making?",
            'post_type': 'educational',
            'best_time_to_post': 'Tuesday 12:30 PM & Thursday 6:00 PM',
            'strategic_reason': 'Builds authority and cuts through false marketing noise by being radically honest.',
        },
        {
            'platform': 'instagram',
            'headline': 'Behind The Scenes: Quality & Craftsmanship',
            'content_draft': f"Swipe to see how we build without cutting corners 👉\n\nNo buzzwords. No exaggerated claims. Just honest ingredients and meticulous design at every step.\n\nSave this post if you believe in products that stand the test of time.\n\n#{b_name.replace(' ', '')} #TransparencyInBusiness #Craftsmanship",
            'post_type': 'behind_the_scenes',
            'best_time_to_post': 'Wednesday 7:00 PM - 9:00 PM',
            'strategic_reason': 'Visual proof reinforces credibility and shields against negative sentiment.',
        },
        {
            'platform': 'linkedin',
            'headline': f"Why {b_name} Stopped Using Superlatives in Marketing",
            'content_draft': f"A quick marketing reflection:\n\nWhen we audited our messaging, we noticed an industry-wide trap: everyone claims to be '#1' or 'the ultimate solution'.\n\nCustomers today are smarter than ever. They don't want superlatives; they want evidence.\n\nHere are 3 metrics we track instead of vanity hype:\n• Customer retention velocity\n• Verifiable product performance\n• Transparent resolution time\n\nHow is your team modernizing its brand voice?",
            'post_type': 'storytelling',
            'best_time_to_post': 'Monday & Wednesday 9:00 AM - 11:00 AM',
            'strategic_reason': 'Positions executive leadership and brand philosophy favorably among B2B partners and discerning buyers.',
        },
    ]

    avoids = [
        {
            'topic_or_phrase': '100% Guaranteed / Miracle Results',
            'reason': 'Triggers customer skepticism and risks consumer protection complaints.',
            'alternative_angle': 'Cite specific user survey results or clinical benchmarks with clear context.',
        },
        {
            'topic_or_phrase': 'Direct Aggressive Attacks on Competitors',
            'reason': 'Makes the brand look defensive and risks trademark or defamation counter-actions.',
            'alternative_angle': 'Highlight unique proprietary features and customer love without naming competitors.',
        },
        {
            'topic_or_phrase': 'Artificial Urgency ("Act Now or Miss Forever")',
            'reason': 'Damages high-trust premium positioning and leads to buyer remorse.',
            'alternative_angle': 'Emphasize value, longevity, and genuine batch availability.',
        },
    ]

    pillars = [
        {'pillar_name': 'Educational & Insightful', 'percentage': 35, 'description': 'Explaining how things work, busting myths, and industry knowledge.'},
        {'pillar_name': 'Customer Stories & Proof', 'percentage': 30, 'description': 'Real reviews, before/after case studies, user photos.'},
        {'pillar_name': 'Behind-the-Scenes & Ethics', 'percentage': 20, 'description': 'Team processes, quality checks, materials sourcing.'},
        {'pillar_name': 'Product & Offer Announcements', 'percentage': 15, 'description': 'New launches, updates, transparent pricing.'},
    ]

    hooks = [
        f"The biggest misconception about {keywords[0] if keywords else 'this space'} that costs people money:",
        f"Why we chose not to make the claim everyone in our industry makes:",
        f"3 things we learned building {b_name} that changed how we view quality:",
        "Don't buy until you check these 2 critical specs:",
    ]

    return {
        'brand_health_score': min(100, max(40, int(avg_score))),
        'summary': f"Strategic analysis for {b_name}: Prioritize radical product honesty over exaggerated claims. Customer sentiment shows higher loyalty when claims are backed with verifiable demonstrations.",
        'what_to_improve': improvements,
        'recommended_posts': rec_posts,
        'what_to_avoid': avoids,
        'content_pillars': pillars,
        'trending_hooks': hooks,
    }


async def generate_strategy_recommendations(user_id: str) -> dict[str, Any]:
    config = social_store.get_config(user_id) or {}
    brand_name = config.get('brand_name') or 'Our Brand'
    keywords = config.get('keywords') or []
    product_names = config.get('product_names') or []

    # Get recent post audits and mentions
    audit_summary = social_store.get_audit_summary(user_id)
    mentions = social_store.list_mentions(user_id, limit=40)
    sentiment_counts = {'positive': 0, 'negative': 0, 'neutral': 0}
    for m in mentions:
        s = m.get('sentiment')
        if s in sentiment_counts:
            sentiment_counts[s] += 1

    competitors = social_store.list_competitors(user_id)
    competitor_names = [c['name'] for c in competitors if 'name' in c]

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.info('Gemini API key not configured; using fallback strategy engine')
        return build_fallback_strategy(brand_name, keywords, audit_summary, sentiment_counts)

    # Gemini prompt
    prompt = f"""You are a world-class Social Media Brand Strategist & Reputation Advisor.
Analyze this brand's social intelligence profile and construct a high-impact marketing strategy:

Brand Name: {brand_name}
Keywords / Products: {', '.join(keywords + product_names) or 'General consumer brand'}
Competitors: {', '.join(competitor_names) or 'Not registered'}
Recent Mentions Sentiment: {sentiment_counts['positive']} positive, {sentiment_counts['negative']} negative, {sentiment_counts['neutral']} neutral.
Post Audit Safety Score: {audit_summary.get('average_safety_score', 90)}/100
Flagged Critical Issues: {audit_summary.get('critical_count', 0)}

Task:
1. Identify 2-3 precise things this brand must IMPROVE in their content and communication.
2. Provide 3-4 CONCRETE, ready-to-post recommendations (full captions with hooks, hashtags, and CTA) across platforms (X, Instagram, LinkedIn). What tweets/posts should they publish to establish authority, avoid false marketing, and build trust?
3. List 3 high-risk topics or phrases they MUST AVOID (e.g. false marketing traps, competitor clashes, deceptive urgency).
4. Propose balanced Content Pillars (% breakdown totaling 100%).
5. Provide 4 viral, high-trust opening hooks.

Return valid JSON adhering to the provided schema.
"""
    try:
        client = genai.Client(api_key=api_key)

        def generate():
            return client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=StrategyRecommendations,
                    temperature=0.3,
                ),
            )

        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(loop.run_in_executor(None, generate), timeout=5.0)
        payload = json.loads(response.text)
        validated = StrategyRecommendations.model_validate(payload)
        return validated.model_dump()
    except Exception as exc:
        logger.warning('Gemini strategy generation failed or timed out: %s. Using heuristic strategy engine.', exc)
        return build_fallback_strategy(brand_name, keywords, audit_summary, sentiment_counts)
