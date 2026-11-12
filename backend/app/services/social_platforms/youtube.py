import logging
from datetime import datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.config import settings
from app.database import social_store
from app.services import social_intelligence

logger = logging.getLogger(__name__)
YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'
OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
HTTP_TIMEOUT = 20
MAX_VIDEOS_PER_SYNC = 20
MAX_COMMENTS_PER_VIDEO = 100


def _token_cipher():
    try:
        return Fernet(settings.SOCIAL_OAUTH_ENCRYPTION_KEY.encode('ascii'))
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail='Social account token encryption is not configured correctly. Contact the administrator.',
        ) from exc


def _is_expired(expires_at):
    if not expires_at:
        return False
    try:
        parsed = datetime.fromisoformat(str(expires_at).replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed <= datetime.now(timezone.utc) + timedelta(seconds=30)
    except ValueError:
        return True


def _provider_error(response):
    status = response.status_code
    if status in (401, 403):
        raise HTTPException(
            status_code=403,
            detail='YouTube denied access to channel data. Reconnect the account and confirm YouTube Data API v3 and read access are enabled.',
        )
    if status == 429:
        raise HTTPException(
            status_code=429,
            detail='The YouTube API quota or rate limit was reached. Try again later.',
        )
    if status >= 500:
        raise HTTPException(
            status_code=503,
            detail='YouTube is temporarily unavailable. Try syncing again shortly.',
        )
    raise HTTPException(
        status_code=502,
        detail='YouTube rejected the data request. Check the YouTube Data API configuration and reconnect if needed.',
    )


def _get_access_token(user_id):
    account = social_store.get_social_account_credentials(user_id, 'youtube')
    if not account or account.get('status') != 'connected':
        raise HTTPException(status_code=409, detail='Connect a YouTube account before syncing channel data.')

    cipher = _token_cipher()
    try:
        refresh_token_encrypted = account.get('refresh_token_encrypted') or ''
        if _is_expired(account.get('token_expires_at')) and refresh_token_encrypted:
            refresh_token = cipher.decrypt(refresh_token_encrypted.encode('ascii')).decode('utf-8')
            provider_settings = settings.SOCIAL_PROVIDER_SETTINGS['youtube']
            response = httpx.post(
                OAUTH_TOKEN_URL,
                data={
                    'client_id': provider_settings['client_id'],
                    'client_secret': provider_settings['client_secret'],
                    'refresh_token': refresh_token,
                    'grant_type': 'refresh_token',
                },
                timeout=HTTP_TIMEOUT,
                follow_redirects=False,
            )
            if response.status_code >= 400:
                token_error = response.json().get('error')
                if token_error in {'invalid_grant', 'unauthorized_client'}:
                    social_store.update_social_account_status(user_id, 'youtube', 'reauth_required')
                    raise HTTPException(
                        status_code=401,
                        detail='The YouTube authorization expired or was revoked. Reconnect the account before syncing.',
                    )
                _provider_error(response)
            refreshed = response.json()
            access_token = refreshed.get('access_token')
            if not access_token:
                raise HTTPException(status_code=502, detail='Google did not return a refreshed YouTube access token.')
            expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=int(refreshed.get('expires_in', 3600)))
            ).isoformat()
            encrypted_access_token = cipher.encrypt(access_token.encode('utf-8')).decode('ascii')
            encrypted_refresh_token = cipher.encrypt(
                (refreshed.get('refresh_token') or refresh_token).encode('utf-8'),
            ).decode('ascii')
            social_store.update_social_account_tokens(
                user_id,
                'youtube',
                encrypted_access_token,
                encrypted_refresh_token,
                expires_at,
            )
            return access_token

        encrypted_access_token = account.get('access_token_encrypted')
        if not encrypted_access_token:
            raise HTTPException(status_code=409, detail='The YouTube connection has no stored access token. Reconnect the account.')
        return cipher.decrypt(encrypted_access_token.encode('ascii')).decode('utf-8')
    except InvalidToken as exc:
        raise HTTPException(
            status_code=409,
            detail='The saved YouTube token cannot be decrypted. Reconnect the account with the current OAuth encryption key.',
        ) from exc
    except httpx.RequestError as exc:
        logger.warning('YouTube token refresh request failed (%s).', type(exc).__name__)
        raise HTTPException(status_code=503, detail='Could not refresh the YouTube session. Check the backend network and try again.') from exc


def _youtube_get(client, endpoint, access_token, params, user_id=None):
    try:
        response = client.get(
            f'{YOUTUBE_API}/{endpoint}',
            params=params,
            headers={'Authorization': f'Bearer {access_token}'},
        )
    except httpx.RequestError as exc:
        logger.warning('YouTube API request failed (%s).', type(exc).__name__)
        raise HTTPException(status_code=503, detail='Could not reach the YouTube API. Check the backend network and try again.') from exc
    if response.status_code == 401 and user_id:
        social_store.update_social_account_status(user_id, 'youtube', 'reauth_required')
        raise HTTPException(
            status_code=401,
            detail='The YouTube authorization expired or was revoked. Reconnect the account before syncing.',
        )
    if response.status_code >= 400:
        _provider_error(response)
    return response.json()


def _tracked_terms(config):
    return [
        term.strip().casefold()
        for term in [
            config.get('brand_name'),
            *(config.get('keywords') or []),
            *(config.get('hashtags') or []),
            *(config.get('product_names') or []),
        ]
        if isinstance(term, str) and term.strip()
    ]


def _matches_tracked_terms(text, terms):
    normalized_text = text.casefold()
    return any(term in normalized_text for term in terms)


def _published_at(value):
    if not value:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()


def _video_records(client, access_token, upload_playlist_id, user_id):
    videos = []
    items_seen = 0
    next_page_token = None
    while items_seen < MAX_VIDEOS_PER_SYNC:
        params = {
            'part': 'snippet,contentDetails',
            'playlistId': upload_playlist_id,
            'maxResults': min(50, MAX_VIDEOS_PER_SYNC - items_seen),
        }
        if next_page_token:
            params['pageToken'] = next_page_token
        page = _youtube_get(client, 'playlistItems', access_token, params, user_id)
        items = page.get('items') or []
        items_seen += len(items)
        video_ids = [
            item.get('contentDetails', {}).get('videoId')
            for item in items
            if item.get('contentDetails', {}).get('videoId')
        ]
        if video_ids:
            details = _youtube_get(client, 'videos', access_token, {
                'part': 'snippet,statistics',
                'id': ','.join(video_ids),
                'maxResults': len(video_ids),
            }, user_id)
            videos.extend(details.get('items') or [])
        next_page_token = page.get('nextPageToken')
        if not next_page_token or not items:
            break
    return videos[:MAX_VIDEOS_PER_SYNC]


def sync_youtube_mentions(user_id, config):
    if not config or not config.get('enabled') or not config.get('brand_name'):
        raise HTTPException(
            status_code=422,
            detail='Configure your brand name and enable the monitoring profile before syncing YouTube.',
        )
    access_token = _get_access_token(user_id)
    terms = _tracked_terms(config)
    added = 0
    already_saved = 0
    matching = 0
    inspected = 0
    source_errors = []
    brand_name = config['brand_name']

    with httpx.Client(timeout=HTTP_TIMEOUT, follow_redirects=False) as client:
        channel_response = _youtube_get(client, 'channels', access_token, {
            'part': 'snippet,contentDetails',
            'mine': 'true',
            'maxResults': 1,
        }, user_id)
        channels = channel_response.get('items') or []
        if not channels:
            raise HTTPException(status_code=403, detail='The connected YouTube account does not have an accessible channel.')
        channel = channels[0]
        uploads_playlist_id = (
            channel.get('contentDetails', {})
            .get('relatedPlaylists', {})
            .get('uploads')
        )
        if not uploads_playlist_id:
            raise HTTPException(status_code=502, detail='YouTube did not return an uploads playlist for the connected channel.')
        videos = _video_records(client, access_token, uploads_playlist_id, user_id)

        for video in videos:
            snippet = video.get('snippet') or {}
            video_id = video.get('id')
            if not video_id:
                continue
            video_text = '\n'.join(filter(None, [
                snippet.get('title', ''),
                snippet.get('description', ''),
            ]))
            if _matches_tracked_terms(video_text, terms):
                matching += 1
                inspected += 1
                statistics = video.get('statistics') or {}
                record = {
                    'entity_name': brand_name,
                    'entity_type': 'brand',
                    'platform': 'youtube',
                    'author': snippet.get('channelTitle') or channel.get('snippet', {}).get('title', ''),
                    'content': video_text[:10_000],
                    'source_url': f'https://www.youtube.com/watch?v={video_id}',
                    'source_post_id': f'video:{video_id}',
                    'published_at': _published_at(snippet.get('publishedAt')),
                    'engagement': {
                        key: int(statistics[value])
                        for key, value in (
                            ('views', 'viewCount'),
                            ('likes', 'likeCount'),
                            ('comments', 'commentCount'),
                        )
                        if str(statistics.get(value, '')).isdigit()
                    },
                    'collection_source': 'authorized_api',
                }
                try:
                    social_store.create_mention(user_id, record)
                    added += 1
                except ValueError:
                    already_saved += 1

            try:
                comment_page = _youtube_get(client, 'commentThreads', access_token, {
                    'part': 'snippet',
                    'videoId': video_id,
                    'maxResults': MAX_COMMENTS_PER_VIDEO,
                    'order': 'time',
                    'textFormat': 'plainText',
                }, user_id)
            except HTTPException as exc:
                if exc.status_code == 403:
                    source_errors.append('Comments were unavailable for one or more videos (disabled or not permitted).')
                    continue
                raise

            for thread in comment_page.get('items') or []:
                comment = (
                    thread.get('snippet', {})
                    .get('topLevelComment', {})
                )
                comment_snippet = comment.get('snippet') or {}
                text = comment_snippet.get('textDisplay') or comment_snippet.get('textOriginal') or ''
                if not text or not _matches_tracked_terms(text, terms):
                    continue
                comment_id = comment.get('id')
                if not comment_id:
                    continue
                matching += 1
                inspected += 1
                record = {
                    'entity_name': brand_name,
                    'entity_type': 'brand',
                    'platform': 'youtube',
                    'author': comment_snippet.get('authorDisplayName', ''),
                    'content': text[:10_000],
                    'source_url': f'https://www.youtube.com/watch?v={video_id}&lc={comment_id}',
                    'source_post_id': f'comment:{comment_id}',
                    'published_at': _published_at(comment_snippet.get('publishedAt')),
                    'engagement': {
                        key: value
                        for key, value in (
                            ('likes', comment_snippet.get('likeCount')),
                            ('replies', thread.get('snippet', {}).get('totalReplyCount')),
                        )
                        if isinstance(value, int) and value >= 0
                    },
                    'collection_source': 'authorized_api',
                }
                try:
                    social_store.create_mention(user_id, record)
                    added += 1
                except ValueError:
                    already_saved += 1

    if added:
        social_intelligence.create_monitoring_alerts(user_id, 'youtube')
    return {
        'platform': 'youtube',
        'account_name': channel.get('snippet', {}).get('title', ''),
        'videos_checked': len(videos),
        'records_checked': inspected,
        'matching_records': matching,
        'mentions_added': added,
        'duplicates_skipped': already_saved,
        'warnings': list(dict.fromkeys(source_errors)),
        'collection_scope': (
            f'Up to {MAX_VIDEOS_PER_SYNC} recent videos and {MAX_COMMENTS_PER_VIDEO} top-level comments per video '
            'on the connected channel only; this does not search all public YouTube content.'
        ),
    }
