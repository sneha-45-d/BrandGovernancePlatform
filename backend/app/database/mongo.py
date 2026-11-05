from urllib.parse import quote, urlsplit, urlunsplit

from pymongo import MongoClient

from app.config import settings


def sanitize_mongo_uri(uri: str) -> str:
    uri = (uri or '').strip()
    if not uri:
        return 'mongodb://localhost:27017'

    try:
        parsed = urlsplit(uri)
        if parsed.scheme.startswith('mongodb') and parsed.username and parsed.password:
            safe_user = quote(parsed.username, safe='')
            safe_password = quote(parsed.password, safe='')
            hostname = parsed.hostname or 'localhost'
            port = f':{parsed.port}' if parsed.port else ''
            netloc = f'{safe_user}:{safe_password}@{hostname}{port}'
            return urlunsplit(parsed._replace(netloc=netloc))
    except Exception:
        pass

    return uri


client = MongoClient(sanitize_mongo_uri(settings.MONGO_URI))
db = client[settings.DB_NAME]


def get_db():
    return db
