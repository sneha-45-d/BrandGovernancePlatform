import httpx
from fastapi import HTTPException

from app.services.social_platforms.common import (
    MAX_SYNC_ITEMS,
    X_API,
    build_sync_result,
    create_alerts_if_needed,
    get_access_token,
    provider_get,
    save_matching_mention,
    tracked_terms,
    validate_monitoring_config,
)


def _x_timeline(client, endpoint, access_token, user_id, account_id):
    results = []
    authors = {}
    pagination_token = None
    while len(results) < MAX_SYNC_ITEMS:
        params = {
            'max_results': min(100, max(5, MAX_SYNC_ITEMS - len(results))),
            'tweet.fields': 'created_at,public_metrics',
            'expansions': 'author_id',
            'user.fields': 'name,username',
        }
        if pagination_token:
            params['pagination_token'] = pagination_token
        page = provider_get(
            client,
            'x',
            f'{X_API}/users/{account_id}/{endpoint}',
            access_token,
            params,
            user_id=user_id,
        )
        results.extend(page.get('data') or [])
        authors.update({
            user.get('id'): user.get('username') or user.get('name') or ''
            for user in (page.get('includes') or {}).get('users', [])
            if user.get('id')
        })
        pagination_token = (page.get('meta') or {}).get('next_token')
        if not pagination_token or not page.get('data'):
            break
    return results[:MAX_SYNC_ITEMS], authors


def sync_x_mentions(user_id, config):
    validate_monitoring_config(config)
    access_token, account = get_access_token(user_id, 'x')
    terms = tracked_terms(config)
    brand_name = config['brand_name']
    added = 0
    duplicates = 0
    checked = 0
    matching = 0
    warnings = []

    with httpx.Client(timeout=20, follow_redirects=False) as client:
        profile = provider_get(
            client,
            'x',
            f'{X_API}/users/me',
            access_token,
            {'user.fields': 'id,name,username'},
            user_id=user_id,
        ).get('data') or {}
        account_id = profile.get('id')
        username = profile.get('username')
        if not account_id or not username:
            raise HTTPException(status_code=502, detail='X did not return the connected account identity.')

        posts, post_authors = _x_timeline(client, 'tweets', access_token, user_id, account_id)
        try:
            mentions, mention_authors = _x_timeline(client, 'mentions', access_token, user_id, account_id)
            post_authors.update(mention_authors)
        except HTTPException as exc:
            if exc.status_code == 403:
                warnings.append('X posts were synced, but the mentions timeline was unavailable to this app or account.')
                mentions = []
            else:
                raise

        for endpoint_posts in (posts, mentions):
            for post in endpoint_posts:
                post_id = post.get('id')
                text = post.get('text') or ''
                if not post_id or not text:
                    continue
                checked += 1
                author_id = post.get('author_id')
                author = username if author_id == account_id else post_authors.get(author_id, '')
                metrics = post.get('public_metrics') or {}
                outcome = save_matching_mention(
                    user_id,
                    'x',
                    brand_name,
                    terms,
                    author,
                    text,
                    f'https://x.com/{username}/status/{post_id}',
                    f'post:{post_id}',
                    post.get('created_at'),
                    {
                        'likes': metrics.get('like_count'),
                        'reposts': metrics.get('retweet_count'),
                        'replies': metrics.get('reply_count'),
                        'quotes': metrics.get('quote_count'),
                    },
                )
                if outcome == 'added':
                    added += 1
                    matching += 1
                elif outcome == 'duplicate':
                    duplicates += 1
                    matching += 1

    create_alerts_if_needed(user_id, 'x', added)
    return build_sync_result(
        'x',
        f'@{username}' if username else account.get('account_name', ''),
        checked,
        matching,
        added,
        duplicates,
        warnings,
        f'Up to {MAX_SYNC_ITEMS} recent posts authored by and {MAX_SYNC_ITEMS} posts mentioning the connected X account; it does not search all public X posts.',
    )
