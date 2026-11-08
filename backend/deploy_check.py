#!/usr/bin/env python3
"""
BRANDITHM Pre-Flight Deployment Readiness Checker
Run this script before deploying to verify environment variables,
database connections, file permissions, and installed dependencies.
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

def check_deployment():
    print("=" * 65)
    print(">>> BRANDITHM DEPLOYMENT READINESS CHECKER <<<")
    print("=" * 65)

    checks_passed = 0
    checks_total = 0
    warnings = []

    def log_result(name: str, passed: bool, detail: str, is_warning: bool = False):
        nonlocal checks_passed, checks_total
        checks_total += 1
        if passed:
            checks_passed += 1
            print(f"  [OK]      {name}: {detail}")
        elif is_warning:
            checks_passed += 1
            warnings.append(f"{name}: {detail}")
            print(f"  [WARN]    {name}: {detail}")
        else:
            print(f"  [FAIL]    {name}: {detail}")

    # 1. Dependency Imports
    print("\n[1] Checking Python Dependencies...")
    required_modules = [
        ("FastAPI", "fastapi"),
        ("Uvicorn", "uvicorn"),
        ("Pydantic", "pydantic"),
        ("PyMongo", "pymongo"),
        ("Pillow (Image Analysis)", "PIL"),
        ("Multipart Form Parser", "multipart"),
        ("PyMuPDF (PDF Parser)", "fitz"),
        ("python-docx (DOCX Parser)", "docx"),
        ("HTTPX Client", "httpx"),
        ("Google Generative AI", "google.generativeai"),
    ]

    for label, mod in required_modules:
        try:
            __import__(mod)
            log_result(label, True, "Installed and importable")
        except ImportError as e:
            log_result(label, False, f"Missing: {e}")

    # 2. Configuration & Environment Variables
    print("\n[2] Checking Configuration & Environment...")
    from app.config import settings

    # JWT Secret
    jwt_key = settings.JWT_SECRET_KEY
    if not jwt_key or jwt_key in ["dev-secret-key", "replace-with-a-long-random-secret"]:
        log_result("JWT Secret Key", False, "Using default/placeholder secret. Set a secure random key in .env for production!", is_warning=True)
    else:
        log_result("JWT Secret Key", True, f"Configured ({len(jwt_key)} characters)")

    # Google AI Key
    api_key = settings.GOOGLE_API_KEY
    if not api_key or "your-" in api_key.lower():
        log_result("Gemini AI API Key", False, "No live GOOGLE_API_KEY set. The engine will run in high-speed local fallback mode.", is_warning=True)
    else:
        log_result("Gemini AI API Key", True, "Configured")

    # Allowed Origins
    origins = settings.ALLOWED_ORIGINS
    log_result("CORS Allowed Origins", True, f"{len(origins)} origin(s) configured ({', '.join(origins[:3])}...)")

    # 3. Database Readiness
    print("\n[3] Checking Database Persistence...")
    # SQLite
    sqlite_path = Path(settings.LOCAL_DB_PATH)
    try:
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        # Test write permission
        test_file = sqlite_path.parent / ".write_test"
        test_file.write_text("ok")
        test_file.unlink()
        log_result("SQLite Directory Writable", True, f"{sqlite_path.parent.resolve()}")
    except Exception as e:
        log_result("SQLite Directory Writable", False, f"Cannot write to database path: {e}")

    # Test Local Store Module
    try:
        from app.database import local_store
        leaders = local_store.get_leaderboard(limit=1)
        log_result("SQLite Local Store Engine", True, f"Operational ({sqlite_path.name})")
    except Exception as e:
        log_result("SQLite Local Store Engine", False, f"Error: {e}")

    # MongoDB
    mongo_uri = settings.MONGO_URI
    if "localhost" in mongo_uri or "127.0.0.1" in mongo_uri:
        log_result("MongoDB Storage", True, f"Local connection ({mongo_uri}). Local SQLite fallback active if offline.", is_warning=True)
    else:
        try:
            from pymongo import MongoClient
            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2500)
            client.admin.command('ping')
            log_result("MongoDB Storage", True, f"Connected to live cloud cluster ({settings.DB_NAME})")
        except Exception as e:
            log_result("MongoDB Storage", False, f"Could not reach remote MongoDB: {e}. SQLite fallback will handle storage.", is_warning=True)

    # 4. Summary & Readiness Decision
    print("\n" + "=" * 65)
    print(f"DEPLOYMENT CHECK SUMMARY: {checks_passed}/{checks_total} checks passed.")
    if warnings:
        print("\nProduction Recommendations / Notices:")
        for w in warnings:
            print(f"  • {w}")
    print("=" * 65)

    if checks_passed == checks_total:
        print(">>> SUCCESS: BRANDITHM IS READY FOR DEPLOYMENT! <<<")
        return 0
    else:
        print(">>> ATTENTION: Some critical checks failed. Please fix before deploying. <<<")
        return 1

if __name__ == "__main__":
    sys.exit(check_deployment())

