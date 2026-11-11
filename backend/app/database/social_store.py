import json
import logging
import re
import sqlite3
import time
from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError, PyMongoError

from app.database import local_store
from app.database.mongo import get_db

logger = logging.getLogger(__name__)
_mongo_indexes_ready = False
_mongo_retry_after = 0


def _now():
    return datetime.now(timezone.utc).isoformat()


def _decode_json(value, fallback):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _clean_document(document):
    if not document:
        return None
    result = dict(document)
    result.pop('_id', None)
    for key in ('keywords', 'hashtags', 'product_names', 'sentiment_data', 'engagement', 'scopes', 'drafts'):
        if key in result:
            result[key] = _decode_json(result[key], [] if key in {'keywords', 'hashtags', 'product_names', 'scopes'} else {})
    if 'enabled' in result:
        result['enabled'] = bool(result['enabled'])
    if 'read' in result:
        result['read'] = bool(result['read'])
    return result


def _ensure_indexes():
    global _mongo_indexes_ready
    if _mongo_indexes_ready:
        return
    db = get_db()
    db['social_mentions'].create_index([('user_id', 1), ('published_at', -1)])
    db['social_mentions'].create_index([('user_id', 1), ('platform', 1), ('sentiment', 1)])
    db['social_mentions'].create_index(
        [('user_id', 1), ('platform', 1), ('source_post_id', 1)],
        unique=True,
        partialFilterExpression={'source_post_id': {'$type': 'string'}},
    )
    db['social_reply_drafts'].create_index([('user_id', 1), ('mention_id', 1), ('created_at', -1)])
    db['social_competitors'].create_index([('user_id', 1), ('name', 1)], unique=True)
    db['social_alerts'].create_index([('user_id', 1), ('detected_at', -1)])
    db['social_alerts'].create_index([('user_id', 1), ('trigger_key', 1)], unique=True)
    db['social_monitoring_config'].create_index('user_id', unique=True)
    db['social_oauth_states'].create_index('expires_at', expireAfterSeconds=0)
    _mongo_indexes_ready = True


def _try_mongo(operation, fallback):
    global _mongo_retry_after
    try:
        if time.monotonic() >= _mongo_retry_after:
            _ensure_indexes()
            result = operation()
            _mongo_retry_after = 0
            return result
    except PyMongoError:
        _mongo_retry_after = time.monotonic() + 5
        logger.info('MongoDB unavailable for social intelligence; using server-local storage', exc_info=True)
    try:
        return fallback()
    except sqlite3.Error as exc:
        logger.exception('Social intelligence storage is unavailable')
        raise RuntimeError('Social intelligence storage is temporarily unavailable.') from exc
    except ValueError:
        raise
    except Exception as exc:
        logger.exception('Social intelligence local storage operation failed')
        raise RuntimeError('Social intelligence storage is temporarily unavailable.') from exc


def get_config(user_id):
    def mongo():
        return _clean_document(get_db()['social_monitoring_config'].find_one({'user_id': user_id}))

    def local():
        with local_store._connect() as connection:
            row = connection.execute(
                'SELECT * FROM social_monitoring_config WHERE user_id = ?',
                (user_id,),
            ).fetchone()
        return _clean_document(dict(row)) if row else None

    return _try_mongo(mongo, local)


def save_config(user_id, brand_name, keywords, hashtags, product_names, enabled):
    now = _now()
    document = {
        'user_id': user_id,
        'brand_name': brand_name,
        'keywords': keywords,
        'hashtags': hashtags,
        'product_names': product_names,
        'enabled': enabled,
        'updated_at': now,
    }

    def mongo():
        collection = get_db()['social_monitoring_config']
        collection.update_one(
            {'user_id': user_id},
            {'$set': document, '$setOnInsert': {'created_at': now}},
            upsert=True,
        )
        return _clean_document(collection.find_one({'user_id': user_id}))

    def local():
        with local_store._connect() as connection:
            connection.execute(
                '''INSERT INTO social_monitoring_config
                   (user_id, brand_name, keywords, hashtags, product_names, enabled, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET
                     brand_name=excluded.brand_name,
                     keywords=excluded.keywords,
                     hashtags=excluded.hashtags,
                     product_names=excluded.product_names,
                     enabled=excluded.enabled,
                     updated_at=excluded.updated_at''',
                (
                    user_id, brand_name, json.dumps(keywords), json.dumps(hashtags),
                    json.dumps(product_names), int(enabled), now, now,
                ),
            )
            row = connection.execute(
                'SELECT * FROM social_monitoring_config WHERE user_id = ?',
                (user_id,),
            ).fetchone()
        return _clean_document(dict(row))

    return _try_mongo(mongo, local)


def create_mention(user_id, payload):
    now = _now()
    mention_id = str(uuid4())
    document = {
        '_id': mention_id,
        'id': mention_id,
        'user_id': user_id,
        'entity_name': payload['entity_name'],
        'entity_type': payload.get('entity_type', 'brand'),
        'platform': payload['platform'],
        'author': payload.get('author', ''),
        'content': payload['content'],
        'source_url': payload.get('source_url', ''),
        'source_post_id': payload.get('source_post_id'),
        'published_at': payload['published_at'],
        'sentiment': 'unanalysed',
        'sentiment_data': {},
        'engagement': payload.get('engagement') or {},
        'collection_source': payload['collection_source'],
        'created_at': now,
    }

    def mongo():
        collection = get_db()['social_mentions']
        try:
            collection.insert_one(document)
        except DuplicateKeyError as exc:
            raise ValueError('This platform post has already been added.') from exc
        return _clean_document(document)

    def local():
        with local_store._connect() as connection:
            try:
                connection.execute(
                    '''INSERT INTO social_mentions
                       (id, user_id, entity_name, entity_type, platform, author, content, source_url, source_post_id,
                        published_at, sentiment, sentiment_data, engagement, collection_source, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (
                        mention_id, user_id, document['entity_name'], document['entity_type'], document['platform'],
                        document['author'], document['content'], document['source_url'],
                        document['source_post_id'], document['published_at'], document['sentiment'],
                        json.dumps(document['sentiment_data']), json.dumps(document['engagement']),
                        document['collection_source'], now,
                    ),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError('This platform post has already been added.') from exc
        return _clean_document(document)

    return _try_mongo(mongo, local)


def list_mentions(user_id, platform=None, sentiment=None, search=None, limit=100, offset=0):
    query = {'user_id': user_id}
    if platform:
        query['platform'] = platform
    if sentiment:
        query['sentiment'] = sentiment
    if search:
        safe_search = re.escape(search)
        query['$or'] = [
            {'content': {'$regex': safe_search, '$options': 'i'}},
            {'author': {'$regex': safe_search, '$options': 'i'}},
            {'entity_name': {'$regex': safe_search, '$options': 'i'}},
        ]

    def mongo():
        cursor = get_db()['social_mentions'].find(query, {'_id': 0}).sort('published_at', -1).skip(offset).limit(limit)
        return [_clean_document(document) for document in cursor]

    def local():
        clauses = ['user_id = ?']
        params = [user_id]
        if platform:
            clauses.append('platform = ?')
            params.append(platform)
        if sentiment:
            clauses.append('sentiment = ?')
            params.append(sentiment)
        if search:
            clauses.append('(content LIKE ? OR author LIKE ? OR entity_name LIKE ?)')
            value = f'%{search}%'
            params.extend([value, value, value])
        params.extend([limit, offset])
        with local_store._connect() as connection:
            rows = connection.execute(
                f'''SELECT * FROM social_mentions WHERE {' AND '.join(clauses)}
                    ORDER BY published_at DESC LIMIT ? OFFSET ?''',
                params,
            ).fetchall()
        return [_clean_document(dict(row)) for row in rows]

    return _try_mongo(mongo, local)


def list_mentions_for_range(user_id, start, end, platform=None):
    query = {
        'user_id': user_id,
        'published_at': {'$gte': start, '$lt': end},
    }
    if platform:
        query['platform'] = platform

    def mongo():
        cursor = get_db()['social_mentions'].find(query, {'_id': 0}).sort('published_at', -1)
        return [_clean_document(document) for document in cursor]

    def local():
        clauses = ['user_id = ?', 'published_at >= ?', 'published_at < ?']
        params = [user_id, start, end]
        if platform:
            clauses.append('platform = ?')
            params.append(platform)
        with local_store._connect() as connection:
            rows = connection.execute(
                f'''SELECT * FROM social_mentions WHERE {' AND '.join(clauses)}
                    ORDER BY published_at DESC''',
                params,
            ).fetchall()
        return [_clean_document(dict(row)) for row in rows]

    return _try_mongo(mongo, local)


def count_mentions(user_id, platform=None, sentiment=None, since=None, search=None):
    filters = {'user_id': user_id}
    if platform:
        filters['platform'] = platform
    if sentiment:
        filters['sentiment'] = sentiment
    if since:
        filters['published_at'] = {'$gte': since}
    if search:
        safe_search = re.escape(search)
        filters['$or'] = [
            {'content': {'$regex': safe_search, '$options': 'i'}},
            {'author': {'$regex': safe_search, '$options': 'i'}},
            {'entity_name': {'$regex': safe_search, '$options': 'i'}},
        ]

    def mongo():
        return get_db()['social_mentions'].count_documents(filters)

    def local():
        clauses = ['user_id = ?']
        params = [user_id]
        if platform:
            clauses.append('platform = ?')
            params.append(platform)
        if sentiment:
            clauses.append('sentiment = ?')
            params.append(sentiment)
        if since:
            clauses.append('published_at >= ?')
            params.append(since)
        if search:
            clauses.append('(content LIKE ? OR author LIKE ? OR entity_name LIKE ?)')
            value = f'%{search}%'
            params.extend([value, value, value])
        with local_store._connect() as connection:
            row = connection.execute(
                f"SELECT COUNT(*) AS count FROM social_mentions WHERE {' AND '.join(clauses)}",
                params,
            ).fetchone()
        return row['count']

    return _try_mongo(mongo, local)


def get_mention(user_id, mention_id):
    def mongo():
        return _clean_document(get_db()['social_mentions'].find_one(
            {'user_id': user_id, 'id': mention_id},
            {'_id': 0},
        ))

    def local():
        with local_store._connect() as connection:
            row = connection.execute(
                'SELECT * FROM social_mentions WHERE user_id = ? AND id = ?',
                (user_id, mention_id),
            ).fetchone()
        return _clean_document(dict(row)) if row else None

    return _try_mongo(mongo, local)


def update_mention_sentiment(user_id, mention_id, sentiment, sentiment_data):
    def mongo():
        result = get_db()['social_mentions'].update_one(
            {'user_id': user_id, 'id': mention_id},
            {'$set': {'sentiment': sentiment, 'sentiment_data': sentiment_data}},
        )
        return result.matched_count > 0

    def local():
        with local_store._connect() as connection:
            result = connection.execute(
                'UPDATE social_mentions SET sentiment = ?, sentiment_data = ? WHERE user_id = ? AND id = ?',
                (sentiment, json.dumps(sentiment_data), user_id, mention_id),
            )
        return result.rowcount > 0

    return _try_mongo(mongo, local)


def save_reply_drafts(user_id, mention_id, drafts):
    draft_id = str(uuid4())
    created_at = _now()
    document = {
        '_id': draft_id,
        'id': draft_id,
        'user_id': user_id,
        'mention_id': mention_id,
        'drafts': drafts,
        'created_at': created_at,
    }

    def mongo():
        get_db()['social_reply_drafts'].insert_one(document)
        return _clean_document(document)

    def local():
        with local_store._connect() as connection:
            connection.execute(
                '''INSERT INTO social_reply_drafts (id, user_id, mention_id, drafts, created_at)
                   VALUES (?, ?, ?, ?, ?)''',
                (draft_id, user_id, mention_id, json.dumps(drafts), created_at),
            )
        return _clean_document(document)

    return _try_mongo(mongo, local)


def list_reply_drafts(user_id, mention_id, limit=10):
    def mongo():
        cursor = get_db()['social_reply_drafts'].find(
            {'user_id': user_id, 'mention_id': mention_id},
            {'_id': 0},
        ).sort('created_at', -1).limit(limit)
        return [_clean_document(document) for document in cursor]

    def local():
        with local_store._connect() as connection:
            rows = connection.execute(
                '''SELECT * FROM social_reply_drafts
                   WHERE user_id = ? AND mention_id = ?
                   ORDER BY created_at DESC LIMIT ?''',
                (user_id, mention_id, limit),
            ).fetchall()
        return [
            {
                'id': row['id'],
                'user_id': row['user_id'],
                'mention_id': row['mention_id'],
                'drafts': _decode_json(row['drafts'], []),
                'created_at': row['created_at'],
            }
            for row in rows
        ]

    return _try_mongo(mongo, local)


def list_competitors(user_id):
    def mongo():
        cursor = get_db()['social_competitors'].find({'user_id': user_id}, {'_id': 0}).sort('name', 1)
        return [_clean_document(document) for document in cursor]

    def local():
        with local_store._connect() as connection:
            rows = connection.execute(
                'SELECT * FROM social_competitors WHERE user_id = ? ORDER BY name',
                (user_id,),
            ).fetchall()
        return [_clean_document(dict(row)) for row in rows]

    return _try_mongo(mongo, local)


def save_competitor(user_id, name, keywords, competitor_id=None):
    now = _now()
    competitor_id = competitor_id or str(uuid4())
    document = {
        '_id': competitor_id,
        'id': competitor_id,
        'user_id': user_id,
        'name': name,
        'keywords': keywords,
        'created_at': now,
        'updated_at': now,
    }

    def mongo():
        collection = get_db()['social_competitors']
        if collection.find_one({'user_id': user_id, 'name': name, 'id': {'$ne': competitor_id}}):
            raise ValueError('A competitor with this name is already registered.')
        collection.update_one(
            {'user_id': user_id, 'id': competitor_id},
            {
                '$set': {key: value for key, value in document.items() if key != '_id'},
                '$setOnInsert': {'_id': competitor_id, 'created_at': now},
            },
            upsert=True,
        )
        return _clean_document(collection.find_one({'user_id': user_id, 'id': competitor_id}, {'_id': 0}))

    def local():
        with local_store._connect() as connection:
            duplicate = connection.execute(
                'SELECT id FROM social_competitors WHERE user_id = ? AND lower(name) = lower(?) AND id != ?',
                (user_id, name, competitor_id),
            ).fetchone()
            if duplicate:
                raise ValueError('A competitor with this name is already registered.')
            connection.execute(
                '''INSERT INTO social_competitors (id, user_id, name, keywords, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET name=excluded.name, keywords=excluded.keywords, updated_at=excluded.updated_at''',
                (competitor_id, user_id, name, json.dumps(keywords), now, now),
            )
            row = connection.execute(
                'SELECT * FROM social_competitors WHERE user_id = ? AND id = ?',
                (user_id, competitor_id),
            ).fetchone()
        return _clean_document(dict(row)) if row else None

    return _try_mongo(mongo, local)


def delete_competitor(user_id, competitor_id):
    def mongo():
        result = get_db()['social_competitors'].delete_one({'user_id': user_id, 'id': competitor_id})
        return result.deleted_count > 0

    def local():
        with local_store._connect() as connection:
            result = connection.execute(
                'DELETE FROM social_competitors WHERE user_id = ? AND id = ?',
                (user_id, competitor_id),
            )
        return result.rowcount > 0

    return _try_mongo(mongo, local)


def create_alert(user_id, title, severity, description, platform, recommended_action, trigger_key):
    now = _now()
    alert_id = str(uuid4())
    document = {
        '_id': alert_id,
        'id': alert_id,
        'user_id': user_id,
        'title': title,
        'severity': severity,
        'description': description,
        'platform': platform,
        'recommended_action': recommended_action,
        'read': False,
        'trigger_key': trigger_key,
        'detected_at': now,
    }

    def mongo():
        collection = get_db()['social_alerts']
        collection.update_one(
            {'user_id': user_id, 'trigger_key': trigger_key},
            {'$setOnInsert': document},
            upsert=True,
        )
        return _clean_document(collection.find_one(
            {'user_id': user_id, 'trigger_key': trigger_key},
            {'_id': 0},
        ))

    def local():
        with local_store._connect() as connection:
            connection.execute(
                '''INSERT INTO social_alerts
                   (id, user_id, title, severity, description, platform, recommended_action, read, trigger_key, detected_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                   ON CONFLICT(user_id, trigger_key) DO NOTHING''',
                (
                    alert_id, user_id, title, severity, description, platform,
                    recommended_action, trigger_key, now,
                ),
            )
            row = connection.execute(
                'SELECT * FROM social_alerts WHERE user_id = ? AND trigger_key = ?',
                (user_id, trigger_key),
            ).fetchone()
        return _clean_document(dict(row)) if row else None

    return _try_mongo(mongo, local)


def list_alerts(user_id, unread_only=False, severity=None, limit=100):
    query = {'user_id': user_id}
    if unread_only:
        query['read'] = False
    if severity:
        query['severity'] = severity

    def mongo():
        cursor = get_db()['social_alerts'].find(query, {'_id': 0}).sort('detected_at', -1).limit(limit)
        return [_clean_document(document) for document in cursor]

    def local():
        clauses = ['user_id = ?']
        params = [user_id]
        if unread_only:
            clauses.append('read = 0')
        if severity:
            clauses.append('severity = ?')
            params.append(severity)
        params.append(limit)
        with local_store._connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM social_alerts WHERE {' AND '.join(clauses)} ORDER BY detected_at DESC LIMIT ?",
                params,
            ).fetchall()
        return [_clean_document(dict(row)) for row in rows]

    return _try_mongo(mongo, local)


def mark_alert_read(user_id, alert_id, read):
    def mongo():
        result = get_db()['social_alerts'].update_one(
            {'user_id': user_id, 'id': alert_id},
            {'$set': {'read': read}},
        )
        return result.matched_count > 0

    def local():
        with local_store._connect() as connection:
            result = connection.execute(
                'UPDATE social_alerts SET read = ? WHERE user_id = ? AND id = ?',
                (int(read), user_id, alert_id),
            )
        return result.rowcount > 0

    return _try_mongo(mongo, local)


def create_oauth_state(state_hash, user_id, platform, state_data, expires_at):
    now = _now()
    expires_datetime = datetime.fromisoformat(expires_at)
    document = {
        'state_hash': state_hash,
        'user_id': user_id,
        'platform': platform,
        'state_data': state_data,
        'expires_at': expires_datetime,
        'created_at': now,
    }

    def mongo():
        get_db()['social_oauth_states'].insert_one(document)
        return True

    def local():
        with local_store._connect() as connection:
            connection.execute(
                '''INSERT INTO social_oauth_states
                   (state_hash, user_id, platform, state_data, expires_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (state_hash, user_id, platform, json.dumps(state_data), expires_datetime.isoformat(), now),
            )
        return True

    return _try_mongo(mongo, local)


def consume_oauth_state(state_hash):
    now = _now()

    def mongo():
        document = get_db()['social_oauth_states'].find_one_and_delete({'state_hash': state_hash})
        if not document:
            return None
        expires_at = document.get('expires_at')
        if isinstance(expires_at, datetime):
            if expires_at <= datetime.now(timezone.utc):
                return None
        elif not expires_at or expires_at <= now:
            return None
        return {
            'user_id': document['user_id'],
            'platform': document['platform'],
            'state_data': _decode_json(document.get('state_data'), {}),
        }

    def local():
        with local_store._connect() as connection:
            row = connection.execute(
                'SELECT * FROM social_oauth_states WHERE state_hash = ?',
                (state_hash,),
            ).fetchone()
            connection.execute('DELETE FROM social_oauth_states WHERE state_hash = ?', (state_hash,))
        if not row or row['expires_at'] <= now:
            return None
        return {
            'user_id': row['user_id'],
            'platform': row['platform'],
            'state_data': _decode_json(row['state_data'], {}),
        }

    return _try_mongo(mongo, local)


def save_social_account(
    user_id,
    platform,
    account_name,
    scopes,
    access_token_encrypted,
    refresh_token_encrypted,
    token_expires_at,
):
    now = _now()
    connected_at = now
    document = {
        'user_id': user_id,
        'platform': platform,
        'account_name': account_name,
        'status': 'connected',
        'scopes': scopes,
        'access_token_encrypted': access_token_encrypted,
        'refresh_token_encrypted': refresh_token_encrypted or '',
        'token_expires_at': token_expires_at,
        'connected_at': connected_at,
        'updated_at': now,
    }

    def mongo():
        collection = get_db()['social_accounts']
        collection.update_one(
            {'user_id': user_id, 'platform': platform},
            {'$set': document, '$setOnInsert': {'created_at': now}},
            upsert=True,
        )
        return True

    def local():
        with local_store._connect() as connection:
            connection.execute(
                '''INSERT INTO social_accounts
                   (user_id, platform, account_name, status, scopes, access_token_encrypted,
                    refresh_token_encrypted, token_expires_at, connected_at, updated_at)
                   VALUES (?, ?, ?, 'connected', ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, platform) DO UPDATE SET
                     account_name=excluded.account_name,
                     status='connected',
                     scopes=excluded.scopes,
                     access_token_encrypted=excluded.access_token_encrypted,
                     refresh_token_encrypted=excluded.refresh_token_encrypted,
                     token_expires_at=excluded.token_expires_at,
                     connected_at=excluded.connected_at,
                     updated_at=excluded.updated_at''',
                (
                    user_id, platform, account_name, json.dumps(scopes),
                    access_token_encrypted, refresh_token_encrypted or '',
                    token_expires_at, connected_at, now,
                ),
            )
        return True

    return _try_mongo(mongo, local)


def list_social_accounts(user_id):
    def sanitize(account):
        if not account:
            return None
        token_expiry = account.get('token_expires_at')
        status = account.get('status') or 'disconnected'
        if token_expiry:
            try:
                expiry = datetime.fromisoformat(str(token_expiry).replace('Z', '+00:00'))
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if expiry <= datetime.now(timezone.utc):
                    status = 'reauth_required'
            except ValueError:
                status = 'reauth_required'
        return {
            'platform': account.get('platform'),
            'account_name': account.get('account_name') or '',
            'status': status,
            'scopes': _decode_json(account.get('scopes'), []),
            'connected_at': account.get('connected_at'),
            'token_expires_at': account.get('token_expires_at'),
        }

    def mongo():
        cursor = get_db()['social_accounts'].find(
            {'user_id': user_id},
            {'_id': 0, 'access_token_encrypted': 0, 'refresh_token_encrypted': 0},
        )
        return [sanitize(account) for account in cursor]

    def local():
        with local_store._connect() as connection:
            rows = connection.execute(
                'SELECT * FROM social_accounts WHERE user_id = ?',
                (user_id,),
            ).fetchall()
        return [sanitize(dict(row)) for row in rows]

    return _try_mongo(mongo, local)


def disconnect_social_account(user_id, platform):
    now = _now()

    def mongo():
        result = get_db()['social_accounts'].delete_one({'user_id': user_id, 'platform': platform})
        return result.deleted_count > 0

    def local():
        with local_store._connect() as connection:
            result = connection.execute(
                'DELETE FROM social_accounts WHERE user_id = ? AND platform = ?',
                (user_id, platform),
            )
        return result.rowcount > 0

    return _try_mongo(mongo, local)
