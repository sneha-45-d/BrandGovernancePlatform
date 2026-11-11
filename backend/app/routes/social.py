import hashlib
import logging
import sqlite3
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.database import social_store
from app.security import get_authenticated_user, verify_user_scope
from app.services import social_intelligence
from app.services import social_oauth

router = APIRouter()
logger = logging.getLogger(__name__)


def _storage_call(operation):
    try:
        return operation()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except sqlite3.Error as exc:
        logger.exception('Social intelligence local database operation failed')
        raise HTTPException(status_code=503, detail='Social intelligence storage is temporarily unavailable.') from exc


class MonitoringConfigInput(BaseModel):
    user_id: str | None = None
    brand_name: str = Field(max_length=120)
    keywords: list[str] = Field(default_factory=list, max_length=50)
    hashtags: list[str] = Field(default_factory=list, max_length=50)
    product_names: list[str] = Field(default_factory=list, max_length=50)
    enabled: bool = False

    @field_validator('brand_name')
    @classmethod
    def normalize_brand_name(cls, value):
        return value.strip()

    @field_validator('keywords', 'hashtags', 'product_names')
    @classmethod
    def normalize_terms(cls, values):
        normalized = [value.strip()[:120] for value in values if value.strip()]
        if len(set(term.casefold() for term in normalized)) != len(normalized):
            raise ValueError('Monitoring terms must not contain duplicates.')
        return normalized


class MentionInput(BaseModel):
    user_id: str | None = None
    entity_name: str = Field(min_length=1, max_length=120)
    entity_type: Literal['brand', 'competitor'] = 'brand'
    platform: Literal['instagram', 'facebook', 'youtube', 'x', 'linkedin', 'manual']
    author: str = Field(default='', max_length=160)
    content: str = Field(min_length=1, max_length=10_000)
    source_url: str = Field(default='', max_length=2048)
    source_post_id: str | None = Field(default=None, max_length=256)
    published_at: datetime
    engagement: dict[str, int] = Field(default_factory=dict)
    collection_source: Literal['user_submitted'] = 'user_submitted'

    @field_validator('entity_name', 'author', 'content', 'source_url')
    @classmethod
    def trim_text(cls, value):
        return value.strip()

    @field_validator('source_url')
    @classmethod
    def validate_source_url(cls, value):
        if value and not value.lower().startswith(('https://', 'http://')):
            raise ValueError('Source links must use http or https.')
        return value

    @field_validator('engagement')
    @classmethod
    def validate_engagement(cls, values):
        if len(values) > 8:
            raise ValueError('At most eight engagement metrics are supported.')
        if any(not key.isidentifier() or value < 0 for key, value in values.items()):
            raise ValueError('Engagement metrics must have valid names and non-negative values.')
        return values


class CompetitorInput(BaseModel):
    user_id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    keywords: list[str] = Field(default_factory=list, max_length=50)

    @field_validator('name')
    @classmethod
    def normalize_name(cls, value):
        return value.strip()

    @field_validator('keywords')
    @classmethod
    def normalize_keywords(cls, values):
        return [value.strip()[:120] for value in values if value.strip()]


class AlertReadInput(BaseModel):
    read: bool


@router.get('/social/overview')
def get_social_overview(
    days: int = Query(default=30, ge=7, le=90),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    platform: str | None = Query(default=None, pattern='^(instagram|facebook|youtube|x|linkedin|manual)$'),
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    if (start_date is None) != (end_date is None):
        raise HTTPException(status_code=422, detail='Provide both start_date and end_date for a custom range.')
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=422, detail='End date must be on or after the start date.')
    if start_date and end_date and (end_date - start_date).days > 365:
        raise HTTPException(status_code=422, detail='Custom date ranges cannot exceed 366 days.')
    return _storage_call(lambda: social_intelligence.build_overview(
        scoped_user_id, days, platform, start_date, end_date,
    ))


@router.get('/social/config')
def get_social_config(
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    config = _storage_call(lambda: social_store.get_config(scoped_user_id))
    accounts = _storage_call(lambda: social_store.list_social_accounts(scoped_user_id))
    account_by_platform = {account['platform']: account for account in accounts}
    platforms = social_intelligence.get_platform_connections(scoped_user_id)
    for integration in platforms:
        account = account_by_platform.get(integration['platform'])
        if account:
            integration['status'] = account['status']
            integration['account_name'] = account['account_name']
            integration['connected_at'] = account['connected_at']
    return {'config': config, 'platforms': platforms}


@router.put('/social/config')
def update_social_config(
    payload: MonitoringConfigInput,
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, payload.user_id)
    if payload.enabled and not payload.brand_name:
        raise HTTPException(status_code=422, detail='Enter a brand name before enabling monitoring.')
    config = _storage_call(lambda: social_store.save_config(
        user_id,
        payload.brand_name,
        payload.keywords,
        payload.hashtags,
        payload.product_names,
        payload.enabled,
    ))
    return {'message': 'Monitoring configuration saved.', 'config': config}


@router.get('/social/mentions')
def get_mentions(
    platform: str | None = Query(default=None, pattern='^(instagram|facebook|youtube|x|linkedin|manual)$'),
    sentiment: str | None = Query(default=None, pattern='^(positive|negative|neutral|unanalysed)$'),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    mentions = _storage_call(lambda: social_store.list_mentions(
        scoped_user_id,
        platform=platform,
        sentiment=sentiment,
        search=search,
        limit=per_page,
        offset=(page - 1) * per_page,
    ))
    total = _storage_call(lambda: social_store.count_mentions(
        scoped_user_id,
        platform=platform,
        sentiment=sentiment,
        search=search,
    ))
    return {
        'mentions': mentions,
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': (total + per_page - 1) // per_page,
    }


@router.post('/social/mentions', status_code=201)
def create_mention(
    payload: MentionInput,
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, payload.user_id)
    config = _storage_call(lambda: social_store.get_config(user_id))
    if not config or not config.get('brand_name'):
        raise HTTPException(status_code=422, detail='Configure your brand name before adding mentions.')
    if payload.entity_type == 'brand' and payload.entity_name.casefold() != config['brand_name'].casefold():
        raise HTTPException(status_code=422, detail='Brand mentions must match the configured brand name.')
    if payload.entity_type == 'brand':
        matching_terms = [
            config['brand_name'],
            *(config.get('keywords') or []),
            *(config.get('hashtags') or []),
            *(config.get('product_names') or []),
        ]
        if not any(term.casefold() in payload.content.casefold() for term in matching_terms):
            raise HTTPException(
                status_code=422,
                detail='The mention content must include a configured brand name, keyword, hashtag, or product.',
            )
    if payload.entity_type == 'competitor':
        competitors = _storage_call(lambda: social_store.list_competitors(user_id))
        if not any(item['name'].casefold() == payload.entity_name.casefold() for item in competitors):
            raise HTTPException(status_code=422, detail='Register this competitor before adding a mention for it.')
    if payload.platform != 'manual' and payload.collection_source != 'user_submitted':
        raise HTTPException(status_code=422, detail='Only verified provider integrations may mark content as API-collected.')
    timestamp = payload.published_at
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    request_data = payload.model_dump()
    request_data['published_at'] = timestamp.astimezone(timezone.utc).isoformat()
    request_data['source_url'] = str(payload.source_url)
    try:
        mention = _storage_call(lambda: social_store.create_mention(user_id, request_data))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    _storage_call(lambda: social_intelligence.create_monitoring_alerts(user_id, payload.platform))
    return {
        'message': 'Mention saved. Run sentiment analysis to generate an AI classification.',
        'mention': mention,
    }


@router.post('/social/mentions/{mention_id}/analyze')
async def analyze_mention(
    mention_id: str,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    mention = _storage_call(lambda: social_store.get_mention(scoped_user_id, mention_id))
    if not mention:
        raise HTTPException(status_code=404, detail='Mention not found.')
    analysis = await social_intelligence.analyze_mention_text(mention['content'])
    updated = _storage_call(lambda: social_store.update_mention_sentiment(
        scoped_user_id,
        mention_id,
        analysis['sentiment'],
        analysis,
    ))
    if not updated:
        raise HTTPException(status_code=404, detail='Mention not found.')
    _storage_call(lambda: social_intelligence.create_monitoring_alerts(scoped_user_id, mention['platform']))
    _storage_call(lambda: social_intelligence.create_recurring_topic_alert(scoped_user_id, mention, analysis))
    return {'message': 'Mention analyzed.', 'sentiment_analysis': analysis}


@router.get('/social/mentions/{mention_id}/reply-drafts')
def get_reply_drafts(
    mention_id: str,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    mention = _storage_call(lambda: social_store.get_mention(scoped_user_id, mention_id))
    if not mention:
        raise HTTPException(status_code=404, detail='Mention not found.')
    drafts = _storage_call(lambda: social_store.list_reply_drafts(scoped_user_id, mention_id))
    return {'mention_id': mention_id, 'draft_sets': drafts, 'publishing_enabled': False}


@router.post('/social/mentions/{mention_id}/reply-drafts', status_code=201)
async def create_reply_drafts(
    mention_id: str,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    mention = _storage_call(lambda: social_store.get_mention(scoped_user_id, mention_id))
    if not mention:
        raise HTTPException(status_code=404, detail='Mention not found.')
    config = _storage_call(lambda: social_store.get_config(scoped_user_id))
    if not config or not config.get('brand_name'):
        raise HTTPException(status_code=422, detail='Configure your brand name before generating reply drafts.')
    analysis = mention.get('sentiment_data') or {}
    drafts = await social_intelligence.generate_reply_drafts(mention, config['brand_name'], analysis)
    saved = _storage_call(lambda: social_store.save_reply_drafts(scoped_user_id, mention_id, drafts['options']))
    return {
        'message': 'Three reply drafts generated for review. Nothing was published.',
        'draft_set': saved,
        'publishing_enabled': False,
    }


@router.get('/social/competitors')
def get_social_competitors(
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    items = _storage_call(lambda: social_store.list_competitors(scoped_user_id))
    overview = _storage_call(lambda: social_intelligence.build_overview(scoped_user_id, days=90))
    return {'competitors': items, 'comparison': overview['competitor_comparison']}


@router.post('/social/competitors', status_code=201)
def create_social_competitor(
    payload: CompetitorInput,
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, payload.user_id)
    if not payload.name:
        raise HTTPException(status_code=422, detail='Competitor name cannot be empty.')
    try:
        competitor = _storage_call(lambda: social_store.save_competitor(user_id, payload.name, payload.keywords))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {'message': 'Competitor saved.', 'competitor': competitor}


@router.put('/social/competitors/{competitor_id}')
def update_social_competitor(
    competitor_id: str,
    payload: CompetitorInput,
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, payload.user_id)
    existing = _storage_call(lambda: social_store.list_competitors(user_id))
    if not any(item['id'] == competitor_id for item in existing):
        raise HTTPException(status_code=404, detail='Competitor not found.')
    try:
        competitor = _storage_call(lambda: social_store.save_competitor(
            user_id,
            payload.name,
            payload.keywords,
            competitor_id=competitor_id,
        ))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {'message': 'Competitor updated.', 'competitor': competitor}


@router.delete('/social/competitors/{competitor_id}')
def delete_social_competitor(
    competitor_id: str,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    deleted = _storage_call(lambda: social_store.delete_competitor(scoped_user_id, competitor_id))
    if not deleted:
        raise HTTPException(status_code=404, detail='Competitor not found.')
    return {'message': 'Competitor removed.'}


@router.get('/social/alerts')
def get_social_alerts(
    unread_only: bool = False,
    severity: str | None = Query(default=None, pattern='^(low|medium|high|critical)$'),
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    alerts = _storage_call(lambda: social_store.list_alerts(scoped_user_id, unread_only, severity))
    return {'alerts': alerts, 'unread_count': sum(not item['read'] for item in alerts)}


@router.patch('/social/alerts/{alert_id}')
def update_social_alert(
    alert_id: str,
    payload: AlertReadInput,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    updated = _storage_call(lambda: social_store.mark_alert_read(scoped_user_id, alert_id, payload.read))
    if not updated:
        raise HTTPException(status_code=404, detail='Alert not found.')
    return {'message': 'Alert updated.', 'id': alert_id, 'read': payload.read}


@router.get('/social/integrations')
def get_social_integrations(
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    accounts = _storage_call(lambda: social_store.list_social_accounts(scoped_user_id))
    account_by_platform = {account['platform']: account for account in accounts}
    integrations = social_intelligence.get_platform_connections(scoped_user_id)
    for integration in integrations:
        account = account_by_platform.get(integration['platform'])
        if account:
            integration['status'] = account['status']
            integration['account_name'] = account['account_name']
            integration['connected_at'] = account['connected_at']
    return {
        'integrations': integrations,
        'message': 'Only OAuth-authorized accounts are listed as connected. Account authentication does not imply access to public posts.',
    }


@router.get('/social/integrations/{platform}/connect')
def connect_social_platform(
    platform: str,
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, None)
    authorization_url = social_oauth.build_authorization_url(platform, user_id)
    return {'authorization_url': authorization_url}


@router.get('/social/integrations/{platform}/callback')
def social_platform_callback(
    platform: str,
    state: str | None = Query(default=None, max_length=256),
    code: str | None = Query(default=None, max_length=4096),
    error: str | None = Query(default=None, max_length=80),
):
    if platform not in social_oauth.PROVIDER_AUTH_URLS:
        raise HTTPException(status_code=404, detail='This social platform is not supported.')
    if error:
        if state:
            try:
                state_hash = hashlib.sha256(state.encode('utf-8')).hexdigest()
                _storage_call(lambda: social_store.consume_oauth_state(state_hash))
            except HTTPException:
                logger.info('OAuth state cleanup did not complete after provider denial')
        return RedirectResponse(
            f'{settings.FRONTEND_URL}/social/overview?social_connection=denied&platform={platform}',
            status_code=303,
        )
    try:
        social_oauth.finish_authorization(platform, state or '', code or '')
        return RedirectResponse(
            f'{settings.FRONTEND_URL}/social/overview?social_connection=connected&platform={platform}',
            status_code=303,
        )
    except HTTPException:
        logger.exception('Social OAuth callback failed for %s', platform)
        return RedirectResponse(
            f'{settings.FRONTEND_URL}/social/overview?social_connection=failed&platform={platform}',
            status_code=303,
        )


@router.delete('/social/integrations/{platform}')
def disconnect_social_platform(
    platform: str,
    user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_authenticated_user),
):
    scoped_user_id = verify_user_scope(current_user, user_id)
    if platform not in social_oauth.PROVIDER_AUTH_URLS:
        raise HTTPException(status_code=404, detail='This social platform is not supported.')
    removed = _storage_call(lambda: social_store.disconnect_social_account(scoped_user_id, platform))
    if not removed:
        raise HTTPException(status_code=404, detail='Social account connection not found.')
    return {
        'message': 'Stored platform tokens were removed. Revoke the Brandithm grant in the platform account settings to invalidate provider-side access.',
    }
