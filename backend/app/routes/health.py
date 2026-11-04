from fastapi import APIRouter

router = APIRouter()


@router.get('/health')
def health_check():
    return {
        'status': 'ok',
        'service': 'BRANDITHM API',
        'message': 'Backend is running successfully.'
    }
