from fastapi import APIRouter
from app.config import settings
from app.database.mongo import is_mongo_available

router = APIRouter()


@router.get('/health')
def health_check():
    mongo_ok = is_mongo_available()
    gemini_configured = bool(settings.GOOGLE_API_KEY and len(settings.GOOGLE_API_KEY) > 10)

    return {
        'status': 'ok',
        'service': settings.APP_NAME,
        'version': settings.APP_VERSION,
        'database': {
            'active_storage': 'mongodb' if mongo_ok else 'sqlite',
            'mongodb_connected': mongo_ok,
            'local_db_path': settings.LOCAL_DB_PATH,
        },
        'gemini_ai': {
            'configured': gemini_configured,
            'model': settings.GEMINI_MODEL,
        },
    }
