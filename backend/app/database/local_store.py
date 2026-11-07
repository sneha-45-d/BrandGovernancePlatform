import hashlib
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from app.config import settings

SESSION_DURATION = timedelta(days=30)


@contextmanager
def _connect():
    database_path = Path(settings.LOCAL_DB_PATH)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    connection.executescript(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS brand_guidelines (
            user_id TEXT NOT NULL,
            brand_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, brand_name)
        );
        CREATE TABLE IF NOT EXISTS content_analyses (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            brand_name TEXT NOT NULL,
            content_title TEXT NOT NULL,
            content TEXT NOT NULL,
            guidelines TEXT NOT NULL,
            analysis TEXT NOT NULL,
            status TEXT NOT NULL,
            review_status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS content_analyses_user_created
            ON content_analyses (user_id, created_at DESC);
        '''
    )
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _user_dict(row):
    return dict(row) if row else None


def create_user(full_name: str, email: str, password_hash: str):
    user_id = str(uuid4())
    now = _now()
    with _connect() as connection:
        connection.execute(
            'INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (user_id, full_name, email, password_hash, now, now),
        )
        return _user_dict(connection.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone())


def find_user_by_email(email: str):
    with _connect() as connection:
        return _user_dict(connection.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone())


def find_user_by_id(user_id: str):
    with _connect() as connection:
        return _user_dict(connection.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone())


def create_session(user_id: str):
    token = f'serverlocal_{secrets.token_urlsafe(32)}'
    with _connect() as connection:
        connection.execute(
            'INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
            (
                hashlib.sha256(token.encode('utf-8')).hexdigest(),
                user_id,
                (datetime.now(timezone.utc) + SESSION_DURATION).isoformat(),
                _now(),
            ),
        )
    return token


def get_session_user(token_hash: str):
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as connection:
        row = connection.execute(
            '''
            SELECT users.*
            FROM auth_sessions
            JOIN users ON users.id = auth_sessions.user_id
            WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
            ''',
            (token_hash, now),
        ).fetchone()
        return _user_dict(row)


def update_user(user_id: str, full_name: str, email: str):
    with _connect() as connection:
        connection.execute(
            'UPDATE users SET full_name = ?, email = ?, updated_at = ? WHERE id = ?',
            (full_name, email, _now(), user_id),
        )
        return _user_dict(connection.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone())


def delete_session(token_hash: str):
    with _connect() as connection:
        connection.execute('DELETE FROM auth_sessions WHERE token_hash = ?', (token_hash,))


def save_guidelines(payload: dict):
    now = _now()
    user_id = payload['user_id']
    brand_name = payload['brand_name']
    serialized = json.dumps(payload)
    with _connect() as connection:
        existing = connection.execute(
            'SELECT created_at FROM brand_guidelines WHERE user_id = ? AND brand_name = ?',
            (user_id, brand_name),
        ).fetchone()
        created_at = existing['created_at'] if existing else now
        connection.execute(
            '''
            INSERT INTO brand_guidelines (user_id, brand_name, payload, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, brand_name) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            ''',
            (user_id, brand_name, serialized, created_at, now),
        )


def get_guidelines(user_id: str, limit: int = 10):
    with _connect() as connection:
        rows = connection.execute(
            'SELECT payload FROM brand_guidelines WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
            (user_id, limit),
        ).fetchall()
        return [json.loads(row['payload']) for row in rows]


def save_analysis(record: dict):
    analysis_id = str(uuid4())
    created_at = record.get('created_at') or _now()
    if hasattr(created_at, 'isoformat'):
        created_at = created_at.isoformat()
    with _connect() as connection:
        connection.execute(
            '''
            INSERT INTO content_analyses (
                id, user_id, brand_name, content_title, content, guidelines,
                analysis, status, review_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                analysis_id,
                record['user_id'],
                record.get('brand_name') or 'BRANDITHM',
                record.get('content_title') or 'Untitled analysis',
                record.get('content') or '',
                json.dumps(record.get('guidelines') or {}),
                json.dumps(record.get('analysis') or {}),
                record.get('status') or 'completed',
                record.get('review_status') or 'needs_review',
                created_at,
            ),
        )
    return analysis_id


def _analysis_dict(row):
    if not row:
        return None
    result = dict(row)
    result['guidelines'] = json.loads(result['guidelines'])
    result['analysis'] = json.loads(result['analysis'])
    return result


def get_analysis(analysis_id: str, user_id: str | None = None):
    query = 'SELECT * FROM content_analyses WHERE id = ?'
    values = [analysis_id]
    if user_id is not None:
        query += ' AND user_id = ?'
        values.append(user_id)
    with _connect() as connection:
        return _analysis_dict(connection.execute(query, values).fetchone())


def list_analyses(user_id: str, status: str | None = None, search: str | None = None, limit: int = 50):
    query = 'SELECT * FROM content_analyses WHERE user_id = ?'
    values: list = [user_id]
    if status:
        query += ' AND status = ?'
        values.append(status)
    query += ' ORDER BY created_at DESC LIMIT ?'
    values.append(limit)
    term = (search or '').strip().lower()
    with _connect() as connection:
        rows = connection.execute(query, values).fetchall()
    results = [_analysis_dict(row) for row in rows]
    if term:
        results = [
            item for item in results
            if term in ' '.join([
                (item.get('analysis') or {}).get('summary') or '',
                item.get('brand_name') or '',
                item.get('content_title') or '',
            ]).lower()
        ]
    return results


def delete_analysis(analysis_id: str, user_id: str):
    with _connect() as connection:
        result = connection.execute(
            'DELETE FROM content_analyses WHERE id = ? AND user_id = ?',
            (analysis_id, user_id),
        )
        return result.rowcount > 0


def update_analysis_review_status(analysis_id: str, user_id: str, status: str):
    with _connect() as connection:
        result = connection.execute(
            'UPDATE content_analyses SET review_status = ? WHERE id = ? AND user_id = ?',
            (status, analysis_id, user_id),
        )
        return result.rowcount > 0
