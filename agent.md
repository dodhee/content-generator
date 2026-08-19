# Agent Project Status

## Informasi Proyek
- **Nama Proyek**: AI Auto Content Generator
- **Tech Stack**: Astro + React/Preact islands, Cloudflare Pages + Functions, D1, KV, R2, Durable Objects, 9Router/OpenRouter
- **Tanggal Mulai**: 2026-08-19
- **Update Terakhir**: 2026-08-19

## Status Fase
| Fase | Deskripsi | Status | Catatan |
|------|-----------|--------|---------|
| 0 | PRD, ARCHITECTURE, TASK_LIST | ✅ | Complete |
| 1 | Project foundation, tooling, biome | 🔄 | In Progress |
| 2 | D1 Schema, local dev DB, migrations | ⏳ | Pending |
| 3 | Auth middleware (GitHub OAuth) | ⏳ | Pending |

## Keputusan Arsitektur
- 2026-08-19 — Astro (SSG + Islands) chosen over Next.js: zero-JS default, faster on Pages, HTMX fallback for non-JS clients
- 2026-08-19 — Durable Objects for generation + publish queues (exactly-once, observable state)
- 2026-08-19 — D1 chosen over PlanetScale (free quota, edge-native, row-level not needed — workspace_id filter sufficient)
- 2026-08-19 — Secrets (OAuth tokens, API keys) → KV, encrypted. Never stored in D1.
- 2026-08-19 — GitHub OAuth only (no password auth, no multi-user roles for v1)

## Masalah yang Belum Terselesaikan
- GitHub OAuth app credentials belum dibuat
- 9Router proxy configuration (port, API key) belum diverifikasi
- Cloudflare Pages Functions local dev (`npx wrangler pages dev`) belum diuji
- No mobile-first design in v1 scope

## Struktur Direktori
```
content_generator/
├── PRD.md
├── ARCHITECTURE.md
├── TASK_LIST.md
├── agent.md          ← THIS FILE
├── package.json
├── astro.config.mjs
├── biome.json
├── tsconfig.json
├── CLAUDE.md
├── db/
│   ├── schema.sql
│   └── migrations/
│       └── 0001_initial.sql
├── functions/
│   ├── _middleware.ts
│   ├── _worker.ts
│   ├── api/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── sites/
│   │   ├── articles/
│   │   ├── generate/
│   │   ├── publish/
│   │   └── calendar/
│   └── durable/
│       └── queue_DO.ts
├── src/
│   ├── entry.tsx
│   ├── layouts/
│   ├── pages/
│   ├── components/
│   └── lib/
│       ├── client/
│       └── server/
│           ├── db.ts
│           ├── auth.ts
│           ├── cms/
│           ├── ai/
│           └── queue.ts
└── .dev.vars
```

## Environment Variables (set via Pages Dashboard)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NINE_ROUTER_API_KEY` (or leave empty for local no-auth)
- `DATABASE_URL` (auto-managed by Wrangler)
- `KV_URL` (auto-managed by Wrangler)

## Deployment
- GitHub repo: `dodhee/content-generator`
- Branch: `main`
- Deploy: GitHub Action → Cloudflare Pages (on push to main)
- Daily cron: 07:00 WIB publish scheduler
