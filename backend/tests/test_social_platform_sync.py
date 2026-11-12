import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.config import settings
from app.services.social_platforms.common import get_access_token
from app.services.social_platforms.linkedin import sync_linkedin_mentions
from app.services.social_platforms.meta import sync_meta_mentions
from app.services.social_platforms.x import sync_x_mentions


class SocialPlatformSyncTests(unittest.TestCase):
    user_id = str(uuid4())
    config = {
        'enabled': True,
        'brand_name': 'Northstar',
        'keywords': ['Northstar'],
        'hashtags': [],
        'product_names': [],
    }

    def test_instagram_sync_reads_authorized_media_and_matching_comments(self):
        records = []

        def fake_get(_client, platform, url, _token, _params=None, **_kwargs):
            self.assertEqual(platform, 'instagram')
            if url.endswith('/me/accounts'):
                return {'data': [{
                    'name': 'Northstar Page',
                    'access_token': 'page-token',
                    'instagram_business_account': {'id': 'ig-1', 'username': 'northstar'},
                }]}
            if url.endswith('/ig-1/media'):
                return {'data': [{
                    'id': 'media-1',
                    'caption': 'Northstar launch',
                    'timestamp': '2026-11-11T12:00:00Z',
                    'permalink': 'https://www.instagram.com/p/media-1/',
                    'like_count': 4,
                    'comments_count': 1,
                }]}
            if url.endswith('/media-1/comments'):
                return {'data': [{
                    'id': 'comment-1',
                    'text': 'Northstar product looks great.',
                    'username': 'customer',
                    'timestamp': '2026-11-11T13:00:00Z',
                    'like_count': 2,
                }]}
            self.fail(f'Unexpected Meta endpoint: {url}')

        with patch('app.services.social_platforms.meta.get_access_token', return_value=('user-token', {'account_name': 'User'})), \
             patch('app.services.social_platforms.meta.provider_get', side_effect=fake_get), \
             patch('app.services.social_platforms.common.social_store.create_mention', side_effect=lambda _user, record: records.append(record)), \
             patch('app.services.social_platforms.meta.create_alerts_if_needed') as alerts:
            result = sync_meta_mentions(self.user_id, self.config, 'instagram')

        self.assertEqual(result['mentions_added'], 2)
        self.assertEqual([record['source_post_id'] for record in records], ['post:media-1', 'comment:comment-1'])
        self.assertTrue(all(record['collection_source'] == 'authorized_api' for record in records))
        alerts.assert_called_once_with(self.user_id, 'instagram', 2)

    def test_facebook_sync_reads_page_posts_and_matching_comments(self):
        records = []

        def fake_get(_client, platform, url, _token, _params=None, **_kwargs):
            self.assertEqual(platform, 'facebook')
            if url.endswith('/me/accounts'):
                return {'data': [{'id': 'page-1', 'name': 'Northstar', 'access_token': 'page-token'}]}
            if url.endswith('/page-1/feed'):
                return {'data': [{
                    'id': 'page-1_post-1',
                    'message': 'Northstar update',
                    'created_time': '2026-11-11T12:00:00Z',
                    'permalink_url': 'https://facebook.com/page-1_post-1',
                }]}
            if url.endswith('/page-1_post-1/comments'):
                return {'data': [{
                    'id': 'comment-2',
                    'message': 'Northstar support helped.',
                    'created_time': '2026-11-11T13:00:00Z',
                    'from': {'name': 'Customer'},
                }]}
            self.fail(f'Unexpected Meta endpoint: {url}')

        with patch('app.services.social_platforms.meta.get_access_token', return_value=('user-token', {'account_name': 'User'})), \
             patch('app.services.social_platforms.meta.provider_get', side_effect=fake_get), \
             patch('app.services.social_platforms.common.social_store.create_mention', side_effect=lambda _user, record: records.append(record)), \
             patch('app.services.social_platforms.meta.create_alerts_if_needed'):
            result = sync_meta_mentions(self.user_id, self.config, 'facebook')

        self.assertEqual(result['mentions_added'], 2)
        self.assertEqual([record['platform'] for record in records], ['facebook', 'facebook'])

    def test_x_sync_collects_matching_posts_and_account_mentions(self):
        records = []

        def fake_get(_client, _platform, url, _token, _params=None, **_kwargs):
            if url.endswith('/users/me'):
                return {'data': {'id': 'x-user-1', 'username': 'northstar'}}
            if url.endswith('/users/x-user-1/tweets'):
                return {'data': [{
                    'id': 'post-1',
                    'text': 'Northstar launches today',
                    'author_id': 'x-user-1',
                    'created_at': '2026-11-11T12:00:00Z',
                    'public_metrics': {'like_count': 3},
                }]}
            if url.endswith('/users/x-user-1/mentions'):
                return {'data': [{
                    'id': 'post-2',
                    'text': 'Northstar delivery review',
                    'author_id': 'other-user',
                    'created_at': '2026-11-11T13:00:00Z',
                }]}
            self.fail(f'Unexpected X endpoint: {url}')

        with patch('app.services.social_platforms.x.get_access_token', return_value=('token', {'account_name': '@northstar'})), \
             patch('app.services.social_platforms.x.provider_get', side_effect=fake_get), \
             patch('app.services.social_platforms.common.social_store.create_mention', side_effect=lambda _user, record: records.append(record)), \
             patch('app.services.social_platforms.x.create_alerts_if_needed'):
            result = sync_x_mentions(self.user_id, self.config)

        self.assertEqual(result['mentions_added'], 2)
        self.assertEqual([record['source_post_id'] for record in records], ['post:post-1', 'post:post-2'])
        self.assertEqual(records[1]['author'], '')

    def test_linkedin_sync_collects_posts_from_authorized_member_profile(self):
        records = []

        def fake_get(_client, _platform, url, _token, _params=None, **_kwargs):
            if url.endswith('/v2/userinfo'):
                return {'sub': 'member-1', 'name': 'Northstar Member'}
            if url.endswith('/rest/posts'):
                return {'elements': [{
                    'id': 'urn:li:share:post-1',
                    'commentary': 'Northstar member update',
                    'createdAt': 1794398400000,
                }]}
            self.fail(f'Unexpected LinkedIn endpoint: {url}')

        with patch('app.services.social_platforms.linkedin.get_access_token', return_value=('token', {'account_name': 'Member'})), \
             patch('app.services.social_platforms.linkedin.provider_get', side_effect=fake_get), \
             patch('app.services.social_platforms.common.social_store.create_mention', side_effect=lambda _user, record: records.append(record)), \
             patch('app.services.social_platforms.linkedin.create_alerts_if_needed'):
            result = sync_linkedin_mentions(self.user_id, self.config)

        self.assertEqual(result['mentions_added'], 1)
        self.assertEqual(records[0]['source_post_id'], 'post:urn:li:share:post-1')
        self.assertEqual(records[0]['author'], 'Northstar Member')
        self.assertEqual(records[0]['collection_source'], 'authorized_api')

    def test_expired_x_access_token_is_refreshed_before_collection(self):
        key = Fernet.generate_key()
        cipher = Fernet(key)
        account = {
            'status': 'connected',
            'access_token_encrypted': cipher.encrypt(b'expired-access').decode('ascii'),
            'refresh_token_encrypted': cipher.encrypt(b'refresh-token').decode('ascii'),
            'token_expires_at': (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        }

        class RefreshResponse:
            status_code = 200

            @staticmethod
            def json():
                return {'access_token': 'new-access', 'refresh_token': 'new-refresh', 'expires_in': 3600}

        with patch.object(settings, 'SOCIAL_OAUTH_ENCRYPTION_KEY', key.decode('ascii')), \
             patch.object(settings, 'SOCIAL_PROVIDER_SETTINGS', {
                 'x': {'client_id': 'client-id', 'client_secret': 'client-secret'},
             }), \
             patch('app.services.social_platforms.common.social_store.get_social_account_credentials', return_value=account), \
             patch('app.services.social_platforms.common.httpx.post', return_value=RefreshResponse()) as refresh, \
             patch('app.services.social_platforms.common.social_store.update_social_account_tokens', return_value=True) as update:
            token, _ = get_access_token(self.user_id, 'x')

        self.assertEqual(token, 'new-access')
        self.assertEqual(refresh.call_args.kwargs['data']['refresh_token'], 'refresh-token')
        encrypted_new_token = update.call_args.args[2]
        self.assertEqual(cipher.decrypt(encrypted_new_token.encode('ascii')), b'new-access')

    def test_near_expiry_meta_user_token_is_exchanged_for_a_long_lived_token(self):
        key = Fernet.generate_key()
        cipher = Fernet(key)
        account = {
            'status': 'connected',
            'access_token_encrypted': cipher.encrypt(b'old-meta-token').decode('ascii'),
            'refresh_token_encrypted': '',
            'token_expires_at': (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        }

        class RefreshResponse:
            status_code = 200

            @staticmethod
            def json():
                return {'access_token': 'extended-meta-token', 'expires_in': 5184000}

        with patch.object(settings, 'SOCIAL_OAUTH_ENCRYPTION_KEY', key.decode('ascii')), \
             patch.object(settings, 'SOCIAL_PROVIDER_SETTINGS', {
                 'facebook': {'client_id': 'client-id', 'client_secret': 'client-secret'},
             }), \
             patch('app.services.social_platforms.common.social_store.get_social_account_credentials', return_value=account), \
             patch('app.services.social_platforms.common.httpx.get', return_value=RefreshResponse()), \
             patch('app.services.social_platforms.common.social_store.update_social_account_tokens', return_value=True) as update:
            token, _ = get_access_token(self.user_id, 'facebook')

        self.assertEqual(token, 'extended-meta-token')
        self.assertEqual(update.call_args.args[3], '')


if __name__ == '__main__':
    unittest.main()
