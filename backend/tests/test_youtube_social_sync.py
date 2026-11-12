import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.services.social_platforms.youtube import _get_access_token, sync_youtube_mentions


class YouTubeSocialSyncTests(unittest.TestCase):
    def test_sync_imports_only_matching_authorized_channel_posts_and_comments(self):
        user_id = str(uuid4())
        saved_records = []

        def fake_youtube_get(client, endpoint, access_token, params, account_user_id=None):
            self.assertIn(account_user_id, (None, user_id))
            if endpoint == 'channels':
                return {'items': [{
                    'snippet': {'title': 'Brand channel'},
                    'contentDetails': {'relatedPlaylists': {'uploads': 'uploads-1'}},
                }]}
            if endpoint == 'playlistItems':
                return {'items': [
                    {'contentDetails': {'videoId': 'video-1'}},
                    {'contentDetails': {'videoId': 'video-2'}},
                ]}
            if endpoint == 'videos':
                return {'items': [
                    {
                        'id': 'video-1',
                        'snippet': {
                            'title': 'Northstar product launch',
                            'description': 'A new product update.',
                            'channelTitle': 'Brand channel',
                            'publishedAt': '2026-11-11T10:00:00Z',
                        },
                        'statistics': {'viewCount': '90', 'likeCount': '8'},
                    },
                    {
                        'id': 'video-2',
                        'snippet': {
                            'title': 'General update',
                            'description': 'No matching tracked term.',
                            'channelTitle': 'Brand channel',
                            'publishedAt': '2026-11-11T11:00:00Z',
                        },
                        'statistics': {},
                    },
                ]}
            if endpoint == 'commentThreads' and params['videoId'] == 'video-1':
                return {'items': [
                    {
                        'id': 'thread-1',
                        'snippet': {
                            'totalReplyCount': 1,
                            'topLevelComment': {
                                'id': 'comment-1',
                                'snippet': {
                                    'textDisplay': 'Northstar delivery was late.',
                                    'authorDisplayName': 'Customer',
                                    'publishedAt': '2026-11-11T12:00:00Z',
                                    'likeCount': 2,
                                },
                            },
                        },
                    },
                    {
                        'id': 'thread-2',
                        'snippet': {
                            'totalReplyCount': 0,
                            'topLevelComment': {
                                'id': 'comment-2',
                                'snippet': {'textDisplay': 'Unrelated comment.'},
                            },
                        },
                    },
                ]}
            if endpoint == 'commentThreads' and params['videoId'] == 'video-2':
                raise HTTPException(status_code=403, detail='comments unavailable')
            self.fail(f'Unexpected YouTube endpoint: {endpoint}')

        def record_created(account_id, record):
            saved_records.append(record)
            if record.get('source_post_id') == 'comment:comment-1':
                raise ValueError('This platform post has already been added.')

        with patch('app.services.social_platforms.youtube._get_access_token', return_value='authorized-token'), \
             patch('app.services.social_platforms.youtube._youtube_get', side_effect=fake_youtube_get), \
             patch('app.services.social_platforms.youtube.social_store.create_mention', side_effect=record_created), \
             patch('app.services.social_platforms.youtube.social_intelligence.create_monitoring_alerts') as create_alerts:
            result = sync_youtube_mentions(user_id, {
                'enabled': True,
                'brand_name': 'Northstar',
                'keywords': ['Northstar'],
                'hashtags': [],
                'product_names': [],
            })

        self.assertEqual(result['videos_checked'], 2)
        self.assertEqual(result['matching_records'], 2)
        self.assertEqual(result['mentions_added'], 1)
        self.assertEqual(result['duplicates_skipped'], 1)
        self.assertEqual(len(result['warnings']), 1)
        self.assertTrue(all(item['collection_source'] == 'authorized_api' for item in saved_records))
        self.assertEqual(saved_records[0]['source_post_id'], 'video:video-1')
        self.assertEqual(saved_records[0]['engagement'], {'views': 90, 'likes': 8})
        create_alerts.assert_called_once_with(user_id, 'youtube')

    def test_sync_requires_an_enabled_monitoring_profile(self):
        with self.assertRaises(HTTPException) as unavailable:
            sync_youtube_mentions(str(uuid4()), {'enabled': False, 'brand_name': 'Northstar'})
        self.assertEqual(unavailable.exception.status_code, 422)

    def test_stored_youtube_access_token_is_decrypted_only_for_provider_calls(self):
        user_id = str(uuid4())
        key = Fernet.generate_key()
        cipher = Fernet(key)
        encrypted = cipher.encrypt(b'authorized-access-token').decode('ascii')
        account = {
            'status': 'connected',
            'access_token_encrypted': encrypted,
            'refresh_token_encrypted': '',
            'token_expires_at': None,
        }
        with patch('app.services.social_platforms.youtube.settings.SOCIAL_OAUTH_ENCRYPTION_KEY', key.decode('ascii')), \
             patch('app.services.social_platforms.youtube.social_store.get_social_account_credentials', return_value=account):
            token = _get_access_token(user_id)
        self.assertEqual(token, 'authorized-access-token')

    def test_expired_youtube_access_token_is_refreshed_and_reencrypted(self):
        user_id = str(uuid4())
        key = Fernet.generate_key()
        cipher = Fernet(key)
        encrypted_refresh = cipher.encrypt(b'authorized-refresh-token').decode('ascii')
        account = {
            'status': 'connected',
            'access_token_encrypted': cipher.encrypt(b'expired-access-token').decode('ascii'),
            'refresh_token_encrypted': encrypted_refresh,
            'token_expires_at': (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        }

        class RefreshResponse:
            status_code = 200

            @staticmethod
            def json():
                return {'access_token': 'refreshed-access-token', 'expires_in': 3600}

        with patch('app.services.social_platforms.youtube.settings.SOCIAL_OAUTH_ENCRYPTION_KEY', key.decode('ascii')), \
             patch('app.services.social_platforms.youtube.settings.SOCIAL_PROVIDER_SETTINGS', {
                 'youtube': {'client_id': 'client-id', 'client_secret': 'client-secret'},
             }), \
             patch('app.services.social_platforms.youtube.social_store.get_social_account_credentials', return_value=account), \
             patch('app.services.social_platforms.youtube.httpx.post', return_value=RefreshResponse()) as refresh, \
             patch('app.services.social_platforms.youtube.social_store.update_social_account_tokens', return_value=True) as update:
            token = _get_access_token(user_id)

        self.assertEqual(token, 'refreshed-access-token')
        self.assertEqual(refresh.call_args.kwargs['data']['refresh_token'], 'authorized-refresh-token')
        updated_access_token = update.call_args.args[2]
        self.assertEqual(cipher.decrypt(updated_access_token.encode('ascii')), b'refreshed-access-token')


if __name__ == '__main__':
    unittest.main()
