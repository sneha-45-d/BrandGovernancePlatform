import logging
import math
import sqlite3

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from pymongo.errors import PyMongoError

from app.database import local_store
from app.database.mongo import get_db

router = APIRouter()
logger = logging.getLogger(__name__)
content_collection = get_db()['content_analysis']


class BrandReviewRequest(BaseModel):
    brand_name: str
    content: str
    guidelines: str | None = None


@router.get('/brand/dashboard')
def brand_dashboard(user_id: str = Query('demo-user')):
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


@router.post('/brand/review')
def review_brand_content(payload: BrandReviewRequest):
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
