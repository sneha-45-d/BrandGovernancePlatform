import asyncio
import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Literal
from zipfile import BadZipFile

import fitz
import google.generativeai as genai
from bson import ObjectId
from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from google.api_core import exceptions as google_exceptions
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from app.config import settings
from app.database import local_store
from app.database.mongo import get_db
from app.services import clash_service, scoring_service, tone_service

router = APIRouter()
logger = logging.getLogger(__name__)
content_collection = get_db()['content_analysis']
guidelines_collection = get_db()['brand_guidelines']


class BrandGuidelinesInput(BaseModel):
    user_id: str = Field(..., min_length=1)
    brand_name: str = Field(default='BRANDITHM')
    brand_description: str = ''
    preferred_tone: str = ''
    target_audience: str = ''
    preferred_keywords: list[str] = Field(default_factory=list)
    restricted_words: list[str] = Field(default_factory=list)
    writing_style: str = ''
    brand_communication_rules: str = ''


class ReviewStatusInput(BaseModel):
    status: Literal['needs_review', 'approved', 'revision_requested']


def normalize_list(items):
    if items is None:
        return []
    if isinstance(items, str):
        return [item.strip() for item in items.split(',') if item.strip()]
    return [str(item).strip() for item in items if str(item).strip()]


def build_guideline_context(guidelines: dict) -> str:
    brand_name = (guidelines or {}).get('brand_name') or 'BRANDITHM'
    description = (guidelines or {}).get('brand_description') or 'Modern AI-powered brand governance platform.'
    tone = (guidelines or {}).get('preferred_tone') or 'Confident, clear, modern, professional, and trustworthy.'
    audience = (guidelines or {}).get('target_audience') or 'Marketing and product teams.'
    keywords = ', '.join(normalize_list((guidelines or {}).get('preferred_keywords') or [])) or 'brand, trust, clarity, innovation'
    restricted = ', '.join(normalize_list((guidelines or {}).get('restricted_words') or [])) or 'overpromise, jargon-heavy, aggressive sales language'
    style = (guidelines or {}).get('writing_style') or 'Short, informative, and conversion-aware, with clear product language.'
    rules = (guidelines or {}).get('brand_communication_rules') or 'Use direct messaging, concise headlines, and avoid exaggerated claims.'

    return (
        f'Brand name: {brand_name}\n'
        f'Brand description: {description}\n'
        f'Preferred tone: {tone}\n'
        f'Target audience: {audience}\n'
        f'Preferred keywords: {keywords}\n'
        f'Restricted words: {restricted}\n'
        f'Writing style: {style}\n'
        f'Brand communication rules: {rules}'
    )


def parse_ai_json_response(raw_text: str | None) -> dict:
    text = (raw_text or '').strip()
    if not text:
        raise ValueError('Empty AI response received from Gemini.')

    if '```' in text:
        text = re.sub(r'```(?:json)?', '', text, flags=re.IGNORECASE).strip()

    first = text.find('{')
    last = text.rfind('}')
    if first != -1 and last != -1 and last > first:
        text = text[first:last + 1]

    return json.loads(text)


def build_local_violation_list(content: str, restricted_words: list[str]) -> list[dict]:
    normalized_content = content.lower()
    violations = []
    seen = set()

    for word in restricted_words:
        cleaned = str(word).strip().lower()
        if not cleaned:
            continue
        if cleaned in normalized_content and cleaned not in seen:
            seen.add(cleaned)
            violations.append({
                'title': f"Restricted term detected: '{word}'",
                'severity': 'high' if cleaned in {'guaranteed', 'instant', 'best ever', 'hype'} else 'medium',
                'description': f"The phrase '{word}' may overstate the message and conflicts with approved brand writing guidance.",
            })

    if 'click here' in normalized_content and 'click here' not in seen:
        violations.append({
            'title': 'Promotional CTA detected',
            'severity': 'medium',
            'description': 'This copy uses a pushy call to action that may feel less credible than the approved tone.',
        })

    return violations


def build_local_analysis(content: str, brand_name: str, guidelines: dict) -> dict:
    restricted_words = normalize_list((guidelines or {}).get('restricted_words') or [])
    violations = build_local_violation_list(content, restricted_words)

    issue_count = len(violations)
    tone_penalty = 6 * issue_count
    score = max(40, 100 - (issue_count * 16) - tone_penalty)
    score = min(score, 98)

    tone_report = tone_service.analyze_tone_local(content, guidelines)

    return {
        'overall_score': int(score),
        'brand_compliance_score': int(max(50, score - 4)),
        'tone_consistency': int(max(50, score - 7)),
        'grammar_score': 93,
        'readability_score': 91,
        'tone_analysis': tone_report,
        'violations': violations or [{
            'title': 'No critical brand violations detected',
            'severity': 'low',
            'description': 'The content appears aligned with the provided brand guidance during offline review.'
        }],
        'critical_issues': [
            {
                'title': 'Brand safety fallback used',
                'description': 'The live Gemini service was unavailable or quota-limited, so a local policy check was used for this review.',
                'recommendation': 'Reconnect or refresh the Gemini API key to enable full AI-powered analysis.'
            }
        ] if not violations else [],
        'recommendations': [
            {
                'title': 'Tighten the message',
                'explanation': 'Replace promotional or exaggerated copy with clearer, evidence-based brand language.',
                'suggested_copy': 'Use confident, specific wording and avoid unsupported or sensational claims.'
            }
        ],
        'summary': (
            'Fallback brand review completed successfully using local brand rules. '
            + ('The copy contains restricted promotional language that should be softened.' if violations else 'The copy appears broadly aligned with the brand guidelines.')
        ),
        'improved_content': content.strip(),
        'engine': 'local',
        'warning': 'Gemini is unavailable or not configured. This result uses local rule checks, not an AI model.',
    }


def build_local_correction(content: str, brand_name: str, guidelines: dict) -> dict:
    replacements = {
        'guaranteed': 'designed to support',
        'instant': 'fast',
        'best ever': 'strong',
        'hype': 'clear value',
        'click here': 'learn more',
    }

    corrected = content
    for original, replacement in replacements.items():
        pattern = re.compile(re.escape(original), re.IGNORECASE)
        corrected = pattern.sub(replacement, corrected)

    changes = []
    for original, replacement in replacements.items():
        if re.search(re.escape(original), content, flags=re.IGNORECASE):
            changes.append({
                'title': f"Replaced '{original}' with '{replacement}'",
                'description': 'This softened the message to better align with approved brand language and reduce hype.'
            })

    if not changes:
        changes.append({
            'title': 'Tone refinement applied',
            'description': 'The content was simplified and made more brand-safe without changing the original intent.'
        })

    return {
        'corrected_content': corrected.strip() or content.strip(),
        'changes_made': changes,
        'summary': 'Fallback correction applied to soften promotional wording and improve brand alignment.',
        'improvements': [
            {
                'title': 'Brand-safe rewrite',
                'description': 'The message has been adjusted to sound credible, polished, and aligned with governance standards.'
            }
        ],
        'engine': 'local',
        'warning': 'Gemini is unavailable or not configured. This result uses local text substitutions, not an AI rewrite.',
    }


def extract_text_from_file(file: UploadFile | None) -> str:
    if file is None or not file.filename:
        return ''

    file_bytes = file.file.read()
    suffix = Path(file.filename).suffix.lower()

    if suffix == '.pdf':
        try:
            with fitz.open(stream=file_bytes, filetype='pdf') as document:
                texts = [page.get_text() for page in document if page.get_text()]
            return '\n\n'.join(texts).strip()
        except fitz.FileDataError as exc:
            raise HTTPException(status_code=400, detail='The uploaded PDF file could not be read.') from exc

    if suffix == '.docx':
        try:
            document = Document(BytesIO(file_bytes))
            return '\n'.join(paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip())
        except (BadZipFile, PackageNotFoundError, ValueError, KeyError) as exc:
            raise HTTPException(status_code=400, detail='The uploaded DOCX file could not be read.') from exc

    if suffix in {'.txt', '.md'}:
        try:
            return file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            return file_bytes.decode('latin-1', errors='ignore')

    raise HTTPException(status_code=415, detail='Supported file types are PDF, DOCX, TXT, and MD.')


def serialize_analysis_record(record: dict) -> dict | None:
    if not record:
        return None

    analysis = record.get('analysis') or {}
    created_at = record.get('created_at')

    return {
        'id': str(record.get('_id')),
        'user_id': record.get('user_id'),
        'brand_name': record.get('brand_name') or 'BRANDITHM',
        'content_title': record.get('content_title') or record.get('title') or 'Untitled analysis',
        'content': record.get('content') or '',
        'analysis': analysis,
        'overall_score': analysis.get('overall_score'),
        'compliance_score': analysis.get('brand_compliance_score'),
        'status': record.get('status') or 'completed',
        'review_status': record.get('review_status') or 'needs_review',
        'created_at': created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at,
        'brand_guidelines': record.get('guidelines') or {},
    }


def is_valid_gemini_key(key: str | None) -> bool:
    if not key:
        return False
    cleaned = key.strip().lower()
    if not cleaned or 'your-' in cleaned or 'placeholder' in cleaned or 'replace' in cleaned:
        return False
    return True


async def run_ai_brand_analysis(content: str, brand_name: str, guidelines: dict) -> dict:
    api_key = settings.GOOGLE_API_KEY or ''
    if not is_valid_gemini_key(api_key):
        return build_local_analysis(content, brand_name, guidelines)

    try:
        genai.configure(api_key=api_key)

        model_name = (settings.GEMINI_MODEL or 'gemini-3.6-flash').strip()
        if not model_name:
            model_name = 'gemini-3.6-flash'

        model = genai.GenerativeModel(model_name)
        guideline_context = build_guideline_context(guidelines)

        prompt = """
You are BRANDITHM AI Brand Governance Engine.
Analyze the submitted marketing content against the brand guidelines below.

Brand:
{brand_name}

Brand guidelines:
{guideline_context}

Content to analyze:
{content}

Return valid JSON only with the following schema:
{{
  "overall_score": 0,
  "brand_compliance_score": 0,
  "tone_consistency": 0,
  "grammar_score": 0,
  "readability_score": 0,
  "violations": [{{"title": "", "severity": "low|medium|high|critical", "description": ""}}],
  "critical_issues": [{{"title": "", "description": "", "recommendation": ""}}],
  "recommendations": [{{"title": "", "explanation": "", "suggested_copy": ""}}],
  "summary": "",
  "improved_content": ""
}}

Rules:
- Score each metric between 0 and 100.
- Identify real violations of tone, compliance, messaging, restricted words, or unsupported claims.
- Explain the underlying issue and provide actionable recommendations.
- Keep the improved_content version aligned with the brand voice but do not rewrite the original content automatically.
""".format(
            brand_name=brand_name,
            guideline_context=guideline_context,
            content=content,
        )

        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config={
                'temperature': 0.2,
                'response_mime_type': 'application/json',
                'max_output_tokens': 2048,
            },
        )
        parsed = parse_ai_json_response(response.text)

        tone_report = parsed.get('tone_analysis')
        if not isinstance(tone_report, dict) or 'detected' not in tone_report:
            tone_report = tone_service.analyze_tone_local(content, guidelines)

        return {
            'overall_score': int(parsed.get('overall_score', 0)),
            'brand_compliance_score': int(parsed.get('brand_compliance_score', 0)),
            'tone_consistency': int(parsed.get('tone_consistency', 0)),
            'grammar_score': int(parsed.get('grammar_score', 0)),
            'readability_score': int(parsed.get('readability_score', 0)),
            'tone_analysis': tone_report,
            'violations': parsed.get('violations') or [],
            'critical_issues': parsed.get('critical_issues') or [],
            'recommendations': parsed.get('recommendations') or [],
            'summary': parsed.get('summary') or 'AI review completed successfully.',
            'improved_content': parsed.get('improved_content') or content,
            'engine': 'gemini',
        }
    except (google_exceptions.GoogleAPIError, ValueError, TypeError) as exc:
        logger.warning('Gemini content analysis failed; using local rules: %s', exc)
        return build_local_analysis(content, brand_name, guidelines)


async def run_ai_content_correction(content: str, brand_name: str, guidelines: dict) -> dict:
    api_key = settings.GOOGLE_API_KEY or ''
    if not is_valid_gemini_key(api_key):
        return build_local_correction(content, brand_name, guidelines)

    try:
        genai.configure(api_key=api_key)

        model_name = (settings.GEMINI_MODEL or 'gemini-3.6-flash').strip() or 'gemini-3.6-flash'
        model = genai.GenerativeModel(model_name)
        guideline_context = build_guideline_context(guidelines)

        prompt = """
You are BRANDITHM AI Copy Improvement Engine.
Rewrite the original content to improve clarity, grammar, tone, readability, and brand alignment while preserving the original meaning.

Brand:
{brand_name}

Brand guidelines:
{guideline_context}

Original content:
{content}

Return valid JSON only with the following schema:
{{
  "corrected_content": "",
  "changes_made": [{{"title": "", "description": ""}}],
  "summary": "",
  "improvements": [{{"title": "", "description": ""}}]
}}

Rules:
- Correct grammar and spelling.
- Remove unsupported claims, restricted words, or overpromotional language.
- Improve brand tone and readability while preserving meaning.
- Keep the rewrite clear, concise, and enterprise-ready.
""".format(
            brand_name=brand_name,
            guideline_context=guideline_context,
            content=content,
        )

        response = await asyncio.to_thread(
            model.generate_content,
            prompt,
            generation_config={
                'temperature': 0.25,
                'response_mime_type': 'application/json',
                'max_output_tokens': 2048,
            },
        )
        parsed = parse_ai_json_response(response.text)

        return {
            'corrected_content': parsed.get('corrected_content') or content,
            'changes_made': parsed.get('changes_made') or [],
            'summary': parsed.get('summary') or 'Content was refined to match brand voice and clarity standards.',
            'improvements': parsed.get('improvements') or [],
            'engine': 'gemini',
        }
    except (google_exceptions.GoogleAPIError, ValueError, TypeError) as exc:
        logger.warning('Gemini content correction failed; using local substitutions: %s', exc)
        return build_local_correction(content, brand_name, guidelines)


@router.post('/brand-guidelines')
def save_brand_guidelines(payload: BrandGuidelinesInput):
    record = payload.model_dump()
    record['updated_at'] = datetime.now(timezone.utc)
    record['created_at'] = record.get('created_at', record['updated_at'])

    try:
        guidelines_collection.update_one(
            {'user_id': payload.user_id, 'brand_name': payload.brand_name},
            {'$set': record},
            upsert=True,
        )
        return {
            'message': 'Brand guidelines saved successfully.',
            'brand_name': payload.brand_name,
            'user_id': payload.user_id,
            'storage': 'mongodb',
        }
    except PyMongoError:
        logger.warning('MongoDB unavailable; saving brand guidelines to local server storage')
        try:
            local_store.save_guidelines(payload.model_dump())
            return {
                'message': 'Brand guidelines saved to local server storage.',
                'brand_name': payload.brand_name,
                'user_id': payload.user_id,
                'storage': 'server-local',
            }
        except sqlite3.Error as exc:
            logger.exception('Unable to save brand guidelines to local server storage')
            raise HTTPException(status_code=503, detail='Brand guidelines could not be saved to local server storage.') from exc


@router.get('/brand-guidelines')
def get_brand_guidelines(user_id: str):
    try:
        items = list(guidelines_collection.find({'user_id': user_id}).sort('updated_at', -1).limit(10))
    except PyMongoError:
        logger.warning('MongoDB unavailable; loading brand guidelines from local server storage')
        try:
            return {
                'guidelines': local_store.get_guidelines(user_id),
                'storage': 'server-local',
            }
        except sqlite3.Error as exc:
            logger.exception('Unable to load brand guidelines from local server storage')
            raise HTTPException(status_code=503, detail='Brand guidelines are unavailable from both configured storage systems.') from exc

    formatted = []
    for item in items:
        item['_id'] = str(item.get('_id'))
        item.pop('created_at', None)
        item.pop('updated_at', None)
        formatted.append(item)
    return {'guidelines': formatted, 'storage': 'mongodb'}


@router.get('/content/history')
def get_content_history(user_id: str = Query(...), status: str | None = None, search: str | None = None):
    query = {'user_id': user_id}
    if status:
        query['status'] = status

    try:
        local_items = local_store.list_analyses(user_id, status=status, search=search, limit=50)
    except sqlite3.Error as exc:
        logger.exception('Unable to load analysis history from local server storage')
        raise HTTPException(status_code=503, detail='Analysis history is unavailable from local server storage.') from exc
    try:
        items = list(
            content_collection.find(
                query,
                {
                    'user_id': 1,
                    'brand_name': 1,
                    'content_title': 1,
                    'title': 1,
                    'analysis.summary': 1,
                    'analysis.overall_score': 1,
                    'analysis.brand_compliance_score': 1,
                    'status': 1,
                    'review_status': 1,
                    'created_at': 1,
                },
            )
            .sort('created_at', -1)
            .limit(50)
        )
    except PyMongoError:
        logger.warning('MongoDB unavailable; loading analysis history from local server storage')
        return {
            'history': [
                {
                    'id': f"serverlocal-{item['id']}",
                    'brand_name': item.get('brand_name') or 'BRANDITHM',
                    'title': item.get('content_title') or 'Untitled analysis',
                    'summary': (item.get('analysis') or {}).get('summary') or '',
                    'overall_score': (item.get('analysis') or {}).get('overall_score'),
                    'compliance_score': (item.get('analysis') or {}).get('brand_compliance_score'),
                    'status': item.get('status') or 'completed',
                    'review_status': item.get('review_status') or 'needs_review',
                    'created_at': item.get('created_at'),
                }
                for item in local_items
            ],
            'storage': 'server-local',
        }

    filtered = []
    search_term = (search or '').strip().lower()
    for item in items:
        analysis_summary = (item.get('analysis') or {}).get('summary') or ''
        brand_name = item.get('brand_name') or ''
        content_title = item.get('content_title') or item.get('title') or ''
        if search_term and search_term not in ' '.join([analysis_summary, brand_name, content_title]).lower():
            continue

        filtered.append({
            'id': str(item.get('_id')),
            'brand_name': brand_name,
            'title': content_title,
            'summary': analysis_summary,
            'overall_score': (item.get('analysis') or {}).get('overall_score'),
            'compliance_score': (item.get('analysis') or {}).get('brand_compliance_score'),
            'status': item.get('status') or 'completed',
            'review_status': item.get('review_status') or 'needs_review',
            'created_at': item.get('created_at'),
        })

    existing_ids = {item['id'] for item in filtered}
    for item in local_items:
        local_id = f"serverlocal-{item['id']}"
        if local_id in existing_ids:
            continue
        filtered.append({
            'id': local_id,
            'brand_name': item.get('brand_name') or 'BRANDITHM',
            'title': item.get('content_title') or 'Untitled analysis',
            'summary': (item.get('analysis') or {}).get('summary') or '',
            'overall_score': (item.get('analysis') or {}).get('overall_score'),
            'compliance_score': (item.get('analysis') or {}).get('brand_compliance_score'),
            'status': item.get('status') or 'completed',
            'review_status': item.get('review_status') or 'needs_review',
            'created_at': item.get('created_at'),
        })
    filtered.sort(key=lambda item: str(item.get('created_at') or ''), reverse=True)
    return {'history': filtered[:50], 'storage': 'mongodb' if not local_items else 'mixed'}


@router.get('/content/{analysis_id}')
def get_content_report(analysis_id: str, user_id: str | None = Query(None)):
    if analysis_id.startswith('serverlocal-'):
        try:
            record = local_store.get_analysis(analysis_id.removeprefix('serverlocal-'), user_id)
        except sqlite3.Error as exc:
            logger.exception('Unable to load analysis report from local server storage')
            raise HTTPException(status_code=503, detail='The local analysis report is temporarily unavailable.') from exc
        if not record:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        record['_id'] = analysis_id
        return serialize_analysis_record(record)

    if not ObjectId.is_valid(analysis_id):
        raise HTTPException(status_code=400, detail='Invalid analysis report id.')

    try:
        record = content_collection.find_one({'_id': ObjectId(analysis_id), **({'user_id': user_id} if user_id else {})})
        if not record:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        return serialize_analysis_record(record)
    except PyMongoError as exc:
        logger.exception('Unable to load content analysis report')
        raise HTTPException(status_code=503, detail='The analysis report is temporarily unavailable.') from exc


@router.delete('/content/{analysis_id}')
def delete_content_report(analysis_id: str, user_id: str = Query(...)):
    if analysis_id.startswith('serverlocal-'):
        try:
            deleted = local_store.delete_analysis(analysis_id.removeprefix('serverlocal-'), user_id)
        except sqlite3.Error as exc:
            logger.exception('Unable to delete local analysis report')
            raise HTTPException(status_code=503, detail='The local analysis report could not be deleted.') from exc
        if not deleted:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        return {'message': 'Analysis report deleted successfully.', 'deleted_id': analysis_id}

    if not ObjectId.is_valid(analysis_id):
        raise HTTPException(status_code=400, detail='Invalid analysis report id.')

    try:
        deleted = content_collection.delete_one({'_id': ObjectId(analysis_id), 'user_id': user_id})
        if deleted.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        return {'message': 'Analysis report deleted successfully.', 'deleted_id': analysis_id}
    except PyMongoError as exc:
        logger.exception('Unable to delete content analysis report')
        raise HTTPException(status_code=503, detail='The analysis report could not be deleted. Try again later.') from exc


@router.patch('/content/{analysis_id}/review-status')
def update_review_status(
    analysis_id: str,
    payload: ReviewStatusInput,
    user_id: str = Query(...),
):
    if analysis_id.startswith('serverlocal-'):
        try:
            updated = local_store.update_analysis_review_status(
                analysis_id.removeprefix('serverlocal-'),
                user_id,
                payload.status,
            )
        except sqlite3.Error as exc:
            logger.exception('Unable to update local content review status')
            raise HTTPException(status_code=503, detail='The local review status could not be saved.') from exc
        if not updated:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        return {'id': analysis_id, 'review_status': payload.status, 'storage': 'server-local'}

    if not ObjectId.is_valid(analysis_id):
        raise HTTPException(status_code=400, detail='Invalid analysis report id.')

    try:
        updated = content_collection.update_one(
            {'_id': ObjectId(analysis_id), 'user_id': user_id},
            {
                '$set': {
                    'review_status': payload.status,
                    'review_updated_at': datetime.now(timezone.utc),
                }
            },
        )
        if updated.matched_count == 0:
            raise HTTPException(status_code=404, detail='Analysis report not found.')
        return {'id': analysis_id, 'review_status': payload.status}
    except PyMongoError as exc:
        logger.exception('Unable to update content review status')
        raise HTTPException(status_code=503, detail='The review status could not be saved to the database.') from exc


@router.post('/content/analyze')
async def analyze_content(
    content: str = Form(''),
    user_id: str = Form('demo-user'),
    brand_name: str = Form('BRANDITHM'),
    content_title: str = Form(''),
    guidelines: str = Form('{}'),
    file: UploadFile | None = File(None),
):
    guideline_payload = {}
    if guidelines:
        try:
            guideline_payload = json.loads(guidelines)
        except json.JSONDecodeError:
            guideline_payload = {}

    file_text = extract_text_from_file(file)
    cleaned_content = (content or '').strip()
    if file_text:
        cleaned_content = '\n\n'.join(filter(None, [cleaned_content, file_text]))

    if not cleaned_content:
        raise HTTPException(status_code=400, detail='No content supplied. Add text or upload a file.')

    if not guideline_payload:
        guideline_payload = {
            'user_id': user_id,
            'brand_name': brand_name,
            'brand_description': 'AI-powered brand governance and intelligence platform.',
            'preferred_tone': 'Confident, clear, professional, trustworthy and modern.',
            'target_audience': 'Marketing teams, product teams, and enterprise brand managers.',
            'preferred_keywords': ['brand', 'trust', 'clarity', 'innovation', 'governance'],
            'restricted_words': ['guaranteed', 'best ever', 'instant', 'unlimited', 'hype'],
            'writing_style': 'Short, persuasive, and crisp with strong product clarity.',
            'brand_communication_rules': 'Avoid exaggerated claims, hype, and vague language. Keep claims precise and evidence-based.'
        }

    analysis = await run_ai_brand_analysis(cleaned_content, brand_name, guideline_payload)

    # Competitor IP & Clash Detection check
    try:
        competitors = local_store.get_competitors(user_id)
        clash_report = clash_service.check_competitor_clashes(cleaned_content, competitors)
    except Exception as exc:
        logger.warning('Competitor clash check failed: %s', exc)
        clash_report = {'has_clashes': False, 'risk_level': 'none', 'clashes': [], 'summary': 'Clash scan skipped.'}

    analysis['clash_report'] = clash_report

    # Gamified Champion Scoring update
    try:
        champion_update = scoring_service.process_analysis_score(user_id, analysis)
    except Exception as exc:
        logger.warning('Champion scoring update failed: %s', exc)
        champion_update = {'points_earned': 10, 'champion_score': 10, 'streak_days': 1, 'badges': [], 'new_badges': []}

    record = {
        'user_id': user_id,
        'brand_name': brand_name,
        'content_title': content_title or (file.filename if file else 'Marketing copy review'),
        'content': cleaned_content,
        'guidelines': guideline_payload,
        'analysis': analysis,
        'status': 'completed',
        'review_status': 'needs_review',
        'created_at': datetime.now(timezone.utc),
    }

    storage_warning = None
    storage = 'mongodb'
    try:
        insert_result = content_collection.insert_one(record)
        record['_id'] = insert_result.inserted_id
    except PyMongoError:
        logger.warning('MongoDB unavailable; saving analysis report to local server storage')
        try:
            local_id = local_store.save_analysis(record)
            record['_id'] = f'serverlocal-{local_id}'
            storage = 'server-local'
        except sqlite3.Error as exc:
            logger.exception('Unable to persist analysis report to local server storage')
            storage_warning = 'The analysis completed, but could not be saved to server history.'

    response = {
        'message': 'Content analyzed successfully.',
        'brand_name': brand_name,
        'analysis': analysis,
        'clash_report': clash_report,
        'champion_update': champion_update,
        'report_id': str(record.get('_id')) if record.get('_id') else None,
        'file_name': file.filename if file else None,
        'storage': storage if record.get('_id') else 'none',
    }

    if storage_warning:
        response['storage_warning'] = storage_warning

    return response


@router.post('/content/correct')
async def correct_content(
    content: str = Form(''),
    user_id: str = Form('demo-user'),
    brand_name: str = Form('BRANDITHM'),
    guidelines: str = Form('{}'),
):
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail='No content supplied for AI correction.')

    guideline_payload = {}
    if guidelines:
        try:
            guideline_payload = json.loads(guidelines)
        except json.JSONDecodeError:
            guideline_payload = {}

    if not guideline_payload:
        guideline_payload = {
            'user_id': user_id,
            'brand_name': brand_name,
            'brand_description': 'AI-powered brand governance and intelligence platform.',
            'preferred_tone': 'Confident, clear, professional, trustworthy and modern.',
            'target_audience': 'Marketing teams, product teams, and enterprise brand managers.',
            'preferred_keywords': ['brand', 'trust', 'clarity', 'innovation', 'governance'],
            'restricted_words': ['guaranteed', 'best ever', 'instant', 'unlimited', 'hype'],
            'writing_style': 'Short, persuasive, and crisp with strong product clarity.',
            'brand_communication_rules': 'Avoid exaggerated claims, hype, and vague language. Keep claims precise and evidence-based.'
        }

    correction = await run_ai_content_correction(content, brand_name, guideline_payload)
    return {
        'message': 'Content corrected successfully.',
        'brand_name': brand_name,
        'original_content': content,
        'corrected_content': correction.get('corrected_content') or content,
        'changes_made': correction.get('changes_made') or [],
        'summary': correction.get('summary') or 'Content was refined to match brand voice and clarity standards.',
        'improvements': correction.get('improvements') or [],
        'engine': correction.get('engine', 'local'),
        'warning': correction.get('warning'),
    }
