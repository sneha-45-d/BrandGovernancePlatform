# Brandithm

Brandithm is a brand governance platform for reviewing written content against a brand's voice, terminology, and communication guidelines. It combines a React dashboard with a FastAPI service, Gemini-powered analysis when configured, and persistent storage for accounts, guidelines, review decisions, and analysis history.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Persistence and database fallback](#persistence-and-database-fallback)
- [Deploy to Netlify](#deploy-to-netlify)
- [Run with Docker](#run-with-docker)
- [Application routes](#application-routes)
- [API and checks](#api-and-checks)
- [Project structure](#project-structure)

## Features

- Sign up, sign in, account settings, and sign out.
- Dashboard and Brand Intelligence views for reviewing recent activity and brand health.
- Editable Brand Guidelines shared with content analysis and AI correction.
- Content analysis with scores, detected issues, recommendations, and review history.
- AI-assisted content correction.
- Review Queue actions to approve a report or request revisions.
- Light and dark themes.
- Gemini-backed analysis and correction when a Google AI API key is configured; local rule-based checks are used when Gemini is unavailable.

## Technology

- **Frontend:** React, Vite, React Router, Tailwind CSS
- **Backend:** Python, FastAPI, Uvicorn
- **Data:** MongoDB (PyMongo), with a server-local SQLite fallback
- **AI:** Google Gemini API (optional)

## Run locally

You will need Node.js/npm and Python installed. Run the frontend and backend in separate terminals.

### 1. Configure the backend

From the repository root, create a virtual environment and install the backend packages:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set at least a secure `JWT_SECRET_KEY`. Configure `MONGO_URI` if you want to use MongoDB, and `GOOGLE_API_KEY` if you want Gemini-powered analysis and correction. See [Configuration](#configuration) for details.

Start the API from the `backend` directory:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The root route redirects to sign in; create an account at `/signup`. Vite forwards `/api` requests to `http://localhost:8000`.

### macOS/Linux shell

Use the equivalent commands below if you are not using PowerShell:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Configuration

Backend settings are read from `backend/.env`. The checked-in `backend/.env.example` is a template; never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port; defaults to `8000`. |
| `MONGO_URI` | MongoDB connection URI. Defaults to local MongoDB at `mongodb://localhost:27017`. |
| `DB_NAME` | MongoDB database name; defaults to `brandithm`. |
| `LOCAL_DB_PATH` | Optional SQLite fallback path. Defaults to `backend/data/brandithm.sqlite3` for a local run. |
| `JWT_SECRET_KEY` | Secret used for session/authentication security. Set a long, unique value outside development. |
| `GOOGLE_API_KEY` | Optional Google AI API key for Gemini. `GEMINI_API_KEY` is also accepted. |
| `GEMINI_MODEL` | Gemini model name; defaults to `gemini-3.6-flash`. |
| `CHROMA_DB_PATH` | Chroma data directory; defaults to `backend/app/data/chroma`. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins permitted by the API. |
| `VITE_API_BASE_URL` | Frontend build-time variable. Set it to the deployed FastAPI origin in the frontend host (for example `https://api.example.com`); leave it blank for local Vite development. Do not add a trailing `/api`. |

For MongoDB Atlas, use a **database user** in the connection URI, not your Atlas website login. Ensure the deployment's IP is allowed in the Atlas network access list. URI-encode reserved characters in the database username or password.

## Persistence and database fallback

When MongoDB is reachable, the API uses it for application data. If MongoDB cannot be reached, the backend uses SQLite for accounts, sessions, brand guidelines, analysis history, and review decisions. The default local database file is `backend/data/brandithm.sqlite3`; it is ignored by Git.

The SQLite fallback belongs to the backend server and is not shared between multiple server instances. Configure `LOCAL_DB_PATH` and persistent disk/volume storage for deployments. Browser-local drafts or accounts are device-specific and are not synchronized between browsers or devices.

The rule-based AI fallback can still perform basic checks, but it is not equivalent to Gemini analysis or a full AI rewrite. Configure a valid Google API key to enable Gemini features.

## Deploy to Netlify

The repository includes a `netlify.toml` configured to build the Vite frontend from `frontend/`, publish `frontend/dist`, use Node.js 22, and rewrite client-side routes to `index.html`. This lets both `/` and direct links such as `/signin` load correctly on Netlify.

Netlify hosts the **frontend only**. It does not run this repository's FastAPI backend. To use sign-in, analysis, guidelines, and review APIs on a deployed site:

1. Deploy the `backend/` service separately to a host that supports Python/FastAPI or Docker.
2. Configure the backend's MongoDB, AI, and persistence environment variables on that host. Keep all secrets there, not in frontend variables.
3. Set `ALLOWED_ORIGINS` on the backend to include your exact Netlify site origin (for example `https://your-site.netlify.app`).
4. In Netlify, set the build environment variable `VITE_API_BASE_URL` to the backend's HTTPS origin (for example `https://your-api.example.com`), without a trailing `/api`, then trigger a new deploy. Vite compiles this value into the frontend build.
5. Confirm the backend health endpoint is reachable at `https://your-api.example.com/api/health`.

If the backend URL is missing or unreachable, the static landing page can still load, but application API requests will not reach FastAPI. No Netlify deployment log or deployed-site URL was included with this change, so the exact failure from a specific deployment cannot be confirmed here; this configuration addresses the missing frontend build/routing setup and makes the backend connection explicit.

## Run with Docker

1. Copy `backend/.env.example` to `backend/.env` and configure the backend values.
2. From the repository root, build and start the services:

```bash
docker compose up --build
```

Open the frontend at [http://localhost:8080](http://localhost:8080). The API is at [http://localhost:8000](http://localhost:8000), with health status at `/api/health` and interactive API documentation at `/docs`.

Docker Compose persists Chroma data in the `chroma_data` named volume. The SQLite fallback database is **not** mounted by the provided Compose file, so add a persistent mount for `/app/data` (or set `LOCAL_DB_PATH` to a mounted location) if you need that data to survive container replacement. Stop the services with `docker compose down`; use `docker compose down --volumes` only if you intend to delete the Chroma volume as well.

## Application routes

| Route | Description |
| --- | --- |
| `/` | Public landing page. |
| `/signin` | Sign in to an account. |
| `/signup` | Create an account. |
| `/dashboard` | Dashboard overview and recent activity. |
| `/analytics` | Analytics view. |
| `/brand-intelligence` | Brand health and intelligence. |
| `/brand-guidelines` | View and edit brand voice and content rules. |
| `/content-analysis` | Analyze submitted content and view results. |
| `/ai-correction` | Generate a brand-aligned correction. |
| `/review-queue` | Review analysis reports and approve or request revisions. |
| `/settings` | Update account information or sign out. |

## API and checks

- API health: `GET /api/health`
- Interactive OpenAPI documentation: `http://localhost:8000/docs`
- Frontend lint: `cd frontend; npm run lint`
- Frontend production build: `cd frontend; npm run build`
- Backend syntax check: `cd backend; python -m compileall app`

## Project structure

```text
Brandithm/
├── backend/
│   ├── app/
│   │   ├── database/     # MongoDB connection and SQLite fallback
│   │   ├── routes/       # Authentication, brand, content, and health APIs
│   │   ├── config.py
│   │   └── main.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```
