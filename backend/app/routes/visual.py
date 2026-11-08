from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.database import local_store
from app.services.visual_service import analyze_image_compliance

router = APIRouter()


class VisualGuidelinesInput(BaseModel):
    user_id: str = Field(..., min_length=1)
    approved_colors: list[str] = Field(default_factory=list)
    color_tolerance: int = Field(default=35, ge=5, le=100)
    aspect_ratios: list[str] = Field(default_factory=list)
    min_width_px: int = Field(default=400, ge=50)
    max_width_px: int = Field(default=4000, le=10000)
    min_height_px: int = Field(default=400, ge=50)
    max_height_px: int = Field(default=4000, le=10000)


@router.get('/visual/guidelines')
def get_visual_guidelines(user_id: str = Query(...)):
    return local_store.get_visual_guidelines(user_id)


@router.post('/visual/guidelines')
def save_visual_guidelines(payload: VisualGuidelinesInput):
    saved = local_store.save_visual_guidelines(payload.user_id, payload.model_dump())
    return {
        'message': 'Visual brand guidelines saved successfully.',
        'guidelines': saved,
    }


@router.post('/visual/check')
async def check_visual_compliance(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail='No image file uploaded.')

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail='Uploaded file is empty.')

    # Check guidelines
    guidelines = local_store.get_visual_guidelines(user_id)

    try:
        report = analyze_image_compliance(file_bytes, file.filename, guidelines)
        return report
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Error analyzing image asset: {exc}') from exc

