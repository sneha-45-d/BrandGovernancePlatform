import asyncio
import base64
import json
import unittest
from io import BytesIO
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import fitz
from docx import Document
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pptx import Presentation

from app.config import settings
from app.main import app
from app.routes.content import run_ai_content_correction
from app.security import get_authenticated_user
from app.services.content_correction import create_corrected_document
from app.services.content_ingestion import MediaFile


class ContentCorrectionTests(unittest.TestCase):
    def test_text_formats_keep_the_original_extension_and_content(self):
        for filename, expected_mime in (
            ('campaign.txt', 'text/plain; charset=utf-8'),
            ('campaign.md', 'text/markdown; charset=utf-8'),
        ):
            with self.subTest(filename=filename):
                data, output_name, mime_type = create_corrected_document(filename, 'Corrected campaign copy.')
                self.assertEqual(output_name, filename.replace('.', '-corrected.', 1))
                self.assertEqual(mime_type, expected_mime)
                self.assertEqual(data, b'Corrected campaign copy.')

    def test_pdf_output_is_a_readable_pdf_with_corrected_text(self):
        data, filename, mime_type = create_corrected_document('campaign.pdf', 'Corrected campaign copy.')
        with fitz.open(stream=data, filetype='pdf') as corrected_pdf:
            extracted = '\n'.join(page.get_text() for page in corrected_pdf)
        self.assertEqual(filename, 'campaign-corrected.pdf')
        self.assertEqual(mime_type, 'application/pdf')
        self.assertIn('Corrected campaign copy.', extracted)

    def test_docx_output_is_a_readable_word_document(self):
        data, filename, _ = create_corrected_document('campaign.docx', 'Corrected campaign copy.')
        document = Document(BytesIO(data))
        self.assertEqual(filename, 'campaign-corrected.docx')
        self.assertIn('Corrected campaign copy.', '\n'.join(paragraph.text for paragraph in document.paragraphs))

    def test_pptx_output_is_a_readable_presentation(self):
        data, filename, _ = create_corrected_document('campaign.pptx', 'Corrected campaign copy.')
        presentation = Presentation(BytesIO(data))
        slide_text = '\n'.join(
            shape.text
            for slide in presentation.slides
            for shape in slide.shapes
            if shape.has_text_frame
        )
        self.assertEqual(filename, 'campaign-corrected.pptx')
        self.assertIn('Corrected campaign copy.', slide_text)

    def test_non_document_format_is_not_claimed_as_a_native_correction(self):
        with self.assertRaises(HTTPException) as unsupported:
            create_corrected_document('creative.png', 'A corrected caption.')
        self.assertEqual(unsupported.exception.status_code, 415)

    def test_media_correction_uses_multimodal_gemini_without_text_fallback(self):
        media = [MediaFile('campaign.mp4', 'video/mp4', b'video-data')]
        response_json = (
            '{"corrected_content":"A clearer campaign caption.",'
            '"summary":"The caption was simplified.",'
            '"changes_made":[],"improvements":[]}'
        )
        with patch('app.routes.content.settings.GOOGLE_API_KEY', 'configured-test-key'), \
             patch('app.routes.content.genai.Client'), \
             patch('app.routes.content.generate_multimodal_content', new=AsyncMock(return_value=response_json)) as generate:
            result = asyncio.run(run_ai_content_correction(
                'Create corrected campaign copy from the uploaded video.',
                'Test Brand',
                {},
                media_files=media,
                analysis_context={'summary': 'The original campaign is unclear.'},
            ))

        self.assertEqual(result['engine'], 'gemini')
        self.assertEqual(result['corrected_content'], 'A clearer campaign caption.')
        self.assertEqual(generate.await_args.args[2], media)
        self.assertEqual(generate.await_args.kwargs['api_key'], 'configured-test-key')


class ContentCorrectionEndpointTests(unittest.TestCase):
    def setUp(self):
        self.user_id = str(uuid4())
        self.auth_override = patch.dict(
            app.dependency_overrides,
            {get_authenticated_user: lambda: {'_id': self.user_id}},
        )
        self.auth_override.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.auth_override.stop()

    def test_uploaded_pdf_returns_corrected_pdf_and_summary(self):
        source = fitz.open()
        page = source.new_page()
        page.insert_text((72, 72), 'Original campaign copy.')
        source_bytes = source.tobytes()
        source.close()
        correction = {
            'corrected_content': 'Corrected campaign copy.',
            'changes_made': [{'title': 'Clearer claim', 'description': 'Removed unsupported wording.'}],
            'summary': 'The campaign copy is clearer.',
            'improvements': [],
            'engine': 'gemini',
        }

        with patch.object(settings, 'GOOGLE_API_KEY', ''), \
             patch('app.routes.content.run_ai_content_correction', new=AsyncMock(return_value=correction)):
            response = self.client.post(
                '/api/content/correct',
                data={'user_id': self.user_id, 'content': 'Original campaign copy.'},
                files={'file': ('campaign.pdf', source_bytes, 'application/pdf')},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers['content-type'], 'application/pdf')
        self.assertIn('campaign-corrected.pdf', response.headers['x-brandithm-filename'])
        metadata = json.loads(base64.b64decode(response.headers['x-brandithm-correction']))
        self.assertEqual(metadata['summary'], 'The campaign copy is clearer.')
        with fitz.open(stream=response.content, filetype='pdf') as output:
            self.assertIn('Corrected campaign copy.', output[0].get_text())

    def test_uploaded_image_returns_corrected_text_without_fake_image_download(self):
        image_bytes = BytesIO()
        Image.new('RGB', (2, 2), '#123456').save(image_bytes, format='PNG')
        correction = {
            'corrected_content': 'A clearer campaign caption.',
            'changes_made': [],
            'summary': 'The caption was simplified.',
            'improvements': [],
            'engine': 'gemini',
        }

        with patch.object(settings, 'GOOGLE_API_KEY', 'configured-test-key'), \
             patch('app.routes.content.run_ai_content_correction', new=AsyncMock(return_value=correction)):
            response = self.client.post(
                '/api/content/correct',
                data={'user_id': self.user_id, 'content': 'Write a corrected caption for this visual.'},
                files={'file': ('campaign.png', image_bytes.getvalue(), 'image/png')},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['corrected_content'], 'A clearer campaign caption.')
        self.assertIsNone(response.json()['output_file'])
        self.assertIn('was not rewritten', response.json()['warning'])


if __name__ == '__main__':
    unittest.main()
