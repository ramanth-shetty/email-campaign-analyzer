# 📊 Email Campaign Analyzer

A full-stack, multi-user web application for analyzing email marketing campaign performance. Upload historical campaign data via CSV or connect live to the Mailchimp API, explore rich analytics dashboards, and receive AI-powered improvement suggestions powered by Google Gemini.

---

## Features

- **Multi-user authentication** — secure JWT-based register/login with refresh tokens
- **CSV upload** — import any Mailchimp or SendGrid campaign export in seconds
- **Mailchimp live sync** — connect your Mailchimp API key and pull real campaign data on demand
- **Analytics dashboard** — open rate, CTR, bounce rate, unsubscribe rate, A/B comparison, audience segments, trend charts
- **AI insights** — Google Gemini analyzes your metrics and returns prioritized, actionable suggestions
- **Campaign comparison** — side-by-side A/B analysis across any two or more campaigns
- **Settings & profile** — manage account details, change password, manage Mailchimp connection

> This tool **analyzes** campaigns only — it does not send emails.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), Tailwind CSS, Recharts, React Query |
| Backend | Node.js 20, Express.js |
| Database | PostgreSQL 15 via Prisma ORM — **runs in Docker** |
| Auth | JWT (access 15 min + refresh 7 days), bcrypt |
| AI | Google Gemini API (`gemini-1.5-flash`, free tier) |
| Email Integration | Mailchimp Marketing API v3 |
| CSV Parsing | multer + csv-parse |
| Background Jobs | Bull queue + Redis — **runs in Docker** |
| Infrastructure | Docker Compose |

---

## Prerequisites

Make sure the following are installed on your machine before starting:

| Tool | Minimum Version | Notes |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Latest | Required — runs PostgreSQL and Redis automatically |
| [Node.js](https://nodejs.org) | 20.x LTS | For running the dev servers |
| [Git](https://git-scm.com) | Any recent | For cloning the repo |

> **No manual PostgreSQL or Redis installation needed.** Both are started automatically by `docker compose up`.

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd email-campaign-analyzer
```

### 2. Set up environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in the required values (see [Environment Variables](#environment-variables) below).

### 3. Add your API keys

- **Gemini API key** — get a free key at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey), set `GEMINI_API_KEY` in `server/.env`
- **Mailchimp API key** *(optional at startup)* — get from Mailchimp → Account → Extras → API Keys, set `MAILCHIMP_API_KEY` in `server/.env`. Users can also enter their own key via the Settings UI.

> Keys are **never committed to git**. `server/.env` is listed in `.gitignore`.

### 4. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 5. Start infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`

### 6. Run database migrations

```bash
cd server
npx prisma migrate dev
```

### 7. Start development servers

```bash
# Terminal 1 — backend (port 4000)
cd server && npm run dev

# Terminal 2 — frontend (port 5173)
cd client && npm run dev
```

### 8. Verify

Open [http://localhost:5173](http://localhost:5173), register an account, and upload a sample CSV.

---

## Project Structure

```
email-campaign-analyzer/
├── client/                        # React (Vite) frontend
│   ├── src/
│   │   ├── components/            # Shared UI components
│   │   ├── contexts/              # AuthContext, etc.
│   │   ├── pages/                 # Route-level page components
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── CampaignsPage.jsx
│   │   │   ├── AnalyticsPage.jsx
│   │   │   ├── AIInsightsPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── hooks/                 # Custom React Query hooks
│   │   ├── lib/                   # Axios instance, helpers
│   │   └── main.jsx
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── server/                        # Node.js / Express backend
│   ├── src/
│   │   ├── controllers/           # Request handlers
│   │   ├── routes/                # Express routers
│   │   ├── services/              # Business logic (Gemini, Mailchimp, CSV, Analytics)
│   │   ├── workers/               # Bull queue processors
│   │   ├── middleware/            # requireAuth, error handler
│   │   └── index.js               # App entry point
│   ├── prisma/
│   │   ├── schema.prisma          # All DB models
│   │   └── migrations/
│   ├── .env.example               # Safe to commit — no real secrets
│   └── Dockerfile
│
├── docker-compose.yml             # PostgreSQL + Redis (+ full stack in production)
├── .gitignore
└── README.md
```

---

## Environment Variables

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Use `postgresql://user:pass@localhost:5432/email_analyzer` for local dev (Docker port-forwarded). Use `postgresql://user:pass@postgres:5432/email_analyzer` inside Docker network. |
| `REDIS_URL` | ✅ | Redis connection URL. Use `redis://localhost:6379` for local dev. Use `redis://redis:6379` inside Docker network. |
| `JWT_SECRET` | ✅ | Secret for signing JWT access tokens. Use a strong random string (32+ chars). |
| `JWT_REFRESH_SECRET` | ✅ | Secret for signing JWT refresh tokens. Must differ from `JWT_SECRET`. |
| `ENCRYPTION_KEY` | ✅ | 32-byte hex key for AES-256 encryption of stored Mailchimp API keys. |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key (free tier). Never exposed to the browser. |
| `MAILCHIMP_API_KEY` | ⬜ | Optional server-wide Mailchimp API key. Users can supply their own via the Settings UI. |
| `PORT` | ⬜ | Backend port. Defaults to `4000`. |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Backend base URL. Use `http://localhost:4000` for local dev. |

---

## API Endpoint Reference

All protected endpoints require `Authorization: Bearer <access_token>` header.

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Create a new account |
| `POST` | `/api/auth/login` | ❌ | Login, returns access token + sets refresh cookie |
| `POST` | `/api/auth/refresh` | ❌ | Exchange refresh token for a new access token |
| `POST` | `/api/auth/logout` | ✅ | Clear refresh token |
| `POST` | `/api/campaigns/upload` | ✅ | Upload campaign CSV file |
| `POST` | `/api/integrations/mailchimp/connect` | ✅ | Save and validate Mailchimp API key |
| `POST` | `/api/integrations/mailchimp/sync` | ✅ | Trigger background sync of Mailchimp campaigns |
| `GET` | `/api/integrations/mailchimp/status` | ✅ | Get last sync status |
| `GET` | `/api/analytics/overview` | ✅ | Aggregate stats across all user campaigns |
| `GET` | `/api/analytics/campaigns` | ✅ | List all campaigns with computed rates |
| `GET` | `/api/analytics/campaigns/:id` | ✅ | Detailed metrics for one campaign |
| `GET` | `/api/analytics/trends` | ✅ | Time-series metrics grouped by week/month |
| `GET` | `/api/analytics/compare?ids=1,2` | ✅ | Side-by-side campaign comparison |
| `POST` | `/api/ai/insights/:campaignId` | ✅ | Generate Gemini AI insights for a campaign |
| `GET` | `/api/ai/insights/:campaignId` | ✅ | Fetch previously generated insights |
| `PATCH` | `/api/users/me` | ✅ | Update profile (name, email) |
| `PATCH` | `/api/users/me/password` | ✅ | Change password |

---

## Running the Full Stack with Docker

To run the entire application (frontend + backend + database + Redis) in Docker:

```bash
docker compose up --build
```

Then open [http://localhost](http://localhost).

The server container automatically runs `prisma migrate deploy` on startup. No manual migration step needed in this mode.

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Follow existing code style — Express controllers in `server/src/controllers/`, React pages in `client/src/pages/`
3. Keep `.env` out of commits — add new variables to `server/.env.example` with placeholder values
4. Open a pull request with a clear description of what changed and why

---

## License

MIT
