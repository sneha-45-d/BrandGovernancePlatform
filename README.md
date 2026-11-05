# BRANDITHM

AI-Powered Brand Governance and Intelligence Platform for Automated Content Review and Consistency.

## Project Overview

BRANDITHM is an enterprise-grade SaaS platform designed to help teams monitor and manage brand consistency, analyze content quality, and enforce brand guidelines with AI-assisted review workflows.

## Product Vision

- Upload and manage brand guidelines
- Review content for tone, terminology, and messaging consistency
- Detect unsupported claims and content violations
- Analyze visual branding alignment
- Generate explainable compliance scores and review reports
- Support enterprise brand governance workflows

## Folder Structure

```text
BRANDITHM/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── index.html
├── backend/
│   ├── app/
│   ├── .env.example
│   ├── requirements.txt
│   └── .venv/
├── README.md
├── .gitignore
└── .env.example (optional project-level env reference)
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Docker Setup

1. Copy `backend/.env.example` to `backend/.env` and set your MongoDB URI, JWT secret, and Google API key. The default Gemini model is `gemini-3.6-flash`; override `GEMINI_MODEL` if needed.
2. From the project root, build and start the application:

```bash
docker compose up --build
```

Open the frontend at `http://localhost:8080`. The API is available at `http://localhost:8000`, and the health check is at `http://localhost:8000/api/health`. Chroma data is stored in the `chroma_data` Docker volume. Stop the services with `docker compose down`; add `--volumes` only if you also intend to delete persisted Chroma data.

The backend expects a reachable MongoDB instance, such as MongoDB Atlas. If using a local MongoDB server, configure `MONGO_URI` to a host address reachable from the container (for Docker Desktop, `host.docker.internal` can reach the host machine).

Content analysis reports are stored in MongoDB and shown in Analysis history. AI correction and analysis use Gemini when `GOOGLE_API_KEY` is configured; otherwise, the app clearly labels its local rule-based fallback, which is not a full AI rewrite or analysis.

## Environment Notes

- Store MongoDB Atlas and Gemini configuration in `backend/.env`.
- Do not expose secrets in frontend code.
- Frontend runs on `http://localhost:5173` by default.
- Backend API runs on `http://localhost:8000` by default.

## Current Phase

This project is in the frontend UI and platform scaffolding stage, focusing on a premium enterprise SaaS interface, routing, dashboard design, Tailwind styling, and API-ready architecture.
