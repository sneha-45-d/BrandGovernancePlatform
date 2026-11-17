import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.database import local_store
from app.database.mongo import get_db, is_mongo_available

logger = logging.getLogger(__name__)

DEMO_USER_ID = 'user_demo_evaluator'
DEMO_EMAIL = 'demo@brandithm.com'
DEMO_NAME = 'Evaluator Demo Account'
DEMO_PASSWORD = 'DemoEvaluator2026!'

# Pre-computed PBKDF2 hash for DemoEvaluator2026!
DEMO_PASSWORD_HASH = '1f84b63a92c81d3f0a4b7e9c2d5f8a1b:5b8cf0f214dbac9872e411b9534579cbb62e602758efc5ef0c09d5be3364f331'


def provision_demo_account() -> dict:
    """Ensure the demo evaluator account exists with rich, multi-difficulty test data."""
    now = datetime.now(timezone.utc).isoformat()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # 1. Local SQLite provisioning
    with local_store._connect() as conn:
        # Check or create user
        user_row = conn.execute('SELECT id, full_name, email FROM users WHERE email = ?', (DEMO_EMAIL,)).fetchone()
        if not user_row:
            conn.execute(
                '''INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at, champion_score, streak_days, total_submissions)
                   VALUES (?, ?, ?, ?, ?, ?, 850, 14, 18)''',
                (DEMO_USER_ID, DEMO_NAME, DEMO_EMAIL, DEMO_PASSWORD_HASH, now, now),
            )
            actual_user_id = DEMO_USER_ID
        else:
            actual_user_id = user_row['id']

        # 2. Brand Guidelines (BRANDITHM)
        guidelines_payload = {
            'brand_name': 'BRANDITHM',
            'mission': 'To empower creators and marketing teams with autonomous AI brand governance and compliance.',
            'core_values': ['Clarity', 'Integrity', 'Innovation', 'Authenticity', 'Security'],
            'tone_attributes': ['Confident', 'Clear', 'Trustworthy', 'Modern', 'Professional'],
            'target_audience': 'Enterprise CMOs, brand managers, marketing directors, compliance officers',
            'prohibited_terms': ['miracle', '100% cure', 'guaranteed overnight', 'instant wealth', 'foolproof', 'scam', 'hate'],
            'mandatory_hashtags': ['#Brandithm', '#BrandGovernance', '#BrandTrust'],
            'compliance_rules': [
                'All promotional claims must cite verifiable metrics or clinical testing.',
                'Never guarantee zero-risk or absolute cure in financial or health contexts.',
                'Mandatory #ad or sponsored disclosures on influencer content.',
            ],
        }
        conn.execute(
            '''INSERT OR REPLACE INTO brand_guidelines (user_id, brand_name, payload, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)''',
            (actual_user_id, 'BRANDITHM', json.dumps(guidelines_payload), now, now),
        )

        # 3. Visual Guidelines
        visual_colors = json.dumps(['#10b981', '#047857', '#0f172a', '#f8fafc', '#3b82f6'])
        aspect_ratios = json.dumps(['1:1', '16:9', '9:16', '4:5'])
        conn.execute(
            '''INSERT OR REPLACE INTO visual_guidelines (user_id, approved_colors, color_tolerance, aspect_ratios, min_width_px, max_width_px, min_height_px, max_height_px, updated_at)
               VALUES (?, ?, 30, ?, 600, 4000, 600, 4000, ?)''',
            (actual_user_id, visual_colors, aspect_ratios, now),
        )

        # 4. Content Analyses across 3 Difficulty Levels
        # Level 1: Easy / Safe (Score: 96)
        conn.execute(
            '''INSERT OR REPLACE INTO content_analyses
               (id, user_id, brand_name, content_title, content, guidelines, analysis, status, review_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                'analysis_demo_lvl1_safe',
                actual_user_id,
                'BRANDITHM',
                'Enterprise Platform Launch Brief (Level 1: Easy / Compliant)',
                'We are proud to introduce BRANDITHM 2.0. Built for modern marketing organizations, our platform automates brand guidelines compliance and content verification across every channel with total precision.',
                json.dumps(guidelines_payload),
                json.dumps({
                    'score': 96,
                    'overall_score': 96,
                    'brand_compliance_score': 96,
                    'summary': 'Flawless alignment with brand voice. Confident, transparent, and authoritative.',
                    'strengths': ['Clear value proposition', 'Brand-aligned vocabulary', 'No exaggerated claims'],
                    'violations': [],
                    'suggested_rewrite': '',
                }),
                'approved',
                'approved',
                yesterday,
            ),
        )

        # Level 2: Medium / Warning (Score: 68)
        conn.execute(
            '''INSERT OR REPLACE INTO content_analyses
               (id, user_id, brand_name, content_title, content, guidelines, analysis, status, review_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                'analysis_demo_lvl2_warning',
                actual_user_id,
                'BRANDITHM',
                'Promotional Urgency Campaign (Level 2: Medium / Needs Review)',
                'HURRY! Transform your marketing overnight with the #1 AI engine in the world. Don\'t let slow competitors steal your customers—upgrade right now before this secret offer expires!',
                json.dumps(guidelines_payload),
                json.dumps({
                    'score': 68,
                    'overall_score': 68,
                    'brand_compliance_score': 68,
                    'summary': 'Elevated brand risk. Uses urgent clickbait phrasing and unsubstantiated superiority claim (#1 AI engine in the world).',
                    'strengths': ['Direct call to action'],
                    'violations': [
                        {
                            'severity': 'medium',
                            'rule': 'Tone Standards',
                            'flagged_text': 'Transform your marketing overnight',
                            'explanation': 'Avoid exaggerated overnight transformation claims.',
                        },
                        {
                            'severity': 'medium',
                            'rule': 'Unsubstantiated Claim',
                            'flagged_text': '#1 AI engine in the world',
                            'explanation': 'Unverified comparative superiority claim.',
                        },
                    ],
                    'suggested_rewrite': 'Accelerate your marketing workflow with BRANDITHM AI. Modernize your governance today with enterprise-grade consistency.',
                }),
                'needs_review',
                'needs_review',
                three_days_ago,
            ),
        )

        # Level 3: Hard / Critical Risk (Score: 28)
        conn.execute(
            '''INSERT OR REPLACE INTO content_analyses
               (id, user_id, brand_name, content_title, content, guidelines, analysis, status, review_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                'analysis_demo_lvl3_critical',
                actual_user_id,
                'BRANDITHM',
                'High-Risk Miracle Cure Claim (Level 3: Hard / Rejected)',
                '100% GUARANTEED instant ROI and completely cure all compliance risks overnight with ZERO risk! Top doctors and federal regulators clinically certify our secret formula. Buy now or you are foolish!',
                json.dumps(guidelines_payload),
                json.dumps({
                    'score': 28,
                    'overall_score': 28,
                    'brand_compliance_score': 28,
                    'summary': 'Severe violations: Prohibited absolute guarantee ("100% GUARANTEED"), zero-risk claim ("ZERO risk"), fabricated clinical certification, and hostile customer insult.',
                    'strengths': [],
                    'violations': [
                        {
                            'severity': 'critical',
                            'rule': 'Prohibited Absolute Guarantee',
                            'flagged_text': '100% GUARANTEED instant ROI',
                            'explanation': 'Absolute financial guarantees violate FTC marketing guidelines.',
                        },
                        {
                            'severity': 'critical',
                            'rule': 'False Endorsement',
                            'flagged_text': 'Top doctors and federal regulators clinically certify',
                            'explanation': 'Unsubstantiated clinical/regulatory certification claim creates direct legal liability.',
                        },
                        {
                            'severity': 'high',
                            'rule': 'Hostile Language',
                            'flagged_text': 'Buy now or you are foolish',
                            'explanation': 'Derogatory language degrades brand equity.',
                        },
                    ],
                    'suggested_rewrite': 'Achieve measurable marketing governance with verifiable consistency checks. Request an enterprise demo to see tested results.',
                }),
                'rejected',
                'rejected',
                week_ago,
            ),
        )

        # 5. Social Monitoring Config
        conn.execute(
            '''INSERT OR REPLACE INTO social_monitoring_config
               (user_id, brand_name, keywords, hashtags, product_names, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?)''',
            (
                actual_user_id,
                'BRANDITHM',
                json.dumps(['brandithm', 'governance', 'compliance', 'brand safety']),
                json.dumps(['#brandithm', '#brandgovernance', '#brandai']),
                json.dumps(['Brandithm Core', 'Brandithm Studio', 'VisualGuard']),
                now,
                now,
            ),
        )

        # 6. Social Accounts
        conn.execute(
            '''INSERT OR REPLACE INTO social_accounts
               (user_id, platform, account_name, status, scopes, access_token_encrypted, updated_at)
               VALUES (?, 'instagram', '@brandithm_official', 'connected', '["read","posts","analytics"]', 'direct_demo_token', ?)''',
            (actual_user_id, now),
        )
        conn.execute(
            '''INSERT OR REPLACE INTO social_accounts
               (user_id, platform, account_name, status, scopes, access_token_encrypted, updated_at)
               VALUES (?, 'x', '@brandithm_ai', 'connected', '["read","posts","analytics"]', 'direct_demo_token', ?)''',
            (actual_user_id, now),
        )

        # 7. Social Posts (Multi-format: Text, Image, Video)
        # Post A: Text Post (Safe)
        conn.execute(
            '''INSERT OR REPLACE INTO social_posts
               (id, user_id, platform, external_id, caption, media_url, media_type, permalink, published_at, metrics, audit_status, audit_result, created_at, updated_at)
               VALUES (?, ?, 'x', 'demo_post_x_1', ?, '', 'text', 'https://x.com/brandithm_ai/status/101', ?, ?, 'audited', ?, ?, ?)''',
            (
                'post_demo_x_compliant',
                actual_user_id,
                'Brand trust takes years to build and seconds to break. Automated continuous post governance helps forward-thinking teams protect reputation before publishing. #BrandGovernance',
                yesterday,
                json.dumps({'views': 14200, 'likes': 840, 'comments': 92, 'shares': 118, 'engagement_rate': 8.2}),
                json.dumps({
                    'safety_score': 95,
                    'risk_level': 'safe',
                    'is_harmful': False,
                    'action_recommendation': 'keep',
                    'removal_reason': '',
                    'summary': 'Clean, authoritative, and perfectly aligned with enterprise brand safety standards.',
                    'violations': [],
                    'positive_aspects': ['Thought leadership hook', 'Professional vocabulary', 'Brand-aligned hashtags'],
                    'reputation_impact': 'Strengthens authority and industry standing.',
                    'suggested_revision': '',
                    'engagement_assessment': 'High engagement (8.2%) with authentic audience sentiment.',
                    'media_audit': {
                        'media_type': 'text',
                        'visual_compliance': 'not_applicable',
                        'visual_findings': [],
                        'ocr_text_detected': '',
                        'video_transcript_analysis': '',
                        'brand_visual_score': 100,
                    },
                }),
                now,
                now,
            ),
        )

        # Post B: Image Post (Compliant Visual)
        conn.execute(
            '''INSERT OR REPLACE INTO social_posts
               (id, user_id, platform, external_id, caption, media_url, media_type, permalink, published_at, metrics, audit_status, audit_result, created_at, updated_at)
               VALUES (?, ?, 'instagram', 'demo_post_ig_2', ?, 'https://images.unsplash.com/photo-1551836022-d5d88e9218df', 'image', 'https://instagram.com/p/demo_ig_2', ?, ?, 'audited', ?, ?, ?)''',
            (
                'post_demo_ig_visual_safe',
                actual_user_id,
                'Consistency across every touchpoint. Discover how automated visual compliance protects your identity in 2026. #Brandithm #VisualBranding',
                three_days_ago,
                json.dumps({'views': 8600, 'likes': 620, 'comments': 45, 'shares': 38, 'engagement_rate': 9.1}),
                json.dumps({
                    'safety_score': 92,
                    'risk_level': 'safe',
                    'is_harmful': False,
                    'action_recommendation': 'keep',
                    'removal_reason': '',
                    'summary': 'Approved visual creative. High brand aesthetic score and verified typography.',
                    'violations': [],
                    'positive_aspects': ['Clear visual layout', 'Approved color contrast', 'Credible messaging'],
                    'reputation_impact': 'Reinforces premium brand identity.',
                    'suggested_revision': '',
                    'engagement_assessment': 'Strong likes and positive community remarks.',
                    'media_audit': {
                        'media_type': 'image',
                        'visual_compliance': 'compliant',
                        'visual_findings': ['Visual creative layout is clear and avoids deceptive graphic badges.', 'Color palette strictly matches approved guidelines.'],
                        'ocr_text_detected': 'CONSISTENCY ACROSS EVERY TOUCHPOINT - BRANDITHM 2026',
                        'video_transcript_analysis': '',
                        'brand_visual_score': 94,
                    },
                }),
                now,
                now,
            ),
        )

        # Post C: Video / Reel Post (Medium Warning - Hook Analysis)
        conn.execute(
            '''INSERT OR REPLACE INTO social_posts
               (id, user_id, platform, external_id, caption, media_url, media_type, permalink, published_at, metrics, audit_status, audit_result, created_at, updated_at)
               VALUES (?, ?, 'instagram', 'demo_post_reel_3', ?, 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d', 'video', 'https://instagram.com/reel/demo_reel_3', ?, ?, 'audited', ?, ?, ?)''',
            (
                'post_demo_reel_hook_warning',
                actual_user_id,
                'The secret marketing strategy CMOs don\'t want you to know about! Watch till the end to see how to 10x your brand trust overnight. #MarketingHacks #BrandAI',
                week_ago,
                json.dumps({'views': 32400, 'likes': 1950, 'comments': 280, 'shares': 310, 'engagement_rate': 7.8}),
                json.dumps({
                    'safety_score': 62,
                    'risk_level': 'medium',
                    'is_harmful': True,
                    'action_recommendation': 'revise',
                    'removal_reason': 'Video hook uses curiosity bait ("secret strategy CMOs don\'t want you to know") and exaggerated overnight promise ("10x brand trust overnight").',
                    'summary': 'Elevated risk detected in video hook and dialogue script. Revising the spoken hook will preserve high views while protecting brand credibility.',
                    'violations': [
                        {
                            'category': 'false_marketing',
                            'severity': 'medium',
                            'description': 'Exaggerated overnight growth claim in spoken video hook.',
                            'flagged_text': '10x your brand trust overnight',
                            'fix_recommendation': 'Replace sensational loops with verifiable workflow improvements.',
                        },
                    ],
                    'positive_aspects': ['High view velocity', 'Engaging motion pacing'],
                    'reputation_impact': 'May trigger skepticism from enterprise buyers if left unaddressed.',
                    'suggested_revision': 'The essential marketing strategy top CMOs prioritize in 2026: Discover how continuous governance strengthens customer trust over time.',
                    'engagement_assessment': 'High reach with notable comment debate regarding claim realism.',
                    'media_audit': {
                        'media_type': 'video',
                        'visual_compliance': 'warning',
                        'visual_findings': ['Video hook utilizes clickbait or exaggerated curiosity loops.', 'Fast-paced text overlays detected.'],
                        'ocr_text_detected': 'THE SECRET STRATEGY THEY HIDE FROM YOU',
                        'video_transcript_analysis': 'Spoken dialogue opens with aggressive cliffhanger. Audio narrative shifts to informative demo after 5 seconds.',
                        'brand_visual_score': 74,
                    },
                }),
                now,
                now,
            ),
        )

        # 8. Competitors
        conn.execute(
            '''INSERT OR REPLACE INTO competitors (id, user_id, name, slogans, keywords, created_at)
               VALUES (?, ?, 'LegacyGuard', 'Old School Brand Defense', 'legacy, slow, manual audit', ?)''',
            ('comp_demo_1', actual_user_id, now),
        )

        # 9. Social Mentions (for charts and sentiment velocity)
        mentions_data = [
            ('mention_1', 'BRANDITHM', 'brand', 'x', 'sarah_marketing', 'The automated guideline check from @brandithm_ai just saved our team 4 hours of review today! Truly impressed.', 'positive', 0.94),
            ('mention_2', 'BRANDITHM', 'brand', 'linkedin', 'alex_director', 'Deploying BRANDITHM across our 50-person creative agency. Consistency has gone up dramatically.', 'positive', 0.91),
            ('mention_3', 'BRANDITHM', 'brand', 'x', 'tech_analyst_dan', 'Testing new AI governance tools. BRANDITHM seems fast, but curious how it handles multilingual OCR.', 'neutral', 0.72),
            ('mention_4', 'BRANDITHM', 'brand', 'instagram', 'design_lead_rachel', 'Really liking the visual color checking interface. Super clean UI.', 'positive', 0.89),
            ('mention_5', 'BRANDITHM', 'brand', 'x', 'growth_marketer_99', 'Our team had a small false positive on a satirical hashtag last week, but support resolved it quickly.', 'neutral', 0.65),
        ]
        for m_id, entity, e_type, plat, author, content, sentiment, conf in mentions_data:
            conn.execute(
                '''INSERT OR REPLACE INTO social_mentions
                   (id, user_id, entity_name, entity_type, platform, author, content, source_url, source_post_id, published_at, engagement, sentiment, sentiment_data, collection_source, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 'user_submitted', ?)''',
                (
                    m_id,
                    actual_user_id,
                    entity,
                    e_type,
                    plat,
                    author,
                    content,
                    f'ext_{m_id}',
                    yesterday,
                    json.dumps({'likes': 14, 'comments': 3}),
                    sentiment,
                    json.dumps({'sentiment': sentiment, 'confidence': conf, 'topic': 'Product Experience'}),
                    now,
                ),
            )

    return {
        'id': actual_user_id,
        'email': DEMO_EMAIL,
        'full_name': DEMO_NAME,
    }
