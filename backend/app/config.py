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
    _default_db = '/tmp/brandithm.sqlite3' if os.getenv('VERCEL') else str(BASE_DIR / 'data' / 'brandithm.sqlite3')
    LOCAL_DB_PATH = os.getenv('LOCAL_DB_PATH', _default_db)
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
    GOOGLE_API_KEY = (os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY') or '').strip()
    GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.6-flash')
    CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', str(BASE_DIR / 'app' / 'data' / 'chroma'))

    _raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173')
    ALLOWED_ORIGINS = [
        origin.strip().rstrip('/')
        for origin in _raw_origins.split(',')
        if origin.strip()
    ]


settings = Settings()
