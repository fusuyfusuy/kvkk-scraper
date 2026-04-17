# KVKK Breach Monitor

Scrapes [KVKK](https://www.kvkk.gov.tr/veri-ihlali-bildirimi/) (Turkish Data Protection Authority) data breach notifications, stores them in a local database, and sends email alerts for new disclosures.

## Stack

| Layer | Tech |
|-------|------|
| Backend | NestJS, Prisma, SQLite, nodemailer |
| Frontend | TanStack Start / Router / Query, React, Tailwind |
| Runtime | Bun |
| Infra | Docker Compose, nginx, Mailpit (dev) |

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# edit .env as needed
docker compose up --build
```

- App: http://localhost
- Mailpit (dev mail UI): http://localhost:8025

### Local Development

```bash
bun install
cd apps/api && bunx prisma migrate dev
# terminal 1
cd apps/api && bun run dev
# terminal 2
cd apps/web && bun run dev
```

- API: http://localhost:3000/api
- Web: http://localhost:5173

## Project Structure

```
.
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── src/
│   │   │   ├── scraper/  # KVKK scraping engine + scheduler
│   │   │   ├── posts/    # REST API for breach posts
│   │   │   ├── email/    # Notification service (nodemailer + handlebars)
│   │   │   ├── sse/      # Server-Sent Events for live updates
│   │   │   ├── prisma/   # Database service
│   │   │   └── config/   # Env validation (zod)
│   │   └── prisma/       # Schema + migrations
│   └── web/              # TanStack Start frontend
│       └── app/
│           ├── routes/   # List view, detail view
│           ├── components/  # PostCard, FilterBar, UnreadBadge
│           └── lib/      # API client, TanStack Query hooks, SSE
├── packages/
│   └── shared/           # Zod types shared between api and web
├── nginx/                # Reverse proxy config
├── archive/              # Original Python scraper (reference)
└── docker-compose.yml
```

## Features

- **Scheduled scraping** — hourly cron (configurable) fetches new breach notifications from KVKK
- **Manual refresh** — trigger via UI button or `POST /api/scraper/refresh`
- **Smart deduplication** — by source URL, with configurable stop conditions (N pages or M consecutive duplicates)
- **Date extraction** — distinguishes publication date (from listing) vs incident date (from post body regex, Turkish month support)
- **Email alerts** — sends per-post notifications via SMTP with HTML templates, transactional delivery tracking
- **Live updates** — SSE pushes new posts to the frontend without polling
- **Search & filter** — by keyword, company name, date range, read/unread status

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/posts` | List posts (query: `search`, `company`, `from`, `to`, `read`, `limit`, `offset`) |
| `GET` | `/api/posts/:id` | Get post detail |
| `POST` | `/api/posts/:id/read` | Mark post as read |
| `GET` | `/api/posts/unread/count` | Unread count |
| `POST` | `/api/scraper/refresh` | Trigger manual scrape |
| `GET` | `/api/scraper/runs` | List scrape run history |
| `GET` | `/api/events` | SSE stream (post:created, post:updated, scrape:completed) |

## Configuration

All config is via environment variables. See [`.env.example`](.env.example) for defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `DATABASE_URL` | `file:./dev.db` | SQLite path |
| `SMTP_HOST` | — | SMTP server host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` / `SMTP_PASS` | — | SMTP credentials |
| `SMTP_FROM` | — | Sender address |
| `NOTIFICATION_RECIPIENTS` | — | Comma-separated recipient emails |
| `CRON_EXPRESSION` | `0 * * * *` | Scrape schedule (hourly) |
| `REFRESH_MODE` | `DUPLICATES` | Stop mode: `PAGES` or `DUPLICATES` |
| `REFRESH_MAX_PAGES` | `50` | Max pages per scrape (when mode=PAGES) |
| `REFRESH_MAX_CONSECUTIVE_DUPLICATES` | `5` | Duplicate threshold (when mode=DUPLICATES) |

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| **nginx** | `:80` | Reverse proxy — `/api/*` to backend, `/` to frontend. SSE-aware. |
| **api** | internal | NestJS backend (bun runtime). Auto-runs Prisma migrations on start. |
| **web** | internal | Static SPA served by nginx-alpine |
| **mailpit** | `:8025` | Dev mail catcher — all outbound SMTP goes here |

SQLite data persists in a Docker named volume (`sqlite-data`).

## License

See [LICENSE](LICENSE).
