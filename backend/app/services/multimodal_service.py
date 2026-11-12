import asyncio
import logging
import os
import tempfile
import time
from pathlib import Path

from google import genai
from google.genai import types

from app.config import settings
from app.services.content_ingestion import MediaFile

logger = logging.getLogger(__name__)
FILE_PROCESSING_TIMEOUT_SECONDS = 120
FILE_PROCESSING_POLL_SECONDS = 2


class MultimodalAnalysisError(Exception):
    def __init__(self, message: str, error_code: str = 'media_processing_failed'):
        super().__init__(message)
        self.error_code = error_code


def _normalized_state(file_object) -> str:
    state = getattr(file_object, 'state', None)
    return getattr(state, 'name', str(state)).upper().split('.')[-1]


def _provider_error(exc: Exception) -> MultimodalAnalysisError:
    message = str(exc).lower()
    status_code = getattr(exc, 'code', None)
    if not isinstance(status_code, int):
        response = getattr(exc, 'response', None)
        status_code = getattr(response, 'status_code', None)

    if status_code == 403:
        return MultimodalAnalysisError(
            'Google denied this Gemini API request. Enable the Generative Language API for this project and check that API-key restrictions allow requests from this backend.',
            error_code='api_access_denied',
        )
    if status_code == 401 or 'api_key_invalid' in message or 'api key not valid' in message or 'invalid api key' in message:
        return MultimodalAnalysisError(
            'Google rejected the Gemini API key. Replace GEMINI_API_KEY in backend\\.env with a valid Google AI Studio key, then restart the backend.',
            error_code='invalid_api_key',
        )
    if status_code == 429 or '429' in message or 'resource_exhausted' in message or 'quota' in message:
        return MultimodalAnalysisError(
            'Gemini quota or rate limit was reached. Check the Google AI project quota and billing, then try again.',
            error_code='quota_exceeded',
        )
    if status_code in (400, 404, 415) or any(
        marker in message
        for marker in ('unsupported mime', 'unsupported file', 'invalid argument', 'not found')
    ):
        return MultimodalAnalysisError(
            'Gemini rejected the uploaded media. Check that this exact format is supported, the file opens correctly, and the selected model accepts media input.',
            error_code='unsupported_media',
        )
    if (isinstance(status_code, int) and status_code >= 500) or type(exc).__name__ in {
        'ServerError',
        'DeadlineExceeded',
        'ServiceUnavailable',
    }:
        return MultimodalAnalysisError(
            'Google Gemini media processing is temporarily unavailable. Brandithm retried the request; wait a moment and try Analyze Content again.',
            error_code='provider_unavailable',
        )
    return MultimodalAnalysisError(
        'Gemini could not process this media request. Check the file format, model access, and Google AI project permissions.',
        error_code='media_processing_failed',
    )


def _generate(model_name: str, prompt: str, media_files: list[MediaFile], api_key: str | None = None) -> str:
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        raise MultimodalAnalysisError('Gemini API key is not configured.', error_code='invalid_api_key')

    client = genai.Client(api_key=key)
    uploaded_files = []
    temporary_paths = []
    try:
        for index, media in enumerate(media_files, start=1):
            suffix = Path(media.filename).suffix
            handle = tempfile.NamedTemporaryFile(
                prefix='brandithm-',
                suffix=suffix,
                delete=False,
            )
            temporary_paths.append(handle.name)
            try:
                handle.write(media.data)
            finally:
                handle.close()

            uploaded = client.files.upload(
                file=handle.name,
                config=types.UploadFileConfig(
                    mime_type=media.mime_type,
                    display_name=f'Brandithm upload {index}{suffix}',
                ),
            )
            uploaded_files.append(uploaded)

            deadline = time.monotonic() + FILE_PROCESSING_TIMEOUT_SECONDS
            state = _normalized_state(uploaded)
            while state == 'PROCESSING' and time.monotonic() < deadline:
                time.sleep(FILE_PROCESSING_POLL_SECONDS)
                uploaded = client.files.get(name=uploaded.name)
                uploaded_files[-1] = uploaded
                state = _normalized_state(uploaded)
            if state == 'FAILED':
                raise MultimodalAnalysisError(
                    'Gemini could not process one of the uploaded media files. Check that the selected model accepts this format and that the file is valid.',
                    error_code='unsupported_media',
                )
            if state != 'ACTIVE':
                raise MultimodalAnalysisError(
                    'Gemini media processing did not finish within two minutes. Try a shorter or smaller media file.',
                    error_code='processing_timeout',
                )

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, *uploaded_files],
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type='application/json',
                max_output_tokens=2048,
            ),
        )
        if not response.text:
            raise MultimodalAnalysisError('Gemini returned an empty media analysis.')
        return response.text
    except MultimodalAnalysisError:
        raise
    except Exception as exc:
        mapped_error = _provider_error(exc)
        logger.error('Gemini multimodal request failed (%s, %s).', mapped_error.error_code, type(exc).__name__)
        raise mapped_error from exc
    finally:
        for uploaded in uploaded_files:
            try:
                client.files.delete(name=uploaded.name)
            except Exception as exc:
                logger.error('Unable to delete temporary Gemini upload (%s).', type(exc).__name__)
        for path in temporary_paths:
            try:
                os.remove(path)
            except OSError as exc:
                logger.error('Unable to delete temporary media file (%s).', type(exc).__name__)


async def generate_multimodal_content(
    model_name: str,
    prompt: str,
    media_files: list[MediaFile],
    api_key: str | None = None,
) -> str:
    attempts = 3
    for attempt in range(attempts):
        try:
            return await asyncio.to_thread(_generate, model_name, prompt, media_files, api_key)
        except MultimodalAnalysisError as exc:
            if exc.error_code != 'provider_unavailable' or attempt == attempts - 1:
                raise
            await asyncio.sleep(attempt + 1)
