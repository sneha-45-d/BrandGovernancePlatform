import hashlib
import sqlite3
from datetime import datetime, timezone

from fastapi import Header, HTTPException
from pymongo.errors import PyMongoError

from app.database import local_store
from app.database.mongo import get_db

users_collection = get_db()['users']
sessions_collection = get_db()['auth_sessions']


def require_user(authorization: str | None) -> tuple[dict, str]:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Please sign in to continue.')

    token = authorization.removeprefix('Bearer ').strip()
    if not token:
        raise HTTPException(status_code=401, detail='Please sign in to continue.')

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    if token.startswith('serverlocal_'):
        try:
            user = local_store.get_session_user(token_hash)
        except sqlite3.Error as exc:
            raise HTTPException(status_code=503, detail='Local account storage is temporarily unavailable.') from exc
        if not user:
            raise HTTPException(status_code=401, detail='Your session has expired. Please sign in again.')
        return user, token_hash

    try:
        session = sessions_collection.find_one({
            'token_hash': token_hash,
            'expires_at': {'$gt': datetime.now(timezone.utc)},
        })
        if not session:
            raise HTTPException(status_code=401, detail='Your session has expired. Please sign in again.')
        user = users_collection.find_one({'_id': session['user_id']})
        if not user:
            raise HTTPException(status_code=401, detail='Account not found. Please sign in again.')
        return user, token_hash
    except PyMongoError:
        try:
            user = local_store.get_session_user(token_hash)
        except sqlite3.Error as exc:
            raise HTTPException(status_code=503, detail='Account storage is temporarily unavailable.') from exc
        if not user:
            raise HTTPException(status_code=401, detail='Your session has expired. Please sign in again.')
        return user, token_hash


def get_authenticated_user(authorization: str | None = Header(default=None)) -> dict:
    user, _ = require_user(authorization)
    return user


def get_user_id(user: dict) -> str:
    user_id = user.get('_id') or user.get('id')
    if user_id is None:
        raise HTTPException(status_code=401, detail='The authenticated account is invalid.')
    return str(user_id)


def verify_user_scope(user: dict, requested_user_id: str | None) -> str:
    user_id = get_user_id(user)
    if requested_user_id is not None and requested_user_id != user_id:
        raise HTTPException(status_code=403, detail='You cannot access data belonging to another account.')
    return user_id
