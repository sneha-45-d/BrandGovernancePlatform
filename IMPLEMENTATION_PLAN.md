# BRANDITHM implementation plan

## Guardrails

- Preserve the current React/Vite pages, routes, authentication, and FastAPI API contract. The repository is not MERN today; a backend rewrite is not part of this plan.
- Use only official, permissioned social APIs and verified competitor sources. Do not seed sample competitors or fabricate external data.
- Label local rule checks as local. A failed multimodal request must fail visibly rather than return a text-only result as if media had been analyzed.
- Keep account ownership checks on every new API, store provider credentials server-side, and add tests with each increment.

## Delivery sequence

| Phase | Scope and acceptance criteria | Status |
|---|---|---|
| 0. Account security | Require authenticated sessions and scope feature data to the signed-in account; verify unauthenticated and cross-account requests are rejected. | Implemented |
| 1. Data-backed analytics | Replace sample dashboard data with persisted, date-filtered account analytics and truthful empty/error states. | Implemented |
| 2. Universal content ingestion | Preserve text/PDF/DOCX; add PPTX text and embedded-image extraction, image/audio/video Gemini analysis, size/type validation, upload cleanup, and explicit missing-key/provider errors. Website URLs and social-platform fetches remain separate permissioned ingestion sources. | Core file/media pipeline implemented; URL and social sources remain |
| 3. Competitor intelligence | Replace the manual-only registry with a selected, licensed/official search provider; persist source URL, retrieval time, and evidence for each discovery; display recommendations with citations. Never invent brands or campaign activity. | Planned; requires search-provider choice and credentials |
| 4. Social integrations | Implement OAuth and token lifecycle for Meta (Instagram/Facebook), LinkedIn, X, and YouTube; persist encrypted tokens and scopes; subscribe to permitted webhooks or supported polling; ingest only accounts and content authorized by the user. | OAuth connection, token encryption, account status, and disconnect are implemented; authorized post collection/webhooks and platform write access remain |
| 5. Brand intelligence and recommendations | Add evidence-linked trend and sentiment analysis over authorized content; retain model/version/source metadata; expose recommendations and corrections through existing analysis/review pages. | Planned; depends on persisted content sources |
| 6. AI Brand Studio | Select an image-generation API; create original concepts from user prompts and brand rules; persist generated assets and provider metadata; show generation status, safety failures, and usage/cost limits. | Planned; requires image-generation provider and credentials |
| 7. Alerts and real-time analytics | Persist alert events for completed analyses, configured violations, new permitted posts, and review decisions; provide an authenticated alert feed and delivery preferences; add a live update channel only after a durable event/outbox path exists. | Planned; depends on social ingestion and alert policy |
| 8. Production readiness | Add integration tests for provider failures, OAuth state/ownership, tenant isolation, uploads, retries, and persistence; validate rate limits, retention, observability, deployment secrets, and recovery procedures. | Ongoing per phase |

## External setup needed before live integrations

1. A Google AI API key and a Gemini model enabled for media inputs. The server currently reads `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) from backend environment configuration.
2. Meta developer app credentials, approved Instagram/Facebook products and permissions, production callback URL, and webhook configuration.
3. LinkedIn developer application credentials and the required member/organization permissions.
4. Google Cloud OAuth client and YouTube Data API project with authorized callback URL and user consent.
5. A selected search provider and its API terms/credentials for source-backed competitor discovery.
6. A selected image-generation provider, credentials, usage budget, and asset-retention policy.

No hackathon deadline was provided. The sequence above is dependency-driven; external platform reviews and API permission approvals are separate schedule risks and cannot be guaranteed by code changes alone.
