import asyncio
import json
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException
from PIL import Image

from app.services.content_ingestion import (
    MAX_UPLOAD_BYTES,
    MediaFile,
    ingest_content_file,
)
from app.services.multimodal_service import generate_multimodal_content
from app.services.clash_service import check_competitor_clashes
from app.routes.content import run_ai_brand_analysis


class ContentIngestionTests(unittest.TestCase):
    def test_extracts_plain_text(self):
        result = ingest_content_file('campaign.txt', b'Brand campaign copy')
        self.assertEqual(result.content_type, 'text')
        self.assertEqual(result.extracted_text, 'Brand campaign copy')
        self.assertFalse(result.media_files)

    def test_scanned_pdf_requires_multimodal_analysis(self):
        import fitz

        document = fitz.open()
        document.new_page()
        pdf_bytes = document.tobytes()
        document.close()

        result = ingest_content_file('scanned.pdf', pdf_bytes)
        self.assertEqual(result.content_type, 'document')
        self.assertTrue(result.requires_multimodal_ai)
        self.assertEqual(result.media_files[0].mime_type, 'application/pdf')

    def test_extracts_presentation_text_and_embedded_image(self):
        presentation = BytesIO()
        image = BytesIO()
        Image.new('RGB', (2, 2), '#123456').save(image, format='PNG')
        with ZipFile(presentation, 'w', ZIP_DEFLATED) as archive:
            archive.writestr(
                'ppt/slides/slide1.xml',
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
                '<a:t>Launch messaging</a:t></p:sld>',
            )
            archive.writestr('ppt/media/image1.png', image.getvalue())

        result = ingest_content_file('campaign.pptx', presentation.getvalue())
        self.assertEqual(result.content_type, 'presentation')
        self.assertIn('Slide 1: Launch messaging', result.extracted_text)
        self.assertTrue(result.requires_multimodal_ai)
        self.assertEqual(result.media_files[0].mime_type, 'image/png')

    def test_rejects_unsupported_and_oversized_files(self):
        with self.assertRaises(HTTPException) as unsupported:
            ingest_content_file('campaign.exe', b'content')
        self.assertEqual(unsupported.exception.status_code, 415)

        with self.assertRaises(HTTPException) as oversized:
            ingest_content_file('campaign.txt', b'x' * (MAX_UPLOAD_BYTES + 1))
        self.assertEqual(oversized.exception.status_code, 413)

    def test_rejects_invalid_image_payload(self):
        with self.assertRaises(HTTPException) as invalid:
            ingest_content_file('creative.png', b'not an image')
        self.assertEqual(invalid.exception.status_code, 400)

    def test_rejects_image_extension_that_does_not_match_its_content(self):
        image = BytesIO()
        Image.new('RGB', (2, 2), '#123456').save(image, format='PNG')
        with self.assertRaises(HTTPException) as invalid:
            ingest_content_file('creative.jpg', image.getvalue())
        self.assertEqual(invalid.exception.status_code, 400)

    def test_empty_competitor_registry_is_not_reported_as_a_successful_scan(self):
        result = check_competitor_clashes('A new campaign', [])
        self.assertFalse(result['checked'])
        self.assertFalse(result['has_clashes'])
        self.assertIn('not performed', result['summary'])

    def test_multimodal_uploads_are_deleted_after_generation(self):
        uploaded = SimpleNamespace(
            name='files/test-upload',
            state='ACTIVE',
        )
        response = SimpleNamespace(text='{"overall_score": 90}')
        media = MediaFile('creative.png', 'image/png', b'image-bytes')

        mock_client = SimpleNamespace()
        mock_client.files = SimpleNamespace(
            upload=MagicMock(return_value=uploaded),
            get=MagicMock(return_value=uploaded),
            delete=MagicMock(),
        )
        mock_client.models = SimpleNamespace(
            generate_content=MagicMock(return_value=response),
        )

        with patch('app.services.multimodal_service.genai.Client', return_value=mock_client), \
             patch('app.services.multimodal_service.settings.GEMINI_API_KEY', 'test-key'):
            result = asyncio.run(generate_multimodal_content('gemini-test', 'Analyze asset', [media]))

        self.assertEqual(result, response.text)
        self.assertEqual(mock_client.files.upload.call_count, 1)
        uploaded_path = Path(mock_client.files.upload.call_args.kwargs['file'])
        self.assertFalse(uploaded_path.exists())
        mock_client.files.delete.assert_called_once_with(name=uploaded.name)
        mock_client.models.generate_content.assert_called_once()

    def test_media_analysis_requires_a_gemini_key_instead_of_falling_back(self):
        media = [MediaFile('creative.png', 'image/png', b'image-bytes')]
        with patch('app.routes.content.settings.GOOGLE_API_KEY', ''):
            with self.assertRaises(HTTPException) as missing_key:
                asyncio.run(run_ai_brand_analysis('Uploaded image asset.', 'Test Brand', {}, media))
        self.assertEqual(missing_key.exception.status_code, 503)

    def test_text_analysis_still_uses_the_labeled_local_fallback(self):
        with patch('app.routes.content.settings.GOOGLE_API_KEY', ''):
            result = asyncio.run(run_ai_brand_analysis('A clear campaign message.', 'Test Brand', {}))
        self.assertEqual(result['engine'], 'local')
        self.assertIn('not an AI model', result['warning'])

    def test_quick_brand_review_uses_compact_evidence_based_prompt(self):
        response_data = {
            'overall_score': 82,
            'brand_compliance_score': 84,
            'tone_consistency': 80,
            'grammar_score': 95,
            'readability_score': 88,
            'audience_fit': {
                'assessment': 'mixed',
                'explanation': 'The benefit is clear, but the intended buyer is not named.',
            },
            'channel_fit': {
                'assessment': 'strong',
                'explanation': 'The copy is concise enough for a short-form placement.',
            },
            'claim_checks': [{
                'claim': '“the best platform”',
                'risk': 'high',
                'evidence_status': 'not provided',
                'explanation': 'No comparative evidence was supplied.',
                'next_step': 'Replace the superlative or provide approved substantiation.',
            }],
            'violations': [{
                'title': 'Unsupported superlative',
                'severity': 'high',
                'evidence': '“the best platform”',
                'description': 'The claim has no supporting evidence.',
            }],
            'critical_issues': [],
            'recommendations': [{
                'title': 'Substantiate or soften the claim',
                'priority': 'high',
                'evidence': '“the best platform”',
                'explanation': 'The superlative may undermine trust.',
                'next_step': 'Replace it with a verifiable product benefit.',
                'measurement': 'Review the revised claim with the product team.',
                'suggested_copy': 'A platform built for clearer workflows.',
            }],
            'summary': 'The copy is clear but includes an unsupported superlative. Replace it with a verifiable benefit.',
        }
        client = SimpleNamespace(
            models=SimpleNamespace(
                generate_content=MagicMock(return_value=SimpleNamespace(text=json.dumps(response_data))),
            ),
        )

        with patch('app.routes.content.get_genai_client', return_value=client), \
             patch('app.routes.content.settings.GOOGLE_API_KEY', 'test-key'), \
             patch('app.routes.content.settings.GEMINI_MODEL', 'gemini-3.5-flash'):
            result = asyncio.run(run_ai_brand_analysis(
                'This is the best platform.',
                'Test Brand',
                {},
                quick_review=True,
                review_context={
                    'campaign_goal': 'Increase qualified demo requests',
                    'target_audience': 'Operations leads at small businesses',
                    'channel': 'LinkedIn sponsored post',
                },
            ))

        request = client.models.generate_content.call_args.kwargs
        self.assertIn('Campaign objective: Increase qualified demo requests', request['contents'])
        self.assertIn('Target audience: Operations leads at small businesses', request['contents'])
        self.assertIn('Channel or format: LinkedIn sponsored post', request['contents'])
        self.assertIn('Do not present this as external fact-checking.', request['contents'])
        self.assertNotIn('improved_content', request['contents'])
        self.assertEqual(request['config'].max_output_tokens, 1536)
        self.assertEqual(result['recommendations'][0]['next_step'], 'Replace it with a verifiable product benefit.')
        self.assertEqual(result['claim_checks'][0]['evidence_status'], 'not provided')
        self.assertEqual(result['audience_fit']['assessment'], 'mixed')

    def test_full_content_review_requests_structured_evidence_and_context(self):
        response_data = {
            'overall_score': 74,
            'brand_compliance_score': 72,
            'tone_consistency': 78,
            'grammar_score': 96,
            'readability_score': 81,
            'audience_fit': {'assessment': 'mixed', 'explanation': 'The audience is supplied but not addressed directly.'},
            'channel_fit': {'assessment': 'strong', 'explanation': 'The short copy suits the stated email subject line.'},
            'claim_checks': [{
                'claim': 'Save 30%',
                'risk': 'high',
                'evidence_status': 'not provided',
                'explanation': 'No source for the discount is included.',
                'next_step': 'Confirm the offer with the campaign owner.',
            }],
            'violations': [{
                'title': 'Unsubstantiated discount',
                'severity': 'high',
                'evidence': 'Save 30%',
                'description': 'The discount lacks supporting offer details.',
            }],
            'critical_issues': [],
            'recommendations': [{
                'title': 'Verify the offer',
                'priority': 'high',
                'evidence': 'Save 30%',
                'explanation': 'The promotion should match an approved offer.',
                'next_step': 'Confirm the terms and eligible dates.',
                'measurement': 'Match the copy against the approved campaign brief.',
                'suggested_copy': 'Explore our current offer.',
            }],
            'summary': 'The message is concise, but the discount needs substantiation before publishing.',
            'improved_content': 'Explore our current offer.',
        }
        client = SimpleNamespace(
            models=SimpleNamespace(
                generate_content=MagicMock(return_value=SimpleNamespace(text=json.dumps(response_data))),
            ),
        )

        with patch('app.routes.content.genai.Client', return_value=client), \
             patch('app.routes.content.settings.GOOGLE_API_KEY', 'test-key'), \
             patch('app.routes.content.settings.GEMINI_MODEL', 'gemini-3.5-flash'):
            result = asyncio.run(run_ai_brand_analysis(
                'Save 30% today.',
                'Test Brand',
                {'target_audience': 'Returning customers'},
                review_context={
                    'campaign_goal': 'Re-engage customers',
                    'channel': 'Email subject line',
                },
            ))

        prompt = client.models.generate_content.call_args.kwargs['contents']
        self.assertIn('Campaign objective: Re-engage customers', prompt)
        self.assertIn('Target audience: Returning customers', prompt)
        self.assertIn('Channel or format: Email subject line', prompt)
        self.assertIn('"claim_checks"', prompt)
        self.assertIn('This is not an external fact-check.', prompt)
        self.assertEqual(result['claim_checks'][0]['next_step'], 'Confirm the offer with the campaign owner.')
        self.assertEqual(result['channel_fit']['assessment'], 'strong')

    def test_brand_review_retries_supported_model_after_invalid_json(self):
        response_data = {
            'overall_score': 77,
            'brand_compliance_score': 75,
            'tone_consistency': 80,
            'grammar_score': 95,
            'readability_score': 85,
            'violations': [],
            'critical_issues': [],
            'recommendations': [],
            'summary': 'The message is clear and aligned with the brand.',
        }
        client = SimpleNamespace(
            models=SimpleNamespace(
                generate_content=MagicMock(side_effect=[
                    SimpleNamespace(text='{invalid json'),
                    SimpleNamespace(text=json.dumps(response_data)),
                ]),
            ),
        )

        with patch('app.routes.content.get_genai_client', return_value=client), \
             patch('app.routes.content.settings.GOOGLE_API_KEY', 'test-key'), \
             patch('app.routes.content.settings.GEMINI_MODEL', 'gemini-3.5-flash'):
            result = asyncio.run(run_ai_brand_analysis(
                'A clear campaign message.',
                'Test Brand',
                {},
                quick_review=True,
            ))

        attempted_models = [
            call.kwargs['model']
            for call in client.models.generate_content.call_args_list
        ]
        self.assertEqual(attempted_models, ['gemini-3.5-flash', 'gemini-3.5-flash-lite'])
        self.assertEqual(result['engine'], 'gemini')

    def test_brand_review_reports_quota_when_fallback_models_are_unavailable(self):
        def fail_by_model(**kwargs):
            if kwargs['model'] == 'gemini-3.1-flash-lite':
                raise RuntimeError('429 RESOURCE_EXHAUSTED')
            raise RuntimeError('404 NOT_FOUND')

        client = SimpleNamespace(
            models=SimpleNamespace(generate_content=MagicMock(side_effect=fail_by_model)),
        )

        with patch('app.routes.content.get_genai_client', return_value=client), \
             patch('app.routes.content.settings.GOOGLE_API_KEY', 'test-key'), \
             patch('app.routes.content.settings.GEMINI_MODEL', 'gemini-3.1-flash-lite'):
            result = asyncio.run(run_ai_brand_analysis(
                'A clear campaign message.',
                'Test Brand',
                {},
                quick_review=True,
            ))

        self.assertEqual(result['engine'], 'local')
        self.assertIn('quota or rate limit', result['warning'])


if __name__ == '__main__':
    unittest.main()
