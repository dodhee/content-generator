# CLAUDE CODE PROMPT — Fase 2: D1 Schema & Local Dev DB

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool mandiri)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**: 
- `PRD.md` — Product Requirements
- `ARCHITECTURE.md` — Tech stack, D1 schema (8 tables), DO queue
- `TASK_LIST.md` — Fase 2 detail (baris 52-100)
- `CLAUDE.md` — Coding conventions (WAJIB diikuti)

**Tujuan Fase 2**: Buat D1 schema lengkap (8 tabel), migration file, Drizzle ORM setup, local SQLite dev DB, dan verifikasi queries dasar.

**Hasil Akhir Fase 2**:
- `db/schema.sql` — full DDL dari ARCHITECTURE.md
- `db/migrations/0001_initial.sql` — migration file
- `src/lib/server/db.ts` — D1 connection + typed queries (Drizzle)
- `package.json` scripts: `db:push`, `db:generate`, `db:migrate`, `db:studio`
- Local `local.db` SQLite created dengan semua tabel
- Basic queries verified (insert, select, join)

---

## 2. FILE BOUNDARIES

**FILE YANG BOLEH DIBUAT/DIUBAH:**
```
D:/PROJECT/content_generator/
├── package.json                      ← UPDATE (add db scripts)
├── db/
│   ├── schema.sql                    ← CREATE (full DDL)
│   └── migrations/
│       └── 0001_initial.sql          ← CREATE
├── src/lib/server/
│   └── db.ts                         ← CREATE (Drizzle + D1)
├── drizzle.config.ts                 ← CREATE (Drizzle config)
├── .dev.vars                         ← CREATE (local D1 binding)
└── vitest.config.ts                  ← CREATE (test config)
```

**FILE YANG TIDAK BOLEH DISINGGUNG:**
- `PRD.md`, `ARCHITECTURE.md`, `TASK_LIST.md`, `agent.md`, `CLAUDE.md`
- `.git/`, `node_modules/`, `.astro/`
- `src/pages/`, `src/layouts/`, `src/components/`, `astro.config.mjs`, `biome.json`, `tsconfig.json`
- `functions/` (belum waktunya)

---

## 3. SPECIFIC RULES (DARI CLAUDE.md + ARCHITECTURE.md)

### D1 Schema (8 Tables) — FROM ARCHITECTURE.md
```sql
-- Tables (exact names & columns from ARCHITECTURE.md):
1. workspaces
2. sites
3. articles
4. article_versions
5. generation_queue
6. publish_queue
7. calendar_slots
8. audit_log
9. usage_stats
10. content_graph
```

### Drizzle ORM Setup
```ts
// src/lib/server/db.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema'; // auto-generated

export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema });
}
```

### TypeScript (STRICT)
- NO `any` — gunakan `unknown` + type guards
- Zod untuk validasi input (nanti di API layer)
- Import types explicitly: `import type { Workspace } from './schema'`

### Biome
- `npm run lint` harus PASS (0 errors)

---

## 4. VERIFICATION & OUTPUT CONTROL

**COMMAND UNTUK VERIFIKASI (JALANKAN SETELAH SELESAI):**
```bash
# 1. Lint + auto-fix
npm run lint -- --write

# 2. TypeScript check
npx tsc --noEmit

# 3. Drizzle push to local SQLite
npm run db:push

# 4. Verify tables exist
sqlite3 local.db ".tables"

# 5. Test basic queries
sqlite3 local.db "SELECT COUNT(*) FROM workspaces;"
sqlite3 local.db "SELECT sql FROM sqlite_master WHERE type='table';"
```

**OUTPUT YANG DIHARAPKAN DARI KAMU (Claude Code):**
- **HANYA** ringkasan status: `STATUS: PASS` atau `STATUS: FAIL`
- Jika FAIL: **HANYA** baris error spesifik (file:line: error message)
- JANGAN output seluruh stdout/stderr terminal

---

## DETAIL TASKS (DARI TASK_LIST.md FASE 2)

### 2.1 Write `db/schema.sql` — Full DDL from ARCHITECTURE.md
- Copy exact schema dari ARCHITECTURE.md lines 75-200
- Include all 10 tables dengan FK, indexes, constraints
- SQLite compatible (no `SERIAL`, use `INTEGER PRIMARY KEY AUTOINCREMENT`)

### 2.2 Create Migration File
```bash
mkdir -p db/migrations
cp db/schema.sql db/migrations/0001_initial.sql
```

### 2.3 Install/Verify Drizzle Dependencies
```bash
# Already installed in Fase 1: drizzle-orm, @neondatabase/serverless, better-sqlite3
# Just verify
npm ls drizzle-orm
```

### 2.4 Write `drizzle.config.ts`
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: 'file:local.db',
  },
});
```

### 2.5 Write `src/lib/server/db.ts` + Auto-generate Schema
```bash
# Generate schema types from SQL
npx drizzle-kit generate --config=drizzle.config.ts
```
> This creates `src/lib/server/db/schema.ts` with typed tables

### 2.6 Write `.dev.vars` for Local Dev
```bash
# Local D1 binding for wrangler dev
DB=local.db
```

### 2.7 Add Package.json Scripts
```json
{
  "scripts": {
    "db:push": "drizzle-kit push --config=drizzle.config.ts",
    "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
    "db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
    "db:studio": "drizzle-kit studio --config=drizzle.config.ts"
  }
}
```

### 2.8 Run `npm run db:push` — Sync to Local SQLite
```bash
npm run db:push
```

### 2.9 Verify Tables & Queries
```bash
sqlite3 local.db ".tables"
sqlite3 local.db "PRAGMA table_info(workspaces);"
sqlite3 local.db "SELECT * FROM workspaces LIMIT 1;"
```

---

## INSTRUKSI EKSEKUSI

1. **Jalankan task 2.1 → 2.9 berurutan**
2. **Setelah setiap task**: run verification commands jika applicable
3. **Jika error**: fix, re-run verification, lanjut task berikutnya
4. **Jika semua PASS**: stop, return summary

**FORMAT JAWABAN AKHIR:**
```
STATUS: PASS
Files created: db/schema.sql, db/migrations/0001_initial.sql, drizzle.config.ts, src/lib/server/db.ts, src/lib/server/db/schema.ts, .dev.vars
Verification: lint=0 errors, tsc=0 errors, db:push=success, tables=10, queries=working
```

ATAU

```
STATUS: FAIL
Errors:
- db/schema.sql:45: syntax error near "FOREIGN"
- drizzle.config.ts:8: "driver" must be "better-sqlite3"
```

---

## CONTOH PROMPT LENGKAP UNTUK COPY-PASTE

```
claude -p "$(cat <<'EOF'
# CLAUDE CODE PROMPT — Fase 2: D1 Schema & Local Dev DB

## 1. TARGET GOAL & CONTEXT
**Proyek**: AI Auto Content Generator
**Lokasi**: D:/PROJECT/content_generator/
**Referensi**: PRD.md, ARCHITECTURE.md (lines 75-200 for schema), TASK_LIST.md (Fase 2), CLAUDE.md
**Tujuan**: Buat D1 schema lengkap (10 tabel), migration, Drizzle ORM, local SQLite, verifikasi queries.

## 2. FILE BOUNDARIES
**BOLEH**: package.json, db/schema.sql, db/migrations/0001_initial.sql, src/lib/server/db.ts, drizzle.config.ts, .dev.vars, vitest.config.ts
**TIDAK BOLEH**: PRD.md, ARCHITECTURE.md, TASK_LIST.md, agent.md, CLAUDE.md, .git/, node_modules/, .astro/, src/pages/, src/layouts/, src/components/, astro.config.mjs, biome.json, tsconfig.json, functions/

## 3. SPECIFIC RULES
- D1 Schema: 10 tables exact dari ARCHITECTURE.md (workspaces, sites, articles, article_versions, generation_queue, publish_queue, calendar_slots, audit_log, usage_stats, content_graph)
- Drizzle ORM: drizzle-orm/d1, better-sqlite3 driver
- TypeScript STRICT: no any, isolatedModules, noUncheckedIndexedAccess
- Biome lint harus PASS
- NO any — gunakan unknown + type guards

## 4. VERIFICATION COMMANDS
npm run lint -- --write
npx tsc --noEmit
npm run db:push
sqlite3 local.db ".tables"
sqlite3 local.db "SELECT COUNT(*) FROM workspaces;"

OUTPUT HANYA: STATUS: PASS/FAIL + baris error spesifik

## TASKS
2.1 Write db/schema.sql dari ARCHITECTURE.md (10 tables, SQLite compatible)
2.2 mkdir -p db/migrations && cp db/schema.sql db/migrations/0001_initial.sql
2.3 Verify deps: npm ls drizzle-orm
2.4 Write drizzle.config.ts (sqlite, better-sqlite3, url: file:local.db)
2.5 Write src/lib/server/db.ts + run npx drizzle-kit generate
2.6 Write .dev.vars (DB=local.db)
2.7 Update package.json scripts: db:push, db:generate, db:migrate, db:studio
2.8 npm run db:push
2.9 Verify: sqlite3 local.db ".tables" → 10 tables, test queries

EKSEKUSI BERURUTAN. FIX ERROR SEBELUM LANJUT. RETURN RINGKASAN AKHIR SAJA.
EOF
)" --dangerously-skip-permissions
```

---

**SIAP DIEKSEKUSI.** Copy prompt di atas, atau jalankan:
```bash
cd D:/PROJECT/content_generator
claude -p "$(cat PHASE2_PROMPT.md)" --dangerously-skip-permissions
```