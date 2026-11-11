import logging
import math
import sqlite3
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.errors import PyMongoError

from app.database import local_store
from app.database.mongo import get_db
from app.security import get_authenticated_user, verify_user_scope

router = APIRouter()
logger = logging.getLogger(__name__)
content_collection = get_db()['content_analysis']


class BrandReviewRequest(BaseModel):
    brand_name: str
    content: str
    guidelines: str | None = None


@router.get('/brand/dashboard')
def brand_dashboard(
    user_id: str | None = Query(None),
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, user_id)
    storage = 'mongodb'
    try:
        reports = list(
            content_collection.find(
                {'user_id': user_id},
                {
                    'user_id': 1,
                    'analysis.overall_score': 1,
                    'analysis.brand_compliance_score': 1,
                    'analysis.summary': 1,
                    'analysis.violations.severity': 1,
                    'created_at': 1,
                    'brand_name': 1,
                    'content_title': 1,
                    'title': 1,
                    'status': 1,
                    'review_status': 1,
                },
            )
            .sort('created_at', -1)
            .limit(1000)
        )
    except PyMongoError:
        logger.warning('MongoDB unavailable; loading dashboard data from local server storage')
        reports = []
        storage = 'server-local'

    try:
        local_reports = local_store.list_analyses(user_id, limit=1000)
    except sqlite3.Error as exc:
        if storage == 'server-local':
            logger.exception('Unable to load dashboard data from local server storage')
            raise HTTPException(status_code=503, detail='Brand dashboard data is unavailable from both storage systems.') from exc
        logger.warning('Unable to include local server reviews in the dashboard: %s', exc)
        local_reports = []

    existing_ids = {str(report.get('_id')) for report in reports}
    for report in local_reports:
        local_id = f"serverlocal-{report['id']}"
        if local_id in existing_ids:
            continue
        reports.append({
            '_id': local_id,
            'brand_name': report.get('brand_name'),
            'content_title': report.get('content_title'),
            'status': report.get('status'),
            'review_status': report.get('review_status'),
            'created_at': report.get('created_at'),
            'analysis': report.get('analysis') or {},
        })
    reports.sort(key=lambda item: str(item.get('created_at') or ''), reverse=True)

    scores = []
    for report in reports:
        score = (report.get('analysis') or {}).get('overall_score')
        try:
            numeric_score = float(score)
        except (TypeError, ValueError):
            continue
        if math.isfinite(numeric_score):
            scores.append(numeric_score)
    flagged = sum(
        any(
            str(issue.get('severity', '')).lower() in {'high', 'critical'}
            for issue in ((report.get('analysis') or {}).get('violations') or [])
            if isinstance(issue, dict)
        )
        for report in reports
    )

    recent_analyses = [
        {
            'id': str(report.get('_id')),
            'brand_name': report.get('brand_name') or 'BRANDITHM',
            'title': report.get('content_title') or report.get('title') or 'Untitled analysis',
            'summary': (report.get('analysis') or {}).get('summary') or '',
            'overall_score': (report.get('analysis') or {}).get('overall_score'),
            'compliance_score': (report.get('analysis') or {}).get('brand_compliance_score'),
            'status': report.get('status') or 'completed',
            'review_status': report.get('review_status') or 'needs_review',
            'created_at': report.get('created_at'),
        }
        for report in reports[:50]
    ]

    return {
        'brand_name': (reports[0].get('brand_name') if reports else None) or 'BRANDITHM',
        'consistency_score': round(sum(scores) / len(scores)) if scores else None,
        'total_analyzed': len(reports),
        'approved': len(reports) - flagged,
        'flagged': flagged,
        'status': 'ready',
        'recent_analyses': recent_analyses,
        'storage': 'mixed' if storage == 'mongodb' and local_reports else storage,
    }


@router.get('/analytics')
def brand_analytics(
    start_date: date,
    end_date: date,
    user_id: str | None = Query(None),
    current_user: dict = Depends(get_authenticated_user),
):
    user_id = verify_user_scope(current_user, user_id)
    if end_date < start_date:
        raise HTTPException(status_code=422, detail='End date must be on or after the start date.')
    if (end_date - start_date).days > 365:
        raise HTTPException(status_code=422, detail='Analytics date range cannot exceed 366 days.')

    start_at = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_before = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
    mongo_available = True
    try:
        mongo_reports = list(content_collection.find(
            {
                'user_id': user_id,
                'created_at': {'$gte': start_at, '$lt': end_before},
            },
            {
                'user_id': 1,
                'brand_name': 1,
                'content_title': 1,
                'title': 1,
                'analysis.overall_score': 1,
                'analysis.brand_compliance_score': 1,
                'analysis.violations': 1,
                'analysis.engine': 1,
                'status': 1,
                'review_status': 1,
                'created_at': 1,
            },
        ).sort('created_at', 1))
    except PyMongoError:
        logger.warning('MongoDB unavailable; loading analytics from local server storage')
        mongo_reports = []
        mongo_available = False

    try:
        local_reports = local_store.list_analyses_between(
            user_id,
            start_at.isoformat(),
            end_before.isoformat(),
        )
    except sqlite3.Error as exc:
        if not mongo_available:
            logger.exception('Unable to load analytics from local server storage')
            raise HTTPException(status_code=503, detail='Analytics are unavailable from both storage systems.') from exc
        logger.exception('Unable to include local server records in analytics')
        local_reports = []
        storage_warning = 'Some server-local analysis records could not be included.'
    else:
        storage_warning = None

    reports = list(mongo_reports)
    report_ids = {str(report.get('_id')) for report in reports}
    for report in local_reports:
        local_id = f"serverlocal-{report['id']}"
        if local_id in report_ids:
            continue
        reports.append({
            '_id': local_id,
            'brand_name': report.get('brand_name'),
            'content_title': report.get('content_title'),
            'status': report.get('status'),
            'review_status': report.get('review_status'),
            'created_at': report.get('created_at'),
            'analysis': report.get('analysis') or {},
        })

    def report_datetime(report: dict) -> datetime | None:
        value = report.get('created_at')
        if isinstance(value, datetime):
            return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
            except ValueError:
                return None
        return None

    def format_day(value: date) -> str:
        return value.strftime('%b %d').replace(' 0', ' ')

    reports = [
        report for report in reports
        if (created_at := report_datetime(report)) is not None
        and start_at <= created_at < end_before
    ]
    reports.sort(key=lambda report: report_datetime(report) or start_at)

    daily_counts = Counter()
    score_series = []
    review_counts = Counter()
    violation_counts = Counter()
    scores = []
    violation_count = 0
    recent_activity = []

    for report in reports:
        created_at = report_datetime(report)
        if created_at is None:
            continue
        analysis = report.get('analysis') or {}
        day = created_at.date().isoformat()
        daily_counts[day] += 1

        score = analysis.get('brand_compliance_score')
        if score is None:
            score = analysis.get('overall_score')
        try:
            numeric_score = float(score)
            if math.isfinite(numeric_score) and 0 <= numeric_score <= 100:
                scores.append(numeric_score)
                score_series.append({
                    'label': format_day(created_at),
                    'score': round(numeric_score, 1),
                })
        except (TypeError, ValueError):
            pass

        review_status = report.get('review_status') or 'needs_review'
        if review_status not in {'needs_review', 'approved', 'revision_requested'}:
            review_status = 'needs_review'
        review_counts[review_status] += 1

        violations = analysis.get('violations') or []
        actual_violations = [
            item for item in violations
            if isinstance(item, dict)
            and item.get('title') != 'No critical brand violations detected'
        ]
        violation_count += len(actual_violations)
        for item in actual_violations:
            title = str(item.get('title') or 'Uncategorized finding').strip()
            if title:
                violation_counts[title] += 1

    day_count = (end_date - start_date).days + 1
    trend_series = []
    cumulative = 0
    for offset in range(day_count):
        day = (start_date + timedelta(days=offset)).isoformat()
        count = daily_counts[day]
        cumulative += count
        trend_series.append({
            'label': format_day(start_date + timedelta(days=offset)),
            'analyses': count,
            'cumulative': cumulative,
        })

    for report in reversed(reports[:]):
        if len(recent_activity) >= 10:
            break
        analysis = report.get('analysis') or {}
        created_at = report_datetime(report)
        if created_at is None:
            continue
        recent_activity.append({
            'id': str(report.get('_id')),
            'title': report.get('content_title') or report.get('title') or 'Untitled analysis',
            'engine': analysis.get('engine') or 'unknown',
            'review_status': report.get('review_status') or 'needs_review',
            'created_at': created_at.isoformat(),
        })

    response = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'overview': {
            'total_analyzed': len(reports),
            'approved': review_counts['approved'],
            'revision_requested': review_counts['revision_requested'],
            'needs_review': review_counts['needs_review'],
            'consistency_score': round(sum(scores) / len(scores), 1) if scores else None,
            'violations': violation_count,
        },
        'score_series': score_series,
        'review_series': [
            {'name': 'Approved', 'value': review_counts['approved']},
            {'name': 'Needs review', 'value': review_counts['needs_review']},
            {'name': 'Revision requested', 'value': review_counts['revision_requested']},
        ],
        'violation_data': [
            {'name': name, 'value': count}
            for name, count in violation_counts.most_common(6)
        ],
        'trend_series': trend_series,
        'recent_activity': recent_activity,
        'storage': 'mixed' if mongo_available and local_reports else (
            'mongodb' if mongo_available else 'server-local'
        ),
    }
    if storage_warning:
        response['warning'] = storage_warning
    return response


@router.post('/brand/review')
def review_brand_content(
    payload: BrandReviewRequest,
    _current_user: dict = Depends(get_authenticated_user),
):
    return {
        'brand_name': payload.brand_name,
        'score': 94,
        'findings': [
            'Brand voice remains consistent across the content.',
            'Tone is aligned with the approved guidelines.',
            'A minor campaign wording update is recommended.'
        ],
        'status': 'ai_review_placeholder'
    }
