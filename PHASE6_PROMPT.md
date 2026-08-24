# CLAUDE CODE PROMPT — Fase 6: AI Generation Pipeline (Outline MVP)

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**:
- `PRD.md` Epic 2 — US-03 (Generate artikel: Outline → Review → Full Article), US-04 (Style DNA), US-05 (Multi-model routing)
- `ARCHITECTURE.md` Section 7 (Durable Object: Generation Queue), Section 5 (Worker Structure — `src/lib/server/ai/`)
- `TASK_LIST.md` Fase 6

**Status sebelumnya**: Fase 0-5 complete (PRD, Arch, Foundation, D1, Auth, Workspace/Site CRUD, Article CRUD)

---

## 2. SCOPE & BOUNDARIES

### File yang BOLEH dibuat/diubah:
```
src/lib/server/ai/
  ├── router.ts               # 9Router/OpenRouter call + fallback
  ├── generate.ts             # Outline generation logic (prompt building, response parsing)
  ├── style-dna.ts            # Style DNA analysis + few-shot injection (stub for now)
  └── image.ts                # Image gen (stub)
functions/api/generate/
  ├── index.ts                # POST /api/generate — enqueue job to DO
  └── [id].ts                 # GET /api/generate/:id — check job status
functions/durable/
  └── queue_DO.ts             # Durable Object: Generation Queue (already has skeleton in ARCHITECTURE.md)
src/types/
  └── generate.ts             # Zod schemas for generation request/response
```

### File yang TIDAK boleh disentuh:
- `src/lib/server/auth.ts`, `workspaces.ts`, `sites.ts`, `articles.ts`
- `functions/_middleware.ts`, `functions/_worker.ts`
- `db/schema.sql`, `db/migrations/`, `src/lib/server/db/schema.ts`
- `package.json`, `tsconfig.json`, `biome.json`, `CLAUDE.md`

---

## 3. SPECIFIC REQUIREMENTS

### Generation Request/Response Types (`src/types/generate.ts`)
```typescript
import { z } from 'zod';

export const generateRequestSchema = z.object({
  article_id: z.string().min(1),
  topic: z.string().min(1).max(500),
  intent: z.enum(['informational', 'commercial', 'transactional']).optional(),
  target_words: z.number().int().positive().max(5000).optional(),
  niche: z.string().optional(),
  tone_preset: z.string().optional(),
  model_override: z.string().optional(), // manual model override
  style_dna: z.boolean().default(true), // inject style DNA few-shot
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const outlineResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(300).optional(),
  sections: z.array(z.object({
    heading: z.string(),
    level: z.number().int().min(2).max(3), // H2 or H3
    key_points: z.array(z.string()),
    target_words: z.number().int().positive().optional(),
  })).min(1),
  suggested_faq: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  suggested_tags: z.array(z.string()).optional(),
  suggested_categories: z.array(z.string()).optional(),
});

export type OutlineResponse = z.infer<typeof outlineResponseSchema>;

export const generationJobSchema = z.object({
  job_id: z.string(),
  article_id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  model_name: z.string().optional(),
  prompt_data: z.string().optional(),
  result_json: z.string().optional(),
  error_message: z.string().optional(),
  retry_count: z.number().int().default(0),
  max_retries: z.number().int().default(3),
  created_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type GenerationJob = z.infer<typeof generationJobSchema>;
```

---

### AI Router (`src/lib/server/ai/router.ts`)

```typescript
// 9Router (local proxy) → OpenRouter fallback
// Env: NINE_ROUTER_BASE_URL, NINE_ROUTER_API_KEY, OPENROUTER_API_KEY

interface RouterOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface RouterResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function callRouter(
  env: Env,
  options: RouterOptions
): Promise<RouterResponse> {
  // 1. Try 9Router first (local, free)
  // 2. Fallback to OpenRouter if 9Router fails
  // 3. Return unified response
}
```

**Models mapping** (per ARCHITECTURE.md):
- `9router-claude-writer` → default (cheap tier)
- `9router-claude-image` → image gen
- `openrouter/anthropic/claude-3.5-sonnet` → balanced
- `openrouter/anthropic/claude-3-opus` → premium

---

### Generate Logic (`src/lib/server/ai/generate.ts`)

```typescript
import { getArticleById, transitionArticleStatus } from '../articles';
import { getSiteByIdWithConfig } from '../sites';
import { callRouter } from './router';

export async function generateOutline(
  env: Env,
  articleId: string,
  request: GenerateRequest
): Promise<OutlineResponse> {
  // 1. Fetch article + site config
  // 2. Build prompt: system + user (include Style DNA if site has wp_style_dna)
  // 3. Call router with model from site.ai_model_default or request.model_override
  // 4. Parse response → validate via outlineResponseSchema
  // 5. Return structured outline
}

// Prompt template (system):
// "You are an expert SEO content strategist. Create a detailed outline for a {intent} article about '{topic}'.
// Target: {target_words} words. Niche: {niche}. Tone: {tone_preset}.
// Output JSON only matching the schema: {title, description, sections[{heading, level, key_points[], target_words}], suggested_faq[], suggested_tags[], suggested_categories[]}"

// If style_dna=true and site.wp_style_dna exists: inject as few-shot examples
```

---

### Generate API (`functions/api/generate/index.ts`)

```typescript
// POST /api/generate
// Body: { article_id, topic, intent?, target_words?, niche?, tone_preset?, model_override?, style_dna? }
// Response: { job_id }

// Flow:
// 1. Validate session + article ownership
// 2. Verify article.status in ['draft', 'outline', 'review'] (can regenerate)
// 3. Create generation_queue row (status='queued')
// 4. Enqueue to Durable Object: POST /queue/enqueue { article_id, prompt_data }
// 5. Return job_id
```

---

### Job Status API (`functions/api/generate/[id].ts`)

```typescript
// GET /api/generate/:id
// Response: GenerationJob (from DO storage)
// - If job.completed: also update article.outline_json + status='outline'
```

---

### Durable Object Queue (`functions/durable/queue_DO.ts`)

**Skeleton sudah ada di ARCHITECTURE.md lines 383-482** — lengkapi:
- `fetch()` handle `/enqueue`, `/process`, `/status/:jobId`
- `processNext()`: ambil job → call `generateOutline()` → update D1 (article.outline_json, status='outline') → mark job completed
- Retry logic: max 3x, exponential backoff
- Error handling: job.status='failed', article.status='failed'

---

## 4. VERIFICATION COMMANDS

```bash
# Lint & type-check
npm run lint
npx tsc --noEmit

# Test local dev (requires wrangler dev)
# wrangler pages dev . --port 8787
# curl -X POST -H "Cookie: cg_session=..." -d '{"article_id":"...","topic":"best phone 2025"}' http://localhost:8787/api/generate
# curl -H "Cookie: cg_session=..." http://localhost:8787/api/generate/<job_id>
```

---

## 5. OUTPUT CONSTRAINTS

- **Hanya laporkan**: STATUS: PASS/FAIL + baris error spesifik (jika ada)
- JANGAN print full stdout
- Gunakan `biome check --write` untuk auto-fix
- Tes compile dengan `npx tsc --noEmit` sebelum selesai
- Follow pola Fase 4/5: auth check, ownership check, Zod validate, error handling
- **Tidak perlu implementasi full article generation** — hanya outline MVP untuk Fase 6