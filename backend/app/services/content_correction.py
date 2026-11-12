import textwrap
from io import BytesIO
from pathlib import Path

import fitz
from docx import Document
from fastapi import HTTPException
from pptx import Presentation
from pptx.util import Pt


NATIVE_DOCUMENT_TYPES = {'.txt', '.md', '.pdf', '.docx', '.pptx'}
OUTPUT_MIME_TYPES = {
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
PAGE_WIDTH = 595
PAGE_HEIGHT = 842
PAGE_MARGIN = 54
FONT_SIZE = 11
LINE_HEIGHT = 16
PRESENTATION_CHARS_PER_SLIDE = 700


def _create_pdf(content: str, title: str) -> bytes:
    pdf = fitz.open()
    font_file = next(
        (
            path
            for path in (
                Path('C:/Windows/Fonts/arial.ttf'),
                Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
                Path('/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'),
                Path('/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'),
            )
            if path.is_file()
        ),
        None,
    )
    font = fitz.Font(fontfile=str(font_file)) if font_file else fitz.Font('helv')
    available_width = PAGE_WIDTH - PAGE_MARGIN * 2
    available_height = PAGE_HEIGHT - PAGE_MARGIN
    page = None
    y = PAGE_MARGIN

    def add_page():
        nonlocal page, y
        page = pdf.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        y = PAGE_MARGIN
        return page

    for paragraph in content.splitlines() or [content]:
        words = paragraph.split()
        lines = []
        current_line = ''
        for word in words:
            candidate = f'{current_line} {word}'.strip()
            if current_line and font.text_length(candidate, fontsize=FONT_SIZE) > available_width:
                lines.append(current_line)
                current_line = word
            else:
                current_line = candidate
        if current_line:
            lines.append(current_line)

        for line in lines or ['']:
            if page is None or y + LINE_HEIGHT > available_height:
                add_page()
            insert_options = {'fontsize': FONT_SIZE, 'color': (0.12, 0.16, 0.22)}
            if font_file:
                insert_options['fontfile'] = str(font_file)
            page.insert_text((PAGE_MARGIN, y), line, **insert_options)
            y += LINE_HEIGHT
        y += LINE_HEIGHT // 2

    pdf.set_metadata({'title': title, 'producer': 'BRANDITHM'})
    result = pdf.tobytes()
    pdf.close()
    return result


def _create_docx(content: str, title: str) -> bytes:
    document = Document()
    document.add_heading(title, level=1)
    for paragraph in content.split('\n'):
        document.add_paragraph(paragraph)
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _split_presentation_content(content: str) -> list[str]:
    paragraphs = []
    for line in content.splitlines():
        if line.strip():
            paragraphs.extend(textwrap.wrap(
                line.strip(),
                width=PRESENTATION_CHARS_PER_SLIDE,
                break_long_words=False,
                replace_whitespace=False,
            ))
    if not paragraphs and content.strip():
        paragraphs = [content.strip()]
    slides = []
    current_slide = []
    current_size = 0
    for paragraph in paragraphs or [content.strip()]:
        if current_slide and current_size + len(paragraph) > PRESENTATION_CHARS_PER_SLIDE:
            slides.append('\n'.join(current_slide))
            current_slide = []
            current_size = 0
        current_slide.append(paragraph)
        current_size += len(paragraph)
    if current_slide:
        slides.append('\n'.join(current_slide))
    return slides


def _create_pptx(content: str, title: str) -> bytes:
    presentation = Presentation()
    layout = presentation.slide_layouts[1]
    for index, slide_content in enumerate(_split_presentation_content(content)):
        slide = presentation.slides.add_slide(layout)
        slide.shapes.title.text = title if index == 0 else f'{title} ({index + 1})'
        text_frame = slide.placeholders[1].text_frame
        text_frame.clear()
        for paragraph_index, line in enumerate(slide_content.splitlines()):
            paragraph = text_frame.paragraphs[0] if paragraph_index == 0 else text_frame.add_paragraph()
            paragraph.text = line
            paragraph.font.size = Pt(20)
    output = BytesIO()
    presentation.save(output)
    return output.getvalue()


def create_corrected_document(filename: str, content: str) -> tuple[bytes, str, str]:
    safe_filename = Path(filename.replace('\\', '/')).name
    suffix = Path(safe_filename).suffix.lower()
    if suffix not in NATIVE_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail='Native corrected downloads are currently supported for TXT, MD, PDF, DOCX, and PPTX files.',
        )
    if not content.strip():
        raise HTTPException(status_code=422, detail='The correction did not produce any content to export.')

    title = f'Corrected {Path(safe_filename).stem or "brand content"}'
    if suffix in {'.txt', '.md'}:
        data = content.encode('utf-8')
    elif suffix == '.pdf':
        data = _create_pdf(content, title)
    elif suffix == '.docx':
        data = _create_docx(content, title)
    else:
        data = _create_pptx(content, title)

    return data, f'{Path(safe_filename).stem or "brand-content"}-corrected{suffix}', OUTPUT_MIME_TYPES[suffix]
