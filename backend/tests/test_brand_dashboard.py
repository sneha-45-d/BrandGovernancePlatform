import unittest
from unittest.mock import patch
from uuid import uuid4

from app.routes import brand


class BrandDashboardTests(unittest.TestCase):
    def test_recent_reviews_include_severity_summary_for_dashboard_badges(self):
        user_id = str(uuid4())
        report = {
            '_id': 'report-1',
            'brand_name': 'Northstar',
            'content_title': 'Spring campaign',
            'analysis': {
                'overall_score': 72,
                'brand_compliance_score': 68,
                'summary': 'A claim needs substantiation.',
                'violations': [{'severity': 'high'}],
            },
            'created_at': '2026-11-13T10:00:00+00:00',
        }
        with (
            patch.object(brand, 'content_collection') as collection,
            patch.object(brand.local_store, 'list_analyses', return_value=[]),
        ):
            collection.find.return_value.sort.return_value.limit.return_value = [report]
            result = brand.brand_dashboard(
                user_id=user_id,
                current_user={'_id': user_id},
            )

        self.assertEqual(result['flagged'], 1)
        self.assertEqual(result['recent_analyses'][0]['id'], 'report-1')
        self.assertTrue(result['recent_analyses'][0]['has_critical_findings'])

    def test_demo_account_provisioning_and_login(self):
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post('/api/auth/demo-login')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['email'], 'demo@brandithm.com')
        self.assertEqual(data['user']['full_name'], 'Evaluator Demo Account')


if __name__ == '__main__':
    unittest.main()
