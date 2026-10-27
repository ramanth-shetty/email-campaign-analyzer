# Email Campaign Analyzer — Implementation Plan

## Overview

Build a full-stack, multi-user **Email Campaign Analyzer** web application. Users can upload historical campaign data via CSV or connect live to the Mailchimp API, view rich analytics on a React dashboard, and receive AI-powered suggestions powered by the **Google Gemini API (free tier)**.

### Scope
- Multi-user authentication (JWT-based login/signup)
- Campaign data ingestion via CSV upload and Mailchimp API live sync
- Analytics dashboard: open rate, CTR, bounce rate, unsubscribe rate, A/B test comparison, audience segmentation
- AI-powered campaign suggestions using Google Gemini API
- RESTful backend API (Node.js + Express)
- PostgreSQL database for campaigns, events, and users
- React (Vite) + Tailwind CSS frontend

### Out of Scope
- Email sending (this tool only analyzes, does not send)
- Billing / subscription management
- Mobile native apps

### Technology Stack
| Layer | Technology |
|---|---|
| Frontend | React (Vite), Tailwind CSS, Recharts, React Query |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (via Prisma ORM) — **provisioned by Docker** |
| Auth | JWT (access + refresh tokens), bcrypt |
| AI | Google Gemini API (gemini-1.5-flash, free tier) |
| Email Integration | Mailchimp Marketing API v3 |
| CSV Parsing | multer + papaparse (backend), csv-parse |
| Queue / Background Jobs | bull + Redis — **provisioned by Docker** |
| Environment Config | dotenv |
| Deployment | Docker Compose (local dev + production) |

> **Infrastructure note**: PostgreSQL and Redis are **never installed manually**. They are always started via `docker compose up` using the images declared in `docker-compose.yml`. Developers only need Docker Desktop installed.

---

## Architecture

```
[React Vite Frontend]
        |
   REST API (Express)
        |
  ┌─────┴──────┐
  │            │
PostgreSQL    Redis
(Prisma ORM)  (Bull Queue)   ← both run inside Docker containers
                  |
           Mailchimp API
           Gemini API
```

---

## Getting Started Checklist

Before running the project for the first time, complete every item in this checklist:

- [ ] **Install Docker Desktop** — download from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop). PostgreSQL and Redis start automatically via `docker compose up`; no manual database installation needed.
- [ ] **Clone the repository** — `git clone <repo-url> && cd email-campaign-analyzer`
- [ ] **Copy environment file** — `cp server/.env.example server/.env` and fill in all required values (see Environment Variables Reference below)
- [ ] **Add your Gemini API key** — obtain a free key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and set `GEMINI_API_KEY` in `server/.env`
- [ ] **Add your Mailchimp API key** — obtain from Mailchimp Account → Extras → API Keys and set `MAILCHIMP_API_KEY` in `server/.env` (users can also enter their own key via the Settings UI)
- [ ] **Install dependencies** — `cd server && npm install` then `cd ../client && npm install`
- [ ] **Start infrastructure** — `docker compose up -d` (starts PostgreSQL on port 5432 and Redis on port 6379)
- [ ] **Run database migrations** — `cd server && npx prisma migrate dev`
- [ ] **Start development servers** — `cd server && npm run dev` (port 4000) and `cd client && npm run dev` (port 5173)
- [ ] **Verify** — open [http://localhost:5173](http://localhost:5173); register an account and upload a sample CSV

> **API Keys note**: The Gemini and Mailchimp API keys listed in `.env.example` are placeholders. Each developer or deployment environment must supply their own keys. Keys are **never committed to git** (`.env` is listed in `.gitignore`).

---

## Phase & Sub-Task Breakdown

---

### Phase 1 — Project Scaffolding & Infrastructure

#### Sub-Task 1.1a — .gitignore
- **Intent**: Create a root `.gitignore` that prevents secrets, build artifacts, node_modules, and OS files from being committed to version control before any other files are added.
- **Expected Outcomes**:
  - `.gitignore` exists at the project root
  - `node_modules/`, `.env`, `dist/`, `.DS_Store`, build output directories, and Prisma migration locks are all ignored
  - `*.env.example` files are **not** ignored (they are safe to commit as they contain no real secrets)
- **Todo List**:
  - [ ] Create root `.gitignore` covering: `node_modules/`, `dist/`, `.env`, `*.env.local`, `.DS_Store`, `Thumbs.db`, `*.log`, `coverage/`, `.vite/`, `server/prisma/migrations/*.db`
  - [ ] Verify `.env.example` is explicitly **not** listed in `.gitignore`
- **Relevant Context**: Must be the very first file committed so no secret is ever accidentally pushed.
- **Status**: [ ] pending

---

#### Sub-Task 1.1b — README.md
- **Intent**: Write a comprehensive root `README.md` so any developer can understand the project, get it running locally, and know how to contribute — without reading the source code.
- **Expected Outcomes**:
  - `README.md` at project root with: project description, feature list, tech stack table, prerequisites, step-by-step local setup, environment variable documentation, project structure diagram, API endpoint reference summary, and contributing guide
  - Getting Started section mirrors the "Getting Started Checklist" above
  - Docker usage clearly explained (no manual Postgres/Redis install)
- **Todo List**:
  - [ ] Write project overview and feature list
  - [ ] Write prerequisites section (Node 20+, Docker Desktop, Git)
  - [ ] Write local setup steps (clone → .env → docker compose up → migrate → dev servers)
  - [ ] Add project folder structure diagram
  - [ ] Add environment variables table with descriptions
  - [ ] Add API endpoint reference table (route, method, auth required, description)
  - [ ] Add contributing section
- **Relevant Context**: Content should align exactly with Sub-Task 1.1a (.gitignore) and the Environment Variables Reference in this plan.
- **Status**: [ ] pending

---

#### Sub-Task 1.2 — Monorepo / Folder Structure Setup
- **Intent**: Establish the project root with `client/` (React) and `server/` (Express) directories, shared config, and Docker Compose for PostgreSQL and Redis.
- **Expected Outcomes**:
  - `client/` created with Vite + React + Tailwind configured
  - `server/` created with Express + Prisma + dotenv configured
  - `docker-compose.yml` spins up PostgreSQL and Redis locally (no manual installs)
  - `server/.env.example` with all required environment variable keys pre-filled with Docker-based URLs
- **Todo List**:
  - [ ] Create root folder with `client/` and `server/` directories
  - [ ] Scaffold `client/` using `npm create vite@latest` with React + TypeScript template
  - [ ] Install and configure Tailwind CSS in `client/`
  - [ ] Scaffold `server/` with `npm init`, install Express, Prisma, dotenv, cors, helmet
  - [ ] Create `docker-compose.yml` with PostgreSQL (port 5432) and Redis (port 6379) services
  - [ ] Create `server/.env.example` using Docker-internal hostnames (see Environment Variables Reference)
  - [ ] Verify `docker compose up -d` starts both containers successfully
- **Relevant Context**: `.gitignore` from 1.1a must exist first. `README.md` from 1.1b documents these steps.
- **Status**: [ ] pending

---

#### Sub-Task 1.3 — Database Schema Design (Prisma)
- **Intent**: Define all database models in Prisma schema — Users, Campaigns, CampaignMetrics, EmailEvents, AudienceSegments — to support all analytics and auth features.
- **Expected Outcomes**:
  - `server/prisma/schema.prisma` contains all models
  - `npx prisma migrate dev` runs cleanly and creates all tables
  - Prisma client generated and importable
- **Todo List**:
  - [ ] Define `User` model (id, email, passwordHash, name, createdAt, mailchimpApiKey encrypted)
  - [ ] Define `Campaign` model (id, userId, name, subject, sentAt, source: CSV|MAILCHIMP, externalId, totalRecipients)
  - [ ] Define `CampaignMetrics` model (id, campaignId, opens, uniqueOpens, clicks, uniqueClicks, bounces, unsubscribes, complaints, deliveries)
  - [ ] Define `EmailEvent` model (id, campaignId, eventType: OPEN|CLICK|BOUNCE|UNSUB, timestamp, recipientEmail, metadata JSON)
  - [ ] Define `AudienceSegment` model (id, campaignId, segmentName, recipientCount, openRate, clickRate)
  - [ ] Define `AIInsight` model (id, campaignId, userId, prompt, response, createdAt)
  - [ ] Run `prisma migrate dev --name init` and verify migration succeeds against the Dockerized PostgreSQL instance
- **Relevant Context**: `DATABASE_URL` must point to the Docker container (see Environment Variables Reference). Phase 1 Sub-Tasks 1.1a, 1.1b, and 1.2 must be complete first.
- **Status**: [ ] pending

---

### Phase 2 — Backend API

#### Sub-Task 2.1 — Authentication API
- **Intent**: Implement secure multi-user JWT auth — register, login, refresh token, logout — so each user's data is isolated.
- **Expected Outcomes**:
  - `POST /api/auth/register` creates a user with bcrypt-hashed password
  - `POST /api/auth/login` returns a signed JWT access token + refresh token (httpOnly cookie)
  - `POST /api/auth/refresh` issues new access token from valid refresh token
  - `POST /api/auth/logout` clears refresh token
  - Auth middleware (`requireAuth`) guards all protected routes
- **Todo List**:
  - [ ] Create `server/src/routes/auth.routes.js` with register, login, refresh, logout endpoints
  - [ ] Create `server/src/controllers/auth.controller.js` with business logic
  - [ ] Implement bcrypt password hashing (saltRounds: 12)
  - [ ] Implement JWT signing with `jsonwebtoken` (access token: 15min, refresh token: 7d)
  - [ ] Store refresh token hash in `User` table
  - [ ] Create `server/src/middleware/requireAuth.js` to verify Bearer token on protected routes
  - [ ] Write Postman/Thunder Client collection or curl examples for testing
- **Relevant Context**: Prisma `User` model from Sub-Task 1.3.
- **Status**: [ ] pending

---

#### Sub-Task 2.2 — CSV Upload & Parsing API
- **Intent**: Allow users to upload a CSV file of campaign data, parse it server-side, normalize into Campaign + CampaignMetrics records, and store in PostgreSQL.
- **Expected Outcomes**:
  - `POST /api/campaigns/upload` accepts multipart CSV, parses, and saves to DB
  - Supports common Mailchimp/SendGrid CSV export formats (column mapping)
  - Returns created campaign ID and summary on success
  - Validates CSV headers and rejects malformed files with clear error messages
- **Todo List**:
  - [ ] Install `multer` and `csv-parse` in server
  - [ ] Create `server/src/routes/campaigns.routes.js`
  - [ ] Create `server/src/controllers/campaigns.controller.js` with `uploadCSV` handler
  - [ ] Implement `server/src/services/csvParser.service.js` — maps CSV columns to DB schema (handles both Mailchimp and generic formats)
  - [ ] Validate required columns: Campaign Name, Subject, Send Time, Recipients, Opens, Clicks, Bounces, Unsubscribes
  - [ ] On success, create `Campaign` + `CampaignMetrics` records via Prisma
  - [ ] Return `{ campaignId, name, totalRecipients, metrics }` response
- **Relevant Context**: Prisma `Campaign` and `CampaignMetrics` models from Sub-Task 1.3.
- **Status**: [ ] pending

---

#### Sub-Task 2.3 — Mailchimp Live API Integration
- **Intent**: Connect to the Mailchimp Marketing API to sync a user's real campaigns into the database on demand, using the user's stored (encrypted) Mailchimp API key.
- **Expected Outcomes**:
  - `POST /api/integrations/mailchimp/connect` saves and validates the Mailchimp API key
  - `POST /api/integrations/mailchimp/sync` triggers a background Bull job to fetch all campaigns and their reports from Mailchimp and upsert into DB
  - `GET /api/integrations/mailchimp/status` returns sync status (last synced, job status)
- **Todo List**:
  - [ ] Install `@mailchimp/mailchimp_marketing` npm package
  - [ ] Encrypt/decrypt Mailchimp API key with AES-256 using a server secret before storing in `User` table
  - [ ] Create `server/src/services/mailchimp.service.js` — fetches campaigns list, fetches reports per campaign
  - [ ] Create `server/src/workers/mailchimpSync.worker.js` (Bull queue processor) — calls mailchimp service, upserts Campaign + CampaignMetrics via Prisma
  - [ ] Create `server/src/routes/integrations.routes.js` with connect, sync, status endpoints
  - [ ] Map Mailchimp report fields to `CampaignMetrics` schema
  - [ ] Add Bull queue (`mailchimp-sync`) backed by Redis — `REDIS_URL` points to Docker container
- **Relevant Context**: Prisma models from 1.3, Redis from docker-compose in 1.2. `REDIS_URL` uses the Docker internal hostname `redis://redis:6379` when running inside Docker, or `redis://localhost:6379` for local dev.
- **Status**: [ ] pending

---

#### Sub-Task 2.4 — Analytics API
- **Intent**: Expose computed analytics endpoints so the frontend can fetch per-campaign and aggregate metrics, trends, and segment breakdowns.
- **Expected Outcomes**:
  - `GET /api/analytics/overview` — aggregate stats across all campaigns for the logged-in user
  - `GET /api/analytics/campaigns` — list all campaigns with computed rates (open rate, CTR, bounce rate)
  - `GET /api/analytics/campaigns/:id` — detailed metrics for one campaign
  - `GET /api/analytics/trends` — time-series data of key metrics grouped by week/month
  - `GET /api/analytics/compare?ids=1,2` — side-by-side comparison of two or more campaigns (A/B analysis)
- **Todo List**:
  - [ ] Create `server/src/services/analytics.service.js` with rate calculation helpers (openRate = uniqueOpens/totalRecipients * 100, etc.)
  - [ ] Implement overview aggregation query via Prisma
  - [ ] Implement campaign list with computed rates
  - [ ] Implement single campaign detail endpoint
  - [ ] Implement trends query (group by sent date, aggregate metrics)
  - [ ] Implement comparison endpoint (accept array of campaign IDs, return normalized comparison object)
  - [ ] Create `server/src/routes/analytics.routes.js`
- **Relevant Context**: `Campaign` and `CampaignMetrics` models; auth middleware from 2.1.
- **Status**: [ ] pending

---

#### Sub-Task 2.5 — Gemini AI Insights API
- **Intent**: Integrate Google Gemini API (gemini-1.5-flash, free tier) to analyze a campaign's metrics and return natural-language suggestions for improvement.
- **Expected Outcomes**:
  - `POST /api/ai/insights/:campaignId` sends campaign metrics as context to Gemini and returns a structured list of suggestions
  - `GET /api/ai/insights/:campaignId` fetches previously generated insights from DB
  - Prompts are structured to ask for: subject line improvement, best send-time recommendation, audience re-engagement tips, A/B test ideas
  - Gemini API key stored in server `.env`, never exposed to client
- **Todo List**:
  - [ ] Install `@google/generative-ai` npm package
  - [ ] Create `server/src/services/gemini.service.js` — builds structured prompt from campaign metrics, calls Gemini API, parses response
  - [ ] Design prompt template: "Given these email campaign metrics: [JSON metrics], provide 5 actionable suggestions to improve open rate, click-through rate, and reduce bounce rate. Format as JSON array of { category, suggestion, priority }."
  - [ ] Create `server/src/controllers/ai.controller.js` — fetches campaign metrics, calls gemini service, saves result to `AIInsight` table
  - [ ] Create `server/src/routes/ai.routes.js`
  - [ ] Cache insights (do not regenerate if insight exists and is < 24 hours old)
- **Relevant Context**: `AIInsight` model from 1.3; analytics service from 2.4. `GEMINI_API_KEY` is set in server `.env` only — never sent to the browser.
- **Status**: [ ] pending

---

### Phase 3 — Frontend Dashboard

#### Sub-Task 3.1 — App Shell, Routing & Auth UI
- **Intent**: Build the React app shell with routing (React Router v6), global auth context, login/signup pages, and a protected dashboard layout with sidebar navigation.
- **Expected Outcomes**:
  - `/login` and `/register` pages with form validation
  - JWT token stored in memory (access token) + httpOnly cookie (refresh token)
  - Protected route wrapper redirects unauthenticated users to `/login`
  - Dashboard layout with top navbar and left sidebar (Campaigns, Analytics, AI Insights, Settings)
- **Todo List**:
  - [ ] Install `react-router-dom`, `axios`, `@tanstack/react-query`, `react-hook-form`, `zod`
  - [ ] Create `client/src/contexts/AuthContext.jsx` — stores user, access token, login/logout methods
  - [ ] Create `client/src/components/ProtectedRoute.jsx`
  - [ ] Build `LoginPage` and `RegisterPage` with React Hook Form + Zod validation
  - [ ] Build `DashboardLayout` component (sidebar + top bar + `<Outlet />`)
  - [ ] Set up React Query `QueryClientProvider` at root
  - [ ] Configure Axios instance with base URL + Authorization header interceptor + auto-refresh on 401
- **Relevant Context**: Auth endpoints from Sub-Task 2.1.
- **Status**: [ ] pending

---

#### Sub-Task 3.2 — Campaign Management UI
- **Intent**: Build pages for listing all campaigns, uploading a CSV file, and connecting/syncing the Mailchimp API, so users can bring their data into the analyzer.
- **Expected Outcomes**:
  - `/campaigns` page: sortable, searchable table of all campaigns with key metrics preview
  - CSV upload modal with drag-and-drop, column mapping preview, and upload progress
  - Mailchimp connect form (API key input, validate button, sync button with status indicator)
  - Toast notifications for success/error states
- **Todo List**:
  - [ ] Install `recharts`, `react-dropzone`, `sonner` (toast)
  - [ ] Build `CampaignsPage` with React Query `useQuery` fetching `/api/analytics/campaigns`
  - [ ] Build `CampaignTable` component with sort and search
  - [ ] Build `CSVUploadModal` with `react-dropzone`, preview parsed headers, submit to `POST /api/campaigns/upload`
  - [ ] Build `MailchimpConnectCard` with API key input, connect + sync buttons, sync status badge
  - [ ] Handle loading skeletons and error states
- **Relevant Context**: Campaigns API from 2.2, Mailchimp API from 2.3, Analytics API from 2.4.
- **Status**: [ ] pending

---

#### Sub-Task 3.3 — Analytics Dashboard UI
- **Intent**: Build the main analytics dashboard with KPI cards, trend charts, campaign comparison, and audience segment breakdown using Recharts.
- **Expected Outcomes**:
  - `/analytics` overview page with 4 KPI cards: avg open rate, avg CTR, avg bounce rate, total campaigns
  - Line chart showing open rate and CTR trends over time
  - Bar chart comparing selected campaigns side-by-side
  - Donut/pie chart for event type breakdown (opens, clicks, bounces, unsubscribes)
  - Campaign detail page `/analytics/:id` with full metrics, segment table
- **Todo List**:
  - [ ] Build `OverviewPage` with `KPICard` components and React Query
  - [ ] Build `TrendsChart` (LineChart via Recharts) — fetches `/api/analytics/trends`
  - [ ] Build `CampaignCompareChart` (BarChart) — accepts selected campaign IDs, fetches `/api/analytics/compare`
  - [ ] Build `EventBreakdownChart` (PieChart/RadialChart)
  - [ ] Build `CampaignDetailPage` at `/analytics/:id` with all metrics, segment table
  - [ ] Add date-range filter (last 30 days / 90 days / all time) — passed as query params
  - [ ] Add campaign multi-select for comparison
- **Relevant Context**: Analytics API from 2.4; Recharts installed in 3.2.
- **Status**: [ ] pending

---

#### Sub-Task 3.4 — AI Insights UI
- **Intent**: Build the AI Insights page where users can request Gemini-powered suggestions for any campaign and view them in a clean, prioritized card layout.
- **Expected Outcomes**:
  - `/ai-insights` page listing all campaigns with an "Analyze" button per campaign
  - On click, calls `POST /api/ai/insights/:campaignId`, shows loading state, then renders results
  - Insight cards grouped by category (Subject Line, Send Time, Audience, A/B Ideas) with priority badge
  - Previously generated insights shown instantly from cache (no re-fetch)
  - "Regenerate" button to force a new Gemini request
- **Todo List**:
  - [ ] Build `AIInsightsPage` with campaign selector and insights panel
  - [ ] Build `InsightCard` component: category icon, suggestion text, priority badge (High/Medium/Low) with color coding
  - [ ] Use React Query `useMutation` for generating insights, `useQuery` for fetching cached ones
  - [ ] Show shimmer skeleton while Gemini is processing
  - [ ] Handle Gemini API errors gracefully (rate limit message, retry option)
  - [ ] Add "Copy suggestion" button on each insight card
- **Relevant Context**: Gemini AI API from 2.5.
- **Status**: [ ] pending

---

#### Sub-Task 3.5 — Settings Page & User Profile
- **Intent**: Build a settings page where users can update their profile, change password, and manage their Mailchimp API key connection.
- **Expected Outcomes**:
  - `/settings` page with Profile tab (name, email update) and Security tab (password change)
  - Integrations tab showing Mailchimp connection status + ability to disconnect
  - All forms use React Hook Form with Zod validation
- **Todo List**:
  - [ ] Build `SettingsPage` with tabbed layout (Profile, Security, Integrations)
  - [ ] Build profile update form → `PATCH /api/users/me`
  - [ ] Build password change form → `PATCH /api/users/me/password`
  - [ ] Build integrations tab — show Mailchimp connect status, add disconnect option
  - [ ] Add `PATCH /api/users/me` and `PATCH /api/users/me/password` backend endpoints
- **Relevant Context**: Auth context from 3.1; integrations routes from 2.3.
- **Status**: [ ] pending

---

### Phase 4 — Integration, Polish & Deployment

#### Sub-Task 4.1 — End-to-End Integration & Testing
- **Intent**: Wire all frontend pages to the live backend, fix any data contract mismatches, and verify the full user flow works end-to-end.
- **Expected Outcomes**:
  - Complete user flow works: register → upload CSV → view analytics → get AI insights
  - Complete Mailchimp flow works: connect API key → sync → view live campaign data → AI insights
  - No broken API calls or missing data on any page
- **Todo List**:
  - [ ] Run full flow: register a new user, upload sample CSV, verify analytics display
  - [ ] Run full flow: connect Mailchimp key, trigger sync, verify campaigns appear
  - [ ] Verify AI insights generation returns valid JSON and renders correctly
  - [ ] Fix any field name or response shape mismatches between frontend and backend
  - [ ] Test JWT refresh flow (access token expiry → auto-refresh → continue session)
  - [ ] Test error states (bad CSV, invalid Mailchimp key, Gemini rate limit)
- **Status**: [ ] pending

---

#### Sub-Task 4.2 — Docker Compose Full Stack Containerization
- **Intent**: Containerize the full application (client + server + postgres + redis) with Docker Compose so the entire stack can be launched with a single `docker compose up` command — no host-level Postgres or Redis installation required.
- **Expected Outcomes**:
  - `docker compose up` starts all 4 services: frontend (nginx), backend, postgres, redis
  - `client/Dockerfile` builds Vite production bundle served by nginx
  - `server/Dockerfile` runs Express in Node.js container with migrations on startup
  - Environment variables injected via `.env` file using Docker-internal service hostnames
  - Health checks configured for postgres and redis containers
- **Todo List**:
  - [ ] Write `server/Dockerfile` (node:20-alpine, install deps, run `prisma migrate deploy`, start server)
  - [ ] Write `client/Dockerfile` (node:20-alpine build stage → nginx:alpine serve stage)
  - [ ] Update root `docker-compose.yml` to include all 4 services: `postgres`, `redis`, `server`, `client`
  - [ ] Set `DATABASE_URL=postgresql://user:pass@postgres:5432/email_analyzer` in server container env (uses `postgres` Docker service name as hostname)
  - [ ] Set `REDIS_URL=redis://redis:6379` in server container env (uses `redis` Docker service name as hostname)
  - [ ] Add nginx config (`client/nginx.conf`) that proxies `/api` requests to backend container
  - [ ] Add `depends_on` with health checks so server waits for postgres and redis to be ready
  - [ ] Document all required `.env` variables in `README.md` (Sub-Task 1.1b)
- **Status**: [ ] pending

---

## Environment Variables Reference

```env
# ─── Server: server/.env ─────────────────────────────────────────────────────

# PostgreSQL — Docker-internal hostname when running via docker compose
DATABASE_URL=postgresql://user:pass@postgres:5432/email_analyzer
# PostgreSQL — local dev (docker compose port-forwarded)
# DATABASE_URL=postgresql://user:pass@localhost:5432/email_analyzer

# Redis — Docker-internal hostname when running via docker compose
REDIS_URL=redis://redis:6379
# Redis — local dev (docker compose port-forwarded)
# REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
ENCRYPTION_KEY=<32-byte-hex-key-for-AES-256>

# AI — Google Gemini (free tier key from https://aistudio.google.com/app/apikey)
# Each developer supplies their own key. Never commit this file.
GEMINI_API_KEY=<your-gemini-api-key>

# Mailchimp (optional — users can also enter their key via the Settings UI)
MAILCHIMP_API_KEY=<your-mailchimp-api-key>

PORT=4000

# ─── Client: client/.env ─────────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:4000
```

> **Security reminder**: `server/.env` is in `.gitignore` and must never be committed. Commit only `server/.env.example` (which contains key names and placeholder values, no real secrets).

---

## Data Flow Summary

1. **CSV Upload Flow**: User uploads CSV → multer receives file → csvParser maps columns → Campaign + CampaignMetrics saved to PostgreSQL → Analytics API returns rates → Dashboard renders charts
2. **Mailchimp Sync Flow**: User enters API key → backend validates + encrypts + saves → Bull job (via Redis) fetches Mailchimp reports → upserts to PostgreSQL → same Analytics API serves dashboard
3. **AI Insights Flow**: User clicks "Analyze" → backend fetches CampaignMetrics from DB → builds structured prompt → calls Gemini API → saves AIInsight to DB → returns suggestions → frontend renders insight cards
4. **Auth Flow**: Register/Login → JWT access token (15min) in memory + refresh token (7d) in httpOnly cookie → Axios interceptor auto-refreshes on 401

---

## Sub-Task Implementation Order

```
1.1a → 1.1b → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 4.1 → 4.2
```

Each sub-task is designed to be implemented independently in a single focused session in Agent mode.
