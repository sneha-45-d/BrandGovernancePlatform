import gc
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from app.config import settings
from app.database import local_store
from app.routes import content


class ReviewSearchTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path_patch = patch.object(
            settings,
            'LOCAL_DB_PATH',
            f'{self.temp_dir.name}\\review-search.sqlite3',
        )
        self.database_path_patch.start()
        local_store.ensure_db_ready()
        self.user_id = str(uuid4())

    def tearDown(self):
        self.database_path_patch.stop()
        gc.collect()
        self.temp_dir.cleanup()

    def test_local_search_finds_matching_old_reviews_before_applying_limit(self):
        for index in range(55):
            local_store.save_analysis({
                'user_id': self.user_id,
                'content_title': f'Review {index}',
                'content': 'Old campaign copy contains archivephrase' if index == 0 else f'Routine content {index}',
                'created_at': (datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=index)).isoformat(),
                'analysis': {
                    'summary': 'needle archived finding' if index == 0 else f'Routine summary {index}',
                },
            })

        results = local_store.list_analyses(self.user_id, search='needle', limit=5)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content_title'], 'Review 0')
        self.assertEqual(
            local_store.list_analyses(self.user_id, search='archivephrase', limit=5)[0]['content_title'],
            'Review 0',
        )

    def test_title_prefix_search_returns_every_match_without_the_default_limit(self):
        for index in range(70):
            local_store.save_analysis({
                'user_id': self.user_id,
                'content_title': f'Marketing review {index}' if index % 2 == 0 else f'Other review {index}',
                'created_at': (datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=index)).isoformat(),
            })

        results = local_store.list_analyses(self.user_id, title_prefix='m', limit=None)

        self.assertEqual(len(results), 35)
        self.assertTrue(all(item['content_title'].lower().startswith('m') for item in results))

    def test_history_search_escapes_mongo_regular_expression_terms(self):
        matching_review = {
            '_id': 'review-1',
            'brand_name': 'Northstar',
            'content_title': 'Archived review',
            'content': 'This copy contains brand.* exactly.',
            'analysis': {'summary': 'Routine campaign review.'},
        }
        with (
            patch.object(content, 'content_collection') as collection,
            patch.object(content.local_store, 'list_analyses', return_value=[]),
        ):
            collection.find.return_value.sort.return_value.limit.return_value = [matching_review]
            result = content.get_content_history(
                user_id=self.user_id,
                search='brand.*',
                current_user={'_id': self.user_id},
            )

        query = collection.find.call_args.args[0]
        self.assertEqual(query['$or'][0]['brand_name'], {'$regex': r'brand\.\*', '$options': 'i'})
        self.assertIn('content', [next(iter(term)) for term in query['$or']])
        self.assertEqual(collection.find.call_args.args[1]['content'], 1)
        self.assertEqual(result['history'][0]['content'], matching_review['content'])

    def test_title_prefix_history_search_returns_all_matching_reviews(self):
        reviews = [
            {
                '_id': f'review-{index}',
                'content_title': f'Marketing review {index}',
                'analysis': {'summary': 'Routine campaign review.'},
                'created_at': f'2026-11-{index + 1:02d}',
            }
            for index in range(60)
        ]
        with (
            patch.object(content, 'content_collection') as collection,
            patch.object(content.local_store, 'list_analyses', return_value=[]),
        ):
            collection.find.return_value.sort.return_value = reviews
            result = content.get_content_history(
                user_id=self.user_id,
                search='m',
                search_title_prefix=True,
                current_user={'_id': self.user_id},
            )

        query = collection.find.call_args.args[0]
        self.assertEqual(query['$or'][0]['content_title'], {'$regex': '^m', '$options': 'i'})
        self.assertEqual(len(result['history']), 60)
        self.assertTrue(all(item['title'].lower().startswith('m') for item in result['history']))


if __name__ == '__main__':
    unittest.main()
