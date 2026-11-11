import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.database import local_store
from app.database.mongo import get_db
from app.security import require_user

router = APIRouter()
users_collection = get_db()['users']
sessions_collection = get_db()['auth_sessions']
SESSION_DURATION = timedelta(days=30)
PASSWORD_ITERATIONS = 310_000


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=256)


class AccountSettingsInput(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PASSWORD_ITERATIONS)
    return f'{salt.hex()}:{digest.hex()}'


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split(':', maxsplit=1)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            bytes.fromhex(salt_hex),
            PASSWORD_ITERATIONS,
        )
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def public_user(user: dict) -> dict:
    is_server_local = '_id' not in user
    return {
        'id': str(user.get('_id') or user.get('id')),
        'full_name': user['full_name'],
        'email': user['email'],
        **({'storage': 'server-local'} if is_server_local else {}),
    }


def create_session(user_id: ObjectId) -> str:
    token = secrets.token_urlsafe(32)
    sessions_collection.insert_one({
        'token_hash': hashlib.sha256(token.encode('utf-8')).hexdigest(),
        'user_id': user_id,
        'expires_at': datetime.now(timezone.utc) + SESSION_DURATION,
        'created_at': datetime.now(timezone.utc),
    })
    return token


@router.post('/auth/register')
def register_user(payload: RegisterRequest):
    email = normalize_email(str(payload.email))
    user = {
        'full_name': payload.full_name.strip(),
        'email': email,
        'password_hash': hash_password(payload.password),
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }

    try:
        users_collection.create_index('email', unique=True)
        result = users_collection.insert_one(user)
        user['_id'] = result.inserted_id
        token = create_session(result.inserted_id)
        return {'token': token, 'user': public_user(user)}
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail='An account with this email already exists.') from exc
    except PyMongoError:
        try:
            local_user = local_store.create_user(user['full_name'], email, user['password_hash'])
            token = local_store.create_session(local_user['id'])
            return {'token': token, 'user': public_user(local_user), 'storage': 'server-local'}
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail='An account with this email already exists.') from exc
        except sqlite3.Error as exc:
            raise HTTPException(status_code=503, detail='Account storage is temporarily unavailable.') from exc


@router.post('/auth/login')
def login_user(payload: LoginRequest):
    normalized = normalize_email(str(payload.email))
    user = None
    try:
        user = users_collection.find_one({'email': normalized})
    except PyMongoError:
        user = None

    if user and verify_password(payload.password, user.get('password_hash')):
        token = create_session(user['_id'])
        return {'token': token, 'user': public_user(user)}

    # Fallback to local store user
    try:
        local_user = local_store.find_user_by_email(normalized)
        if local_user and verify_password(payload.password, local_user.get('password_hash')):
            token = local_store.create_session(local_user['id'])
            return {'token': token, 'user': public_user(local_user), 'storage': 'server-local'}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail='Account storage is temporarily unavailable.') from exc

    raise HTTPException(status_code=401, detail='Email or password is incorrect.')


@router.get('/auth/me')
def get_current_user(authorization: str | None = Header(default=None)):
    user, _ = require_user(authorization)
    return {'user': public_user(user)}


@router.patch('/auth/me')
def update_current_user(
    payload: AccountSettingsInput,
    authorization: str | None = Header(default=None),
):
    user, _ = require_user(authorization)
    if authorization.removeprefix('Bearer ').strip().startswith('serverlocal_'):
        try:
            updated_user = local_store.update_user(
                user['id'],
                payload.full_name.strip(),
                normalize_email(str(payload.email)),
            )
            return {'user': public_user(updated_user), 'storage': 'server-local'}
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail='An account with this email already exists.') from exc
        except sqlite3.Error as exc:
            raise HTTPException(status_code=503, detail='Account settings could not be saved to local server storage.') from exc
    try:
        users_collection.create_index('email', unique=True)
        users_collection.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'full_name': payload.full_name.strip(),
                    'email': normalize_email(str(payload.email)),
                    'updated_at': datetime.now(timezone.utc),
                }
            },
        )
        updated_user = users_collection.find_one({'_id': user['_id']})
        return {'user': public_user(updated_user)}
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail='An account with this email already exists.') from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail='Account settings could not be saved.') from exc


@router.post('/auth/logout')
def logout_user(authorization: str | None = Header(default=None)):
    _, token_hash = require_user(authorization)
    if authorization.removeprefix('Bearer ').strip().startswith('serverlocal_'):
        try:
            local_store.delete_session(token_hash)
            return {'message': 'Signed out successfully.'}
        except sqlite3.Error as exc:
            raise HTTPException(status_code=503, detail='Could not end the local server session.') from exc
    try:
        sessions_collection.delete_one({'token_hash': token_hash})
        return {'message': 'Signed out successfully.'}
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail='Could not end the server session.') from exc
