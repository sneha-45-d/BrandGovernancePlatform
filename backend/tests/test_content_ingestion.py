import asyncio
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from zipfile import ZIP_DEFLATED, ZipFile

from google.genai import types
from fastapi import HTTPException
from PIL import Image

from app.services.content_ingestion import (
    MAX_UPLOAD_BYTES,
    MediaFile,
    ingest_content_file,
)
from app.services.multimodal_service import (
    MultimodalAnalysisError,
    _provider_error,
    generate_multimodal_content,
)
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
            state=types.FileState.ACTIVE,
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

        with patch('app.services.multimodal_service.genai.Client', return_value=mock_client):
            result = asyncio.run(generate_multimodal_content(
                'gemini-test',
                'Analyze asset',
                [media],
                api_key='test-key',
            ))

        self.assertEqual(result, response.text)
        self.assertEqual(mock_client.files.upload.call_count, 1)
        uploaded_path = Path(mock_client.files.upload.call_args.kwargs['file'])
        self.assertFalse(uploaded_path.exists())
        mock_client.files.delete.assert_called_once_with(name=uploaded.name)
        mock_client.models.generate_content.assert_called_once()

    def test_invalid_gemini_key_error_is_actionable_without_echoing_key(self):
        private_key = 'test-secret-key-value'
        mapped = _provider_error(Exception(
            f'API_KEY_INVALID: API key not valid. Request URL included {private_key}'
        ))

        self.assertIsInstance(mapped, MultimodalAnalysisError)
        self.assertEqual(mapped.error_code, 'invalid_api_key')
        self.assertIn('backend\\.env', str(mapped))
        self.assertNotIn(private_key, str(mapped))

    def test_gemini_quota_error_is_classified_without_returning_a_false_success(self):
        mapped = _provider_error(Exception('429 RESOURCE_EXHAUSTED: quota exceeded'))
        self.assertEqual(mapped.error_code, 'quota_exceeded')
        self.assertIn('quota', str(mapped).lower())

    def test_gemini_server_error_is_classified_as_retryable(self):
        error = type('ServerError', (Exception,), {'code': 500})('temporary service error')
        mapped = _provider_error(error)
        self.assertEqual(mapped.error_code, 'provider_unavailable')
        self.assertIn('retried', str(mapped))

    def test_multimodal_server_error_is_retried_before_returning(self):
        transient_error = MultimodalAnalysisError('Temporary service error', 'provider_unavailable')
        with patch(
            'app.services.multimodal_service.asyncio.to_thread',
            new=AsyncMock(side_effect=[transient_error, 'media analysis result']),
        ) as worker, patch('asyncio.sleep', new=AsyncMock()):
            result = asyncio.run(generate_multimodal_content(
                'gemini-test',
                'Analyze this media',
                [MediaFile('creative.png', 'image/png', b'image-bytes')],
                api_key='test-key',
            ))
        self.assertEqual(result, 'media analysis result')
        self.assertEqual(worker.await_count, 2)

    def test_gemini_access_error_is_not_misreported_as_unsupported_media(self):
        error = type('ClientError', (Exception,), {'code': 403})('permission denied')
        mapped = _provider_error(error)
        self.assertEqual(mapped.error_code, 'api_access_denied')
        self.assertIn('API-key restrictions', str(mapped))

    def test_media_analysis_requires_a_gemini_key_instead_of_falling_back(self):
        media = [MediaFile('creative.png', 'image/png', b'image-bytes')]
        with patch('app.routes.content.settings.GOOGLE_API_KEY', ''):
            with self.assertRaises(HTTPException) as missing_key:
                asyncio.run(run_ai_brand_analysis('Uploaded image asset.', 'Test Brand', {}, media))
        self.assertEqual(missing_key.exception.status_code, 503)

    def test_invalid_key_during_media_analysis_returns_configuration_error(self):
        media = [MediaFile('creative.png', 'image/png', b'image-bytes')]
        provider_error = _provider_error(Exception('API_KEY_INVALID: API key not valid.'))
        with patch('app.routes.content.settings.GOOGLE_API_KEY', 'configured-test-key'), \
             patch('app.routes.content.genai.Client'), \
             patch(
                 'app.routes.content.generate_multimodal_content',
                 new=AsyncMock(side_effect=provider_error),
             ):
            with self.assertRaises(HTTPException) as invalid_key:
                asyncio.run(run_ai_brand_analysis('Uploaded image asset.', 'Test Brand', {}, media))
        self.assertEqual(invalid_key.exception.status_code, 503)
        self.assertIn('valid Google AI Studio key', invalid_key.exception.detail)
        self.assertNotIn('API_KEY_INVALID', invalid_key.exception.detail)

    def test_text_analysis_still_uses_the_labeled_local_fallback(self):
        with patch('app.routes.content.settings.GOOGLE_API_KEY', ''):
            result = asyncio.run(run_ai_brand_analysis('A clear campaign message.', 'Test Brand', {}))
        self.assertEqual(result['engine'], 'local')
        self.assertIn('not an AI model', result['warning'])


if __name__ == '__main__':
    unittest.main()
