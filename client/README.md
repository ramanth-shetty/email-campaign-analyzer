# 📊 Email Campaign Analyzer

A full-stack, multi-user web application for analyzing email marketing campaign performance. Upload historical campaign data via CSV or connect live to the Mailchimp API, explore analytics dashboards, and receive AI-powered improvement suggestions from Google Gemini.

---

## Features

- **Multi-user authentication** — JWT register/login with refresh tokens (httpOnly cookie)
- **CSV upload** — import Mailchimp/SendGrid-style campaign exports (duplicates are skipped)
- **Mailchimp live sync** — connect your API key and pull sent campaigns on demand
- **Analytics dashboard** — open rate, CTR, bounce rate, unsubscribe rate, trends, event breakdown, date-range filter
- **Campaign comparison** — side-by-side analysis of two or more campaigns
- **AI insights** — Google Gemini returns prioritized, actionable suggestions per campaign
- **Settings & profile** — update profile, change password, disconnect Mailchimp

> This tool **analyzes** campaigns only — it does not send emails.

---

## Technology Stack

| Layer             | Technology                                                                            |
| ----------------- | ------------------------------------------------------------------------------------- |
| Frontend          | React 19 (Vite, TypeScript), Tailwind CSS 3, Recharts, TanStack Query, React Router 7 |
| Backend           | Node.js 22, Express 4                                                                 |
| Database          | PostgreSQL 15 via Prisma ORM — **runs in Docker**                                     |
| Auth              | JWT (access 15 min + refresh 7 days), bcryptjs                                        |
| AI                | Google Gemini API (`gemini-2.5-flash` by default, free tier)                          |
| Email Integration | Mailchimp Marketing API v3                                                            |
| CSV Parsing       | multer + csv-parse                                                                    |
| Background Jobs   | Bull queue + Redis — **runs in Docker**                                               |
| Infrastructure    | Docker Compose                                                                        |

---

## Prerequisites

| Tool                                                             | Minimum Version | Notes                                                      |
| ---------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Latest          | Runs PostgreSQL and Redis (and the full stack if you want) |
| [Node.js](https://nodejs.org)                                    | 22.x            | Required by some client dependencies                       |
| [Git](https://git-scm.com)                                       | Any recent      | For cloning the repo                                       |

> No manual PostgreSQL or Redis installation is needed.

---

## Getting Started (local development)

### 1. Clone the repository

```bash
git clone <repo-url>
cd email-campaign-analyzer
```

### 2. Set up environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`:

- Generate `ENCRYPTION_KEY` (must be 64 hex characters):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Replace `JWT_SECRET` and `JWT_REFRESH_SECRET` with long random strings.
- Set `GEMINI_API_KEY` (free key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).

> `.env` files are git-ignored. Never commit real keys.

### 3. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 4. Start infrastructure (PostgreSQL + Redis only)

```bash
docker compose up -d postgres redis
```

> Do **not** run a bare `docker compose up -d` for local development. It also starts the containerized server on port 4000, which conflicts with `npm run dev`.

### 5. Run database migrations

```bash
cd server
npx prisma migrate dev
```

### 6. Start development servers

```bash
# Terminal 1 — backend (port 4000)
cd server && npm run dev

# Terminal 2 — frontend (port 5173)
cd client && npm run dev
```

### 7. Verify

Open [http://localhost:5173](http://localhost:5173), register an account, and upload a CSV.

---

## Running the Full Stack with Docker

```bash
cp server/.env.example server/.env   # then fill in secrets as above
docker compose up --build
```

Open [http://localhost](http://localhost).

- The server container runs `prisma migrate deploy` on startup.
- The client is built with a relative API URL; nginx proxies `/api` to the server container.
- Compose overrides `DATABASE_URL`, `REDIS_URL` and `CLIENT_URL` for the container network.
- Postgres, Redis and the API are bound to `127.0.0.1` only.
- For any deployment beyond localhost, serve over HTTPS (the refresh cookie is `secure` when `NODE_ENV=production`) and move the database credentials out of `docker-compose.yml`.

---

## CSV Format

Required columns: **Campaign Name, Recipients, Opens, Clicks, Bounces, Unsubscribes**
Optional columns: Subject, Send Time, Unique Opens, Unique Clicks, Delivered, Complaints

- If only totals are provided, unique counts default to the totals.
- Rate columns (e.g. "CTR", "Open Rate") are ignored; rates are computed from counts.
- Re-uploading a campaign with the same name and send time is skipped.
- The import is all-or-nothing: any invalid row rejects the whole file with a row-specific message.

---

## Project Structure

```
email-campaign-analyzer/
├── client/                        # React (Vite, TypeScript) frontend
│   ├── src/
│   │   ├── components/            # ProtectedRoute, DashboardLayout
│   │   ├── contexts/              # AuthContext
│   │   ├── pages/                 # Login, Register, Campaigns, Analytics, AIInsights, Settings
│   │   ├── lib/                   # Axios instance (api.ts)
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts
│
├── server/                        # Node.js / Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/              # gemini, mailchimp, csvParser, analytics
│   │   ├── workers/               # Bull queue processors
│   │   ├── middleware/            # requireAuth
│   │   ├── lib/                   # prisma, encryption
│   │   └── index.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml             # postgres, redis, server, client
├── .gitignore
└── README.md
```

---

## Environment Variables

### `server/.env`

| Variable             | Required | Description                                                                                                       |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | ✅       | PostgreSQL URL. `.env.example` uses `localhost` for local dev; Compose overrides it with the `postgres` hostname. |
| `REDIS_URL`          | ✅       | Redis URL. `localhost` for local dev; Compose overrides it with the `redis` hostname.                             |
| `JWT_SECRET`         | ✅       | Secret for access tokens (32+ chars).                                                                             |
| `JWT_REFRESH_SECRET` | ✅       | Secret for refresh tokens. Must differ from `JWT_SECRET`.                                                         |
| `ENCRYPTION_KEY`     | ✅       | **64 hex characters** (32 bytes). Used for AES-256-GCM encryption of stored Mailchimp keys.                       |
| `GEMINI_API_KEY`     | ✅       | Google Gemini API key. Never exposed to the browser.                                                              |
| `GEMINI_MODEL`       | ⬜       | Override the default model (`gemini-2.5-flash`).                                                                  |
| `CLIENT_URL`         | ⬜       | Allowed CORS origin. Defaults to `http://localhost:5173`.                                                         |
| `PORT`               | ⬜       | Backend port. Defaults to `4000`.                                                                                 |

### `client/.env`

| Variable            | Required | Description                                                                                                          |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | ✅ (dev) | Backend base URL, `http://localhost:4000` for local dev. Docker builds set it empty so requests use the nginx proxy. |

---

## API Endpoint Reference

Protected endpoints require `Authorization: Bearer <access_token>`.

| Method   | Route                                                         | Auth        | Description                                         |
| -------- | ------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `GET`    | `/api/health`                                                 | ❌          | Health check                                        |
| `POST`   | `/api/auth/register`                                          | ❌          | Create an account                                   |
| `POST`   | `/api/auth/login`                                             | ❌          | Login; returns access token and sets refresh cookie |
| `POST`   | `/api/auth/refresh`                                           | ❌ (cookie) | Exchange refresh cookie for a new access token      |
| `POST`   | `/api/auth/logout`                                            | ❌ (cookie) | Revoke refresh token and clear cookie               |
| `POST`   | `/api/campaigns/upload`                                       | ✅          | Upload campaign CSV (field name `file`)             |
| `POST`   | `/api/integrations/mailchimp/connect`                         | ✅          | Validate and save Mailchimp API key                 |
| `POST`   | `/api/integrations/mailchimp/sync`                            | ✅          | Start background sync of sent campaigns             |
| `GET`    | `/api/integrations/mailchimp/status`                          | ✅          | Connection status and last sync time                |
| `DELETE` | `/api/integrations/mailchimp`                                 | ✅          | Disconnect Mailchimp                                |
| `GET`    | `/api/analytics/overview?range=30\|90\|all`                   | ✅          | Aggregate stats and event totals                    |
| `GET`    | `/api/analytics/campaigns`                                    | ✅          | List campaigns with computed rates                  |
| `GET`    | `/api/analytics/campaigns/:id`                                | ✅          | Detailed metrics for one campaign                   |
| `GET`    | `/api/analytics/trends?groupBy=month\|week&range=30\|90\|all` | ✅          | Time-series metrics                                 |
| `GET`    | `/api/analytics/compare?ids=a,b`                              | ✅          | Side-by-side campaign comparison                    |
| `POST`   | `/api/ai/insights/:campaignId`                                | ✅          | Generate insights (cached for 24 hours)             |
| `GET`    | `/api/ai/insights/:campaignId`                                | ✅          | Fetch latest insights                               |
| `POST`   | `/api/ai/insights/:campaignId/regenerate`                     | ✅          | Force a new generation                              |
| `GET`    | `/api/users/me`                                               | ✅          | Current user                                        |
| `PATCH`  | `/api/users/me`                                               | ✅          | Update profile (name, email)                        |
| `PATCH`  | `/api/users/me/password`                                      | ✅          | Change password                                     |

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Follow existing code style — Express controllers in `server/src/controllers/`, React pages in `client/src/pages/`
3. Keep `.env` out of commits — add new variables to `server/.env.example` with placeholder values
4. Open a pull request with a clear description of what changed and why

---

## License

MIT
