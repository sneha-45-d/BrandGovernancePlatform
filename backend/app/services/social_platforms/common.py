import logging
from datetime import datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.config import settings
from app.database import social_store

logger = logging.getLogger(__name__)
HTTP_TIMEOUT = 20
MAX_SYNC_ITEMS = 100
META_GRAPH = 'https://graph.facebook.com/v27.0'
X_API = 'https://api.x.com/2'
LINKEDIN_API = 'https://api.linkedin.com'
LINKEDIN_VERSION = '202610'


def validate_monitoring_config(config):
    if not config or not config.get('enabled') or not config.get('brand_name'):
        raise HTTPException(
            status_code=422,
            detail='Configure your brand name and enable the monitoring profile before syncing social accounts.',
        )


def tracked_terms(config):
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


def matches_tracked_terms(text, terms):
    normalized_text = text.casefold()
    return any(term in normalized_text for term in terms)


def published_at(value):
    try:
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value, timezone.utc)
        elif isinstance(value, datetime):
            parsed = value
        elif isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        else:
            return None
    except (OverflowError, OSError, TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def _cipher():
    try:
        return Fernet(settings.SOCIAL_OAUTH_ENCRYPTION_KEY.encode('ascii'))
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail='Social account token encryption is not configured correctly. Contact the administrator.',
        ) from exc


def _is_expired(value, leeway=timedelta(seconds=30)):
    if not value:
        return False
    try:
        expires = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires <= datetime.now(timezone.utc) + leeway
    except ValueError:
        return True


def _oauth_refresh(user_id, platform, account, cipher):
    provider = settings.SOCIAL_PROVIDER_SETTINGS[platform]
    refresh_encrypted = account.get('refresh_token_encrypted') or ''
    refresh_token = cipher.decrypt(refresh_encrypted.encode('ascii')).decode('utf-8') if refresh_encrypted else ''
    try:
        if platform == 'facebook' or platform == 'instagram':
            response = httpx.get(
                f'{META_GRAPH}/oauth/access_token',
                params={
                    'grant_type': 'fb_exchange_token',
                    'client_id': provider['client_id'],
                    'client_secret': provider['client_secret'],
                    'fb_exchange_token': cipher.decrypt(
                        account['access_token_encrypted'].encode('ascii'),
                    ).decode('utf-8'),
                },
                timeout=HTTP_TIMEOUT,
                follow_redirects=False,
            )
        else:
            data = {
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
                'client_id': provider['client_id'],
            }
            auth = None
            if platform == 'x':
                auth = (provider['client_id'], provider['client_secret'])
            else:
                data['client_secret'] = provider['client_secret']
            response = httpx.post(
                'https://api.x.com/2/oauth2/token' if platform == 'x'
                else f'{LINKEDIN_API}/oauth/v2/accessToken',
                data=data,
                auth=auth,
                timeout=HTTP_TIMEOUT,
                follow_redirects=False,
            )
    except httpx.RequestError as exc:
        logger.warning('%s token refresh request failed (%s).', platform, type(exc).__name__)
        raise HTTPException(status_code=503, detail=f'Could not refresh the {platform.title()} session. Try again later.') from exc

    if response.status_code >= 400:
        try:
            provider_error = response.json().get('error')
        except ValueError:
            provider_error = None
        if provider_error in {'invalid_grant', 'invalid_token', 'expired_token'} or _is_expired(account.get('token_expires_at')):
            social_store.update_social_account_status(user_id, platform, 'reauth_required')
            raise HTTPException(
                status_code=401,
                detail=f'The {platform.title()} authorization expired or was revoked. Reconnect the account before syncing.',
            )
        _raise_provider_error(platform, response, user_id)

    try:
        token = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f'{platform.title()} returned an invalid token response.') from exc
    access_token = token.get('access_token')
    if not access_token:
        raise HTTPException(status_code=502, detail=f'{platform.title()} did not return a refreshed access token.')
    expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=int(token.get('expires_in', 3600)))
    ).isoformat()
    new_refresh_token = token.get('refresh_token') or refresh_token
    saved = social_store.update_social_account_tokens(
        user_id,
        platform,
        cipher.encrypt(access_token.encode('utf-8')).decode('ascii'),
        cipher.encrypt(new_refresh_token.encode('utf-8')).decode('ascii') if new_refresh_token else '',
        expires_at,
    )
    if not saved:
        raise HTTPException(status_code=503, detail=f'Could not persist the refreshed {platform.title()} authorization.')
    return access_token


def get_access_token(user_id, platform):
    account = social_store.get_social_account_credentials(user_id, platform)
    if not account or account.get('status') != 'connected':
        raise HTTPException(status_code=409, detail=f'Connect a {platform.title()} account before syncing.')
    encrypted_token = account.get('access_token_encrypted')
    if not encrypted_token:
        raise HTTPException(status_code=409, detail=f'The {platform.title()} connection has no stored token. Reconnect it.')

    cipher = _cipher()
    try:
        if platform in {'facebook', 'instagram'}:
            refresh_due = _is_expired(account.get('token_expires_at'), timedelta(days=7))
            if refresh_due and account.get('token_expires_at') and not _is_expired(account.get('token_expires_at')):
                return _oauth_refresh(user_id, platform, account, cipher), account
        if _is_expired(account.get('token_expires_at')):
            if account.get('refresh_token_encrypted') and platform in {'x', 'linkedin'}:
                return _oauth_refresh(user_id, platform, account, cipher), account
            social_store.update_social_account_status(user_id, platform, 'reauth_required')
            raise HTTPException(
                status_code=401,
                detail=f'The {platform.title()} authorization expired. Reconnect the account before syncing.',
            )
        access_token = cipher.decrypt(encrypted_token.encode('ascii')).decode('utf-8')
        return access_token, account
    except InvalidToken as exc:
        raise HTTPException(
            status_code=409,
            detail=f'The saved {platform.title()} token cannot be decrypted. Reconnect it with the current OAuth encryption key.',
        ) from exc


def _raise_provider_error(platform, response, user_id=None):
    if response.status_code == 401:
        if user_id:
            social_store.update_social_account_status(user_id, platform, 'reauth_required')
        raise HTTPException(status_code=401, detail=f'{platform.title()} authorization is invalid. Reconnect the account and try again.')
    if response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f'{platform.title()} denied this collection request. Check that the connected account and app have the required read permissions and asset roles.',
        )
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail=f'{platform.title()} rate limit or API quota reached. Try again later.')
    if response.status_code >= 500:
        raise HTTPException(status_code=503, detail=f'{platform.title()} is temporarily unavailable. Try syncing again shortly.')
    raise HTTPException(
        status_code=502,
        detail=f'{platform.title()} rejected the data request. Check API access and reconnect if required.',
    )


def provider_get(client, platform, url, access_token, params=None, headers=None, user_id=None):
    request_headers = {'Authorization': f'Bearer {access_token}'}
    request_headers.update(headers or {})
    try:
        response = client.get(
            url,
            params=params,
            headers=request_headers,
        )
    except httpx.RequestError as exc:
        logger.warning('%s API request failed (%s).', platform, type(exc).__name__)
        raise HTTPException(status_code=503, detail=f'Could not reach {platform.title()}. Check the backend network and try again.') from exc
    if response.status_code >= 400:
        _raise_provider_error(platform, response, user_id)
    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f'{platform.title()} returned an invalid data response.') from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail=f'{platform.title()} returned an invalid data response.')
    return payload


def save_matching_mention(user_id, platform, brand_name, terms, author, content, source_url, source_post_id, date, engagement=None):
    if not isinstance(content, str) or not content or not matches_tracked_terms(content, terms):
        return 'not_matching'
    timestamp = published_at(date)
    if not timestamp:
        return 'invalid_date'
    record = {
        'entity_name': brand_name,
        'entity_type': 'brand',
        'platform': platform,
        'author': (author if isinstance(author, str) else '')[:240],
        'content': content[:10_000],
        'source_url': source_url or '',
        'source_post_id': source_post_id,
        'published_at': timestamp,
        'engagement': {
            key: value for key, value in (engagement or {}).items()
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0
        },
        'collection_source': 'authorized_api',
    }
    try:
        social_store.create_mention(user_id, record)
        return 'added'
    except ValueError:
        return 'duplicate'


def build_sync_result(platform, account_name, checked, matching, added, duplicates, warnings, scope):
    return {
        'platform': platform,
        'account_name': account_name,
        'records_checked': checked,
        'matching_records': matching,
        'mentions_added': added,
        'duplicates_skipped': duplicates,
        'warnings': list(dict.fromkeys(warnings)),
        'collection_scope': scope,
    }


def create_alerts_if_needed(user_id, platform, added):
    if added:
        from app.services.social_intelligence import create_monitoring_alerts

        create_monitoring_alerts(user_id, platform)
