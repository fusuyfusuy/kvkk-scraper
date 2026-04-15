# Requirements — nestjs-tanstack-kvkk-scraper

Feature: Convert the existing Python KVKK scraper into a TypeScript monorepo with a
NestJS + Prisma + SQLite backend and a TanStack Start + Router + Query + Tailwind
frontend. The system periodically scrapes
`https://www.kvkk.gov.tr/veri-ihlali-bildirimi/`, stores breach-notification posts,
exposes them via REST + live updates to a web UI, and emails subscribers when new
breaches are detected.

Mode: greenfield (new monorepo scaffolding; existing `scrape.py` is a
behavioural reference only).

---

## Actors

| Name | Role / permissions | Can initiate |
|------|-------------------|--------------|
| **Cron Scheduler** | Internal NestJS scheduler (no auth). Runs on a fixed cadence. | Scheduled scrape job; email-notification sweep. |
| **Anonymous Web User** | Unauthenticated end user of the frontend. Read-only access to posts; may trigger client-side state (mark-as-read, manual refresh). No authz layer in v1. | Browse list; open detail; search / filter; mark post as read; trigger manual refresh; subscribe to live updates. |
| **Email Recipient** | Configured SMTP recipient(s) listed in env. Passive — receives mail only. | (none — receives notifications) |
| **Operator / Developer** | Person deploying or configuring the service. Edits env / config. | Provide SMTP creds, cron expression, refresh-mode config; start/stop the service. |
| **KVKK Website** | External system scraped over HTTP. | (source of truth — emits 200/302/5xx responses) |
| **SMTP Server** | External mail relay configured via env. | (delivers queued mail) |

---

## Core Flows

### Flow: Scheduled Scrape
1. Cron scheduler fires at configured cadence (default: hourly).
2. Backend scrape module computes starting URL `${BASE_URL}/veri-ihlali-bildirimi/?&page=1`.
3. For each page N (starting at 1):
   1. Backend sends GET with a randomised desktop User-Agent and `timeout=30s`, following 3xx redirects.
   2. Parse HTML: collect the single `.blog-post-container` anchor (if present) plus every `.blog-grid-title a[href]`.
   3. If the page yields zero links, stop pagination.
   4. For each href:
      1. Resolve absolute URL against `BASE_URL`.
      2. **Dedup check by source URL** against `posts.source_url` (unique index).
      3. If already present: increment `consecutive_duplicates`; in refresh mode, if `consecutive_duplicates >= M` stop; otherwise continue.
      4. If new: fetch detail page, parse `.blog-post-inner`, extract `.blog-post-title` (stripping both title prefixes), body text, publication date from listing metadata, and incident date from body regex (Turkish month map + `DD[./]MM[./]YYYY`). Reset `consecutive_duplicates`.
      5. Insert row transactionally with `sent_at = NULL`, `read_at = NULL`, `scraped_at = now()`.
      6. Sleep random 1–3 s between detail fetches (politeness).
   5. Advance to page N+1 unless walk-N-pages mode has hit its cap or refresh-mode duplicate threshold is tripped.
4. Emit `ScrapeRunCompleted` event with counts (pages_walked, posts_found, posts_inserted, duplicates_seen, errors).
5. Trigger Email Notification Sweep (Flow below).
6. Emit SSE event `scrape:completed` so connected frontends can invalidate queries.

### Flow: Manual Refresh (from UI)
1. User clicks "Refresh" in header.
2. Frontend `POST /api/scrape/refresh` (TanStack Query mutation).
3. Backend enqueues a scrape run **iff no run is currently in-flight** (singleton lock). If locked, return `409 Conflict` with `{ status: "already-running" }`.
4. Backend returns `202 Accepted` with `{ runId }` immediately; scrape proceeds asynchronously identical to Scheduled Scrape.
5. Frontend subscribes to SSE and shows a spinner until `scrape:completed` for that runId.

### Flow: List / Search / Filter Posts
1. User lands on `/` (TanStack Router route).
2. TanStack Query issues `GET /api/posts?search=&company=&dateFrom=&dateTo=&page=&pageSize=&unreadOnly=`.
3. Backend queries Prisma: full-text-ish `LIKE` on title + body for `search`, `LIKE` on title for `company`, `incident_date` range for date filters, `read_at IS NULL` for `unreadOnly`. Paginate (default pageSize 20, max 100). Order by `published_at DESC NULLS LAST, scraped_at DESC`.
4. Response: `{ items: Post[], total, page, pageSize, unreadCount }`.
5. Frontend renders list; header shows unread badge = `unreadCount`.

### Flow: View Post Detail
1. User clicks list item → route `/posts/$id`.
2. Frontend `GET /api/posts/:id`. 404 if not found.
3. Frontend renders post with `title`, `body` (preformatted text), `published_at`, `incident_date`, `source_url`.

### Flow: Mark As Read
1. On detail view mount (or via explicit "Mark as read" button if `read_at IS NULL`), frontend `POST /api/posts/:id/read`.
2. Backend sets `read_at = now()` if NULL (idempotent).
3. Response returns updated post. Frontend invalidates list + unread-count queries.

### Flow: Live Updates
1. On app mount, frontend opens SSE stream `GET /api/events`.
2. Backend pushes events: `scrape:started`, `scrape:completed`, `post:created`, `post:updated` (for read flag).
3. Frontend dispatches query invalidations per event. If SSE connection drops, client falls back to polling `GET /api/posts` every 60 s until reconnect.

### Flow: Email Notification Sweep
1. Triggered by end of each scrape run (and optionally by an independent cron for retry of failed sends).
2. Backend fetches posts with `sent_at IS NULL` ordered by `scraped_at ASC`.
3. For each post, **inside a single DB transaction**:
   1. Render HTML + text email from a template using `{ title, published_at, incident_date, source_url, body_excerpt }`.
   2. Call nodemailer `sendMail` with SMTP config from env.
   3. On success: `UPDATE posts SET sent_at = now() WHERE id = ? AND sent_at IS NULL` and commit.
   4. On failure: rollback (leave `sent_at` NULL), log error, continue with next post.
4. Emit `email:sent` or `email:failed` telemetry per post.

---

## Business Constraints

1. **Dedup key = `source_url`** (unique index). Title is explicitly NOT the dedup key — titles can collide across breaches.
2. **Dates are two distinct fields**:
   - `published_at` (DateTime, nullable) — from listing metadata on the index page.
   - `incident_date` (Date, nullable) — parsed from the detail page body via regex (numeric and Turkish-month forms).
3. **HTTP client follows 302 redirects** (opposite of the Python reference which aborted on 302). Max 5 redirects; same-origin enforced.
4. **Refresh mode is config-driven** with two strategies:
   - `walk_n_pages`: scrape pages 1..N every run regardless of duplicates.
   - `until_m_duplicates`: stop after encountering M consecutive already-seen source URLs.
   Default: `until_m_duplicates` with M=5.
5. **Email send is transactional with `mark_as_sent`**: a post is marked sent only if the SMTP call returned success; SMTP failure must not leave the row flagged sent.
6. **Singleton scrape lock**: at most one scrape run (scheduled or manual) executes concurrently.
7. **Politeness**: randomised 1–3 s delay between detail fetches; randomised User-Agent per request; exponential backoff (base 5 s, max 3 attempts) on 5xx / network errors.
8. **Persistence**: SQLite via Prisma; DB file path configurable via `DATABASE_URL`.
9. **No authentication** on the REST API or SSE stream in v1. The service is assumed to run on a trusted network or behind a reverse proxy.
10. **Title sanitisation**: strip both `"Kamuoyu Duyurusu (Veri İhlali Bildirimi) – "` (en dash) and `"Kamuoyu Duyurusu (Veri İhlali Bildirimi) - "` (ASCII hyphen) prefixes.
11. **Ordering in list view**: `published_at DESC NULLS LAST, scraped_at DESC`.
12. **Timezone**: all timestamps stored as UTC ISO-8601; frontend formats in user locale.

---

## Error Conditions

| Flow | Failure | Handling |
|------|---------|----------|
| Scheduled Scrape | Network timeout / DNS failure on listing page | RETRY with exponential backoff (3 attempts). After final failure: ABORT current run, emit `scrape:failed`, schedule resumes next cron tick. |
| Scheduled Scrape | 5xx from KVKK | RETRY (3 attempts, expo backoff). Then ABORT. |
| Scheduled Scrape | 302 redirect | FOLLOW (up to 5 hops, same-origin). |
| Scheduled Scrape | 4xx other than 404 | ABORT run, log, do not mark-as-seen. |
| Scheduled Scrape | 404 on a detail page | SKIP that post, continue; log warning. |
| Scheduled Scrape | HTML parse failure (missing `.blog-post-inner` etc.) | SKIP that post, log, continue. |
| Scheduled Scrape | DB unique-constraint on `source_url` | Treat as duplicate (not error); count toward `consecutive_duplicates`. |
| Manual Refresh | Scrape already in flight | ABORT with `409 Conflict`, surface in UI toast. |
| List / Search | Invalid query params | ABORT with `400 Bad Request` + Zod error details. |
| Detail | Unknown id | ABORT with `404 Not Found`. |
| Mark As Read | Unknown id | ABORT with `404 Not Found`. |
| Mark As Read | Already read | Idempotent — return current row, no state change. |
| SSE | Client disconnect | Server closes stream; client auto-reconnects with backoff; falls back to polling after 3 failed reconnects. |
| Email Sweep | SMTP auth failure | ABORT sweep (config issue); log ERROR; do not mark any post sent; alert via log. |
| Email Sweep | Transient SMTP failure on one post | RETRY next sweep (row stays `sent_at = NULL`); continue with next post in current sweep. |
| Email Sweep | Template render error | SKIP that post (log), continue. Leaves row unsent; will be retried. |
| Email Sweep | DB write after send succeeds fails | Transaction rollback — email may have been sent but row stays unsent → acceptable risk; log WARN. (See Assumption A8.) |

---

## Out of Scope

1. Authentication / authorization (no login, no RBAC) — deferred.
2. Multi-tenant or multi-source scraping — only KVKK in v1.
3. Full-text search engine (Meili / Postgres FTS) — SQLite `LIKE` only.
4. Attachment / PDF download from KVKK posts — text body only.
5. Bulk operations (bulk mark-as-read, bulk delete) — deferred.
6. User-specific read state — `read_at` is global (single-user assumption).
7. Push notifications / webhooks — only SMTP email and in-app SSE.
8. Horizontal scaling — singleton instance is assumed (scrape lock is in-process).
9. Admin UI for SMTP / cron config — env-driven only.
10. i18n of the frontend — Turkish content is passed through; UI chrome is English-only.
11. Docker / deployment artifacts — repo ships source + `pnpm` scripts only.
12. Migration of historical `database.db` from the Python app — fresh DB only (see Assumption A2).
13. WebSocket transport — SSE only.
14. Rate-limiting / anti-bot beyond UA rotation and polite delays.

---

## Assumptions & Decisions

Each row: ambiguity surfaced in the prompt, chosen default, rationale. Orchestrator will surface these at the Phase 0 gate.

| # | Ambiguity | Decision | Rationale / Excluded Alternative |
|---|-----------|----------|----------------------------------|
| A1 | Cron cadence not specified | Default **hourly** (`0 * * * *`), overridable via `SCRAPE_CRON` env. | KVKK publishes infrequently; hourly balances freshness and politeness. Excluded: every-15-min (noisy), daily (too slow for breach notifications). |
| A2 | Migrate legacy `database.db`? | **No migration**; start with a fresh Prisma-managed DB. Legacy file ignored. | Schema differs (single `title` unique key vs. new `source_url` unique). Migration adds scope with little user value since the site can be re-scraped. Excluded: one-shot import script (can be added later). |
| A3 | "Publication date from listing metadata" — the reference Python doesn't read listing-level dates | New scraper will attempt to read a date element adjacent to each listing link (common WP pattern: `.blog-post-date` or `time[datetime]`). If absent, `published_at` stays NULL and only `incident_date` is used. | Matches prompt's explicit distinction. Excluded: using detail-page meta-tags only. |
| A4 | "Company name" filter semantics | Case-insensitive `LIKE '%term%'` on `title` (KVKK titles are of the form "… <COMPANY> hakkında"). No separate `company` column in v1. | Minimum viable; avoids NER. Excluded: extracting company into its own column via regex/LLM. |
| A5 | SSE vs. polling | Ship **both**: SSE primary, polling fallback every 60 s when SSE is disconnected. | Prompt allows either; combining gives resilience. Excluded: WebSocket (heavier infra). |
| A6 | Unread badge scope | Global unread count across all posts (not per-filter). | Simpler, matches single-user assumption. Excluded: per-filter unread. |
| A7 | Email recipients | Comma-separated list in `EMAIL_TO` env; one email per new post (not a digest) so each row has a 1:1 send. | Matches "mark_as_sent done transactionally with the send". Excluded: digest mode (complicates the transactional guarantee). |
| A8 | Send-then-DB-fail window | Accept the small window where SMTP succeeded but the `sent_at` update failed → post may be re-emailed once on next sweep. Log WARN. | True exactly-once requires an outbox/2PC not warranted in v1. Documented in error table. |
| A9 | Refresh-mode defaults | `until_m_duplicates` with **M=5**, cap at 50 pages as safety stop. | "Until consecutive duplicates" matches steady-state operation; 50-page cap prevents runaway on malformed pages. Excluded: unbounded walk. |
| A10 | Redirect scope | Follow up to **5** redirects, **same-origin only** (`www.kvkk.gov.tr`). | Defends against open-redirect misuse while honouring the "follow 302" requirement. |
| A11 | SQLite + concurrent writes (cron + API) | Use Prisma's default `better-sqlite3` with `journal_mode=WAL`; all writes serialized through a Nest service. | Adequate for single-instance deployment. Excluded: Postgres (stack says SQLite). |
| A12 | Monorepo layout | pnpm workspaces with `apps/api` (NestJS), `apps/web` (TanStack Start), `packages/shared` (Zod schemas + TS types shared between both). | Standard TanStack/Nest layout. Excluded: Nx / Turborepo (adds tooling weight). |
| A13 | Input validation | Zod on both ends; backend DTOs generated from shared Zod schemas via `nestjs-zod`. | Single source of truth for request/response shapes. |
| A14 | "Mark as read" trigger | Automatic on detail-view mount **and** explicit button when already on detail page (re-mark is idempotent). | Matches typical UX. Excluded: auto-read on list hover. |
| A15 | Delete / retention | No deletion. Posts kept indefinitely. | Volume is low (hundreds/year). Excluded: configurable retention. |
| A16 | Observability | Structured logs (pino) only in v1. No metrics/tracing exporter. | Keeps scope tight. Excluded: OTel exporter. |
| A17 | Frontend routing target | TanStack Start (SSR-capable) with client-only data fetching for list/detail in v1 (hydration keeps things simple). | Matches stack. Excluded: full SSR data loading (adds loader complexity). |
