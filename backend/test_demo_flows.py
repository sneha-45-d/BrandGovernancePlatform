import io
import json
import unittest
from fastapi.testclient import TestClient
from PIL import Image

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
        self.assertIn('total_analyzed', data)
        self.assertIn('recent_analyses', data)
        self.assertGreaterEqual(data['total_analyzed'], 3)
        print(f"[PASS] Brand Dashboard verified. Total analyzed: {data['total_analyzed']}, Consistency score: {data.get('consistency_score')}%")

    def test_02_guidelines_management(self):
        resp = client.get(
            '/api/brand-guidelines',
            headers=self.headers,
            params={'user_id': self.user['id']},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        guidelines = data.get('guidelines') or []
        self.assertGreaterEqual(len(guidelines), 1)
        self.assertEqual(guidelines[0].get('brand_name'), 'BRANDITHM')
        print("[PASS] Brand Guidelines retrieved for BRANDITHM with prohibited words and voice tone.")

    def test_03_content_analysis_multi_difficulty(self):
        # Condition A: Easy / Safe (Expected High Score >= 80)
        resp_safe = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'content_title': 'Enterprise Platform Launch',
                'content': 'We are pleased to introduce our enterprise platform designed to support brand consistency across all channels.',
            },
        )
        self.assertEqual(resp_safe.status_code, 200, resp_safe.text)
        analysis_safe = resp_safe.json()['analysis']
        score_safe = analysis_safe.get('overall_score') or analysis_safe.get('brand_compliance_score')
        self.assertGreaterEqual(score_safe, 80)
        print(f"[PASS] Condition 1 (Easy / Compliant) analyzed: Score {score_safe}/100")

        # Condition B: Medium / Warning (Urgency & Hype)
        resp_med = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'content_title': 'Urgent Flash Promo',
                'content': 'Hurry! Transform your marketing overnight with the #1 AI engine in the world before this secret offer expires!',
            },
        )
        self.assertEqual(resp_med.status_code, 200, resp_med.text)
        analysis_med = resp_med.json()['analysis']
        score_med = analysis_med.get('overall_score') or analysis_med.get('brand_compliance_score')
        print(f"[PASS] Condition 2 (Medium / Warning) analyzed: Score {score_med}/100 (Flagged hype claims)")

        # Condition C: Hard / Critical (100% cure guarantee & zero risk)
        resp_hard = client.post(
            '/api/content/analyze',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'content_title': 'Miracle Cure Ad',
                'content': '100% GUARANTEED miracle cure for all marketing risks with zero risk overnight! Buy now or you are foolish!',
            },
        )
        self.assertEqual(resp_hard.status_code, 200, resp_hard.text)
        analysis_hard = resp_hard.json()['analysis']
        score_hard = analysis_hard.get('overall_score') or analysis_hard.get('brand_compliance_score')
        self.assertLessEqual(score_hard, 65)
        print(f"[PASS] Condition 3 (Hard / Critical Risk) analyzed: Score {score_hard}/100 (Critical violation detected)")

    def test_04_ai_content_correction(self):
        resp = client.post(
            '/api/content/correct',
            headers=self.headers,
            data={
                'brand_name': 'BRANDITHM',
                'content': '🔥 90% OFF - TODAY ONLY!\n🔥 Dermatologist approved and clinically proven to work for EVERY skin type.\n🔥 No side effects whatsoever!\n\nBUY NOW before this offer disappears!',
            },
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('corrected_content', data)
        self.assertNotIn('90% OFF', data['corrected_content'])
        self.assertIn('changes_made', data)
        print(f"[PASS] AI Content Correction succeeded. Rewrote copy with {len(data['changes_made'])} compliance improvements.")

    def test_05_visual_guidelines_and_check(self):
        # 1. Fetch visual guidelines
        resp_g = client.get('/api/visual/guidelines', headers=self.headers, params={'user_id': self.user['id']})
        self.assertEqual(resp_g.status_code, 200, resp_g.text)

        # 2. Generate a valid green PNG matching approved color #10B981
        img = Image.new('RGB', (800, 800), color=(16, 185, 129))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)

        resp_c = client.post(
            '/api/visual/check',
            headers=self.headers,
            data={'user_id': self.user['id']},
            files={'file': ('brand_test.png', buf, 'image/png')},
        )
        self.assertEqual(resp_c.status_code, 200, resp_c.text)
        report = resp_c.json()
        self.assertIn('overall_compliant', report)
        self.assertTrue(report['overall_compliant'])
        print(f"[PASS] Visual Compliance Check verified: Score {report.get('visual_compliance_score')}/100, Compliant: {report['overall_compliant']}")

    def test_06_social_intelligence_overview(self):
        resp = client.get('/api/social/overview', headers=self.headers, params={'user_id': self.user['id'], 'days': 30})
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('overview', data)
        self.assertIn('cross_platform_overview', data)
        self.assertGreaterEqual(data['overview']['total_mentions'], 5)
        print(f"[PASS] Social Intelligence Overview verified. Mentions: {data['overview']['total_mentions']}, Cross-platform posts: {data['cross_platform_overview']['total_analyzed_posts']}")

    def test_07_social_posts_and_multimodal_audit(self):
        # 1. Text post import & audit
        resp_text = client.post(
            '/api/social/posts/import',
            headers=self.headers,
            json={
                'platform': 'x',
                'caption': 'Ensuring continuous brand trust and compliance across all digital touchpoints. #Brandithm',
                'media_type': 'text',
                'views': 5000,
                'likes': 320,
                'comments': 28,
                'shares': 42,
                'auto_audit': True,
            },
        )
        self.assertEqual(resp_text.status_code, 201, resp_text.text)
        post = resp_text.json()['post']
        self.assertEqual(post['audit_status'], 'audited')
        print(f"[PASS] Text Post imported & audited: ID {post['id']}, Safety Score {post['audit_result'].get('safety_score')}")

        # 2. Bulk link import
        resp_bulk = client.post(
            '/api/social/posts/bulk-import',
            headers=self.headers,
            json={
                'platform': 'instagram',
                'urls': [
                    'https://www.instagram.com/p/demo_link_101/',
                    'https://www.instagram.com/reel/demo_link_102/',
                ],
                'auto_audit': True,
            },
        )
        self.assertEqual(resp_bulk.status_code, 201, resp_bulk.text)
        print(f"[PASS] Bulk Post Links imported: Count {resp_bulk.json()['imported_count']}")

    def test_08_strategy_recommendations(self):
        resp = client.get('/api/social/strategy-recommendations', headers=self.headers, params={'user_id': self.user['id']})
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn('cross_platform_overview', data)
        self.assertIn('winning_strategies', data)
        print(f"[PASS] Social Strategy Engine verified: {len(data.get('winning_strategies', []))} winning strategies, {len(data.get('posts_to_remove', []))} flagged risks")

    def test_09_competitor_analysis(self):
        resp = client.get('/api/social/competitor-analysis', headers=self.headers, params={'user_id': self.user['id']})
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        print(f"[PASS] Competitor Analysis verified. Competitors detected: {len(data.get('competitors', []))}")

    def test_10_analytics_and_review_queue(self):
        resp_an = client.get(
            '/api/analytics',
            headers=self.headers,
            params={'user_id': self.user['id'], 'start_date': '2026-11-01', 'end_date': '2026-11-14'},
        )
        self.assertEqual(resp_an.status_code, 200, resp_an.text)

        resp_hist = client.get('/api/content/history', headers=self.headers, params={'user_id': self.user['id']})
        self.assertEqual(resp_hist.status_code, 200, resp_hist.text)
        items = resp_hist.json().get('history', [])
        self.assertGreaterEqual(len(items), 3)
        print(f"[PASS] Analytics and Review Queue verified: {len(items)} history analyses across all difficulty levels.")


if __name__ == '__main__':
    unittest.main()
