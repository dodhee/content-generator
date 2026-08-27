# Task List — AI Auto Content Generator (v2 Consolidated)

**Dibuat**: 2026-08-28
**Basis**: PRD.md + ARCHITECTURE.md + implementasi aktual (agent.md)
**Prinsip**: 1 Fase = 1 Epic/Feature Cluster utama, linear, tidak pecah jadi .1/.2/.3

---

## Fase 0 — Planning & Architecture ✅
**Scope:** PRD, ARCHITECTURE, TASK_LIST
**Files:** `PRD.md`, `ARCHITECTURE.md`, `TASK_LIST.md` (v2 ini), `CLAUDE.md`
**Status:** Complete — semua dokumen foundation ada

---

## Fase 1 — Project Foundation & Tooling ✅
**Scope:** Astro init, deps, Biome, TS strict config
**Files:** `package.json`, `astro.config.mjs`, `biome.json`, `tsconfig.json`, `CLAUDE.md`
**Tasks:**
- 1.1 Init npm project + Astro
- 1.2 Install deps: React, Zod, date-fns, clsx, tailwind
- 1.3 Setup Biome (lint + format)
- 1.4 Configure TS (strict, isolatedModules)
- 1.5 Write `CLAUDE.md` with coding conventions
- 1.6 Verify dev server
**Acceptance:** `npm run dev` starts, `npm run lint` clean, `npx tsc --noEmit` clean

---

## Fase 2 — D1 Schema & Migrations ✅
**Scope:** Full D1 schema, local SQLite, migrations
**Files:** `src/lib/server/db.ts`, `db/schema.sql`, `db/migrations/0001_initial.sql`, `.dev.vars`, `package.json` (db scripts)
**Tasks:**
- 2.1 Write `db/schema.sql` with all 8 tables
- 2.2 Create migration `db/migrations/0001_initial.sql`
- 2.3 Install Drizzle ORM + Cloudflare D1 adapter
- 2.4 Write `src/lib/server/db.ts` (D1 connection, typed queries)
- 2.5 Test local DB: `npm run db:push`
- 2.6 Verify queries work
**Acceptance:** Local DB created with 8 tables, FK constraints work, queries execute

---

## Fase 3 — Auth Middleware (GitHub OAuth) ✅
**Scope:** GitHub OAuth flow, session in KV, auth middleware
**Files:** `functions/_middleware.ts`, `functions/api/auth/callback.ts`, `src/lib/server/auth.ts`, `.dev.vars` (secrets)
**Tasks:**
- 3.1 Create GitHub OAuth app (callback: `/api/auth/callback`)
- 3.2 Write `src/lib/server/auth.ts`: sign, verify, session store in KV
- 3.3 Write `functions/api/auth/callback.ts`: OAuth callback handler
- 3.4 Write `functions/_middleware.ts`: session validation, fail-closed 401
- 3.5 Test 401 response on protected routes without session
**Acceptance:** OAuth flow works, session cookie set, 401 on unauthenticated API calls

---

## Fase 4 — Workspace API & Frontend ✅
**Scope:** Workspace CRUD, settings, isolation
**Files:** `functions/api/workspaces/index.ts`, `functions/api/workspaces/[id].ts`, `src/lib/server/workspaces.ts`, `src/pages/workspaces.astro` (jika ada)
**Tasks:**
- 4.1 Workspace CRUD API (create, read, update, list)
- 4.2 Workspace isolation (workspace_id filter on all queries)
- 4.3 Settings: default_lang, timezone, AI model defaults
- 4.4 Frontend: workspace selector (jika multi-workspace)
**Acceptance:** Workspace CRUD works, row-level isolation enforced

---

## Fase 5 — Sites API & UI ✅
**Scope:** Site connection (WP, Blogger, Astro, Webhook), config per type, UI
**Files:** `functions/api/sites/index.ts`, `functions/api/sites/[id].ts`, `src/lib/server/sites.ts`, `src/pages/sites.astro`, `src/components/SitesManager.tsx`, `src/components/SiteForm.tsx`
**Tasks:**
- 5.1 Sites API: CRUD + Zod validation per type
- 5.2 Config mapping: WP (url, user, app_password), Blogger (blog_id, refresh_token), Astro (repo, branch, path), Webhook (url, secret)
- 5.3 Secrets masking: password fields → `***` di response
- 5.4 UI: SitesManager (list, add, delete), SiteForm (conditional fields per type)
- 5.5 D1 migration: `ALTER TABLE sites ADD COLUMN config_json TEXT`
**Acceptance:** Add/edit/delete site works, config per type saved, secrets masked, UI a11y clean

---

## Fase 6 — Article CRUD & Versioning ✅
**Scope:** Article lifecycle, status pipeline, version history
**Files:** `functions/api/articles/index.ts`, `functions/api/articles/[id].ts`, `src/lib/server/articles.ts`, `src/pages/articles.astro` (jika ada), `src/components/ArticleEditor.tsx`
**Tasks:**
- 6.1 Article CRUD API
- 6.2 Status pipeline: draft → outline → review → queued → generating → ready → scheduled → publishing → published/failed
- 6.3 Version history: snapshot on save/generate/regenerate
- 6.4 Diff utility (side-by-side)
- 6.5 Frontmatter JSON handling
**Acceptance:** Article CRUD + status transitions + versioning work

---

## Fase 7 — Content Calendar (MVP) ✅
**Scope:** Visual calendar per site, drag-drop scheduling, recurring slots
**Files:** `functions/api/calendar/index.ts`, `functions/api/calendar/slots.ts`, `src/lib/server/calendar.ts`, `src/pages/calendar.astro`, `src/components/CalendarGrid.tsx`
**Tasks:**
- 7.1 Calendar API: slots CRUD, date filtering
- 7.2 CalendarGrid component: month view, week grouping, drag-drop
- 7.3 Recurring slots: "Every Monday 07:00", "1st & 15th"
- 7.4 Timezone handling per workspace
**Acceptance:** Month view renders, drag-drop schedules article, recurring slots work

---

## Fase 8 — AI Outline Generation ✅
**Scope:** 9Router/OpenRouter integration, DO queue, outline generation
**Files:** `src/lib/server/ai/router.ts`, `src/lib/server/ai/generate.ts`, `src/lib/server/queue.ts`, `functions/durable/queue_DO.ts`, `functions/api/generate/index.ts`
**Tasks:**
- 8.1 AI Router: model tiers (cheap/balanced/premium), cost tracking
- 8.2 Generate outline from topic/keyword/niche/intent/tone
- 8.3 DO Queue: exactly-once processing, observable state
- 8.4 API `/api/generate`: enqueue outline job, poll status
- 8.5 Frontend: generate outline UI (linked from calendar/article)
**Acceptance:** Outline generated via AI, queued in DO, status polling works

---

## Fase 9 — WordPress Publisher ✅
**Scope:** WP REST API v2 publish, enqueue, status, retry, CF deploy
**Files:** `src/lib/server/cms/wordpress.ts`, `functions/api/publish/index.ts`, `functions/api/publish/[id].ts`, `functions/api/publish/queue.ts`, `functions/durable/queue_DO.ts`
**Subtasks (terverifikasi):**
- 9.1 `wordpress.ts publishArticle()`: WP REST POST `/wp/v2/posts`, categories, tags, featured image, Yoast/RankMath meta, schedule
- 9.2 `functions/api/publish/index.ts`: POST enqueue + GET list queue
- 9.3 `functions/api/publish/[id].ts`: GET status (DO fallback DB) + PATCH `/retry`
- 9.4 CF Pages deploy: Pages + D1 + KV created, remote migration ✅, secrets bound
- 9.5 OAuth callback fixes: HMAC crypto bug fixed (cad00ab), redirect callback → `/` (fa5b3ac), D1 `config_json` migration
- 9.6 DO Worker: `content-generator-queue` deployed, new_sqlite_classes, QUEUE binding via API, Pages redeploy verified
**Acceptance:** Publish to WP works end-to-end, queue monitored, retry works, production deploy stable

---

## Fase 10 — Publish Queue Dashboard ✅
**Scope:** Queue monitoring UI, drift detection
**Files:** `src/pages/publish-queue.astro`, `src/components/PublishQueueTable.tsx`, `src/components/DriftDetector.tsx`, `functions/api/drift/index.ts`, `src/lib/server/cms/drift.ts`
**Subtasks (terverifikasi):**
- 10.1 `functions/api/publish/queue.ts`: GET queue fix, workspace dari session
- 10.3 `src/pages/publish-queue.astro`: dashboard page, biome-ignore astro frontmatter FP
- 10.4 `PublishQueueTable.tsx`: table + filter + retry button
- 10.5 `DriftDetector.tsx` + drift API: fetch WP live via slug `published_url`, diff vs `content_md`, mock dihapus (PRD US-13 AC-03)
**Acceptance:** Queue dashboard shows all items, filter works, retry triggers re-publish, drift detection compares live vs stored

---

## Fase 11 — Audit Log & Monitoring ✅
**Scope:** Audit trail, filtering, wiring ke article lifecycle
**Files:** `src/lib/server/audit.ts`, `functions/api/audit/index.ts`
**Tasks:**
- 11.1 `audit.ts`: `logAudit()` fail-open, structured JSON
- 11.2 API `/api/audit`: list with filter action/since/limit (max 200)
- 11.3 Wire ke articles: created, edited, status:*, deleted
**Acceptance:** Audit logs captured for all article actions, queryable via API

---

## Fase 12 — Dashboard Root + Global Navigation 🔜 NEXT
**Scope:** Root dashboard, global nav, OAuth redirect consistency
**Files:** `src/pages/index.astro`, `src/components/Navigation.tsx`, `src/components/DashboardStats.tsx`, `src/components/TodaySchedule.tsx`, `src/layouts/Layout.astro`, `functions/api/dashboard/stats.ts`, `functions/api/auth/callback.ts`
**Tasks:**
- 12.1 `index.astro`: hapus `prerender=true`, server-side session check, redirect `/api/auth/login` jika tidak auth
- 12.2 `DashboardStats.tsx`: 4 stat cards (articles 7d, scheduled today, failed publishes, AI cost MTD) + API `/api/dashboard/stats`
- 12.3 `TodaySchedule.tsx`: compact list hari ini dari calendar API, max 10 rows
- 12.4 `Navigation.tsx`: nav bar (Dashboard|Sites|Calendar|Queue), active state, user dropdown (workspace + logout)
- 12.5 Wire Navigation ke Layout: `showNav` prop, apply ke `/`, `/sites`, `/calendar`, `/publish-queue`
- 12.6 OAuth callback: redirect `/sites` → `/` (root dashboard)
- 12.7 E2E test: login → dashboard → sites → calendar → queue → logout
**Acceptance:** Root = functional dashboard, global nav connects all pages, OAuth lands on dashboard

---

## Fase 13 — Article Generation UI (PRD US-03) ⬜ PLANNED
**Scope:** Outline editor → Review → Full article generation
**Files:** `src/pages/generate.astro`, `src/components/OutlineEditor.tsx`, `src/components/ArticleGenerator.tsx`, `functions/api/generate/outline.ts`, `functions/api/generate/article.ts`
**Tasks:**
- 13.1 Outline editor: drag-drop reorder H2/H3, add/remove sections, edit points
- 13.2 Review step: accept/reject/regenerate per section
- 13.3 Full article generation: streaming per section, markdown + frontmatter output
- 13.4 Integration: calendar slot → generate flow
**Acceptance:** End-to-end generate: topic → outline → review → full article → save to article

---

## Fase 14 — Style DNA (PRD US-04) ⬜ PLANNED
**Scope:** Analyze site content, extract brand voice, inject few-shot
**Files:** `src/lib/server/ai/style-dna.ts`, `functions/api/style-dna/index.ts`, `src/components/StyleDNAPanel.tsx`
**Tasks:**
- 14.1 "Analyze Site" trigger: crawl 50-200 posts via REST/Git/sitemap
- 14.2 Extract: sentence length, vocab diversity, transitions, heading depth, CTA patterns
- 14.3 Generate 3-5 few-shot examples
- 14.4 Auto-inject ke prompt untuk semua generasi di site tersebut
- 14.5 Re-analyze button
**Acceptance:** Style DNA generated per site, auto-applied to generation prompts

---

## Fase 15 — Media Management (PRD US-09) ⬜ PLANNED
**Scope:** AI image gen, R2 upload, alt text, markdown injection
**Files:** `src/lib/server/ai/image.ts`, `functions/api/media/index.ts`, `src/components/MediaManager.tsx`
**Tasks:**
- 15.1 AI image generation (Pollinations/FLUX) dari prompt di editor
- 15.2 Auto alt text, compress (WebP, max 1200px), upload ke R2
- 15.3 Insert ke markdown: `![alt](url)` + frontmatter `og:image`
**Acceptance:** Images generated, uploaded, inserted into article markdown

---

## Fase 16 — Blogger Publisher (PRD US-11) ⬜ PLANNED
**Scope:** Blogger API v3 publish, OAuth2 token refresh
**Files:** `src/lib/server/cms/blogger.ts`, `functions/api/publish/blogger.ts`
**Tasks:**
- 16.1 OAuth2 token refresh otomatis
- 16.2 Create/update post via Blogger API v3: labels, schedule
- 16.3 Image upload via Blogger media API (atau R2 + inject URL)
- 16.4 Post-publish verify (status 200, canonical, indexable)
**Acceptance:** Publish to Blogger works same reliability as WP

---

## Fase 17 — Astro/Git Publisher (PRD US-12) ⬜ PLANNED
**Scope:** Generate .md/.mdx file, GitHub App commit + push, Actions deploy
**Files:** `src/lib/server/cms/astro.ts`, `functions/api/publish/astro.ts`
**Tasks:**
- 17.1 Generate `.md/.mdx` dengan frontmatter lengkap ke `src/content/posts/{slug}.md`
- 17.2 Commit + push via GitHub App (scoped token, no PAT di UI)
- 17.3 Trigger GitHub Actions deploy (detect workflow file)
- 17.4 Poll Actions API → wait deploy success → mark published dengan live URL
**Acceptance:** Publish to Astro static site via Git works end-to-end

---

## Tracking Matrix: PRD Epic → Fase Implementation

| PRD Epic | User Story | TASK_LIST Fase (v2) | Status | Notes |
|----------|-----------|---------------------|--------|-------|
| Epic 1   | US-01 Workspace | Fase 4 | ✅ | |
| Epic 1   | US-02 Site Connect | Fase 5 | ✅ | |
| Epic 2   | US-03 Generate Article | Fase 13 | ⬜ | Next major feature after Fase 12 |
| Epic 2   | US-04 Style DNA | Fase 14 | ⬜ | |
| Epic 2   | US-05 Multi-model Routing | Fase 8 (partial) | ⚠️ Partial | Router exists, routing logic needs UI |
| Epic 2   | US-06 Opportunity Radar | — | ⬜ | Not started |
| Epic 3   | US-07 Calendar | Fase 7 | ✅ | |
| Epic 3   | US-08 Version History | Fase 6 | ✅ | |
| Epic 3   | US-09 Media | Fase 15 | ⬜ | |
| Epic 4   | US-10 WP Publish | Fase 9 | ✅ | |
| Epic 4   | US-11 Blogger Publish | Fase 16 | ⬜ | |
| Epic 4   | US-12 Astro/Git Publish | Fase 17 | ⬜ | |
| Epic 4   | US-13 Drift Detection | Fase 10.5 | ✅ | |

---

## Archive References (Old Numbering)

| Old agent.md | New Fase | Notes |
|--------------|----------|-------|
| Fase 6 (AI Generation Pipeline) | Fase 8 | Renamed to "AI Outline Generation" |
| Fase 9.1-9.6 | Fase 9 | Consolidated |
| Fase 10.1b, 10.3-10.5b | Fase 10 | Consolidated |
| Fase 11.1-11.3 | Fase 11 | Kept |
| Fase 5.4b | Fase 5 | Merged into Sites |
| Fase 12 (old) | Fase 12 | Same scope, renumbered |

---

## Verification Commands (Per Phase)

```bash
# Fase 0-3: Foundation
npm run lint && npx tsc --noEmit && npm run dev

# Fase 4-7: Core Features
npm run build  # Pages build must succeed
wrangler pages deploy dist --project-name=content-generator

# Fase 8-11: AI + Publish + Monitoring
# Test each API endpoint with valid session
curl -H "Cookie: cg_session=TOKEN" https://apps.codevx.web.id/api/...

# Fase 12: Dashboard + Nav
npm run build
npx wrangler pages dev dist --kv KV --d1 DB
# Manual E2E: login → dashboard → nav all pages → logout

# Fase 13-17: Remaining PRD Features
# TBD per phase
```

---

## Rules for Future Phases

1. **One phase at a time** — complete verification before next
2. **No .1/.2/.3 suffixes** — use subtasks within phase
3. **Update agent.md** on phase completion with commit hash
4. **Update this TASK_LIST** when scope changes
5. **PRD traceability** — every feature maps to PRD US-XX
6. **Deploy verification** — production smoke test required before ✅