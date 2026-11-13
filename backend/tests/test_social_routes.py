import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from app.config import settings
from app.database import social_store
from app.main import app
from app.security import get_authenticated_user
from app.services import social_intelligence


class SocialRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path_patch = patch.object(
            settings,
            'LOCAL_DB_PATH',
            f'{self.temp_dir.name}\\routes-test.sqlite3',
        )
        self.database_path_patch.start()
        self.mongo_patch = patch(
            'app.database.social_store.get_db',
            side_effect=ServerSelectionTimeoutError('MongoDB unavailable in isolated test'),
        )
        self.mongo_patch.start()
        self.user_id = str(uuid4())
        self.other_user_id = str(uuid4())
        self.auth_override = patch.dict(
            app.dependency_overrides,
            {get_authenticated_user: lambda: {'_id': self.user_id}},
        )
        self.auth_override.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.auth_override.stop()
        self.mongo_patch.stop()
        self.database_path_patch.stop()
        try:
            self.temp_dir.cleanup()
        except Exception:
            pass

    def test_social_endpoints_require_authentication(self):
        with patch.dict(app.dependency_overrides, {}, clear=True):
            response = self.client.get('/api/social/overview')
        self.assertEqual(response.status_code, 401)

    def test_cross_account_access_is_rejected(self):
        response = self.client.get('/api/social/overview', params={'user_id': self.other_user_id})
        self.assertEqual(response.status_code, 403)

    def test_mention_lifecycle_and_validated_sentiment_error(self):
        config_response = self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'hashtags': ['#northstar'],
            'product_names': [],
            'enabled': True,
        })
        self.assertEqual(config_response.status_code, 200)

        invalid_mention = self.client.post('/api/social/mentions', json={
            'user_id': self.user_id,
            'entity_name': 'Northstar',
            'entity_type': 'brand',
            'platform': 'manual',
            'content': 'This message does not contain the configured brand keyword.',
            'published_at': '2026-11-11T00:00:00Z',
        })
        self.assertEqual(invalid_mention.status_code, 422)

        mention_response = self.client.post('/api/social/mentions', json={
            'user_id': self.user_id,
            'entity_name': 'Northstar',
            'entity_type': 'brand',
            'platform': 'manual',
            'author': 'tester',
            'content': 'Northstar support helped me today.',
            'published_at': '2026-11-11T00:00:00Z',
            'engagement': {'likes': 1},
        })
        self.assertEqual(mention_response.status_code, 201)
        mention_id = mention_response.json()['mention']['id']
        self.assertEqual(mention_response.json()['mention']['collection_source'], 'user_submitted')

        with patch.object(settings, 'GEMINI_API_KEY', ''):
            analyze_response = self.client.post(f'/api/social/mentions/{mention_id}/analyze')
        self.assertEqual(analyze_response.status_code, 503)
        self.assertIn('GEMINI_API_KEY', analyze_response.json()['detail'])

        summary = self.client.get('/api/social/overview', params={'user_id': self.user_id})
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()['overview']['total_mentions'], 1)

    def test_overview_metrics_charts_and_date_platform_filters(self):
        self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'enabled': True,
        })
        today = datetime.now(timezone.utc).date()
        published_dates = [
            datetime.combine(today - timedelta(days=2), datetime.min.time(), timezone.utc),
            datetime.combine(today - timedelta(days=5), datetime.min.time(), timezone.utc),
            datetime.combine(today - timedelta(days=20), datetime.min.time(), timezone.utc),
        ]
        mentions = []
        for platform, published_at, content, engagement in [
            ('instagram', published_dates[0], 'Northstar support was excellent.', {'likes': 10, 'comments': 2, 'shares': 1}),
            ('youtube', published_dates[1], 'Northstar delivery was late.', {'likes': 3, 'comments': 1}),
            ('manual', published_dates[2], 'Northstar update is available.', {'likes': 2}),
        ]:
            response = self.client.post('/api/social/mentions', json={
                'user_id': self.user_id,
                'entity_name': 'Northstar',
                'platform': platform,
                'content': content,
                'published_at': published_at.isoformat(),
                'engagement': engagement,
            })
            self.assertEqual(response.status_code, 201, response.text)
            mentions.append(response.json()['mention'])

        analyses = [
            {
                'sentiment': 'positive',
                'confidence': 0.98,
                'explanation': 'The post praises support.',
                'topic': 'Customer support',
                'customer_signal': 'Appreciation for support.',
                'keywords': ['support'],
                'suggested_action': 'Thank the customer.',
            },
            {
                'sentiment': 'negative',
                'confidence': 0.94,
                'explanation': 'The post reports a delivery problem.',
                'topic': 'Delivery',
                'customer_signal': 'Complaint about late delivery.',
                'keywords': ['delivery'],
                'suggested_action': 'Review the delivery issue.',
            },
        ]
        with patch.object(social_intelligence, 'analyze_mention_text', new=AsyncMock(side_effect=analyses)), \
             patch.object(social_intelligence, 'create_monitoring_alerts'):
            for mention in mentions[:2]:
                analyzed = self.client.post(f"/api/social/mentions/{mention['id']}/analyze")
                self.assertEqual(analyzed.status_code, 200, analyzed.text)

        recent = self.client.get('/api/social/overview', params={
            'user_id': self.user_id,
            'days': 7,
        })
        self.assertEqual(recent.status_code, 200, recent.text)
        recent_data = recent.json()
        self.assertEqual(recent_data['overview'], {
            'total_mentions': 2,
            'positive_mentions': 1,
            'negative_mentions': 1,
            'neutral_mentions': 0,
            'unanalysed_mentions': 0,
            'total_engagement': 17,
            'reputation_score': 50,
        })
        self.assertEqual(
            {item['name']: item['value'] for item in recent_data['sentiment_distribution']},
            {'Positive': 1, 'Negative': 1, 'Neutral': 0},
        )
        self.assertEqual(sum(item['mentions'] for item in recent_data['mention_trend']), 2)
        self.assertEqual({item['platform']: item['mentions'] for item in recent_data['platform_mentions']}, {
            'Instagram': 1,
            'YouTube': 1,
        })
        self.assertEqual(len(recent_data['recent_mentions']), 2)
        self.assertEqual({item['topic'] for item in recent_data['insights']}, {'Customer support', 'Delivery'})

        filtered = self.client.get('/api/social/overview', params={
            'user_id': self.user_id,
            'days': 30,
            'platform': 'youtube',
        })
        self.assertEqual(filtered.status_code, 200, filtered.text)
        self.assertEqual(filtered.json()['overview']['total_mentions'], 1)
        self.assertEqual(filtered.json()['overview']['negative_mentions'], 1)

        custom = self.client.get('/api/social/overview', params={
            'user_id': self.user_id,
            'start_date': (today - timedelta(days=3)).isoformat(),
            'end_date': today.isoformat(),
        })
        self.assertEqual(custom.status_code, 200, custom.text)
        self.assertEqual(custom.json()['overview']['total_mentions'], 1)
        self.assertEqual(custom.json()['start_date'], (today - timedelta(days=3)).isoformat())
        self.assertEqual(custom.json()['end_date'], today.isoformat())

    def test_overview_separates_brand_metrics_from_competitor_comparison(self):
        self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'enabled': True,
        })
        competitor = self.client.post('/api/social/competitors', json={
            'user_id': self.user_id,
            'name': 'Acme',
            'keywords': ['Acme'],
        })
        self.assertEqual(competitor.status_code, 201, competitor.text)
        published_at = datetime.now(timezone.utc).isoformat()
        for entity_type, entity_name, content, engagement in [
            ('brand', 'Northstar', 'Northstar customers are happy.', {'likes': 10}),
            ('competitor', 'Acme', 'Acme launched a new product.', {'likes': 90}),
        ]:
            response = self.client.post('/api/social/mentions', json={
                'user_id': self.user_id,
                'entity_name': entity_name,
                'entity_type': entity_type,
                'platform': 'manual',
                'content': content,
                'published_at': published_at,
                'engagement': engagement,
            })
            self.assertEqual(response.status_code, 201, response.text)
            self.assertEqual(response.json()['mention']['entity_type'], entity_type)

        overview = self.client.get('/api/social/overview', params={
            'user_id': self.user_id,
            'days': 7,
        })
        self.assertEqual(overview.status_code, 200, overview.text)
        data = overview.json()
        self.assertEqual(data['overview']['total_mentions'], 1)
        self.assertEqual(data['overview']['total_engagement'], 10)
        self.assertEqual(
            {item['name']: item['mentions'] for item in data['competitor_comparison']},
            {'Northstar': 1, 'Acme': 1},
        )

    def test_overview_includes_all_matching_mentions_without_page_limit(self):
        self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'enabled': True,
        })
        today = datetime.now(timezone.utc).date().isoformat()
        timestamp = f'{today}T12:00:00+00:00'
        with social_store.local_store._connect() as connection:
            connection.executemany(
                '''INSERT INTO social_mentions
                   (id, user_id, entity_name, entity_type, platform, author, content, source_url,
                    source_post_id, published_at, sentiment, sentiment_data, engagement,
                    collection_source, created_at)
                   VALUES (?, ?, 'Northstar', 'brand', 'manual', '', 'Northstar mention', '', NULL,
                           ?, 'unanalysed', '{}', '{}', 'user_submitted', ?)''',
                [
                    (f'mention-{index}', self.user_id, timestamp, timestamp)
                    for index in range(1001)
                ],
            )

        overview = self.client.get('/api/social/overview', params={
            'user_id': self.user_id,
            'days': 7,
        })
        self.assertEqual(overview.status_code, 200, overview.text)
        self.assertEqual(overview.json()['overview']['total_mentions'], 1001)

    def test_reply_drafts_are_persisted_and_never_published(self):
        self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'enabled': True,
        })
        created = self.client.post('/api/social/mentions', json={
            'user_id': self.user_id,
            'entity_name': 'Northstar',
            'platform': 'manual',
            'content': 'Northstar package arrived late.',
            'published_at': '2026-11-11T00:00:00Z',
        })
        mention_id = created.json()['mention']['id']
        draft_options = {
            'options': [
                {'tone': 'empathetic', 'text': 'We are sorry about the delay.', 'rationale': 'Acknowledges impact.'},
                {'tone': 'concise', 'text': 'Sorry for the delay.', 'rationale': 'Short acknowledgment.'},
                {'tone': 'professional', 'text': 'Thank you for letting us know.', 'rationale': 'Professional tone.'},
            ],
        }

        with patch(
            'app.routes.social.social_intelligence.generate_reply_drafts',
            new=AsyncMock(return_value=draft_options),
        ):
            response = self.client.post(f'/api/social/mentions/{mention_id}/reply-drafts')

        self.assertEqual(response.status_code, 201, response.text)
        self.assertFalse(response.json()['publishing_enabled'])
        self.assertEqual(len(response.json()['draft_set']['drafts']), 3)
        history = self.client.get(f'/api/social/mentions/{mention_id}/reply-drafts')
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.json()['draft_sets']), 1)
        self.assertFalse(history.json()['publishing_enabled'])
        cross_user = self.client.get(
            f'/api/social/mentions/{mention_id}/reply-drafts',
            params={'user_id': self.other_user_id},
        )
        self.assertEqual(cross_user.status_code, 403)

    def test_invalid_platform_and_source_url_are_rejected(self):
        response = self.client.get('/api/social/overview', params={'platform': 'unknown'})
        self.assertEqual(response.status_code, 422)

        self.client.put('/api/social/config', json={
            'user_id': self.user_id,
            'brand_name': 'Northstar',
            'keywords': ['Northstar'],
            'enabled': True,
        })
        bad_url = self.client.post('/api/social/mentions', json={
            'user_id': self.user_id,
            'entity_name': 'Northstar',
            'platform': 'manual',
            'content': 'Northstar message',
            'source_url': 'javascript:alert(1)',
            'published_at': '2026-11-11T00:00:00Z',
        })
        self.assertEqual(bad_url.status_code, 422)


if __name__ == '__main__':
    unittest.main()
