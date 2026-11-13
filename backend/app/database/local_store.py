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


def _init_db(connection):
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

        CREATE TABLE IF NOT EXISTS competitors (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slogans TEXT NOT NULL,
            keywords TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS competitors_user
            ON competitors (user_id);

        CREATE TABLE IF NOT EXISTS social_monitoring_config (
            user_id TEXT PRIMARY KEY,
            brand_name TEXT NOT NULL DEFAULT '',
            keywords TEXT NOT NULL DEFAULT '[]',
            hashtags TEXT NOT NULL DEFAULT '[]',
            product_names TEXT NOT NULL DEFAULT '[]',
            enabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS social_mentions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            entity_type TEXT NOT NULL DEFAULT 'brand',
            platform TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL,
            source_url TEXT NOT NULL DEFAULT '',
            source_post_id TEXT,
            published_at TEXT NOT NULL,
            sentiment TEXT NOT NULL DEFAULT 'unanalysed',
            sentiment_data TEXT NOT NULL DEFAULT '{}',
            engagement TEXT NOT NULL DEFAULT '{}',
            collection_source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE (user_id, platform, source_post_id)
        );
        CREATE INDEX IF NOT EXISTS social_mentions_user_published
            ON social_mentions (user_id, published_at DESC);
        CREATE INDEX IF NOT EXISTS social_mentions_user_platform_sentiment
            ON social_mentions (user_id, platform, sentiment);
        CREATE TABLE IF NOT EXISTS social_reply_drafts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            mention_id TEXT NOT NULL,
            drafts TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS social_reply_drafts_user_mention
            ON social_reply_drafts (user_id, mention_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS social_competitors (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            keywords TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (user_id, name)
        );
        CREATE INDEX IF NOT EXISTS social_competitors_user
            ON social_competitors (user_id);
        CREATE TABLE IF NOT EXISTS social_alerts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'all',
            recommended_action TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            trigger_key TEXT NOT NULL,
            detected_at TEXT NOT NULL,
            UNIQUE (user_id, trigger_key)
        );
        CREATE INDEX IF NOT EXISTS social_alerts_user_detected
            ON social_alerts (user_id, detected_at DESC);
        CREATE TABLE IF NOT EXISTS social_accounts (
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            account_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'disconnected',
            scopes TEXT NOT NULL DEFAULT '[]',
            access_token_encrypted TEXT NOT NULL DEFAULT '',
            refresh_token_encrypted TEXT NOT NULL DEFAULT '',
            token_expires_at TEXT,
            connected_at TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, platform)
        );
        CREATE TABLE IF NOT EXISTS social_oauth_states (
            state_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            state_data TEXT NOT NULL DEFAULT '{}',
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS social_posts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            external_id TEXT NOT NULL,
            caption TEXT NOT NULL DEFAULT '',
            media_url TEXT NOT NULL DEFAULT '',
            media_type TEXT NOT NULL DEFAULT 'text',
            permalink TEXT NOT NULL DEFAULT '',
            published_at TEXT NOT NULL,
            metrics TEXT NOT NULL DEFAULT '{}',
            audit_status TEXT NOT NULL DEFAULT 'unaudited',
            audit_result TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (user_id, platform, external_id)
        );
        CREATE INDEX IF NOT EXISTS social_posts_user_platform
            ON social_posts (user_id, platform, published_at DESC);
        CREATE INDEX IF NOT EXISTS social_posts_user_audit
            ON social_posts (user_id, audit_status);

        CREATE TABLE IF NOT EXISTS visual_guidelines (
            user_id TEXT PRIMARY KEY,
            approved_colors TEXT NOT NULL,
            color_tolerance INTEGER DEFAULT 30,
            aspect_ratios TEXT NOT NULL,
            min_width_px INTEGER DEFAULT 400,
            max_width_px INTEGER DEFAULT 4000,
            min_height_px INTEGER DEFAULT 400,
            max_height_px INTEGER DEFAULT 4000,
            updated_at TEXT NOT NULL
        );
        '''
    )
    for column, col_type in [
        ('champion_score', 'INTEGER DEFAULT 0'),
        ('streak_days', 'INTEGER DEFAULT 0'),
        ('last_submission_date', 'TEXT'),
        ('badges', "TEXT DEFAULT '[]'"),
        ('total_submissions', 'INTEGER DEFAULT 0'),
    ]:
        try:
            connection.execute(f'ALTER TABLE users ADD COLUMN {column} {col_type}')
        except sqlite3.OperationalError:
            pass
    try:
        connection.execute('ALTER TABLE social_mentions ADD COLUMN entity_type TEXT')
    except sqlite3.OperationalError:
        pass


_initialized_paths = set()


def ensure_db_ready(target_path: Path | str | None = None):
    db_path = Path(target_path or settings.LOCAL_DB_PATH)
    try:
        path_key = str(db_path.resolve())
    except Exception:
        path_key = str(db_path)
    if path_key in _initialized_paths:
        return
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path, timeout=10) as conn:
        conn.execute('PRAGMA journal_mode = WAL')
        conn.execute('PRAGMA synchronous = NORMAL')
        conn.execute('PRAGMA cache_size = -64000')
        conn.execute('PRAGMA temp_store = MEMORY')
        conn.execute('PRAGMA foreign_keys = ON')
        _init_db(conn)
    _initialized_paths.add(path_key)


@contextmanager
def _connect():
    database_path = Path(settings.LOCAL_DB_PATH)
    try:
        path_key = str(database_path.resolve())
    except Exception:
        path_key = str(database_path)
    if path_key not in _initialized_paths:
        ensure_db_ready(database_path)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    connection.execute('PRAGMA synchronous = NORMAL')
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


def list_analyses(
    user_id: str,
    status: str | None = None,
    search: str | None = None,
    limit: int | None = 50,
    title_prefix: str | None = None,
):
    query = 'SELECT * FROM content_analyses WHERE user_id = ?'
    values: list = [user_id]
    if status:
        query += ' AND status = ?'
        values.append(status)
    term = (search or '').strip().lower()
    prefix = (title_prefix or '').strip().lower()
    if prefix:
        pattern = f"{prefix.replace('!', '!!').replace('%', '!%').replace('_', '!_')}%"
        query += " AND LOWER(content_title) LIKE ? ESCAPE '!'"
        values.append(pattern)
    elif term:
        pattern = f"%{term.replace('!', '!!').replace('%', '!%').replace('_', '!_')}%"
        query += '''
            AND (
                LOWER(brand_name) LIKE ? ESCAPE '!'
                OR LOWER(content_title) LIKE ? ESCAPE '!'
                OR LOWER(content) LIKE ? ESCAPE '!'
                OR LOWER(COALESCE(json_extract(analysis, '$.summary'), '')) LIKE ? ESCAPE '!'
            )
        '''
        values.extend([pattern, pattern, pattern, pattern])
    query += ' ORDER BY created_at DESC'
    if limit is not None:
        query += ' LIMIT ?'
        values.append(limit)
    with _connect() as connection:
        rows = connection.execute(query, values).fetchall()
    return [_analysis_dict(row) for row in rows]


def list_analyses_between(user_id: str, start_at: str, end_before: str) -> list[dict]:
    with _connect() as connection:
        rows = connection.execute(
            '''
            SELECT id, user_id, brand_name, content_title, analysis, status, review_status, created_at
            FROM content_analyses
            WHERE user_id = ? AND created_at >= ? AND created_at < ?
            ORDER BY created_at ASC
            ''',
            (user_id, start_at, end_before),
        ).fetchall()
    reports = []
    for row in rows:
        report = dict(row)
        report['analysis'] = json.loads(report['analysis'])
        reports.append(report)
    return reports


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


# -------------------------------------------------------------
# Champion Scoring & Leaderboard
# -------------------------------------------------------------

def get_user_champion_stats(user_id: str) -> dict:
    with _connect() as connection:
        row = connection.execute(
            'SELECT id, full_name, email, champion_score, streak_days, last_submission_date, badges, total_submissions FROM users WHERE id = ?',
            (user_id,),
        ).fetchone()
        if not row:
            return {
                'user_id': user_id,
                'champion_score': 0,
                'streak_days': 0,
                'last_submission_date': None,
                'badges': [],
                'total_submissions': 0,
            }
        data = dict(row)
        try:
            data['badges'] = json.loads(data.get('badges') or '[]')
        except Exception:
            data['badges'] = []
        return data


def record_submission_and_score(user_id: str, points: int, new_badges: list[str]) -> dict:
    today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    with _connect() as connection:
        row = connection.execute(
            'SELECT champion_score, streak_days, last_submission_date, badges, total_submissions FROM users WHERE id = ?',
            (user_id,),
        ).fetchone()
        if not row:
            return {
                'champion_score': points,
                'streak_days': 1,
                'badges': new_badges,
                'total_submissions': 1,
                'points_earned': points,
            }

        current_score = row['champion_score'] or 0
        current_streak = row['streak_days'] or 0
        last_date = row['last_submission_date']
        total_sub = (row['total_submissions'] or 0) + 1

        try:
            existing_badges = json.loads(row['badges'] or '[]')
        except Exception:
            existing_badges = []

        # Calculate streak logic
        if last_date == today_str:
            new_streak = max(1, current_streak)
        elif last_date:
            try:
                last_dt = datetime.strptime(last_date, '%Y-%m-%d').date()
                today_dt = datetime.now(timezone.utc).date()
                if (today_dt - last_dt).days == 1:
                    new_streak = current_streak + 1
                else:
                    new_streak = 1
            except Exception:
                new_streak = 1
        else:
            new_streak = 1

        updated_badges = list(dict.fromkeys(existing_badges + new_badges))
        updated_score = current_score + points

        connection.execute(
            '''
            UPDATE users SET
                champion_score = ?,
                streak_days = ?,
                last_submission_date = ?,
                badges = ?,
                total_submissions = ?,
                updated_at = ?
            WHERE id = ?
            ''',
            (
                updated_score,
                new_streak,
                today_str,
                json.dumps(updated_badges),
                total_sub,
                _now(),
                user_id,
            ),
        )

        return {
            'champion_score': updated_score,
            'streak_days': new_streak,
            'badges': updated_badges,
            'total_submissions': total_sub,
            'points_earned': points,
        }


def get_leaderboard(limit: int = 10) -> list[dict]:
    with _connect() as connection:
        rows = connection.execute(
            '''
            SELECT id, full_name, champion_score, streak_days, badges, total_submissions
            FROM users
            ORDER BY champion_score DESC, total_submissions DESC
            LIMIT ?
            ''',
            (limit,),
        ).fetchall()
        leaderboard = []
        for index, row in enumerate(rows, start=1):
            item = dict(row)
            try:
                item['badges'] = json.loads(item.get('badges') or '[]')
            except Exception:
                item['badges'] = []
            item['rank'] = index
            item['display_name'] = item.get('full_name') or 'Anonymous User'
            leaderboard.append(item)
        return leaderboard


# -------------------------------------------------------------
# Competitor IP Management
# -------------------------------------------------------------

def add_competitor(user_id: str, name: str, slogans: list[str], keywords: list[str]) -> dict:
    comp_id = str(uuid4())
    now = _now()
    with _connect() as connection:
        connection.execute(
            'INSERT INTO competitors (id, user_id, name, slogans, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (comp_id, user_id, name.strip(), json.dumps(slogans), json.dumps(keywords), now),
        )
    return {
        'id': comp_id,
        'user_id': user_id,
        'name': name.strip(),
        'slogans': slogans,
        'keywords': keywords,
        'created_at': now,
    }


def get_competitors(user_id: str) -> list[dict]:
    with _connect() as connection:
        rows = connection.execute(
            'SELECT * FROM competitors WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,),
        ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item['slogans'] = json.loads(item.get('slogans') or '[]')
            item['keywords'] = json.loads(item.get('keywords') or '[]')
            result.append(item)
        return result


def get_competitor(competitor_id: str, user_id: str) -> dict | None:
    with _connect() as connection:
        row = connection.execute(
            'SELECT * FROM competitors WHERE id = ? AND user_id = ?',
            (competitor_id, user_id),
        ).fetchone()
        if not row:
            return None
        item = dict(row)
        item['slogans'] = json.loads(item.get('slogans') or '[]')
        item['keywords'] = json.loads(item.get('keywords') or '[]')
        return item


def update_competitor(competitor_id: str, user_id: str, name: str, slogans: list[str], keywords: list[str]) -> dict | None:
    with _connect() as connection:
        result = connection.execute(
            'UPDATE competitors SET name = ?, slogans = ?, keywords = ? WHERE id = ? AND user_id = ?',
            (name.strip(), json.dumps(slogans), json.dumps(keywords), competitor_id, user_id),
        )
        if result.rowcount == 0:
            return None
        return get_competitor(competitor_id, user_id)


def delete_competitor(competitor_id: str, user_id: str) -> bool:
    with _connect() as connection:
        result = connection.execute(
            'DELETE FROM competitors WHERE id = ? AND user_id = ?',
            (competitor_id, user_id),
        )
        return result.rowcount > 0


# -------------------------------------------------------------
# Visual Brand Guidelines
# -------------------------------------------------------------

DEFAULT_VISUAL_GUIDELINES = {
    'approved_colors': ['#059669', '#0F172A', '#10B981', '#334155', '#FFFFFF'],
    'color_tolerance': 35,
    'aspect_ratios': ['16:9', '1:1', '4:3', '9:16'],
    'min_width_px': 400,
    'max_width_px': 4000,
    'min_height_px': 400,
    'max_height_px': 4000,
}


def get_visual_guidelines(user_id: str) -> dict:
    with _connect() as connection:
        row = connection.execute(
            'SELECT * FROM visual_guidelines WHERE user_id = ?',
            (user_id,),
        ).fetchone()
        if not row:
            return {'user_id': user_id, **DEFAULT_VISUAL_GUIDELINES, 'is_default': True}
        return {
            'user_id': user_id,
            'approved_colors': json.loads(row['approved_colors'] or '[]'),
            'color_tolerance': row['color_tolerance'],
            'aspect_ratios': json.loads(row['aspect_ratios'] or '[]'),
            'min_width_px': row['min_width_px'],
            'max_width_px': row['max_width_px'],
            'min_height_px': row['min_height_px'],
            'max_height_px': row['max_height_px'],
            'updated_at': row['updated_at'],
            'is_default': False,
        }


def save_visual_guidelines(user_id: str, data: dict) -> dict:
    now = _now()
    approved_colors = data.get('approved_colors') or DEFAULT_VISUAL_GUIDELINES['approved_colors']
    color_tolerance = int(data.get('color_tolerance', 35))
    aspect_ratios = data.get('aspect_ratios') or DEFAULT_VISUAL_GUIDELINES['aspect_ratios']
    min_width = int(data.get('min_width_px', 400))
    max_width = int(data.get('max_width_px', 4000))
    min_height = int(data.get('min_height_px', 400))
    max_height = int(data.get('max_height_px', 4000))

    with _connect() as connection:
        connection.execute(
            '''
            INSERT INTO visual_guidelines (
                user_id, approved_colors, color_tolerance, aspect_ratios,
                min_width_px, max_width_px, min_height_px, max_height_px, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                approved_colors = excluded.approved_colors,
                color_tolerance = excluded.color_tolerance,
                aspect_ratios = excluded.aspect_ratios,
                min_width_px = excluded.min_width_px,
                max_width_px = excluded.max_width_px,
                min_height_px = excluded.min_height_px,
                max_height_px = excluded.max_height_px,
                updated_at = excluded.updated_at
            ''',
            (
                user_id,
                json.dumps(approved_colors),
                color_tolerance,
                json.dumps(aspect_ratios),
                min_width,
                max_width,
                min_height,
                max_height,
                now,
            ),
        )
    return get_visual_guidelines(user_id)
