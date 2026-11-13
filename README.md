# BRANDITHM

**AI-Powered Brand Governance & Intelligence Platform**

Brandithm helps teams review content against their brand voice, terminology, and communication guidelines. It combines a React dashboard with a FastAPI backend, authenticated accounts, brand profiles, content reviews, and saved history.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [API and tests](#api-and-tests)
- [Deployment](#deployment)

## Features

- Account registration, sign-in, and user-scoped data.
- Dashboard, analytics, Brand Intelligence, and editable brand guidelines.
- Content analysis and brand-aligned correction for text and supported documents/media.
- Review queue to approve reports or request revisions.
- Social Media Intelligence for monitored mentions, competitor profiles, and alerts.
- Responsive layouts and light/dark themes.

Some AI-powered features require an optional provider key. The application reports provider configuration or availability errors rather than presenting a failed request as a successful analysis.

## Technology

- **Frontend:** React, Vite, React Router, Tailwind CSS
- **Backend:** Python, FastAPI, Uvicorn
- **Data:** MongoDB via PyMongo, with server-local SQLite fallback
- **AI:** Optional Google Gemini integration

## Quick start

### Prerequisites

- Git
- Node.js 22.12 or newer and npm
- Python 3.12
- MongoDB (optional for local development; SQLite fallback is available)

### 1. Clone the repository

```powershell
git clone https://github.com/sneha-45-d/BrandGovernancePlatform.git
cd BrandGovernancePlatform
```

### 2. Configure and start the backend

From the repository root, create a Python virtual environment and install dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend\.env`:

- Set a long, unique `JWT_SECRET_KEY`.
- Set `PORT=8003` to match the local frontend proxy.
- Set `MONGO_URI` if using MongoDB. Otherwise the backend uses its SQLite fallback.
- Set `GEMINI_API_KEY` only if you want to use Gemini-powered features.

Start the API from the `backend` directory:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

The API health check is at [http://localhost:8003/api/health](http://localhost:8003/api/health). Interactive API documentation is at [http://localhost:8003/docs](http://localhost:8003/docs).

### 3. Install and start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), then sign in or create an account. Vite forwards `/api` requests to the backend on port 8003.

### macOS/Linux

Backend setup:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set PORT=8003 and a secure JWT_SECRET_KEY in .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

Frontend setup, in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

## Configuration

Backend secrets belong only in `backend/.env`. Do not put credentials in frontend variables, commit them, or paste them into source files.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port. Use `8003` for the local Vite proxy; deployment platforms may set this automatically. |
| `JWT_SECRET_KEY` | Required signing secret for authentication. Use a unique random value. |
| `MONGO_URI` | MongoDB connection string. Optional for local work when using the SQLite fallback. |
| `DB_NAME` | MongoDB database name. |
| `LOCAL_DB_PATH` | Optional path for the SQLite fallback database. Use persistent storage in deployments. |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Optional Gemini key for supported AI features. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins permitted by the API. |

MongoDB Atlas requires a database user and network access for the backend host. If MongoDB is unavailable, SQLite data is stored on the backend host and is not shared across backend instances.

## Project structure

```text
BrandGovernancePlatform/
├── backend/
│   ├── app/
│   │   ├── database/       # MongoDB and SQLite persistence
│   │   ├── routes/         # Authenticated API endpoints
│   │   ├── services/       # AI and provider integrations
│   │   ├── config.py       # Backend environment configuration
│   │   └── main.py         # FastAPI application
│   ├── tests/              # Backend tests
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Shared UI and navigation
│   │   ├── lib/            # API and application helpers
│   │   └── pages/          # Dashboard and feature pages
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── netlify.toml
├── railway.json
└── README.md
```

## API and tests

Feature APIs require an authenticated bearer token. Requests are scoped to the signed-in user.

- `GET /api/health` — API and storage health
- `GET /docs` — interactive OpenAPI documentation
- `POST /api/auth/register` and `POST /api/auth/login` — account registration and sign-in
- Content analysis and brand-guideline endpoints are documented in the interactive API docs.

Run backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Run frontend checks:

```powershell
cd frontend
npm run lint
npm run build
```

## Deployment

- **Frontend:** Netlify configuration is provided by `netlify.toml`. Set `VITE_API_BASE_URL` to the backend HTTPS origin when deploying separately.
- **Backend:** Railway configuration is provided by `railway.json` and `backend/Dockerfile`. Set backend secrets in the hosting provider, not in Git.
- Include the deployed frontend origin in backend `ALLOWED_ORIGINS`.
- Use persistent storage for SQLite if MongoDB is not configured.
