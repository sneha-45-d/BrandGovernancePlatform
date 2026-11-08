from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import local_store
from app.services.clash_service import check_competitor_clashes

router = APIRouter()

DEFAULT_SAMPLE_COMPETITORS = [
    {
        'name': 'NovaBrand AI',
        'slogans': ['Instant brand compliance in seconds', 'The best AI copy guaranteed'],
        'keywords': ['novaguard', 'hyperbrand', 'instant-audit'],
    },
    {
        'name': 'ApexGovernance',
        'slogans': ['Unbreakable enterprise trust', 'Guaranteed zero violations'],
        'keywords': ['apextrust', 'brandlock', 'zero-risk'],
    },
]


class CompetitorInput(BaseModel):
    user_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    slogans: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class ClashCheckInput(BaseModel):
    text: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    threshold: float = Field(default=0.65, ge=0.3, le=0.95)


@router.get('/competitors')
def get_user_competitors(user_id: str = Query(...)):
    items = local_store.get_competitors(user_id)
    if not items:
        for sample in DEFAULT_SAMPLE_COMPETITORS:
            local_store.add_competitor(
                user_id=user_id,
                name=sample['name'],
                slogans=sample['slogans'],
                keywords=sample['keywords'],
            )
        items = local_store.get_competitors(user_id)
    return {'competitors': items, 'count': len(items)}


@router.post('/competitors')
def add_competitor(payload: CompetitorInput):
    item = local_store.add_competitor(
        user_id=payload.user_id,
        name=payload.name,
        slogans=[s.strip() for s in payload.slogans if s.strip()],
        keywords=[k.strip() for k in payload.keywords if k.strip()],
    )
    return {'message': 'Competitor registered successfully.', 'competitor': item}


@router.put('/competitors/{competitor_id}')
def update_competitor(competitor_id: str, payload: CompetitorInput):
    updated = local_store.update_competitor(
        competitor_id=competitor_id,
        user_id=payload.user_id,
        name=payload.name,
        slogans=[s.strip() for s in payload.slogans if s.strip()],
        keywords=[k.strip() for k in payload.keywords if k.strip()],
    )
    if not updated:
        raise HTTPException(status_code=404, detail='Competitor profile not found.')
    return {'message': 'Competitor updated successfully.', 'competitor': updated}


@router.delete('/competitors/{competitor_id}')
def delete_competitor(competitor_id: str, user_id: str = Query(...)):
    deleted = local_store.delete_competitor(competitor_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail='Competitor profile not found.')
    return {'message': 'Competitor deleted successfully.', 'deleted_id': competitor_id}


@router.post('/competitors/check-clash')
def check_clash(payload: ClashCheckInput):
    competitors = local_store.get_competitors(payload.user_id)
    if not competitors:
        for sample in DEFAULT_SAMPLE_COMPETITORS:
            local_store.add_competitor(
                user_id=payload.user_id,
                name=sample['name'],
                slogans=sample['slogans'],
                keywords=sample['keywords'],
            )
        competitors = local_store.get_competitors(payload.user_id)
    result = check_competitor_clashes(payload.text, competitors, threshold=payload.threshold)
    return result

