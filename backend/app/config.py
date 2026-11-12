import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


class Settings:
    APP_NAME = 'BRANDITHM API'
    APP_VERSION = '0.1.0'
    PORT = int(os.getenv('PORT', '8000'))
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('DB_NAME', 'brandithm')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    _volume_mount = os.getenv('RAILWAY_VOLUME_MOUNT_PATH')
    _default_db_path = str(Path(_volume_mount) / 'brandithm.sqlite3') if _volume_mount else str(BASE_DIR / 'data' / 'brandithm.sqlite3')
    LOCAL_DB_PATH = os.getenv('LOCAL_DB_PATH') or _default_db_path
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
    GEMINI_API_KEY = (os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY') or '').strip()
    GOOGLE_API_KEY = GEMINI_API_KEY
    GEMINI_MODEL = (os.getenv('GEMINI_MODEL') or 'gemini-3.5-flash').strip()
    SOCIAL_OAUTH_ENCRYPTION_KEY = os.getenv('SOCIAL_OAUTH_ENCRYPTION_KEY', '').strip()
    SOCIAL_PROVIDER_SETTINGS = {
        'instagram': {'client_id': os.getenv('META_APP_ID', '').strip(), 'client_secret': os.getenv('META_APP_SECRET', '').strip(), 'redirect_uri': (os.getenv('INSTAGRAM_REDIRECT_URI') or os.getenv('META_REDIRECT_URI') or '').strip()},
        'facebook': {'client_id': os.getenv('META_APP_ID', '').strip(), 'client_secret': os.getenv('META_APP_SECRET', '').strip(), 'redirect_uri': (os.getenv('FACEBOOK_REDIRECT_URI') or os.getenv('META_REDIRECT_URI') or '').strip()},
        'youtube': {'client_id': os.getenv('YOUTUBE_CLIENT_ID', '').strip(), 'client_secret': os.getenv('YOUTUBE_CLIENT_SECRET', '').strip(), 'redirect_uri': os.getenv('YOUTUBE_REDIRECT_URI', '').strip()},
        'x': {'client_id': os.getenv('X_CLIENT_ID', '').strip(), 'client_secret': os.getenv('X_CLIENT_SECRET', '').strip(), 'redirect_uri': os.getenv('X_REDIRECT_URI', '').strip()},
        'linkedin': {'client_id': os.getenv('LINKEDIN_CLIENT_ID', '').strip(), 'client_secret': os.getenv('LINKEDIN_CLIENT_SECRET', '').strip(), 'redirect_uri': os.getenv('LINKEDIN_REDIRECT_URI', '').strip()},
    }
    CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', str(BASE_DIR / 'app' / 'data' / 'chroma'))
    ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
        if origin.strip()
    ]


settings = Settings()
