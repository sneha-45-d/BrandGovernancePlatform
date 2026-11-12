import httpx

from fastapi import HTTPException

from app.services.social_platforms.common import (
    META_GRAPH,
    build_sync_result,
    create_alerts_if_needed,
    get_access_token,
    provider_get,
    save_matching_mention,
    tracked_terms,
    validate_monitoring_config,
)

MAX_ASSETS = 10
MAX_POSTS_PER_ASSET = 25
MAX_COMMENTS_PER_POST = 100


def _meta_edge(client, platform, path, access_token, params, user_id, max_items):
    results = []
    after = None
    while len(results) < max_items:
        page_params = {**params, 'limit': min(50, max_items - len(results))}
        if after:
            page_params['after'] = after
        response = provider_get(
            client,
            platform,
            f'{META_GRAPH}/{path.lstrip("/")}',
            access_token,
            page_params,
            user_id=user_id,
        )
        items = response.get('data') or []
        if not isinstance(items, list):
            raise HTTPException(status_code=502, detail=f'{platform.title()} returned an invalid collection response.')
        results.extend(items)
        after = (response.get('paging') or {}).get('cursors', {}).get('after')
        if not after or not items:
            break
    return results[:max_items]


def sync_meta_mentions(user_id, config, platform):
    if platform not in {'facebook', 'instagram'}:
        raise HTTPException(status_code=404, detail='This Meta platform is not supported.')
    validate_monitoring_config(config)
    access_token, account = get_access_token(user_id, platform)
    brand_name = config['brand_name']
    terms = tracked_terms(config)
    checked = 0
    matching = 0
    added = 0
    duplicates = 0
    warnings = []

    with httpx.Client(timeout=20, follow_redirects=False) as client:
        pages = _meta_edge(
            client,
            platform,
            'me/accounts',
            access_token,
            {
                'fields': (
                    'id,name,access_token'
                    if platform == 'facebook'
                    else 'id,name,access_token,instagram_business_account{id,username}'
                ),
                'limit': 50,
            },
            user_id,
            MAX_ASSETS,
        )
        if platform == 'facebook' and not pages:
            raise HTTPException(
                status_code=409,
                detail='No Facebook Pages are available to this connection. Grant Pages access to the app and confirm your Page role, then reconnect.',
            )
        assets = []
        if platform == 'facebook':
            assets = [
                {'id': page.get('id'), 'name': page.get('name') or account.get('account_name'), 'token': page.get('access_token')}
                for page in pages if page.get('id') and page.get('access_token')
            ]
        else:
            assets = [
                {
                    'id': (page.get('instagram_business_account') or {}).get('id'),
                    'name': (page.get('instagram_business_account') or {}).get('username') or page.get('name'),
                    'token': page.get('access_token'),
                }
                for page in pages
                if (page.get('instagram_business_account') or {}).get('id') and page.get('access_token')
            ]
            if not assets:
                raise HTTPException(
                    status_code=409,
                    detail='No connected Instagram professional account was found on the authorized Facebook Pages. Link an eligible Instagram Business or Creator account and reconnect with the required permissions.',
                )
        if platform == 'facebook' and not assets:
            raise HTTPException(
                status_code=409,
                detail='Facebook returned no usable Page access tokens. Confirm your Page role and Pages permissions, then reconnect the account.',
            )

        for asset in assets:
            asset_token = asset['token']
            if platform == 'facebook':
                posts = _meta_edge(
                    client,
                    platform,
                    f"{asset['id']}/feed",
                    asset_token,
                    {
                        'fields': 'id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)',
                        'is_published': 'true',
                    },
                    user_id,
                    MAX_POSTS_PER_ASSET,
                )
                comments_path = lambda post_id: f'{post_id}/comments'
                comment_fields = 'id,message,created_time,from,like_count'
            else:
                posts = _meta_edge(
                    client,
                    platform,
                    f"{asset['id']}/media",
                    asset_token,
                    {'fields': 'id,caption,timestamp,permalink,like_count,comments_count,username,media_type'},
                    user_id,
                    MAX_POSTS_PER_ASSET,
                )
                comments_path = lambda post_id: f'{post_id}/comments'
                comment_fields = 'id,text,username,timestamp,like_count'

            for post in posts:
                post_id = post.get('id')
                if not post_id:
                    continue
                if platform == 'facebook':
                    post_text = post.get('message') or ''
                    date = post.get('created_time')
                    post_url = post.get('permalink_url') or f'https://www.facebook.com/{post_id}'
                    likes = (post.get('likes') or {}).get('summary', {}).get('total_count')
                    comments_count = (post.get('comments') or {}).get('summary', {}).get('total_count')
                    engagement = {'likes': likes, 'comments': comments_count}
                else:
                    post_text = post.get('caption') or ''
                    date = post.get('timestamp')
                    post_url = post.get('permalink') or f'https://www.instagram.com/p/{post_id}/'
                    engagement = {'likes': post.get('like_count'), 'comments': post.get('comments_count')}

                checked += 1
                result = save_matching_mention(
                    user_id, platform, brand_name, terms,
                    asset.get('name'), post_text, post_url, f'post:{post_id}', date, engagement,
                )
                if result == 'added':
                    added += 1
                    matching += 1
                elif result == 'duplicate':
                    duplicates += 1
                    matching += 1

                try:
                    comments = _meta_edge(
                        client,
                        platform,
                        comments_path(post_id),
                        asset_token,
                        {'fields': comment_fields},
                        user_id,
                        MAX_COMMENTS_PER_POST,
                    )
                except HTTPException as exc:
                    if exc.status_code == 403:
                        warnings.append('Some comments were unavailable because of provider permissions or post settings.')
                        continue
                    raise

                for comment in comments:
                    comment_id = comment.get('id')
                    text = comment.get('message') if platform == 'facebook' else comment.get('text')
                    if not comment_id or not text:
                        continue
                    checked += 1
                    commenter = (
                        (comment.get('from') or {}).get('name')
                        if platform == 'facebook'
                        else comment.get('username')
                    )
                    comment_date = comment.get('created_time') if platform == 'facebook' else comment.get('timestamp')
                    comment_engagement = {
                        'likes': comment.get('like_count'),
                        'replies': comment.get('comment_count'),
                    }
                    result = save_matching_mention(
                        user_id,
                        platform,
                        brand_name,
                        terms,
                        commenter,
                        text,
                        post_url,
                        f'comment:{comment_id}',
                        comment_date,
                        comment_engagement,
                    )
                    if result == 'added':
                        added += 1
                        matching += 1
                    elif result == 'duplicate':
                        duplicates += 1
                        matching += 1

    if added:
        create_alerts_if_needed(user_id, platform, added)
    account_name = ', '.join(dict.fromkeys(asset.get('name') or '' for asset in assets if asset.get('name')))
    scope = (
        f'Up to {MAX_ASSETS} authorized Facebook Pages, {MAX_POSTS_PER_ASSET} recent posts per Page, and {MAX_COMMENTS_PER_POST} comments per post; it does not search all public Facebook content.'
        if platform == 'facebook'
        else f'Up to {MAX_ASSETS} Instagram professional accounts linked to authorized Facebook Pages, {MAX_POSTS_PER_ASSET} recent media per account, and {MAX_COMMENTS_PER_POST} comments per item; it does not search all public Instagram content.'
    )
    return build_sync_result(
        platform,
        account_name or account.get('account_name', ''),
        checked,
        matching,
        added,
        duplicates,
        warnings,
        scope,
    )
