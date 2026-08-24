# CLAUDE CODE PROMPT — Fase 5: Article CRUD + Status Pipeline

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**:
- `PRD.md` Epic 3 (Content Management & Calendar) — US-07, US-08
- `ARCHITECTURE.md` Section 4 (D1 Schema — articles, article_versions)
- `TASK_LIST.md` Fase 5

**Status sebelumnya**: Fase 0-4 complete (PRD, Arch, Foundation, D1 Schema, Auth, Workspace/Site CRUD)

---

## 2. SCOPE & BOUNDARIES

### File yang BOLEH dibuat/diubah:
```
functions/api/articles/
  ├── index.ts          # GET /api/articles, POST /api/articles
  └── [id].ts           # GET/PUT/PATCH/DELETE /api/articles/:id
src/lib/server/
  ├── articles.ts       # Article queries (D1) + versioning logic
  └── types/
      └── article.ts    # Zod schemas + TypeScript types
```

### File yang TIDAK boleh disentuh:
- `src/lib/server/auth.ts`, `workspaces.ts`, `sites.ts`
- `functions/_middleware.ts`, `functions/_worker.ts`
- `db/schema.sql`, `db/migrations/`, `src/lib/server/db/schema.ts`
- `package.json`, `tsconfig.json`, `biome.json`, `CLAUDE.md`

---

## 3. SPECIFIC REQUIREMENTS

### Article CRUD Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/articles | List articles (filter: workspace_id, site_id, status) |
| POST | /api/articles | Create article (status=draft, version=1) |
| GET | /api/articles/:id | Get article detail + versions |
| PUT | /api/articles/:id | Update content/frontmatter → auto-save version |
| PATCH | /api/articles/:id/status | Transition status (validated) |
| DELETE | /api/articles/:id | Soft delete (status=deleted) |

### Article Zod Schema (`src/lib/server/types/article.ts`)
```typescript
import { z } from 'zod';

export const articleStatusSchema = z.enum([
  'draft', 'outline', 'review', 'queued', 'generating',
  'ready', 'scheduled', 'publishing', 'published', 'failed', 'deleted'
]);

export const articleIntentSchema = z.enum([
  'informational', 'commercial', 'transactional'
]);

export const articleCreateSchema = z.object({
  workspace_id: z.string().min(1),
  site_id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(250).optional(),
  intent: articleIntentSchema.optional(),
  target_words: z.number().int().positive().optional(),
  niche: z.string().optional(),
  tone_preset: z.string().optional(),
  ai_model: z.string().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  content_md: z.string().optional(),
  frontmatter_json: z.string().optional(),
  outline_json: z.string().optional(),
});

export const articleStatusTransitionSchema = z.object({
  status: articleStatusSchema,
});

// Valid transitions (per PRD US-08)
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['outline', 'deleted'],
  outline: ['review', 'draft', 'deleted'],
  review: ['queued', 'outline', 'deleted'],
  queued: ['generating', 'review', 'deleted'],
  generating: ['ready', 'failed', 'queued'],
  ready: ['scheduled', 'queued', 'review', 'deleted'],
  scheduled: ['publishing', 'ready', 'deleted'],
  publishing: ['published', 'failed', 'scheduled'],
  published: ['scheduled', 'deleted'], // republish/schedule
  failed: ['queued', 'review', 'deleted'],
  deleted: [], // terminal
};
```

### Article Row Type (matches D1 schema)
```typescript
export interface ArticleRow {
  id: string;
  workspace_id: string;
  site_id: string;
  title: string | null;
  slug: string | null;
  status: string;
  intent: string | null;
  target_words: number | null;
  niche: string | null;
  tone_preset: string | null;
  ai_model_used: string | null;
  content_md: string | null;
  frontmatter_json: string | null;
  outline_json: string | null;
  created_at: string | null;
  updated_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  publish_error: string | null;
  version: number;
}

export interface ArticleVersionRow {
  id: number;
  article_id: string;
  version: number;
  frontmatter_json: string | null;
  content_md: string | null;
  changed_by: string | null;
  changed_at: string | null;
  diff_data: string | null;
}
```

---

### Query Functions (`src/lib/server/articles.ts`)

```typescript
// GET /api/articles?workspace_id=...&site_id=...&status=...
export async function listArticles(
  db: D1Database,
  workspaceId: string,
  filters?: { site_id?: string; status?: string }
): Promise<ArticleRow[]> { ... }

// POST /api/articles
export async function createArticle(
  db: D1Database,
  data: z.infer<typeof articleCreateSchema>
): Promise<ArticleRow> { ... }
// - Generate ID: `art_${crypto.randomUUID()}`
// - Insert article with status='draft', version=1
// - Insert article_versions row (version=1, changed_by='user')
// - Return created article

// GET /api/articles/:id
export async function getArticleById(
  db: D1Database,
  id: string
): Promise<ArticleRow | null> { ... }

export async function getArticleVersions(
  db: D1Database,
  articleId: string
): Promise<ArticleVersionRow[]> { ... }

// PUT /api/articles/:id — update content/frontmatter
export async function updateArticle(
  db: D1Database,
  id: string,
  data: z.infer<typeof articleUpdateSchema>,
  actor: 'user' | 'system' = 'user'
): Promise<ArticleRow | null> { ... }
// - Fetch current article
// - Increment version
// - Update article row (content_md, frontmatter_json, outline_json, version, updated_at)
// - Insert article_versions row (new version, changed_by=actor, diff_data=JSON summary)
// - Return updated article

// PATCH /api/articles/:id/status
export async function transitionArticleStatus(
  db: D1Database,
  id: string,
  newStatus: string
): Promise<ArticleRow | null> { ... }
// - Validate transition via VALID_TRANSITIONS
// - Update status + updated_at
// - If status='published': set published_at = now()
// - Return updated article

// DELETE /api/articles/:id — soft delete
export async function softDeleteArticle(
  db: D1Database,
  id: string
): Promise<boolean> { ... }
// - Update status='deleted', updated_at=now()
// - Return success
```

---

### Security & Validation (per Fase 4 pattern)
- All routes protected by middleware (workspace_id from session)
- Verify workspace ownership before any operation
- Verify article belongs to workspace
- Zod validation on all inputs
- Rate limit: 60 req/min per workspace (KV-based — reuse existing pattern)

---

## 4. VERIFICATION COMMANDS

```bash
# Lint & type-check (harus PASS)
npm run lint
npx tsc --noEmit

# Test local dev (requires wrangler dev)
# wrangler pages dev . --port 8787
# curl -H "Cookie: cg_session=..." http://localhost:8787/api/articles
```

---

## 5. OUTPUT CONSTRAINTS

- **Hanya laporkan**: STATUS: PASS/FAIL + baris error spesifik (jika ada)
- JANGAN print full stdout
- Gunakan `biome check --write` untuk auto-fix
- Tes compile dengan `npx tsc --noEmit` sebelum selesai
- Setiap file harus follow pola Fase 4 (auth check, ownership check, Zod validate, error handling)