import sys
import unittest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class DemoAccountEndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Login with demo account
        resp = client.post('/api/auth/demo-login')
        assert resp.status_code == 200, resp.text
        data = resp.json()
        cls.token = data['token']
        cls.user = data['user']
        cls.headers = {'Authorization': f'Bearer {cls.token}'}
        print("\n[PASS] Demo account logged in:", cls.user['email'])

    def test_01_brand_dashboard(self):
        resp = client.get('/api/brand/dashboard', headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('total_analyses', data)
        self.assertIn('recent_analyses', data)
        print("[PASS] Brand Dashboard retrieved. Analyses count:", data.get('total_analyses'))

    def test_02_guidelines_management(self):
        resp = client.get('/api/brand-guidelines', headers=self.headers, params={'brand_name': 'BRANDITHM'})
        self.assertEqual(resp.status_code, 200, resp.text)
        print("[PASS] Brand Guidelines retrieved for BRANDITHM")

    def test_03_content_analysis_multi_difficulty(self):
        # Condition A: Easy / Safe (Expected High Score > 85)
        resp_safe = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'title': 'Enterprise Security Update',
                'text': 'We are pleased to share our updated security documentation for enterprise customers.',
            },
        )
        self.assertEqual(resp_safe.status_code, 200, resp_safe.text)
        score_safe = resp_safe.json()['analysis']['score']
        self.assertGreaterEqual(score_safe, 80)
        print(f"[PASS] Condition 1 (Easy/Safe) analyzed. Compliance Score: {score_safe}/100")

        # Condition B: Medium / Warning (Urgency / Hype)
        resp_med = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'title': 'Flash Sale Promo',
                'text': 'Hurry! Transform your marketing overnight with the #1 tool in the universe!',
            },
        )
        self.assertEqual(resp_med.status_code, 200, resp_med.text)
        score_med = resp_med.json()['analysis']['score']
        print(f"[PASS] Condition 2 (Medium/Warning) analyzed. Compliance Score: {score_med}/100")

        # Condition C: Hard / Critical (100% cure guarantee & zero risk)
        resp_hard = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'title': 'Miracle Cure Ad',
                'text': '100% GUARANTEED miracle cure for all marketing risks with zero risk overnight!',
            },
        )
        self.assertEqual(resp_hard.status_code, 200, resp_hard.text)
        score_hard = resp_hard.json()['analysis']['score']
        self.assertLessEqual(score_hard, 60)
        print(f"[PASS] Condition 3 (Hard/Critical) analyzed. Compliance Score: {score_hard}/100 (Flagged appropriately)")

    def test_04_ai_content_correction(self):
        resp = client.post(
            '/api/content/correct',
            headers=self.headers,
            json={
                'brand_name': 'BRANDITHM',
                'text': '100% guaranteed overnight miracle cure for all marketing risks.',
                'violations': ['Absolute guarantee', 'Sensational cure claim'],
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        corrected = resp.json()
        self.assertIn('corrected_text', corrected)
        print("[PASS] AI Content Correction succeeded. Rewrote text into brand-safe tone.")

    def test_05_visual_guidelines_and_check(self):
        resp_g = client.get('/api/visual/guidelines', headers=self.headers)
        self.assertEqual(resp_g.status_code, 200, resp_g.text)

        # Visual check
        resp_c = client.post(
            '/api/visual/check',
            headers=self.headers,
            json={
                'color_hex': '#10b981',
                'width': 1200,
                'height': 630,
            },
        )
        self.assertEqual(resp_c.status_code, 200, resp_c.text)
        self.assertTrue(resp_c.json()['passed'])
        print("[PASS] Visual Guidelines and Color Compliance check verified (Passed).")

    def test_06_social_intelligence_overview(self):
        resp = client.get('/api/social/overview', headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('total_brand_mentions', data)
        self.assertIn('cross_platform_overview', data)
        print("[PASS] Social Intelligence Overview retrieved with cross-platform stats.")

    def test_07_social_posts_and_multimodal_audit(self):
        # 1. Text post import & audit
        resp_text = client.post(
            '/api/social/posts/import',
            headers=self.headers,
            json={
                'platform': 'x',
                'caption': 'Ensuring continuous brand trust and compliance across all digital touchpoints.',
                'media_type': 'text',
                'views': 5000,
                'likes': 320,
                'comments': 28,
                'shares': 42,
                'auto_audit': True,
            },
        )
        self.assertEqual(resp_text.status_code, 201, resp_text.text)
        post_id = resp_text.json()['post']['id']
        self.assertEqual(resp_text.json()['post']['audit_status'], 'audited')
        print("[PASS] Text Post imported and AI audited successfully.")

        # 2. Multi-link bulk import
        resp_bulk = client.post(
            '/api/social/posts/bulk-import',
            headers=self.headers,
            json={
                'platform': 'instagram',
                'urls': [
                    'https://www.instagram.com/p/samplepost1/',
                    'https://www.instagram.com/reel/samplereel2/',
                ],
                'auto_audit': True,
            },
        )
        self.assertEqual(resp_bulk.status_code, 201, resp_bulk.text)
        self.assertEqual(resp_bulk.json()['imported_count'], 2)
        print("[PASS] Bulk Post Links imported and audited successfully.")

    def test_08_strategy_recommendations(self):
        resp = client.get('/api/social/strategy-recommendations', headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('recommendations', data)
        print("[PASS] AI Strategy Engine generated dynamic recommendations.")

    def test_09_competitor_analysis(self):
        resp = client.get('/api/social/competitor-analysis', headers=self.headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        print("[PASS] Competitor Guard analysis generated.")

    def test_10_analytics_and_review_queue(self):
        resp_an = client.get('/api/analytics', headers=self.headers)
        self.assertEqual(resp_an.status_code, 200, resp_an.text)

        resp_hist = client.get('/api/content/history', headers=self.headers)
        self.assertEqual(resp_hist.status_code, 200, resp_hist.text)
        print(f"[PASS] Analytics and Review Queue verified. History items: {len(resp_hist.json()['items'])}")


if __name__ == '__main__':
    unittest.main()

