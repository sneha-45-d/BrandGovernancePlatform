import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

from app.config import settings
from app.services.social_platforms.public_post import _post_identity, fetch_public_post


class PublicPostFetchTests(unittest.TestCase):
    user_id = str(uuid4())
    config = {'brand_name': 'Northstar'}

    def test_extracts_supported_youtube_and_x_ids(self):
        self.assertEqual(_post_identity('https://youtu.be/abcdefghijk'), ('youtube', 'abcdefghijk'))
        self.assertEqual(
            _post_identity('https://www.youtube.com/shorts/abcdefghijk?feature=share'),
            ('youtube', 'abcdefghijk'),
        )
        self.assertEqual(
            _post_identity('https://x.com/brand/status/1234567890'),
            ('x', '1234567890'),
        )

    def test_rejects_non_https_and_unsupported_social_public_urls_clearly(self):
        with self.assertRaises(HTTPException) as insecure:
            _post_identity('http://youtu.be/abcdefghijk')
        self.assertEqual(insecure.exception.status_code, 422)

        with self.assertRaises(HTTPException) as instagram:
            _post_identity('https://www.instagram.com/p/ABC123/')
        self.assertEqual(instagram.exception.status_code, 501)
        self.assertIn('No page scraping or user login', instagram.exception.detail)

    def test_fetch_saves_youtube_post_as_public_api_data_without_user_oauth(self):
        record = {}

        def fake_get(_url, params, **_kwargs):
            self.assertEqual(params['id'], 'abcdefghijk')
            self.assertEqual(params['key'], 'server-side-test-key')

            class Response:
                status_code = 200

                @staticmethod
                def json():
                    return {'items': [{
                        'id': 'abcdefghijk',
                        'snippet': {
                            'title': 'Northstar public update',
                            'description': 'Public description',
                            'channelTitle': 'Northstar Channel',
                            'publishedAt': '2026-11-11T12:00:00Z',
                        },
                        'statistics': {'viewCount': '20', 'likeCount': '3'},
                    }]}
            return Response()

        def save_mention(user_id, payload):
            record.update(payload)
            return {'id': 'mention-1', **payload}

        with patch.object(settings, 'YOUTUBE_API_KEY', 'server-side-test-key'), \
             patch('app.services.social_platforms.public_post.httpx.get', side_effect=fake_get), \
             patch('app.services.social_platforms.public_post.social_store.create_mention', side_effect=save_mention):
            result = fetch_public_post(self.user_id, 'https://youtube.com/watch?v=abcdefghijk', self.config)

        self.assertEqual(result['mention']['id'], 'mention-1')
        self.assertEqual(record['collection_source'], 'public_api')
        self.assertEqual(record['platform'], 'youtube')
        self.assertEqual(record['engagement'], {'views': 20, 'likes': 3})
        self.assertIn('no account login', result['collection_scope'])

    def test_youtube_fetch_reports_missing_server_side_api_key(self):
        with patch.object(settings, 'YOUTUBE_API_KEY', ''):
            with self.assertRaises(HTTPException) as missing_key:
                fetch_public_post(self.user_id, 'https://youtu.be/abcdefghijk', self.config)
        self.assertEqual(missing_key.exception.status_code, 503)
        self.assertIn('YOUTUBE_API_KEY', missing_key.exception.detail)

    def test_fetch_saves_x_post_using_app_bearer_credential(self):
        record = {}

        def fake_get(_client, platform, url, access_token, params=None, **_kwargs):
            self.assertEqual(platform, 'x')
            self.assertTrue(url.endswith('/tweets/1234567890'))
            self.assertEqual(access_token, 'server-side-test-bearer')
            self.assertIn('public_metrics', params['tweet.fields'])
            return {
                'data': {
                    'id': '1234567890',
                    'text': 'Northstar public update',
                    'created_at': '2026-11-11T12:00:00Z',
                    'author_id': 'author-1',
                    'public_metrics': {'like_count': 4},
                },
                'includes': {'users': [{'id': 'author-1', 'username': 'northstar'}]},
            }

        def save_mention(user_id, payload):
            record.update(payload)
            return {'id': 'mention-2', **payload}

        with patch.object(settings, 'X_BEARER_TOKEN', 'server-side-test-bearer'), \
             patch('app.services.social_platforms.public_post.provider_get', side_effect=fake_get), \
             patch('app.services.social_platforms.public_post.social_store.create_mention', side_effect=save_mention):
            result = fetch_public_post(self.user_id, 'https://x.com/northstar/status/1234567890', self.config)

        self.assertEqual(result['mention']['id'], 'mention-2')
        self.assertEqual(record['collection_source'], 'public_api')
        self.assertEqual(record['author'], '@northstar')
        self.assertEqual(record['engagement'], {'likes': 4})

    def test_x_fetch_reports_missing_server_side_api_credential(self):
        with patch.object(settings, 'X_BEARER_TOKEN', ''):
            with self.assertRaises(HTTPException) as missing_token:
                fetch_public_post(self.user_id, 'https://x.com/brand/status/1234567890', self.config)
        self.assertEqual(missing_token.exception.status_code, 503)
        self.assertIn('X_BEARER_TOKEN', missing_token.exception.detail)

    def test_fetch_requires_a_configured_brand_name(self):
        with self.assertRaises(HTTPException) as no_brand:
            fetch_public_post(self.user_id, 'https://youtu.be/abcdefghijk', None)
        self.assertEqual(no_brand.exception.status_code, 422)


if __name__ == '__main__':
    unittest.main()
