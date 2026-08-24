# CLAUDE CODE PROMPT — Fase 4: Workspaces & Sites CRUD API

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**: 
- `PRD.md` Epic 2 (Workspaces & Sites), Epic 3 (Content Management)
- `ARCHITECTURE.md` Section 3 (API Routes), Section 4 (D1 Schema)
- `TASK_LIST.md` Fase 4

**Status sebelumnya**: Fase 0-3 complete (PRD, Arch, Foundation, D1 Schema, Auth)

## 2. SCOPE & BOUNDARIES

### File yang boleh dibuat/diubah:
```
functions/api/workspaces/
  ├── index.ts          # GET /api/workspaces, POST /api/workspaces
  └── [id].ts           # GET/PATCH/DELETE /api/workspaces/:id
functions/api/sites/
  ├── index.ts          # GET /api/sites, POST /api/sites
  └── [id].ts           # GET/PATCH/DELETE /api/sites/:id
src/lib/server/
  ├── workspaces.ts     # Workspace queries (D1)
  └── sites.ts          # Site queries (D1)
```

### File yang TIDAK boleh disentuh:
- `src/lib/server/auth.ts` (sudah jadi)
- `functions/_middleware.ts`, `functions/_worker.ts`
- `db/schema.sql`, `db/migrations/`
- `package.json`, `tsconfig.json`, `biome.json`

## 3. SPECIFIC REQUIREMENTS

### Workspace CRUD
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/workspaces | List workspaces (user owns) |
| POST | /api/workspaces | Create workspace |
| GET | /api/workspaces/:id | Get workspace detail |
| PATCH | /api/workspaces/:id | Update workspace (name, description, settings) |
| DELETE | /api/workspaces/:id | Delete workspace (cascade) |

### Site CRUD
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sites | List sites in workspace |
| POST | /api/sites | Create site connection |
| GET | /api/sites/:id | Get site detail (mask secrets) |
| PATCH | /api/sites/:id | Update site config |
| DELETE | /api/sites/:id | Delete site |

### Site Types & Config (per ARCHITECTURE.md)
```typescript
type SiteType = 'wordpress' | 'blogger' | 'astro' | 'webhook';

interface SiteConfig {
  // WordPress
  wp_url?: string;
  wp_username?: string;
  wp_app_password?: string;
  // Blogger
  blogger_blog_id?: string;
  blogger_refresh_token?: string;
  // Astro (Git-backed)
  github_repo?: string;
  github_branch?: string;
  github_installation_id?: string;
  // Webhook
  webhook_url?: string;
  webhook_secret?: string;
  // Common
  default_category?: string;
  default_tags?: string[];
}
```

### Validation (Zod)
- Workspace: name (1-100), description (optional), default_lang (2-char), timezone (IANA)
- Site: name (1-100), type (enum), config (type-specific), is_active (bool)

### Security
- All routes protected by middleware (workspace_id from headers)
- Verify workspace ownership before any operation
- Mask secrets in GET responses (return `***` for passwords/tokens)
- Rate limit: 60 req/min per workspace (KV-based)

## 4. VERIFICATION COMMANDS

```bash
# Lint & type-check
npm run lint
npx tsc --noEmit

# Test local dev (requires wrangler dev)
# wrangler pages dev . --port 8787
# curl -H "Cookie: cg_session=..." http://localhost:8787/api/workspaces
```

## 5. OUTPUT CONSTRAINTS

- **Hanya laporkan**: STATUS: PASS/FAIL + baris error spesifik (jika ada)
- JANGAN print full stdout
- Gunakan `biome check --write` untuk auto-fix
- Tes compile dengan `npx tsc --noEmit` sebelum selesai