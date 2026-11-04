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

## Environment Notes

- Store MongoDB Atlas and Gemini configuration in `backend/.env`.
- Do not expose secrets in frontend code.
- Frontend runs on `http://localhost:5173` by default.
- Backend API runs on `http://localhost:8000` by default.

## Current Phase

This project is in the frontend UI and platform scaffolding stage, focusing on a premium enterprise SaaS interface, routing, dashboard design, Tailwind styling, and API-ready architecture.
