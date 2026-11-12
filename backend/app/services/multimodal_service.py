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
    pass


def _state_name(file_object) -> str:
    try:
        return str(getattr(file_object, 'state', file_object)).upper()
    except Exception:
        return 'UNKNOWN'


def _generate(model_name: str, prompt: str, media_files: list[MediaFile], api_key: str | None = None) -> str:
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        raise MultimodalAnalysisError('Gemini API key is not configured.')

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
            state = _state_name(uploaded)
            while 'PROCESSING' in state and time.monotonic() < deadline:
                time.sleep(FILE_PROCESSING_POLL_SECONDS)
                uploaded = client.files.get(name=uploaded.name)
                uploaded_files[-1] = uploaded
                state = _state_name(uploaded)
            if 'FAILED' in state:
                raise MultimodalAnalysisError('Gemini could not process one of the uploaded media files.')
            if 'ACTIVE' not in state:
                raise MultimodalAnalysisError('Gemini media processing did not finish in time.')

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
        logger.exception('Gemini multimodal analysis failed')
        raise MultimodalAnalysisError('Gemini could not analyze the uploaded media.') from exc
    finally:
        for uploaded in uploaded_files:
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                logger.exception('Unable to delete temporary Gemini upload %s', getattr(uploaded, 'name', 'unknown'))
        for path in temporary_paths:
            try:
                os.remove(path)
            except OSError:
                logger.exception('Unable to delete temporary media file %s', path)


async def generate_multimodal_content(
    model_name: str,
    prompt: str,
    media_files: list[MediaFile],
    api_key: str | None = None,
) -> str:
    return await asyncio.to_thread(_generate, model_name, prompt, media_files, api_key)
