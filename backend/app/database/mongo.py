import logging
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from pymongo import MongoClient
from pymongo.errors import ConfigurationError

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


try:
    client = MongoClient(
        sanitize_mongo_uri(settings.MONGO_URI),
        connectTimeoutMS=2500,
        serverSelectionTimeoutMS=1200,
        socketTimeoutMS=10000,
    )
    db = client[settings.DB_NAME]
except ConfigurationError as exc:
    logger.warning('MongoDB configuration/DNS unavailable during startup; local storage fallbacks remain active')
    db = UnavailableDatabase(exc)


def get_db():
    return db
