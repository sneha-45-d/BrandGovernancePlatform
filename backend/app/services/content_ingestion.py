import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

import pymupdf as fitz
from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PRESENTATION_ENTRIES = 1000
MAX_PRESENTATION_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_PRESENTATION_IMAGES = 12
MAX_PRESENTATION_IMAGE_BYTES = 10 * 1024 * 1024

FILE_TYPES = {
    '.pdf': ('document', 'application/pdf'),
    '.docx': ('document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    '.pptx': ('presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    '.txt': ('text', 'text/plain'),
    '.md': ('text', 'text/markdown'),
    '.png': ('image', 'image/png'),
    '.jpg': ('image', 'image/jpeg'),
    '.jpeg': ('image', 'image/jpeg'),
    '.webp': ('image', 'image/webp'),
    '.gif': ('image', 'image/gif'),
    '.bmp': ('image', 'image/bmp'),
    '.mp3': ('audio', 'audio/mpeg'),
    '.wav': ('audio', 'audio/wav'),
    '.m4a': ('audio', 'audio/mp4'),
    '.aac': ('audio', 'audio/aac'),
    '.ogg': ('audio', 'audio/ogg'),
    '.flac': ('audio', 'audio/flac'),
    '.mp4': ('video', 'video/mp4'),
    '.mov': ('video', 'video/quicktime'),
    '.webm': ('video', 'video/webm'),
    '.mpeg': ('video', 'video/mpeg'),
    '.mpg': ('video', 'video/mpeg'),
    '.avi': ('video', 'video/x-msvideo'),
    '.wmv': ('video', 'video/x-ms-wmv'),
    '.flv': ('video', 'video/x-flv'),
    '.3gp': ('video', 'video/3gpp'),
}

PRESENTATION_IMAGE_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
}
PRESENTATION_SLIDE_PATTERN = re.compile(r'^ppt/slides/slide(\d+)\.xml$')
IMAGE_FORMATS = {
    '.png': 'PNG',
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.webp': 'WEBP',
    '.gif': 'GIF',
    '.bmp': 'BMP',
}


@dataclass
class MediaFile:
    filename: str
    mime_type: str
    data: bytes


@dataclass
class IngestedContent:
    content_type: str
    extracted_text: str = ''
    media_files: list[MediaFile] = field(default_factory=list)
    requires_multimodal_ai: bool = False


def _extract_presentation(data: bytes, filename: str) -> IngestedContent:
    try:
        with ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_PRESENTATION_ENTRIES:
                raise HTTPException(status_code=413, detail='The presentation contains too many embedded files.')
            if sum(entry.file_size for entry in entries) > MAX_PRESENTATION_UNCOMPRESSED_BYTES:
                raise HTTPException(status_code=413, detail='The expanded presentation exceeds the processing limit.')

            slides = []
            for entry in entries:
                match = PRESENTATION_SLIDE_PATTERN.fullmatch(entry.filename)
                if not match:
                    continue
                try:
                    root = ET.fromstring(archive.read(entry))
                except ET.ParseError as exc:
                    raise HTTPException(status_code=400, detail='The uploaded presentation contains an invalid slide.') from exc
                text = ' '.join(
                    (node.text or '').strip()
                    for node in root.iter()
                    if node.tag.endswith('}t') and (node.text or '').strip()
                )
                if text:
                    slides.append((int(match.group(1)), text))

            media_files = []
            media_total_bytes = 0
            media_entries = sorted(
                (entry for entry in entries if entry.filename.startswith('ppt/media/')),
                key=lambda entry: entry.filename,
            )
            for entry in media_entries:
                extension = Path(entry.filename).suffix.lower()
                mime_type = PRESENTATION_IMAGE_TYPES.get(extension)
                if not mime_type:
                    continue
                if len(media_files) >= MAX_PRESENTATION_IMAGES:
                    break
                if entry.file_size > MAX_PRESENTATION_IMAGE_BYTES:
                    continue
                if media_total_bytes + entry.file_size > MAX_PRESENTATION_IMAGE_BYTES:
                    break
                media_files.append(MediaFile(
                    filename=f'slide-image-{len(media_files) + 1}{extension}',
                    mime_type=mime_type,
                    data=archive.read(entry),
                ))
                media_total_bytes += entry.file_size
    except BadZipFile as exc:
        raise HTTPException(status_code=400, detail='The uploaded presentation could not be read.') from exc

    extracted_text = '\n\n'.join(
        f'Slide {slide_number}: {text}'
        for slide_number, text in sorted(slides)
    )[:100_000]
    return IngestedContent(
        content_type='presentation',
        extracted_text=extracted_text,
        media_files=media_files,
        requires_multimodal_ai=bool(media_files),
    )


def ingest_content_file(filename: str, data: bytes) -> IngestedContent:
    suffix = Path(filename).suffix.lower()
    file_type = FILE_TYPES.get(suffix)
    if not file_type:
        raise HTTPException(
            status_code=415,
            detail='Supported files include PDF, DOCX, PPTX, TXT, MD, images, audio, and video.',
        )
    if not data:
        raise HTTPException(status_code=400, detail='Uploaded file is empty.')
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='The uploaded file exceeds the 25 MB limit.')

    content_type, mime_type = file_type
    if content_type == 'text':
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            text = data.decode('latin-1')
        return IngestedContent(content_type=content_type, extracted_text=text[:1_000_000])

    if suffix == '.pdf':
        try:
            with fitz.open(stream=data, filetype='pdf') as document:
                text = '\n\n'.join(page.get_text() for page in document if page.get_text()).strip()
        except (fitz.FileDataError, ValueError) as exc:
            raise HTTPException(status_code=400, detail='The uploaded PDF file could not be read.') from exc
        return IngestedContent(
            content_type=content_type,
            extracted_text=text[:1_000_000],
            media_files=[MediaFile(filename='uploaded-document.pdf', mime_type=mime_type, data=data)],
            requires_multimodal_ai=not bool(text),
        )

    if suffix == '.docx':
        try:
            with ZipFile(BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > MAX_PRESENTATION_ENTRIES:
                    raise HTTPException(status_code=413, detail='The document contains too many embedded files.')
                if sum(entry.file_size for entry in entries) > MAX_PRESENTATION_UNCOMPRESSED_BYTES:
                    raise HTTPException(status_code=413, detail='The expanded document exceeds the processing limit.')
            document = Document(BytesIO(data))
            text = '\n'.join(
                paragraph.text.strip()
                for paragraph in document.paragraphs
                if paragraph.text.strip()
            )
        except HTTPException:
            raise
        except (BadZipFile, PackageNotFoundError, ValueError, KeyError) as exc:
            raise HTTPException(status_code=400, detail='The uploaded DOCX file could not be read.') from exc
        return IngestedContent(content_type=content_type, extracted_text=text[:1_000_000])

    if suffix == '.pptx':
        return _extract_presentation(data, filename)

    if content_type == 'image':
        try:
            with Image.open(BytesIO(data)) as image:
                if image.width * image.height > 80_000_000:
                    raise HTTPException(status_code=413, detail='The uploaded image dimensions exceed the processing limit.')
                if image.format != IMAGE_FORMATS[suffix]:
                    raise HTTPException(status_code=400, detail='The image file extension does not match its actual format.')
                image.verify()
        except HTTPException:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, UnidentifiedImageError) as exc:
            raise HTTPException(status_code=400, detail='The uploaded image is invalid or exceeds safe processing limits.') from exc

    return IngestedContent(
        content_type=content_type,
        media_files=[MediaFile(filename=f'uploaded-asset{suffix}', mime_type=mime_type, data=data)],
        requires_multimodal_ai=True,
    )
