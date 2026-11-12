import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.config import settings
from app.database import social_store

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15


def get_decrypted_token(user_id: str, platform: str) -> str | None:
    account = social_store.get_social_account_raw(user_id, platform)
    if not account or account.get('status') == 'disconnected':
        return None

    encrypted_token = account.get('access_token_encrypted')
    if not encrypted_token:
        return None

    key = settings.SOCIAL_OAUTH_ENCRYPTION_KEY
    if not key:
        return None

    try:
        cipher = Fernet(key.encode('ascii'))
        return cipher.decrypt(encrypted_token.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError, UnicodeEncodeError) as exc:
        logger.warning('Failed to decrypt token for platform %s: %s', platform, exc)
        return None


async def fetch_instagram_posts(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    url = 'https://graph.facebook.com/v21.0/me/media'
    params = {
        'fields': 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
        'limit': limit,
        'access_token': access_token,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json().get('data', [])
        posts = []
        for item in data:
            posts.append({
                'platform': 'instagram',
                'external_id': str(item.get('id')),
                'caption': item.get('caption', ''),
                'media_url': item.get('media_url', ''),
                'media_type': (item.get('media_type') or 'image').lower(),
                'permalink': item.get('permalink', ''),
                'published_at': item.get('timestamp') or datetime.now(timezone.utc).isoformat(),
                'metrics': {
                    'likes': item.get('like_count', 0),
                    'comments': item.get('comments_count', 0),
                },
            })
        return posts


async def fetch_facebook_posts(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    url = 'https://graph.facebook.com/v21.0/me/posts'
    params = {
        'fields': 'id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true)',
        'limit': limit,
        'access_token': access_token,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json().get('data', [])
        posts = []
        for item in data:
            reactions = item.get('reactions', {}).get('summary', {}).get('total_count', 0)
            comments = item.get('comments', {}).get('summary', {}).get('total_count', 0)
            posts.append({
                'platform': 'facebook',
                'external_id': str(item.get('id')),
                'caption': item.get('message', ''),
                'media_url': '',
                'media_type': 'status',
                'permalink': item.get('permalink_url', ''),
                'published_at': item.get('created_time') or datetime.now(timezone.utc).isoformat(),
                'metrics': {
                    'likes': reactions,
                    'comments': comments,
                },
            })
        return posts


async def fetch_youtube_posts(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    headers = {'Authorization': f'Bearer {access_token}'}
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        # Step 1: get uploads playlist ID
        channel_resp = await client.get(
            'https://www.googleapis.com/youtube/v3/channels',
            params={'part': 'contentDetails', 'mine': 'true'},
            headers=headers,
        )
        channel_resp.raise_for_status()
        items = channel_resp.json().get('items', [])
        if not items:
            return []
        uploads_playlist = items[0].get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads')
        if not uploads_playlist:
            return []

        # Step 2: get playlist items
        items_resp = await client.get(
            'https://www.googleapis.com/youtube/v3/playlistItems',
            params={
                'part': 'snippet',
                'playlistId': uploads_playlist,
                'maxResults': limit,
            },
            headers=headers,
        )
        items_resp.raise_for_status()
        video_items = items_resp.json().get('items', [])
        posts = []
        for v in video_items:
            snippet = v.get('snippet', {})
            video_id = snippet.get('resourceId', {}).get('videoId', '')
            posts.append({
                'platform': 'youtube',
                'external_id': video_id or str(v.get('id')),
                'caption': f"{snippet.get('title', '')}\n\n{snippet.get('description', '')}".strip(),
                'media_url': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                'media_type': 'video',
                'permalink': f"https://www.youtube.com/watch?v={video_id}" if video_id else '',
                'published_at': snippet.get('publishedAt') or datetime.now(timezone.utc).isoformat(),
                'metrics': {},
            })
        return posts


async def fetch_x_posts(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    headers = {'Authorization': f'Bearer {access_token}'}
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        # Get user ID first
        me_resp = await client.get('https://api.x.com/2/users/me', headers=headers)
        me_resp.raise_for_status()
        user_id = me_resp.json().get('data', {}).get('id')
        if not user_id:
            return []

        # Fetch recent tweets
        tweets_resp = await client.get(
            f'https://api.x.com/2/users/{user_id}/tweets',
            params={
                'max_results': min(max(limit, 5), 100),
                'tweet.fields': 'created_at,public_metrics',
            },
            headers=headers,
        )
        tweets_resp.raise_for_status()
        data = tweets_resp.json().get('data', [])
        posts = []
        for item in data:
            metrics = item.get('public_metrics', {})
            posts.append({
                'platform': 'x',
                'external_id': str(item.get('id')),
                'caption': item.get('text', ''),
                'media_url': '',
                'media_type': 'tweet',
                'permalink': f"https://x.com/i/status/{item.get('id')}",
                'published_at': item.get('created_at') or datetime.now(timezone.utc).isoformat(),
                'metrics': {
                    'likes': metrics.get('like_count', 0),
                    'retweets': metrics.get('retweet_count', 0),
                    'replies': metrics.get('reply_count', 0),
                    'impressions': metrics.get('impression_count', 0),
                },
            })
        return posts


async def fetch_linkedin_posts(access_token: str, limit: int = 25) -> list[dict[str, Any]]:
    headers = {
        'Authorization': f'Bearer {access_token}',
        'X-Restli-Protocol-Version': '2.0.0',
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        me_resp = await client.get('https://api.linkedin.com/v2/userinfo', headers=headers)
        me_resp.raise_for_status()
        person_urn = me_resp.json().get('sub')
        if not person_urn:
            return []

        posts_resp = await client.get(
            'https://api.linkedin.com/v2/ugcPosts',
            params={
                'q': 'authors',
                'authors': f'List(urn:li:person:{person_urn})',
                'count': limit,
            },
            headers=headers,
        )
        posts_resp.raise_for_status()
        elements = posts_resp.json().get('elements', [])
        posts = []
        for el in elements:
            specific_content = el.get('specificContent', {}).get('com.linkedin.ugc.ShareContent', {})
            text = specific_content.get('shareCommentary', {}).get('text', '')
            posts.append({
                'platform': 'linkedin',
                'external_id': str(el.get('id')),
                'caption': text,
                'media_url': '',
                'media_type': 'post',
                'permalink': f"https://www.linkedin.com/feed/update/{el.get('id')}",
                'published_at': datetime.now(timezone.utc).isoformat(),
                'metrics': {},
            })
        return posts


async def sync_platform_posts(user_id: str, platform: str) -> dict[str, Any]:
    token = get_decrypted_token(user_id, platform)
    if not token:
        raise HTTPException(
            status_code=400,
            detail=f"{platform.title()} is not connected or token is missing. Please connect your account first.",
        )

    fetcher_map = {
        'instagram': fetch_instagram_posts,
        'facebook': fetch_facebook_posts,
        'youtube': fetch_youtube_posts,
        'x': fetch_x_posts,
        'linkedin': fetch_linkedin_posts,
    }

    fetcher = fetcher_map.get(platform)
    if not fetcher:
        raise HTTPException(status_code=400, detail=f"Unsupported platform for post sync: {platform}")

    try:
        raw_posts = await fetcher(token)
    except httpx.HTTPStatusError as exc:
        logger.warning('Failed fetching posts for %s: %s %s', platform, exc.response.status_code, exc.response.text)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch posts from {platform.title()} API. The provider returned status {exc.response.status_code}.",
        ) from exc
    except httpx.RequestError as exc:
        logger.exception('Network error fetching posts for %s', platform)
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach {platform.title()} API. Please try again later.",
        ) from exc

    saved_posts = []
    for p in raw_posts:
        saved = social_store.save_post(user_id, p)
        saved_posts.append(saved)

    return {
        'platform': platform,
        'synced_count': len(saved_posts),
        'posts': saved_posts,
    }

