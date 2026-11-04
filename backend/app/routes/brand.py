from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class BrandReviewRequest(BaseModel):
    brand_name: str
    content: str
    guidelines: str | None = None


@router.get('/brand/dashboard')
def brand_dashboard():
    return {
        'brand_name': 'BRANDITHM',
        'consistency_score': 94,
        'active_campaigns': 12,
        'pending_reviews': 4,
        'status': 'dashboard_ready'
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
