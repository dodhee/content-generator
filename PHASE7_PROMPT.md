# CLAUDE CODE PROMPT — Fase 7: Content Calendar (MVP)

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**:
- `PRD.md` Epic 3 — US-07 (Content Calendar visual drag-drop per site)
- `ARCHITECTURE.md` Section 4 (D1 Schema — calendar_slots), Section 5 (API routes)
- `TASK_LIST.md` Fase 7

**Status sebelumnya**: Fase 0-6 complete (PRD, Arch, Foundation, D1, Auth, Workspace/Site CRUD, Article CRUD, AI Generation Pipeline)

---

## 2. SCOPE & BOUNDARIES

### File yang BOLEH dibuat/diubah:
```
functions/api/calendar/
  ├── index.ts                # GET /api/calendar — list slots (month/week view)
  └── slots.ts                # CRUD /api/calendar/slots
src/lib/server/
  └── calendar.ts             # Calendar queries (D1)
src/components/
  └── CalendarGrid.tsx        # React component: month/week grid, drag-drop
src/pages/
  └── calendar.astro          # Calendar page (Astro + React island)
src/types/
  └── calendar.ts             # Zod schemas
```

### File yang TIDAK boleh disentuh:
- `src/lib/server/auth.ts`, `workspaces.ts`, `sites.ts`, `articles.ts`, `ai/router.ts`
- `functions/_middleware.ts`, `functions/_worker.ts`, `functions/durable/queue_DO.ts`
- `db/schema.sql`, `db/migrations/`, `src/lib/server/db/schema.ts`
- `package.json`, `tsconfig.json`, `biome.json`, `CLAUDE.md`

---

## 3. SPECIFIC REQUIREMENTS

### Calendar Types (`src/types/calendar.ts`)
```typescript
import { z } from 'zod';

export const calendarSlotSchema = z.object({
  workspace_id: z.string().min(1),
  site_id: z.string().optional(),
  article_id: z.string().optional(),
  slot_datetime: z.string().datetime(), // ISO
  slot_type: z.enum(['generation', 'publish', 'manual']).default('manual'),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.object({
    freq: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().positive().default(1),
    days: z.array(z.enum(['mon','tue','wed','thu','fri','sat','sun'])).optional(), // for weekly
    day_of_month: z.number().int().min(1).max(31).optional(), // for monthly
  }).optional(),
});

export const calendarSlotUpdateSchema = calendarSlotSchema.partial();

export type CalendarSlot = z.infer<typeof calendarSlotSchema>;
export type CalendarSlotUpdate = z.infer<typeof calendarSlotUpdateSchema>;

export interface CalendarSlotRow {
  id: string;
  workspace_id: string;
  site_id: string | null;
  article_id: string | null;
  slot_datetime: string;
  slot_type: string;
  is_recurring: number;
  recurrence_rule: string | null;
  created_at: string | null;
  updated_at: string | null;
}
```

---

### Calendar Queries (`src/lib/server/calendar.ts`)

```typescript
// GET /api/calendar?workspace_id=...&month=2025-01&site_id=...
export async function listCalendarSlots(
  db: D1Database,
  workspaceId: string,
  filters?: { month?: string; site_id?: string; slot_type?: string }
): Promise<CalendarSlotRow[]> { ... }
// - month format: "2025-01" (year-month)
// - Returns slots grouped by week for calendar grid

// GET /api/calendar/slots/:id
export async function getCalendarSlotById(
  db: D1Database,
  id: string
): Promise<CalendarSlotRow | null> { ... }

// POST /api/calendar/slots
export async function createCalendarSlot(
  db: D1Database,
  data: CalendarSlot
): Promise<CalendarSlotRow> { ... }
// - Generate ID: `slot_${crypto.randomUUID()}`
// - If recurring: validate recurrence_rule, expand occurrences? (MVP: store rule only)

// PUT /api/calendar/slots/:id
export async function updateCalendarSlot(
  db: D1Database,
  id: string,
  data: CalendarSlotUpdate
): Promise<CalendarSlotRow | null> { ... }
// - If article_id assigned: verify article belongs to workspace + site matches

// DELETE /api/calendar/slots/:id
export async function deleteCalendarSlot(
  db: D1Database,
  id: string
): Promise<boolean> { ... }
```

---

### Calendar API (`functions/api/calendar/index.ts`)

```typescript
// GET /api/calendar?workspace_id=...&month=2025-01&site_id=...
// Response: { weeks: [{ week_start, week_end, slots: [] }] }
// Group slots by week (Monday-Sunday)
```

---

### Slots CRUD API (`functions/api/calendar/slots.ts`)

```typescript
// GET /api/calendar/slots/:id
// PUT /api/calendar/slots/:id
// DELETE /api/calendar/slots/:id
// POST /api/calendar/slots (create)
```

---

### CalendarGrid React Component (`src/components/CalendarGrid.tsx`)

**Props:**
```typescript
interface CalendarGridProps {
  workspaceId: string;
  initialMonth: string; // "2025-01"
  slots: CalendarSlotRow[];
  articles: ArticleRow[]; // for drag source
  onSlotClick: (slot: CalendarSlotRow, date: Date) => void;
  onArticleDrop: (articleId: string, slotId: string) => Promise<void>;
  onSlotCreate: (date: Date) => void;
}
```

**Features:**
- Month view (default) + Week view toggle
- Grid: 7 columns (Mon-Sun), 4-6 rows
- Each cell: date + slots (max 3 visible, "+N more")
- Drag article from sidebar → drop on cell → calls `onArticleDrop`
- Click empty cell → create slot modal
- Click slot → edit modal (assign article, change type, set recurring)
- Recurring badge on recurring slots
- Color coding by slot_type: generation=blue, publish=green, manual=gray

---

### Calendar Page (`src/pages/calendar.astro`)

```astro
---
// Fetch workspace, sites, articles, slots for initial month
// Pass to CalendarGrid as props (client:load for interactivity)
---
<Layout>
  <CalendarGrid client:load {workspaceId} {initialMonth} {slots} {articles} />
</Layout>
```

---

## 4. VERIFICATION COMMANDS

```bash
# Lint & type-check
npm run lint
npx tsc --noEmit

# Test local dev
# wrangler pages dev . --port 8787
# curl -H "Cookie: cg_session=..." "http://localhost:8787/api/calendar?workspace_id=...&month=2025-01"
```

---

## 5. OUTPUT CONSTRAINTS

- **Hanya laporkan**: STATUS: PASS/FAIL + baris error spesifik (jika ada)
- JANGAN print full stdout
- Gunakan `biome check --write` untuk auto-fix
- Tes compile dengan `npx tsc --noEmit` sebelum selesai
- Follow pola Fase 4-6: auth check, ownership check, Zod validate, error handling
- CalendarGrid: React + native drag-drop API (no external libs)
- MVP scope: month view, basic drag-drop, recurring rule storage only (no auto-expansion)