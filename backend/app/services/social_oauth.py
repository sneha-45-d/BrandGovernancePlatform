import base64
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.config import settings
from app.database import social_store
from app.services.social_intelligence import PROVIDER_SETUP, get_platform_connections

logger = logging.getLogger(__name__)
OAUTH_STATE_TTL = timedelta(minutes=10)
OAUTH_TIMEOUT_SECONDS = 12
PROVIDER_AUTH_URLS = {
    'instagram': 'https://www.facebook.com/v27.0/dialog/oauth',
    'facebook': 'https://www.facebook.com/v27.0/dialog/oauth',
    'youtube': 'https://accounts.google.com/o/oauth2/v2/auth',
    'x': 'https://twitter.com/i/oauth2/authorize',
    'linkedin': 'https://www.linkedin.com/oauth/v2/authorization',
}
PROVIDER_TOKEN_URLS = {
    'instagram': 'https://graph.facebook.com/v27.0/oauth/access_token',
    'facebook': 'https://graph.facebook.com/v27.0/oauth/access_token',
    'youtube': 'https://oauth2.googleapis.com/token',
    'x': 'https://api.x.com/2/oauth2/token',
    'linkedin': 'https://www.linkedin.com/oauth/v2/accessToken',
}
PROVIDER_SCOPES = {
    'instagram': 'instagram_basic,instagram_manage_comments,pages_show_list,pages_read_engagement',
    'facebook': 'pages_show_list,pages_read_engagement,pages_read_user_content',
    'youtube': 'https://www.googleapis.com/auth/youtube.readonly',
    'x': 'tweet.read users.read offline.access',
    'linkedin': 'openid profile r_member_social',
}


def _oauth_config(platform):
    if platform not in PROVIDER_AUTH_URLS:
        raise HTTPException(status_code=404, detail='This social platform is not supported.')
    config = settings.SOCIAL_PROVIDER_SETTINGS[platform]
    if not all(config.values()):
        raise HTTPException(
            status_code=503,
            detail=f'{platform.title()} OAuth is not configured. {PROVIDER_SETUP[platform]}',
        )
    if not settings.SOCIAL_OAUTH_ENCRYPTION_KEY:
        raise HTTPException(
            status_code=503,
            detail='Social OAuth is disabled. Configure SOCIAL_OAUTH_ENCRYPTION_KEY with a generated Fernet key before connecting accounts.',
        )
    try:
        Fernet(settings.SOCIAL_OAUTH_ENCRYPTION_KEY.encode('ascii'))
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(
            status_code=503,
            detail='SOCIAL_OAUTH_ENCRYPTION_KEY is invalid. Generate one with Fernet.generate_key() and restart the API.',
        ) from exc
    return config


def build_authorization_url(platform, user_id):
    config = _oauth_config(platform)
    state = secrets.token_urlsafe(32)
    verifier = None
    parameters = {
        'client_id': config['client_id'],
        'redirect_uri': config['redirect_uri'],
        'response_type': 'code',
        'state': state,
        'scope': PROVIDER_SCOPES[platform],
    }

    if platform in {'instagram', 'facebook'}:
        parameters['auth_type'] = 'rerequest'
    elif platform == 'youtube':
        parameters.update({
            'access_type': 'offline',
            'include_granted_scopes': 'true',
            'prompt': 'consent',
        })
    elif platform == 'x':
        verifier = secrets.token_urlsafe(48)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode('ascii')).digest(),
        ).decode('ascii').rstrip('=')
        parameters.update({
            'code_challenge': challenge,
            'code_challenge_method': 'S256',
        })
    elif platform == 'linkedin':
        parameters['response_type'] = 'code'

    expires_at = (datetime.now(timezone.utc) + OAUTH_STATE_TTL).isoformat()
    state_hash = hashlib.sha256(state.encode('utf-8')).hexdigest()
    try:
        social_store.create_oauth_state(
            state_hash,
            user_id,
            platform,
            {'code_verifier': verifier} if verifier else {},
            expires_at,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail='Could not safely start the social account connection.') from exc
    return f"{PROVIDER_AUTH_URLS[platform]}?{urlencode(parameters)}"


def _exchange_token(platform, code, config, state_data):
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': config['redirect_uri'],
        'client_id': config['client_id'],
        'client_secret': config['client_secret'],
    }
    auth = None
    if platform == 'x':
        data['code_verifier'] = state_data.get('code_verifier', '')
        auth = (config['client_id'], config['client_secret'])
    with httpx.Client(timeout=OAUTH_TIMEOUT_SECONDS, follow_redirects=False) as client:
        if platform in {'instagram', 'facebook'}:
            response = client.get(PROVIDER_TOKEN_URLS[platform], params=data)
        else:
            response = client.post(PROVIDER_TOKEN_URLS[platform], data=data, auth=auth)
        response.raise_for_status()
        token = response.json()

        access_token = token.get('access_token')
        if not access_token:
            raise HTTPException(status_code=502, detail='The social provider did not return an access token.')

        if platform in {'instagram', 'facebook'}:
            extended_response = client.get(
                PROVIDER_TOKEN_URLS[platform],
                params={
                    'grant_type': 'fb_exchange_token',
                    'client_id': config['client_id'],
                    'client_secret': config['client_secret'],
                    'fb_exchange_token': access_token,
                },
            )
            extended_response.raise_for_status()
            extended_token = extended_response.json()
            access_token = extended_token.get('access_token') or access_token
            token['expires_in'] = extended_token.get('expires_in', token.get('expires_in'))
            profile_response = client.get(
                'https://graph.facebook.com/v27.0/me',
                params={'fields': 'id,name'},
                headers={'Authorization': f'Bearer {access_token}'},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
            account_name = profile.get('name') or profile.get('id') or platform.title()
        elif platform == 'youtube':
            profile_response = client.get(
                'https://www.googleapis.com/youtube/v3/channels',
                params={'part': 'snippet', 'mine': 'true'},
                headers={'Authorization': f'Bearer {access_token}'},
            )
            profile_response.raise_for_status()
            items = profile_response.json().get('items') or []
            if not items:
                raise HTTPException(status_code=403, detail='The authorized YouTube account has no accessible channel.')
            account_name = items[0].get('snippet', {}).get('title') or 'YouTube account'
        elif platform == 'x':
            profile_response = client.get(
                'https://api.x.com/2/users/me',
                headers={'Authorization': f'Bearer {access_token}'},
            )
            profile_response.raise_for_status()
            profile = profile_response.json().get('data') or {}
            account_name = profile.get('username') or profile.get('name') or 'X account'
        else:
            profile_response = client.get(
                'https://api.linkedin.com/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
            account_name = profile.get('name') or profile.get('email') or 'LinkedIn account'

    granted_scopes = token.get('scope', '')
    if isinstance(granted_scopes, str):
        granted_scopes = granted_scopes.replace(',', ' ').split()
    expires_at = None
    if token.get('expires_in'):
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(token['expires_in']))).isoformat()
    return {
        'access_token': access_token,
        'refresh_token': token.get('refresh_token') or '',
        'expires_at': expires_at,
        'scopes': granted_scopes,
        'account_name': account_name,
    }


def finish_authorization(platform, state, code):
    if not state or not code:
        raise HTTPException(status_code=400, detail='The social provider returned an incomplete OAuth response.')
    state_hash = hashlib.sha256(state.encode('utf-8')).hexdigest()
    try:
        oauth_state = social_store.consume_oauth_state(state_hash)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail='Could not validate the social OAuth session.') from exc
    if not oauth_state or oauth_state['platform'] != platform:
        raise HTTPException(status_code=400, detail='The social OAuth session is invalid, expired, or already used.')
    config = _oauth_config(platform)
    try:
        token = _exchange_token(platform, code, config, oauth_state.get('state_data') or {})
        cipher = Fernet(settings.SOCIAL_OAUTH_ENCRYPTION_KEY.encode('ascii'))
        social_store.save_social_account(
            oauth_state['user_id'],
            platform,
            token['account_name'],
            token['scopes'],
            cipher.encrypt(token['access_token'].encode('utf-8')).decode('ascii'),
            cipher.encrypt(token['refresh_token'].encode('utf-8')).decode('ascii') if token['refresh_token'] else '',
            token['expires_at'],
        )
        return {'user_id': oauth_state['user_id'], 'account_name': token['account_name']}
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        logger.warning('Social provider OAuth failed for %s with HTTP %s', platform, exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f'{platform.title()} rejected the OAuth exchange or profile request. Verify the app permissions and callback URL.',
        ) from exc
    except (httpx.RequestError, ValueError, RuntimeError) as exc:
        logger.exception('Could not complete %s OAuth', platform)
        raise HTTPException(status_code=502, detail=f'Could not complete {platform.title()} authorization.') from exc
