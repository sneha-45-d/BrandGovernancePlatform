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
    LOCAL_DB_PATH = os.getenv('LOCAL_DB_PATH', str(BASE_DIR / 'data' / 'brandithm.sqlite3'))
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
    GOOGLE_API_KEY = (os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY') or '').strip()
    GEMINI_MODEL = (os.getenv('GEMINI_MODEL') or 'gemini-3.5-flash').strip()
    CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', str(BASE_DIR / 'app' / 'data' / 'chroma'))
    ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
        if origin.strip()
    ]


settings = Settings()
