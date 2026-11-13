import threading
from typing import Optional

from google import genai

from app.config import settings

_client_lock = threading.Lock()
_cached_client: Optional[genai.Client] = None
_cached_key: Optional[str] = None


def get_genai_client(api_key: Optional[str] = None) -> genai.Client:
    """Return a thread-safe singleton/cached genai.Client instance to reuse

    HTTP connection pools and avoid repeated SSL/session setup overhead.
    """
    global _cached_client, _cached_key
    key = (api_key or settings.GEMINI_API_KEY).strip()
    if not key:
        raise ValueError("Gemini API key is not configured.")

    if _cached_client is not None and _cached_key == key:
        return _cached_client

    with _client_lock:
        if _cached_client is not None and _cached_key == key:
            return _cached_client
        _cached_client = genai.Client(api_key=key)
        _cached_key = key
        return _cached_client
