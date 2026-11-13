import asyncio
import hashlib
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import HTTPException
from pymongo.errors import ServerSelectionTimeoutError
from cryptography.fernet import Fernet
import httpx

from app.config import settings
from app.database import social_store
from app.services import social_intelligence
from app.services import social_oauth


class SocialIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = f'{self.temp_dir.name}\\social-test.sqlite3'
        self.database_path_patch = patch.object(settings, 'LOCAL_DB_PATH', self.database_path)
        self.database_path_patch.start()
        self.mongo_patch = patch(
            'app.database.social_store.get_db',
            side_effect=ServerSelectionTimeoutError('MongoDB unavailable in isolated test'),
        )
        self.mongo_patch.start()
        self.user_id = str(uuid4())

    def tearDown(self):
        self.mongo_patch.stop()
        self.database_path_patch.stop()
        try:
            self.temp_dir.cleanup()
        except Exception:
            pass

    def _save_config(self):
        return social_store.save_config(
            self.user_id,
            'Northstar',
            ['northstar'],
            ['#northstar'],
            ['Northstar One'],
            True,
        )

    def _create_mention(self, *, sentiment='unanalysed', entity_name='Northstar', published_at=None, topic=''):
        mention = social_store.create_mention(
            self.user_id,
            {
                'entity_name': entity_name,
                'platform': 'manual',
                'author': 'customer',
                'content': f'{sentiment} mention about {topic or "the product"}',
                'source_url': '',
                'source_post_id': None,
                'published_at': (published_at or datetime.now(timezone.utc)).isoformat(),
                'engagement': {'likes': 3, 'comments': 1},
                'collection_source': 'user_submitted',
            },
        )
        if sentiment != 'unanalysed':
            social_store.update_mention_sentiment(
                self.user_id,
                mention['id'],
                sentiment,
                {
                    'sentiment': sentiment,
                    'confidence': 0.9,
                    'explanation': 'A test classification.',
                    'topic': topic or 'Product experience',
                    'customer_signal': 'A test signal.',
                    'keywords': ['product'],
                    'suggested_action': 'Review the feedback.',
                },
            )
            mention['sentiment'] = sentiment
            mention['sentiment_data'] = {
                'sentiment': sentiment,
                'confidence': 0.9,
                'explanation': 'A test classification.',
                'topic': topic or 'Product experience',
                'customer_signal': 'A test signal.',
                'keywords': ['product'],
                'suggested_action': 'Review the feedback.',
            }
        return mention

    def test_monitoring_configuration_and_mentions_are_tenant_scoped(self):
        config = self._save_config()
        self.assertEqual(config['brand_name'], 'Northstar')
        self.assertTrue(config['enabled'])

        self._create_mention()
        self.assertEqual(social_store.count_mentions(self.user_id), 1)
        self.assertEqual(social_store.count_mentions('different-user'), 0)
        self.assertEqual(len(social_store.list_mentions(self.user_id)), 1)
        self.assertEqual(social_store.list_mentions('different-user'), [])

    def test_overview_only_uses_saved_records(self):
        self._save_config()
        self._create_mention(sentiment='positive', topic='Great support')
        self._create_mention(sentiment='negative', topic='Slow shipping')
        self._create_mention()

        result = social_intelligence.build_overview(self.user_id, days=7)
        self.assertEqual(result['overview']['total_mentions'], 3)
        self.assertEqual(result['overview']['positive_mentions'], 1)
        self.assertEqual(result['overview']['negative_mentions'], 1)
        self.assertEqual(result['overview']['unanalysed_mentions'], 1)
        self.assertEqual(result['overview']['total_engagement'], 12)
        self.assertEqual(result['overview']['reputation_score'], 50)
        self.assertIn('only from saved', result['data_note'])

    def test_competitors_and_alerts_persist_and_scope_by_user(self):
        competitor = social_store.save_competitor(self.user_id, 'Acme', ['acme product'])
        self.assertEqual(competitor['name'], 'Acme')
        self.assertEqual(len(social_store.list_competitors(self.user_id)), 1)
        self.assertEqual(social_store.list_competitors('different-user'), [])
        self.assertTrue(social_store.delete_competitor(self.user_id, competitor['id']))
        self.assertFalse(social_store.delete_competitor(self.user_id, competitor['id']))

        alert = social_store.create_alert(
            self.user_id,
            'Test alert',
            'medium',
            'Saved data crossed a test threshold.',
            'manual',
            'Review the records.',
            'test-alert',
        )
        self.assertFalse(alert['read'])
        self.assertEqual(len(social_store.list_alerts(self.user_id, unread_only=True)), 1)
        self.assertEqual(social_store.list_alerts('different-user'), [])
        self.assertTrue(social_store.mark_alert_read(self.user_id, alert['id'], True))
        self.assertEqual(social_store.list_alerts(self.user_id, unread_only=True), [])

    def test_repeated_negative_topics_raise_deduplicated_alert(self):
        first = self._create_mention(sentiment='negative', topic='Billing delays')
        second = self._create_mention(sentiment='negative', topic='Billing delays')
        third = self._create_mention(sentiment='negative', topic='Billing delays')
        analysis = third['sentiment_data']

        social_intelligence.create_recurring_topic_alert(self.user_id, third, analysis)
        social_intelligence.create_recurring_topic_alert(self.user_id, second, analysis)
        alerts = social_store.list_alerts(self.user_id)
        matching = [item for item in alerts if item['title'] == 'Recurring customer concern detected']
        self.assertEqual(len(matching), 1)
        self.assertIn('Billing delays', matching[0]['description'])

    def test_invalid_ai_response_is_rejected(self):
        with self.assertRaises(HTTPException) as invalid:
            social_intelligence._validate_analysis_payload({'sentiment': 'maybe'})
        self.assertEqual(invalid.exception.status_code, 502)

    def test_reply_drafts_must_include_distinct_supported_styles(self):
        valid = {
            'options': [
                {'tone': 'empathetic', 'text': 'We understand.', 'rationale': 'Acknowledges the concern.'},
                {'tone': 'concise', 'text': 'Thanks for sharing.', 'rationale': 'Brief acknowledgment.'},
                {'tone': 'professional', 'text': 'Thank you for the feedback.', 'rationale': 'Formal and clear.'},
            ],
        }
        self.assertEqual(
            {item['tone'] for item in social_intelligence._validate_reply_drafts(valid)['options']},
            {'empathetic', 'concise', 'professional'},
        )
        duplicate_tone = {
            **valid,
            'options': [valid['options'][0], valid['options'][0], valid['options'][2]],
        }
        with self.assertRaises(HTTPException) as invalid:
            social_intelligence._validate_reply_drafts(duplicate_tone)
        self.assertEqual(invalid.exception.status_code, 502)

    def test_missing_gemini_key_returns_configuration_error(self):
        with patch.object(settings, 'GEMINI_API_KEY', ''):
            with self.assertRaises(HTTPException) as missing_key:
                asyncio.run(social_intelligence.analyze_mention_text('Great product'))
        self.assertEqual(missing_key.exception.status_code, 503)
        self.assertIn('GEMINI_API_KEY', missing_key.exception.detail)

    def test_gemini_network_failure_returns_actionable_configuration_error(self):
        client = Mock()
        client.models.generate_content.side_effect = httpx.ConnectError('DNS unavailable')
        with patch.object(settings, 'GEMINI_API_KEY', 'configured-test-key'), \
             patch('app.services.social_intelligence.genai.Client', return_value=client):
            with self.assertRaises(HTTPException) as unavailable:
                asyncio.run(social_intelligence.analyze_mention_text('Northstar is helpful'))
        self.assertEqual(unavailable.exception.status_code, 503)
        self.assertIn('DNS', unavailable.exception.detail)

    def test_volume_alert_thresholds_require_actual_persisted_mentions(self):
        now = datetime.now(timezone.utc)
        self._create_mention(sentiment='negative', published_at=now - timedelta(hours=5))
        self._create_mention(sentiment='negative', published_at=now - timedelta(hours=4))
        self._create_mention(sentiment='negative', published_at=now - timedelta(hours=3))

        social_intelligence.create_monitoring_alerts(self.user_id, 'manual')
        alerts = social_store.list_alerts(self.user_id)
        self.assertTrue(any(item['title'] == 'Negative mentions are increasing' for item in alerts))

    def test_oauth_state_is_single_use_and_x_uses_pkce(self):
        test_config = {
            'client_id': 'x-client',
            'client_secret': 'x-secret',
            'redirect_uri': 'http://localhost:8000/api/social/integrations/x/callback',
        }
        with patch.dict(settings.SOCIAL_PROVIDER_SETTINGS, {'x': test_config}), \
             patch.object(settings, 'SOCIAL_OAUTH_ENCRYPTION_KEY', Fernet.generate_key().decode()):
            url = social_oauth.build_authorization_url('x', self.user_id)

        from urllib.parse import parse_qs, urlsplit

        query = parse_qs(urlsplit(url).query)
        self.assertIn('code_challenge', query)
        self.assertEqual(query['code_challenge_method'], ['S256'])
        state = query['state'][0]
        state_hash = hashlib.sha256(state.encode('utf-8')).hexdigest()
        stored = social_store.consume_oauth_state(state_hash)
        self.assertEqual(stored['user_id'], self.user_id)
        self.assertEqual(stored['platform'], 'x')
        self.assertTrue(stored['state_data']['code_verifier'])
        self.assertIsNone(social_store.consume_oauth_state(state_hash))

    def test_connection_status_never_exposes_tokens_and_flags_expiry(self):
        self._save_config()
        key = Fernet.generate_key()
        social_store.save_social_account(
            self.user_id,
            'youtube',
            'Northstar channel',
            ['youtube.readonly'],
            Fernet(key).encrypt(b'access-token').decode(),
            Fernet(key).encrypt(b'refresh-token').decode(),
            (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        )
        account = social_store.list_social_accounts(self.user_id)[0]
        self.assertEqual(account['status'], 'reauth_required')
        self.assertNotIn('access_token_encrypted', account)
        self.assertNotIn('refresh_token_encrypted', account)


    def test_multi_format_post_auditing_images_videos_text(self):
        from app.services.post_auditor import heuristic_audit

        # 1. Text post audit
        text_audit = heuristic_audit(
            caption="Excited to launch our new product line!",
            brand_name="Northstar",
            platform="x",
            media_type="text",
        )
        self.assertEqual(text_audit['risk_level'], 'safe')
        self.assertEqual(text_audit['media_audit']['media_type'], 'text')
        self.assertEqual(text_audit['media_audit']['visual_compliance'], 'not_applicable')

        # 2. Image post audit with false clinical seal
        image_audit = heuristic_audit(
            caption="Check out our formula with Doctor Approved and 100% Genuine Seal!",
            brand_name="Northstar",
            platform="instagram",
            media_type="image",
            media_url="https://example.com/ad.jpg",
        )
        self.assertIn(image_audit['media_audit']['visual_compliance'], ('warning', 'non_compliant'))
        self.assertEqual(image_audit['media_audit']['media_type'], 'image')
        self.assertTrue(len(image_audit['media_audit']['visual_findings']) > 0)

        # 3. Video / Reel audit with script and sensational hook
        video_audit = heuristic_audit(
            caption="New reel on life hacks!",
            brand_name="Northstar",
            platform="instagram",
            media_type="video",
            video_script="Here is a secret trick they don't want you to know about overnight wealth!",
        )
        self.assertEqual(video_audit['media_audit']['media_type'], 'video')
        self.assertIn(video_audit['media_audit']['visual_compliance'], ('warning', 'non_compliant'))
        self.assertTrue(len(video_audit['media_audit']['video_transcript_analysis']) > 0)


if __name__ == '__main__':
    unittest.main()
