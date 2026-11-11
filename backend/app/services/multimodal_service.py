import logging
import os
import tempfile
import time
from pathlib import Path

import google.generativeai as genai

from app.services.content_ingestion import MediaFile

logger = logging.getLogger(__name__)
FILE_PROCESSING_TIMEOUT_SECONDS = 120
FILE_PROCESSING_POLL_SECONDS = 2


class MultimodalAnalysisError(Exception):
    pass


def _state_name(file_object) -> str:
    try:
        return genai.protos.File.State(file_object.state).name
    except (AttributeError, TypeError, ValueError):
        return str(file_object.state)


def _generate(model_name: str, prompt: str, media_files: list[MediaFile]) -> str:
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

            uploaded = genai.upload_file(
                path=handle.name,
                mime_type=media.mime_type,
                display_name=f'Brandithm upload {index}{suffix}',
            )
            uploaded_files.append(uploaded)

            deadline = time.monotonic() + FILE_PROCESSING_TIMEOUT_SECONDS
            state = _state_name(uploaded)
            while state == 'PROCESSING' and time.monotonic() < deadline:
                time.sleep(FILE_PROCESSING_POLL_SECONDS)
                uploaded = genai.get_file(uploaded.name)
                uploaded_files[-1] = uploaded
                state = _state_name(uploaded)
            if state == 'FAILED':
                raise MultimodalAnalysisError('Gemini could not process one of the uploaded media files.')
            if state != 'ACTIVE':
                raise MultimodalAnalysisError('Gemini media processing did not finish in time.')

        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            [prompt, *uploaded_files],
            generation_config={
                'temperature': 0.2,
                'response_mime_type': 'application/json',
                'max_output_tokens': 2048,
            },
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
                genai.delete_file(uploaded.name)
            except Exception:
                logger.exception('Unable to delete temporary Gemini upload %s', uploaded.name)
        for path in temporary_paths:
            try:
                os.remove(path)
            except OSError:
                logger.exception('Unable to delete temporary media file %s', path)


async def generate_multimodal_content(
    model_name: str,
    prompt: str,
    media_files: list[MediaFile],
) -> str:
    import asyncio

    return await asyncio.to_thread(_generate, model_name, prompt, media_files)
