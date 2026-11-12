import httpx

from app.services.social_platforms.common import (
    LINKEDIN_API,
    LINKEDIN_VERSION,
    MAX_SYNC_ITEMS,
    build_sync_result,
    create_alerts_if_needed,
    get_access_token,
    provider_get,
    save_matching_mention,
    tracked_terms,
    validate_monitoring_config,
)

LINKEDIN_HEADERS = {
    'Linkedin-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
}


def _post_text(post):
    parts = []
    commentary = post.get('commentary')
    if isinstance(commentary, str):
        parts.append(commentary)
    elif isinstance(commentary, dict) and isinstance(commentary.get('text'), str):
        parts.append(commentary['text'])
    content = post.get('content') or {}
    article = content.get('article') or {}
    for key in ('title', 'description'):
        value = article.get(key)
        if isinstance(value, str):
            parts.append(value)
    media = content.get('media') or {}
    if isinstance(media.get('title'), str):
        parts.append(media['title'])
    return '\n'.join(part for part in parts if part).strip()


def sync_linkedin_mentions(user_id, config):
    validate_monitoring_config(config)
    access_token, account = get_access_token(user_id, 'linkedin')
    terms = tracked_terms(config)
    brand_name = config['brand_name']
    checked = 0
    matching = 0
    added = 0
    duplicates = 0

    with httpx.Client(timeout=20, follow_redirects=False) as client:
        profile = provider_get(
            client,
            'linkedin',
            f'{LINKEDIN_API}/v2/userinfo',
            access_token,
            headers=LINKEDIN_HEADERS,
            user_id=user_id,
        )
        member_id = profile.get('sub')
        if not member_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=502, detail='LinkedIn did not return the connected member identifier.')
        author = member_id if str(member_id).startswith('urn:li:person:') else f'urn:li:person:{member_id}'
        response = provider_get(
            client,
            'linkedin',
            f'{LINKEDIN_API}/rest/posts',
            access_token,
            {'author': author, 'count': MAX_SYNC_ITEMS, 'start': 0, 'sortBy': 'CREATED'},
            headers=LINKEDIN_HEADERS,
            user_id=user_id,
        )
        posts = response.get('elements') or []
        for post in posts[:MAX_SYNC_ITEMS]:
            post_id = post.get('id')
            content = _post_text(post)
            if not post_id or not content:
                continue
            checked += 1
            timestamp = post.get('createdAt') or post.get('lastModifiedAt')
            outcome = save_matching_mention(
                user_id,
                'linkedin',
                brand_name,
                terms,
                profile.get('name') or account.get('account_name', ''),
                content,
                f'https://www.linkedin.com/feed/update/{post_id}/',
                f'post:{post_id}',
                timestamp,
            )
            if outcome == 'added':
                added += 1
                matching += 1
            elif outcome == 'duplicate':
                duplicates += 1
                matching += 1

    create_alerts_if_needed(user_id, 'linkedin', added)
    return build_sync_result(
        'linkedin',
        profile.get('name') or account.get('account_name', ''),
        checked,
        matching,
        added,
        duplicates,
        [],
        f"Up to {MAX_SYNC_ITEMS} recent posts authored by the connected LinkedIn member only; organization posts and other members' public content are not included.",
    )
