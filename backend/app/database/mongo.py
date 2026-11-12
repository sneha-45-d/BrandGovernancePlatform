import logging
import os
import sys
import time
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from pymongo import MongoClient
from pymongo.errors import ConfigurationError, PyMongoError

from app.config import settings

logger = logging.getLogger(__name__)


def sanitize_mongo_uri(uri: str) -> str:
    uri = (uri or '').strip()
    if not uri:
        return 'mongodb://localhost:27017'

    try:
        parsed = urlsplit(uri)
        if parsed.scheme.startswith('mongodb') and parsed.username and parsed.password:
            safe_user = quote(unquote(parsed.username), safe='')
            safe_password = quote(unquote(parsed.password), safe='')
            hostname = parsed.hostname or 'localhost'
            port = f':{parsed.port}' if parsed.port else ''
            netloc = f'{safe_user}:{safe_password}@{hostname}{port}'
            return urlunsplit(parsed._replace(netloc=netloc))
    except Exception:
        pass

    return uri


class UnavailableCollection:
    def __init__(self, error):
        self.error = error

    def __getattr__(self, _name):
        def raise_unavailable(*_args, **_kwargs):
            raise self.error
        return raise_unavailable


class UnavailableDatabase:
    def __init__(self, error):
        self.error = error

    def __getitem__(self, _name):
        return UnavailableCollection(self.error)


_client = None
_db = None
_mongo_available = None
_last_check_time = 0.0


def _init_client():
    global _client, _db
    if _client is not None:
        return _client, _db

    try:
        _client = MongoClient(
            sanitize_mongo_uri(settings.MONGO_URI),
            connectTimeoutMS=1500,
            serverSelectionTimeoutMS=800,
            socketTimeoutMS=5000,
        )
        _db = _client[settings.DB_NAME]
    except (ConfigurationError, PyMongoError) as exc:
        logger.warning('MongoDB client init error: %s', exc)
        _client = None
        _db = UnavailableDatabase(exc)
    return _client, _db


def is_mongo_available() -> bool:
    global _mongo_available, _last_check_time
    now = time.time()
    # Cache status for 60 seconds
    if _mongo_available is not None and (now - _last_check_time) < 60:
        return _mongo_available

    uri = sanitize_mongo_uri(settings.MONGO_URI)
    is_localhost = 'localhost' in uri or '127.0.0.1' in uri
    is_cloud = bool(os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('PORT') or os.getenv('RENDER') or os.getenv('VERCEL'))
    is_testing = bool(os.getenv('TESTING') or os.getenv('DISABLE_MONGO') or 'pytest' in sys.modules or 'unittest' in sys.modules)

    # Fast skip if explicitly in test mode or unconfigured cloud localhost
    if is_testing or (is_localhost and is_cloud):
        _mongo_available = False
        _last_check_time = now
        return False

    client, _ = _init_client()
    if client is None:
        _mongo_available = False
        _last_check_time = now
        return False

    try:
        client.admin.command('ping', maxTimeMS=700)
        _mongo_available = True
    except Exception as exc:
        logger.info('MongoDB ping failed (%s); using local storage', exc)
        _mongo_available = False

    _last_check_time = now
    return _mongo_available


def get_db():
    _, raw_db = _init_client()
    if not is_mongo_available():
        return UnavailableDatabase(PyMongoError('MongoDB is unavailable; using local storage.'))
    return raw_db
