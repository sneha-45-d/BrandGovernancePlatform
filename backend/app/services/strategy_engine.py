import asyncio
import json
import logging
from typing import Any, Literal

from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings
from app.database import social_store
from app.services.gemini_client import get_genai_client
from app.services.platform_fetcher import calculate_engagement_rate

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


class PostRemovalRecommendation(BaseModel):
    post_id: str = Field(default='')
    platform: str = Field(default='instagram')
    headline_or_preview: str = Field(min_length=1, max_length=200)
    risk_level: Literal['low', 'medium', 'high', 'critical'] = 'high'
    reason_to_remove: str = Field(min_length=1, max_length=500)
    recommended_action: Literal['delete_immediately', 'archive_and_repost', 'revise_caption'] = 'delete_immediately'
    suggested_replacement: str = Field(default='', max_length=1500)


class WinningStrategy(BaseModel):
    strategy_title: str = Field(min_length=1, max_length=150)
    platform: str = Field(default='all')
    why_it_worked: str = Field(min_length=1, max_length=400)
    metric_signal: str = Field(default='', max_length=200)
    action_to_replicate: str = Field(min_length=1, max_length=400)


class CrossPlatformOverview(BaseModel):
    total_analyzed_posts: int = Field(default=0)
    total_views: int = Field(default=0)
    total_likes: int = Field(default=0)
    total_comments: int = Field(default=0)
    average_engagement_rate: float = Field(default=0.0)
    best_performing_platform: str = Field(default='none')
    platform_with_most_risk: str = Field(default='none')


class StrategyRecommendations(BaseModel):
    brand_health_score: int = Field(ge=0, le=100)
    cross_platform_overview: CrossPlatformOverview
    summary: str = Field(min_length=1, max_length=1000)
    winning_strategies: list[WinningStrategy] = Field(default_factory=list)
    posts_to_remove: list[PostRemovalRecommendation] = Field(default_factory=list)
    what_to_improve: list[ImprovementAction] = Field(default_factory=list)
    what_to_avoid: list[AvoidItem] = Field(default_factory=list)
    content_pillars: list[ContentPillar] = Field(default_factory=list)
    recommended_posts: list[RecommendedPost] = Field(default_factory=list)
    trending_hooks: list[str] = Field(default_factory=list)


def compute_cross_platform_metrics(posts: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    total_views = 0
    total_likes = 0
    total_comments = 0
    platform_stats: dict[str, dict[str, Any]] = {}
    posts_to_remove: list[dict[str, Any]] = []
    eng_rates: list[float] = []

    for p in posts:
        metrics = p.get('metrics') or {}
        views = int(metrics.get('views', 0) or 0)
        likes = int(metrics.get('likes', 0) or 0)
        comments = int(metrics.get('comments', 0) or 0)
        eng_rate = float(metrics.get('engagement_rate', 0.0) or 0.0)
        if eng_rate <= 0.0 and (likes > 0 or comments > 0):
            eng_rate = calculate_engagement_rate(metrics)

        total_views += views
        total_likes += likes
        total_comments += comments
        eng_rates.append(eng_rate)

        plat = p.get('platform', 'unknown').lower()
        if plat not in platform_stats:
            platform_stats[plat] = {
                'views': 0,
                'likes': 0,
                'comments': 0,
                'posts': 0,
                'eng_rates': [],
                'critical_risks': 0,
            }

        platform_stats[plat]['views'] += views
        platform_stats[plat]['likes'] += likes
        platform_stats[plat]['comments'] += comments
        platform_stats[plat]['posts'] += 1
        platform_stats[plat]['eng_rates'].append(eng_rate)

        # Evaluate risk / removal candidate
        audit = p.get('audit_result') or {}
        risk_level = audit.get('risk_level', 'low')
        action_rec = audit.get('action_recommendation', 'keep')
        safety_score = audit.get('safety_score', 100)
        issues = audit.get('issues_detected') or []

        if risk_level in ('critical', 'high'):
            platform_stats[plat]['critical_risks'] += 1

        if action_rec == 'remove_immediately' or risk_level in ('critical', 'high') or safety_score < 70 or issues:
            caption_preview = (p.get('caption') or 'Untitled Post').strip()[:180]
            reason = audit.get('removal_reason') or ('; '.join(issues) if issues else 'Flagged for brand compliance and consumer claim risk.')
            suggested_rep = audit.get('suggested_revision') or ''
            posts_to_remove.append({
                'post_id': p.get('id', ''),
                'platform': plat,
                'headline_or_preview': caption_preview or 'Post flagged for immediate review',
                'risk_level': risk_level if risk_level in ('critical', 'high', 'medium', 'low') else 'high',
                'reason_to_remove': reason[:480],
                'recommended_action': 'delete_immediately' if risk_level == 'critical' else 'revise_caption',
                'suggested_replacement': suggested_rep[:1400],
            })

    total_posts = len(posts)
    avg_eng = round(sum(eng_rates) / len(eng_rates), 2) if eng_rates else 0.0

    # Best performing platform (by average engagement or views)
    best_plat = 'none'
    best_score = -1.0
    riskiest_plat = 'none'
    max_risks = 0
    for plat, s in platform_stats.items():
        plat_avg = sum(s['eng_rates']) / len(s['eng_rates']) if s['eng_rates'] else 0.0
        score = plat_avg * 10 + (s['views'] / 1000)
        if score > best_score:
            best_score = score
            best_plat = plat
        if s['critical_risks'] > max_risks:
            max_risks = s['critical_risks']
            riskiest_plat = plat

    if best_plat == 'none' and platform_stats:
        best_plat = list(platform_stats.keys())[0]

    cross_platform_overview = {
        'total_analyzed_posts': total_posts,
        'total_views': total_views,
        'total_likes': total_likes,
        'total_comments': total_comments,
        'average_engagement_rate': avg_eng,
        'best_performing_platform': best_plat,
        'platform_with_most_risk': riskiest_plat,
    }

    # Derive winning strategies from top-performing posts
    sorted_posts = sorted(
        posts,
        key=lambda x: (
            float((x.get('metrics') or {}).get('engagement_rate', 0.0) or 0.0),
            int((x.get('metrics') or {}).get('likes', 0) or 0),
            int((x.get('metrics') or {}).get('views', 0) or 0),
        ),
        reverse=True,
    )

    winning_strategies: list[dict[str, Any]] = []
    for top_p in sorted_posts[:3]:
        m = top_p.get('metrics') or {}
        p_views = m.get('views', 0)
        p_likes = m.get('likes', 0)
        p_comments = m.get('comments', 0)
        p_eng = m.get('engagement_rate', 0.0)
        plat = top_p.get('platform', 'all')
        cap = (top_p.get('caption') or '').strip()
        first_line = cap.split('\n')[0][:120] if cap else 'Top-performing content hook'

        if p_likes > 0 or p_views > 0 or p_eng > 0:
            winning_strategies.append({
                'strategy_title': f"{plat.title()} High-Impact Hook: \"{first_line[:50]}...\"",
                'platform': plat,
                'why_it_worked': f"Achieved {p_eng}% engagement rate with {p_views:,} views, {p_likes:,} likes, and {p_comments:,} comments.",
                'metric_signal': f"{p_views:,} views | {p_likes:,} likes | {p_comments:,} comments ({p_eng}%)",
                'action_to_replicate': f"Deploy similar storytelling hooks on {plat.title()} with clear interactive questions to drive comments.",
            })

    return cross_platform_overview, posts_to_remove, winning_strategies


def build_fallback_strategy(
    brand_name: str,
    keywords: list[str],
    audit_summary: dict[str, Any],
    sentiment_ratio: dict[str, int],
    cross_platform_overview: dict[str, Any],
    posts_to_remove: list[dict[str, Any]],
    winning_strategies: list[dict[str, Any]],
) -> dict[str, Any]:
    b_name = brand_name or 'Your Brand'
    kw_str = ', '.join(keywords) if keywords else 'quality products'

    avg_score = audit_summary.get('average_safety_score', 85)
    crit_count = audit_summary.get('critical_count', len(posts_to_remove))

    improvements: list[dict[str, Any]] = []
    if crit_count > 0:
        improvements.append({
            'area': 'Compliance & Deceptive Claims Elimination',
            'issue': f"{crit_count} posts were flagged for exaggerated promises or unsubstantiated guarantees.",
            'actionable_fix': 'Replace absolute guarantees (e.g. 100% cure, instant overnight transformation) with verified customer evidence and lab results.',
            'priority': 'high',
        })
    else:
        improvements.append({
            'area': 'Comment Conversion & Community Discussion',
            'issue': 'Broadcast-style captions miss opportunities for user interaction.',
            'actionable_fix': 'End posts with targeted questions and open prompts to increase algorithmic reach.',
            'priority': 'medium',
        })

    improvements.append({
        'area': 'Cross-Platform Channel Optimization',
        'issue': 'Unified posting without tailoring aspect ratios and hooks to specific platforms.',
        'actionable_fix': 'Use conversational threads on X, carousel infographics on Instagram, and detailed breakdowns on LinkedIn & YouTube.',
        'priority': 'medium',
    })

    rec_posts = [
        {
            'platform': 'instagram',
            'headline': 'Behind The Scenes: Quality & Craftsmanship',
            'content_draft': f"Swipe to see our real development process 👉\n\nNo buzzwords. No exaggerated claims. Just honest ingredients and meticulous design at every step.\n\nSave this post if you value transparency.\n\n#{b_name.replace(' ', '')} #Transparency #Craftsmanship",
            'post_type': 'behind_the_scenes',
            'best_time_to_post': 'Wednesday 7:00 PM - 9:00 PM',
            'strategic_reason': 'Visual proof reinforces credibility and shields against negative sentiment.',
        },
        {
            'platform': 'x',
            'headline': f"Debunking Common Myths in {keywords[0] if keywords else 'our industry'}",
            'content_draft': f"Most brands promise overnight miracles. Here is what actually works:\n\n1. Consistency beats hype.\n2. Genuine transparency wins long-term trust.\n\nAt {b_name}, we share the full testing behind every release.\n\nWhat is the biggest claim you wish companies stopped making?",
            'post_type': 'educational',
            'best_time_to_post': 'Tuesday 12:30 PM & Thursday 6:00 PM',
            'strategic_reason': 'Builds authority and cuts through false marketing noise by being radically honest.',
        },
        {
            'platform': 'linkedin',
            'headline': f"Why {b_name} Stopped Using Superlatives in Marketing",
            'content_draft': f"A quick marketing reflection:\n\nWhen we audited our messaging, we noticed an industry-wide trap: everyone claims to be '#1' or 'the ultimate solution'.\n\nCustomers today are smarter than ever. They want evidence.\n\nHere are 3 metrics we track instead of vanity hype:\n• Customer retention velocity\n• Verifiable product performance\n• Transparent resolution time\n\nHow is your team modernizing its brand voice?",
            'post_type': 'storytelling',
            'best_time_to_post': 'Monday & Wednesday 9:00 AM - 11:00 AM',
            'strategic_reason': 'Positions leadership favorably among B2B partners and discerning buyers.',
        },
        {
            'platform': 'youtube',
            'headline': 'How We Build vs How Others Cut Corners',
            'content_draft': f"In this breakdown, we examine the actual testing protocol behind our products. We discuss:\n- What happens during stress testing\n- Why we refuse to use hype claims\n- The real results our customers experience\n\nSubscribe for honest breakdowns and clear insights.",
            'post_type': 'educational',
            'best_time_to_post': 'Saturday 11:00 AM',
            'strategic_reason': 'Long-form video establishes deep trust and positions the brand as the honest authority.',
        },
    ]

    avoids = [
        {
            'topic_or_phrase': '100% Guaranteed / Overnight Miracle Results',
            'reason': 'Triggers consumer skepticism and legal consumer protection complaints.',
            'alternative_angle': 'Cite specific verified test benchmarks and real customer reviews with context.',
        },
        {
            'topic_or_phrase': 'Direct Aggressive Attacks on Competitors',
            'reason': 'Damages professional brand posture and invites retaliatory claims.',
            'alternative_angle': 'Highlight unique proprietary features and customer love without naming rivals.',
        },
        {
            'topic_or_phrase': 'Artificial Urgency ("Act Now or Miss Forever")',
            'reason': 'Damages premium positioning and causes buyer remorse.',
            'alternative_angle': 'Emphasize value, longevity, and genuine batch availability.',
        },
    ]

    pillars = [
        {'pillar_name': 'Educational & Insightful', 'percentage': 35, 'description': 'Explaining how products work, busting industry myths, and sharing domain knowledge.'},
        {'pillar_name': 'Customer Stories & Proof', 'percentage': 30, 'description': 'Real reviews, before/after case studies, verified testimonials.'},
        {'pillar_name': 'Behind-the-Scenes & Ethics', 'percentage': 20, 'description': 'Team processes, quality checks, materials sourcing.'},
        {'pillar_name': 'Product & Offer Announcements', 'percentage': 15, 'description': 'New launches, updates, transparent pricing.'},
    ]

    hooks = [
        f"The biggest misconception about {keywords[0] if keywords else 'this space'} that costs people money:",
        "Why we chose not to make the claim everyone in our industry makes:",
        f"3 things we learned building {b_name} that changed how we view quality:",
        "Don't buy until you check these 2 critical specs:",
    ]

    if not winning_strategies:
        winning_strategies = [
            {
                'strategy_title': 'Radical Product Honesty & Proof-First Messaging',
                'platform': 'all',
                'why_it_worked': 'Posts highlighting ingredient/spec breakdown without superlatives convert higher intent audiences.',
                'metric_signal': 'Higher comment-to-view ratio and stronger retention.',
                'action_to_replicate': 'Anchor every promotional claim with a specific testing or design fact.',
            }
        ]

    return {
        'brand_health_score': min(100, max(40, int(avg_score))),
        'cross_platform_overview': cross_platform_overview,
        'summary': f"Cross-platform intelligence for {b_name}: {cross_platform_overview['total_analyzed_posts']} posts analyzed across platforms ({cross_platform_overview['total_views']:,} total views, {cross_platform_overview['total_likes']:,} likes). Top performing channel is {cross_platform_overview['best_performing_platform'].title()}. Prioritize transparent proof-first content and immediately resolve flagged deceptive claims.",
        'winning_strategies': winning_strategies,
        'posts_to_remove': posts_to_remove,
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

    # Get posts and calculate cross-platform metrics
    posts = social_store.list_posts(user_id, limit=200)
    audit_summary = social_store.get_audit_summary(user_id)
    mentions = social_store.list_mentions(user_id, limit=40)

    sentiment_counts = {'positive': 0, 'negative': 0, 'neutral': 0}
    for m in mentions:
        s = m.get('sentiment')
        if s in sentiment_counts:
            sentiment_counts[s] += 1

    competitors = social_store.list_competitors(user_id)
    competitor_names = [c['name'] for c in competitors if 'name' in c]

    cross_overview, posts_to_remove, winning_strategies = compute_cross_platform_metrics(posts)

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.info('Gemini API key not configured; using fallback strategy engine')
        return build_fallback_strategy(
            brand_name, keywords, audit_summary, sentiment_counts,
            cross_overview, posts_to_remove, winning_strategies,
        )

    # Prepare real posts summary for Gemini prompt
    posts_context_lines = []
    for idx, p in enumerate(posts[:15], 1):
        m = p.get('metrics') or {}
        ar = p.get('audit_result') or {}
        cap = (p.get('caption') or '').strip().replace('\n', ' ')[:100]
        posts_context_lines.append(
            f"Post #{idx} [ID: {p.get('id')}] [{p.get('platform')}] Views: {m.get('views', 0)} | Likes: {m.get('likes', 0)} | Comments: {m.get('comments', 0)} | EngRate: {m.get('engagement_rate', 0)}% | Risk: {ar.get('risk_level', 'low')} | Action: {ar.get('action_recommendation', 'keep')} | Caption: \"{cap}\""
        )
    posts_context_text = '\n'.join(posts_context_lines) if posts_context_lines else 'No posts connected yet.'

    flagged_context_lines = []
    for p_rem in posts_to_remove:
        flagged_context_lines.append(
            f"- Post ID {p_rem['post_id']} ({p_rem['platform']}): \"{p_rem['headline_or_preview']}\" -> Risk: {p_rem['risk_level']}. Reason: {p_rem['reason_to_remove']}"
        )
    flagged_context_text = '\n'.join(flagged_context_lines) if flagged_context_lines else 'No flagged posts.'

    prompt = f"""You are a world-class Social Media Brand Strategist & Reputation Advisor.
Analyze this brand's real cross-platform social intelligence profile and construct a high-impact marketing strategy:

Brand Name: {brand_name}
Keywords / Products: {', '.join(keywords + product_names) or 'General consumer brand'}
Competitors: {', '.join(competitor_names) or 'None registered'}

CROSS-PLATFORM ENGAGEMENT TOTALS:
- Total Analyzed Posts: {cross_overview['total_analyzed_posts']}
- Total Views across platforms: {cross_overview['total_views']:,}
- Total Likes: {cross_overview['total_likes']:,}
- Total Comments: {cross_overview['total_comments']:,}
- Average Engagement Rate: {cross_overview['average_engagement_rate']}%
- Best Performing Platform: {cross_overview['best_performing_platform']}
- Riskiest Platform: {cross_overview['platform_with_most_risk']}

ACTUAL POSTS AUDITED (REAL DATA):
{posts_context_text}

FLAGGED POSTS WITH COMPLIANCE / CLAIM RISKS:
{flagged_context_text}

TASK:
1. Provide a brand health score (0-100) and an executive cross-platform summary.
2. In 'winning_strategies': Identify top-performing content patterns from the high-engagement posts above (explain why they worked and how to replicate them).
3. In 'posts_to_remove': For every flagged or high-risk post listed above, recommend whether to delete immediately or revise, explain the exact reason why to remove it (e.g. false claim, deceptive promise), and give a concrete compliant suggested replacement caption. Keep the exact post_id.
4. List 2-3 specific improvements in content and communication.
5. List 3 high-risk marketing traps or phrases to avoid.
6. Propose 4 balanced content pillars with percentage breakdown totaling 100%.
7. Provide 4 concrete recommended post drafts across platforms (Instagram, X, LinkedIn, YouTube).
8. Provide 4 high-trust opening hooks.

Return valid JSON adhering to the provided schema.
"""
    configured_model = (settings.GEMINI_MODEL or 'gemini-3.5-flash-lite').strip()
    models_to_try = list(dict.fromkeys([
        configured_model,
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
    ]))

    client = get_genai_client(api_key)
    for model_name in filter(None, models_to_try):
        try:
            def generate():
                return client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type='application/json',
                        response_schema=StrategyRecommendations,
                        temperature=0.3,
                        max_output_tokens=3000,
                    ),
                )

            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(loop.run_in_executor(None, generate), timeout=8.0)
            payload = json.loads(response.text)
            validated = StrategyRecommendations.model_validate(payload)
            res_dict = validated.model_dump()
            # Ensure real cross-platform overview numbers are preserved accurately
            res_dict['cross_platform_overview'] = cross_overview
            # If Gemini returned empty posts_to_remove but we had computed ones, preserve them
            if not res_dict.get('posts_to_remove') and posts_to_remove:
                res_dict['posts_to_remove'] = posts_to_remove
            if not res_dict.get('winning_strategies') and winning_strategies:
                res_dict['winning_strategies'] = winning_strategies
            return res_dict
        except Exception as exc:
            logger.warning('Gemini strategy generation with model %s failed: %s', model_name, exc)
            if '429' in str(exc) or 'quota' in str(exc).lower():
                await asyncio.sleep(1.0)

    logger.warning('All Gemini models failed or timed out for strategy engine. Using heuristic fallback.')
    return build_fallback_strategy(
        brand_name, keywords, audit_summary, sentiment_counts,
        cross_overview, posts_to_remove, winning_strategies,
    )
