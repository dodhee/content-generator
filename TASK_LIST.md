# Task List — AI Auto Content Generator

## Overview

Breakdown of implementation phases, micro-tasks, inputs/outputs, acceptance criteria, and verification commands.

---

## Fase 1 — Project Foundation & Tooling

### Scope
Initialize the project structure, package management, linting, and local dev environment.

### Files
- `package.json`
- `astro.config.mjs`
- `biome.json` (formatter/linter)
- `tsconfig.json`
- `CLAUDE.md`

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 1.1 | Init npm project + Astro | `npm create astro@latest -- --template basics` |
| 1.2 | Install deps: React, Zod, date-fns, clsx, tailwind | `nvs use lts && npm i react react-dom zod date-fns clsx tailwindcss postcss autoprefixer` |
| 1.3 | Setup Biome (lint + format) | `npx @biomejs/biome init` |
| 1.4 | Configure TS (strict, isolatedModules) | write `tsconfig.json` |
| 1.5 | Write `CLAUDE.md` with coding conventions | write `CLAUDE.md` |
| 1.6 | Verify dev server | `npm run dev` → check `http://localhost:4321` loads |

### Acceptance Criteria
- [ ] `npm run dev` starts Astro dev server on port 4321
- [ ] `npm run lint` returns 0 errors on clean files
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] `CLAUDE.md` defines: no `any`, strict types, biome config, import order rules

### Verification
```bash
npm run lint -- --write
npx tsc --noEmit
npm run dev &
sleep 5 && curl -s http://localhost:4321 | head -5
```

---

## Fase 2 — D1 Schema & Local Dev DB

### Scope
Define the full D1 schema from `ARCHITECTURE.md`, set up local SQLite for dev, migrations.

### Files
- `src/lib/server/db.ts`
- `db/schema.sql`
- `db/migrations/0001_initial.sql`
- `.dev.vars` (D1 binding for wrangler dev)
- `package.json` (add `db:push`, `db:generate`, `db:migrate`)

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 2.1 | Write `db/schema.sql` with all tables from ARCHITECTURE.md | write `db/schema.sql` |
| 2.2 | Create migration file `db/migrations/0001_initial.sql` | write migration |
| 2.3 | Install Drizzle ORM + Cloudflare D1 adapter | `npm i drizzle-orm @neondatabase/serverless better-sqlite3 --save-dev` |
| 2.4 | Write `src/lib/server/db.ts` (D1 connection, typed queries) | write `db.ts` |
| 2.5 | Test local DB: `npm run db:push` (sync schema to local SQLite) | run `npm run db:push` |
| 2.6 | Verify queries work (select, insert, join) | manual SQLite insert + select |

### Acceptance Criteria
- [ ] `npm run db:push` creates local `local.db` with all tables
- [ ] All 8 tables created with correct columns/types
- [ ] Foreign key constraints work
- [ ] `SELECT COUNT(*) FROM workspaces` works

### Verification
```bash
npm run db:push
npx drizzle-kit studio  # opens browser, verify tables
sqlite3 local.db ".tables"
```

---

## Fase 3 — Auth Middleware (GitHub OAuth)

### Scope
Implement GitHub OAuth for authentication. Store user/workspace sessions in KV.

### Files
- `functions/_middleware.ts`
- `functions/api/auth/github.ts`
- `src/lib/server/auth.ts`
- `.dev.vars` (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 3.1 | Create GitHub OAuth app (developer settings) — callback: `/api/auth/github/callback` | manual (docs in CLAUDE.md) |
| 3.2 | Write `src/lib/server/auth.ts`: sign, verify, session store in KV | write `auth.ts` |
| 3.3 | Write `functions/api/auth/github.ts`: OAuth callback handler | write `github.ts` |
| 3.4 | Write `functions/_middleware.ts`: inject session into all routes | write `_middleware.ts` |
| 3.5 | Protect `/api/*` with auth check — 401 if no valid session | test via curl |

### Acceptance Criteria
- [ ] GitHub login redirects correctly
- [ ] Callback stores session in KV
- [ ] Session cookie set + validated on subsequent requests
- [ ] Protected endpoint returns 401 without session

### Verification
```bash
curl -i http://localhost:8787/api/workspaces  # expect 401
# Test login flow manually
```

---

## Fase 4 — Workspace API & Frontend

### Scope
Build CRUD API for workspaces + basic Astro frontend UI.

### Files
- `functions/api/workspaces/index.ts`
- `functions/api/workspaces/[id].ts`
- `src/pages/workspaces.astro`
- `src/pages/workspaces/[id].astro`
- `src/lib/client/api.ts` (type-safe client)

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 4.1 | Write workspace CRUD API (POST/GET/PUT/DELETE) | write `workspaces/index.ts` |
| 4.2 | Write single workspace API (GET/PUT/DELETE) | write `workspaces/[id].ts` |
| 4.3 | Create `workspaces.astro` list page | write `workspaces.astro` |
| 4.4 | Create `[id].astro` detail page w/ site management link | write `[id].astro` |
| 4.5 | Write client API wrapper (`src/lib/client/api.ts`) | write `api.ts` |

### Acceptance Criteria
- [ ] Create workspace → returns 201 + inserts to D1
- [ ] List workspaces → returns JSON array
- [ ] Delete workspace → cascades to sites (D1 foreign key)
- [ ] Frontend renders workspace list, can navigate to detail

### Verification
```bash
curl -X POST http://localhost:8787/api/workspaces -b "session=..." -d '{"name":"test"}'
curl http://localhost:8787/api/workspaces -b "session=..." | jq
```

---

## Fase 5 — Site Connection (WordPress MVP)

### Scope
Connect a WordPress site — store config, test connection, sync categories/tags.

### Files
- `functions/api/sites/index.ts`
- `functions/api/sites/[id].ts`
- `src/lib/server/cms/wordpress.ts`
- `src/lib/server/db.ts` (add `sites` table insert/update logic)

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 5.1 | Write WP connection test + category/tag sync | write `wordpress.ts` |
| 5.2 | Write `sites/index.ts` API (POST/GET) | write `sites/index.ts` |
| 5.3 | Write `sites/[id].ts` API (PUT/DELETE/GET) | write `sites/[id].ts` |
| 5.4 | Test: real WP site — input URL+app password → lists categories | curl test |

### Acceptance Criteria
- [ ] POST `/sites` with WordPress config → 201 + verified against live site
- [ ] GET `/sites` returns all sites for workspace
- [ ] PUT `/sites/:id` → updates config, re-syncs categories
- [ ] DELETE `/sites/:id` → removes from D1
- [ ] WP connection test handles 401, 403, wrong URL, timeout

### Verification
```bash
# Use a real or local WP test site
curl -X POST http://localhost:8787/api/sites \
  -b "session=..." \
  -d '{"name":"test-wp","type":"wordpress","wp_url":"https://demo.com","wp_username":"admin","wp_app_password":"xxxx"}'
```

---

## Fase 6 — Article CRUD + Status Pipeline

### Scope
Article master record with full status pipeline.

### Files
- `functions/api/articles/index.ts`
- `functions/api/articles/[id].ts`
- `src/lib/server/db.ts` (add article helpers)
- `src/types/article.ts`

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 6.1 | Write Zod schema for article input | write `types/article.ts` |
| 6.2 | POST `/articles` → create with status=`draft`, default frontmatter | write `articles/index.ts` |
| 6.3 | GET `/articles?workspace_id=...` → list all | write `articles/index.ts` |
| 6.4 | GET `/articles/:id` → full article + versions | write `articles/[id].ts` |
| 6.5 | PUT `/articles/:id` → update content/frontmatter → auto-save version | write `articles/[id].ts` |
| 6.6 | PATCH `/articles/:id/status` → transition statuses | write `articles/[id].ts` |
| 6.7 | DELETE `/articles/:id` → soft-delete (status=deleted) | write `articles/[id].ts` |

### Acceptance Criteria
- [ ] Create article → status `draft`, version 1 created
- [ ] Edit → version increments, old version preserved
- [ ] Status transitions: draft → outline → generating → ready → queued → publishing → published
- [ ] All invalid transitions rejected (e.g. draft → published)
- [ ] Soft delete hides from list but preserves version history

### Verification
```bash
curl -X POST http://localhost:8787/api/articles -b "session=..." -d '{"title":"Test","workspace_id":"...","site_id":"..."}'
curl http://localhost:8787/api/articles -b "session=..." | jq '.[] | select(.title=="Test")'
```

---

## Fase 7 — AI Generation Pipeline (Outline Only)

### Scope
MVP pipeline: receive article draft → generate outline via 9Router → save to article.

### Files
- `src/lib/server/ai/router.ts`
- `src/lib/server/ai/generate.ts`
- `functions/api/generate/index.ts`
- `functions/api/generate/[id].ts`

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 7.1 | Write `ai/router.ts`: 9Router API call + fallback logic | write `router.ts` |
| 7.2 | Write `ai/generate.ts`: outline generation (prompt + response handling) | write `generate.ts` |
| 7.3 | Write `generate/index.ts`: enqueue → DO queue | write `generate/index.ts` |
| 7.4 | Write `generate/[id].ts`: check job status | write `generate/[id].ts` |
| 7.5 | Test end-to-end: POST `/generate` → outline saved to article | curl test |

### Acceptance Criteria
- [ ] POST `/api/generate` with `{"article_id":"...", "topic":"...", "intent":"informational"}` → returns job_id
- [ ] 9Router called with structured prompt (include Style DNA if site configured)
- [ ] Job status: queued → processing → completed
- [ ] Article.updated_at + outline_json populated with result
- [ ] Error handling: 9Router failure → retry (max 3x) → fail job + article.status = `failed`

### Verification
```bash
# Check 9Router is reachable (local proxy)
curl http://localhost:3999/v1/chat/completions # 9Router default port

# Trigger generation
curl -X POST http://localhost:8787/api/generate -b "session=..." -d '{"article_id":"...","topic":"best phone 2025"}'

# Check result
curl http://localhost:8787/api/articles/<id> -b "session=..." | jq '.outline_json'
```

---

## Fase 8 — Content Calendar (MVP)

### Scope
Calendar grid view (week/month) + slot creation + article assignment.

### Files
- `functions/api/calendar/index.ts`
- `functions/api/calendar/slots.ts`
- `src/pages/calendar.astro`
- `src/components/CalendarGrid.tsx`

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 8.1 | Write `calendar/index.ts`: list slots per workspace/site | write `index.ts` |
| 8.2 | Write `calendar/slots.ts`: CRUD slots | write `slots.ts` |
| 8.3 | Create `calendar.astro` page | write `calendar.astro` |
| 8.4 | Create `CalendarGrid.tsx` React component | write `CalendarGrid.tsx` |
| 8.5 | Test: create slot → assign article → fetch list | curl + browser |

### Acceptance Criteria
- [ ] GET `/api/calendar?workspace_id=...&month=2025-01` → returns slots grouped by week
- [ ] POST `/api/calendar/slots` → create recurring or one-off
- [ ] Drag article from sidebar → drop on calendar slot → API call PATCH slot `{article_id: ...}`
- [ ] Delete slot → no orphan references
- [ ] CalendarGrid renders correct week grid, highlights assigned slots

### Verification
```bash
curl -X POST http://localhost:8787/api/calendar/slots \
  -b "session=..." \
  -d '{"workspace_id":"...","slot_datetime":"2025-01-15T07:00:00Z"}'

curl http://localhost:8787/api/calendar?workspace_id=...&month=2025-01 | jq
```

---

## Fase 9 — WordPress Publisher

### Scope
Publish a "ready" article to WordPress via REST API, verify success.

### Files
- `src/lib/server/cms/wordpress.ts` (add `publish` function)
- `functions/api/publish/index.ts`
- `functions/api/publish/[id].ts`
- `src/lib/server/queue.ts` (enqueue publish job)

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 9.1 | Extend `wordpress.ts`: `publishArticle(article, site_config)` → REST API POST | patch `wordpress.ts` |
| 9.2 | Write `publish/index.ts`: enqueue → DO publish queue | write `publish/index.ts` |
| 9.3 | Write `publish/[id].ts`: check publish job status | write `[id].ts` |
| 9.4 | Test: article with status `ready` → publish to real WP | curl + WP dashboard |

### Acceptance Criteria
- [ ] POST `/api/publish` with `{"article_id":"..."}` → returns publish_job_id
- [ ] Article.status → `publishing` → `published` (on success)
- [ ] WordPress receives: title, markdown→HTML, categories, tags, featured image
- [ ] On success: `published_url` set, `published_at` timestamped
- [ ] On failure: retry 3x, then `status=failed` + `publish_error` populated
- [ ] Post-publish verify: GET publish URL → 200 OK

### Verification
```bash
# Article must be 'ready' first
curl -X POST http://localhost:8787/api/publish -b "session=..." -d '{"article_id":"..."}'

# Check article updated
curl http://localhost:8787/api/articles/<id> | jq '{status, published_url}'

# Check WordPress dashboard for new post
# (manual verify)
```

---

## Fase 10 — Publish Queue Dashboard + Monitoring

### Scope
Frontend UI to view publish queue status, retry failures, inspect payloads.

### Files
- `functions/api/publish/queue.ts`
- `src/pages/publish-queue.astro`
- `src/components/PublishQueueTable.tsx`
- `src/components/DriftDetector.tsx`

### Tasks
| Task | Scope | Command |
|------|-------|---------|
| 10.1 | GET `/api/publish/queue?workspace=...` → all queue items | write `queue.ts` |
| 10.2 | PATCH `/api/publish/:job_id/retry` → requeue failed items | write `queue.ts` |
| 10.3 | Create `publish-queue.astro` page | write `publish-queue.astro` |
| 10.4 | Create `PublishQueueTable.tsx` (filter by status) | write table |
| 10.5 | Create `DriftDetector.tsx` (compares source vs published) | write component |

### Acceptance Criteria
- [ ] Queue table shows: article title, target site, status, timestamp, error message (if failed)
- [ ] Retry button → PATCH API → status back to `pending`
- [ ] Filter: pending, processing, success, failed
- [ ] Drift detector: re-fetches 3 articles → shows diff if content changed on CMS side

### Verification
```bash
# Test queue API
curl http://localhost:8787/api/publish/queue -b "session=..." | jq '.[] | select(.status=="failed")'

# Manual: check queue page in browser, test retry button
```

---

## Notes

- Each phase ends with **verification** before commit
- Use `npm run test:unit` (vitest) after fase 2 for new logic
- Use `npx wrangler dev` for local Functions testing (port 8787)
- D1 local: `npm run db:push` uses local SQLite; production uses remote D1
- All API tests use `curl -b "session=..."` — session cookie from auth flow