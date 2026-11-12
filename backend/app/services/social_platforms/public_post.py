import re
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import HTTPException

from app.config import settings
from app.database import social_store
from app.services.social_platforms.common import provider_get, published_at

YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'
X_API = 'https://api.x.com/2'
YOUTUBE_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')
X_POST_ID = re.compile(r'^[0-9]{1,30}$')
SUPPORTED_APIS = 'YouTube and X public post URLs, when the corresponding server-side API credentials and provider access are configured.'


def _post_identity(url):
    try:
        parsed = urlparse(url.strip())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail='Enter a valid public social post URL.') from exc
    if parsed.scheme != 'https' or not parsed.hostname:
        raise HTTPException(status_code=422, detail='Post URLs must use HTTPS.')
    host = parsed.hostname.lower().removeprefix('www.')
    parts = [part for part in parsed.path.split('/') if part]

    video_id = None
    if host in {'youtube.com', 'm.youtube.com', 'music.youtube.com'}:
        if parsed.path == '/watch':
            video_id = parse_qs(parsed.query).get('v', [None])[0]
        elif len(parts) == 2 and parts[0] in {'shorts', 'live', 'embed', 'v'}:
            video_id = parts[1]
    elif host == 'youtu.be' and len(parts) == 1:
        video_id = parts[0]
    if video_id is not None:
        if not YOUTUBE_ID.fullmatch(video_id):
            raise HTTPException(status_code=422, detail='The YouTube URL does not contain a valid video ID.')
        return 'youtube', video_id

    if host in {'x.com', 'twitter.com'}:
        if len(parts) >= 3 and parts[1] in {'status', 'statuses'} and X_POST_ID.fullmatch(parts[2]):
            return 'x', parts[2]
        raise HTTPException(status_code=422, detail='The X URL must point to a specific post, for example x.com/username/status/123456789.')

    if host in {'instagram.com', 'facebook.com', 'fb.watch', 'linkedin.com', 'lnkd.in'}:
        raise HTTPException(
            status_code=501,
            detail=(
                f'{host} public-post URL fetching is not available through an authorized public API for this app. '
                f'Supported providers: {SUPPORTED_APIS} No page scraping or user login was attempted.'
            ),
        )
    raise HTTPException(status_code=422, detail=f'This URL is not a supported social post. Supported providers: {SUPPORTED_APIS}')


def _api_error(platform, response):
    if response.status_code == 404 or response.status_code == 410:
        raise HTTPException(status_code=404, detail=f'The {platform.title()} post is unavailable, deleted, private, or not accessible through the API.')
    if response.status_code == 401 or response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f'{platform.title()} API access was denied. Verify the server-side API credential and provider access tier; no user login is used.',
        )
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail=f'{platform.title()} API rate limit or quota reached. Try again later.')
    if response.status_code >= 500:
        raise HTTPException(status_code=503, detail=f'{platform.title()} is temporarily unavailable.')
    raise HTTPException(status_code=502, detail=f'{platform.title()} rejected the public-post lookup request.')


def _get_youtube_video(video_id):
    api_key = settings.YOUTUBE_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail='Public YouTube URL fetching needs YOUTUBE_API_KEY in backend\\.env. This is a server-side API key, not a user login.',
        )
    try:
        response = httpx.get(
            f'{YOUTUBE_API}/videos',
            params={'part': 'snippet,statistics', 'id': video_id, 'key': api_key},
            timeout=15,
            follow_redirects=False,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail='Could not reach the YouTube Data API. Check backend network access and try again.') from exc
    if response.status_code >= 400:
        _api_error('youtube', response)
    try:
        items = response.json().get('items') or []
    except ValueError as exc:
        raise HTTPException(status_code=502, detail='YouTube returned an invalid video response.') from exc
    if not items:
        raise HTTPException(status_code=404, detail='The YouTube video is unavailable or not public.')
    item = items[0]
    snippet = item.get('snippet') or {}
    statistics = item.get('statistics') or {}
    content = '\n'.join(filter(None, [snippet.get('title'), snippet.get('description')]))
    if not content:
        raise HTTPException(status_code=422, detail='The public YouTube video has no text to analyze.')
    return {
        'platform': 'youtube',
        'post_id': video_id,
        'author': snippet.get('channelTitle') or '',
        'content': content[:10_000],
        'published_at': snippet.get('publishedAt'),
        'source_url': f'https://www.youtube.com/watch?v={video_id}',
        'engagement': {
            key: int(statistics[value])
            for key, value in (('views', 'viewCount'), ('likes', 'likeCount'), ('comments', 'commentCount'))
            if str(statistics.get(value, '')).isdigit()
        },
    }


def _get_x_post(post_id):
    bearer_token = settings.X_BEARER_TOKEN
    if not bearer_token:
        raise HTTPException(
            status_code=503,
            detail='Public X URL fetching needs X_BEARER_TOKEN in backend\\.env and an X API access tier that permits post lookup. No user login is used.',
        )
    with httpx.Client(timeout=15, follow_redirects=False) as client:
        response = provider_get(
            client,
            'x',
            f'{X_API}/tweets/{post_id}',
            bearer_token,
            {
                'tweet.fields': 'created_at,public_metrics,author_id',
                'expansions': 'author_id',
                'user.fields': 'name,username',
            },
        )
    post = response.get('data') or {}
    if not post.get('id') or not post.get('text'):
        raise HTTPException(status_code=404, detail='The X post is unavailable or not public.')
    author_data = (response.get('includes') or {}).get('users') or []
    author = author_data[0] if author_data else {}
    username = author.get('username')
    metrics = post.get('public_metrics') or {}
    return {
        'platform': 'x',
        'post_id': post_id,
        'author': f"@{username}" if username else author.get('name', ''),
        'content': post['text'][:10_000],
        'published_at': post.get('created_at'),
        'source_url': f'https://x.com/{username}/status/{post_id}' if username else f'https://x.com/i/status/{post_id}',
        'engagement': {
            key: metrics[value]
            for key, value in (
                ('likes', 'like_count'),
                ('reposts', 'retweet_count'),
                ('replies', 'reply_count'),
                ('quotes', 'quote_count'),
            )
            if isinstance(metrics.get(value), int) and metrics[value] >= 0
        },
    }


def fetch_public_post(user_id, url, config):
    if not config or not config.get('brand_name'):
        raise HTTPException(status_code=422, detail='Set your brand name in the monitoring profile before fetching a post.')
    platform, post_id = _post_identity(url)
    post = _get_youtube_video(post_id) if platform == 'youtube' else _get_x_post(post_id)
    timestamp = published_at(post.get('published_at'))
    if not timestamp:
        raise HTTPException(status_code=502, detail=f'{platform.title()} did not return a valid post publication date.')
    record = {
        'entity_name': config['brand_name'],
        'entity_type': 'brand',
        'platform': platform,
        'author': post['author'],
        'content': post['content'],
        'source_url': post['source_url'],
        'source_post_id': f'public:{platform}:{post_id}',
        'published_at': timestamp,
        'engagement': post['engagement'],
        'collection_source': 'public_api',
    }
    try:
        mention = social_store.create_mention(user_id, record)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail='This public post has already been fetched into your mentions.') from exc
    return {
        'message': f'{platform.title()} post fetched through its official public API and saved. Run sentiment analysis from Brand Mentions.',
        'collection_scope': 'Only the specific public post URL you entered was fetched; no account login or page scraping was used.',
        'mention': mention,
    }
