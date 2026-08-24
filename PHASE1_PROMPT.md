# CLAUDE CODE PROMPT — Fase 1: Project Foundation & Tooling

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator (internal tool mandiri)
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**: 
- `PRD.md` — Product Requirements (17 user stories, 6 epics)
- `ARCHITECTURE.md` — Tech stack, D1 schema, DO queue, security
- `TASK_LIST.md` — Fase 1 detail (baris 1-50)
- `CLAUDE.md` — Coding conventions (WAJIB diikuti)

**Tujuan Fase 1**: Initialize Astro project + tooling (Biome, TS strict, dependencies) sehingga `npm run dev` jalan di port 4321 dengan 0 error lint/typecheck.

**Hasil Akhir Fase 1**:
- Astro project structure siap
- `package.json` dengan deps lengkap
- `biome.json` configured
- `tsconfig.json` strict mode
- `CLAUDE.md` sudah ada (jangan ubah)
- Dev server start & serve halaman dasar

---

## 2. FILE BOUNDARIES

**FILE YANG BOLEH DIBUAT/DIUBAH:**
```
D:/PROJECT/content_generator/
├── package.json              ← CREATE/UPDATE
├── astro.config.mjs          ← CREATE
├── biome.json                ← CREATE
├── tsconfig.json             ← CREATE
├── .gitignore                ← CREATE (if missing)
├── src/
│   ├── entry.tsx             ← CREATE
│   ├── env.d.ts              ← CREATE
│   ├── pages/
│   │   └── index.astro       ← CREATE (minimal homepage)
│   └── layouts/
│       └── Layout.astro      ← CREATE
├── public/
│   └── favicon.svg           ← CREATE (optional)
└── .vscode/
    └── settings.json         ← CREATE (optional, Biome integration)
```

**FILE YANG TIDAK BOLEH DISINGGUNG:**
- `PRD.md`, `ARCHITECTURE.md`, `TASK_LIST.md`, `agent.md`, `CLAUDE.md`
- `.git/` directory
- `db/`, `functions/`, `src/lib/server/` (belum waktunya)

---

## 3. SPECIFIC RULES (DARI CLAUDE.md)

### TypeScript (STRICT)
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "isolatedModules": true,
  "moduleResolution": "bundler",
  "target": "ES2022",
  "lib": ["ES2022", "DOM", "DOM.Iterable"],
  "jsx": "react-jsx",
  "jsxImportSource": "react"
}
```

### NO `any` — GUNAKAN `unknown` + TYPE GUARDS
```ts
// ❌ SALAH
function parse(data: any) { ... }

// ✅ BENAR
function parse(data: unknown): Parsed {
  if (isParsed(data)) return data;
  throw new Error('Invalid');
}
```

### Zod Validation — SEMUA API INPUT
```ts
import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  default_lang: z.enum(['id', 'en']).default('id'),
});
```

### Biome Config (formatter + linter)
```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "quoteStyle": "single",
    "trailingCommas": "all",
    "semicolons": "always"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedVariables": "error" },
      "style": { "noNonNullAssertion": "warn" }
    }
  }
}
```

### Import Order (Biome handles via `--write`)
- External packages first
- Internal (`@/`, `~/`) 
- Relative (`./`, `../`)

### File Naming
- Files: `kebab-case` (`user-profile.astro`)
- React Components: `PascalCase` (`CalendarGrid.tsx`)
- Directories: `kebab-case`

---

## 4. VERIFICATION & OUTPUT CONTROL

**COMMAND UNTUK VERIFIKASI (JALANKAN SETELAH SELESAI):**
```bash
# 1. Lint + auto-fix
npm run lint -- --write

# 2. TypeScript check (NO EMIT)
npx tsc --noEmit

# 3. Dev server test (background, 5 detik, lalu curl)
npm run dev &
sleep 5
curl -s http://localhost:4321 | head -20
```

**OUTPUT YANG DIHARAPKAN DARI KAMU (Claude Code):**
- **HANYA** ringkasan status: `STATUS: PASS` atau `STATUS: FAIL`
- Jika FAIL: **HANYA** baris error spesifik (file:line: error message)
- JANGAN output seluruh stdout/stderr terminal
- JANGAN narasi panjang

---

## DETAIL TASKS (DARI TASK_LIST.md)

### 1.1 Init Astro Project
```bash
# Di dalam D:/PROJECT/content_generator/
npm create astro@latest -- --template basics --yes --install
```
> Gunakan `--yes` untuk non-interactive. Jika sudah ada package.json, skip. Node.js v22 sudah terinstall global.

### 1.2 Install Dependencies
```bash
npm i react react-dom zod date-fns clsx tailwindcss postcss autoprefixer @tailwindcss/vite
npm i -D @biomejs/biome drizzle-orm @neondatabase/serverless better-sqlite3 vitest
```
> Note: `@tailwindcss/vite` untuk Tailwind v4 (Astro 5+ compatible)

### 1.3 Setup Biome
```bash
npx @biomejs/biome init
```
> Edit `biome.json` sesuai config di atas.

### 1.4 Configure Tailwind (v4)
```bash
npx tailwindcss init
```
> Buat `src/styles/global.css` dengan `@import "tailwindcss";` + `@theme` config.

### 1.5 Verify All Checks Pass
```bash
npm run lint -- --write
npx tsc --noEmit
npm run dev &
sleep 5 && curl -s http://localhost:4321 | grep -c "<!DOCTYPE html>"
```

---

## INSTRUKSI EKSEKUSI

1. **Jalankan task 1.1 → 1.5 berurutan**
2. **Setelah setiap task**: run verification commands
3. **Jika error**: fix, re-run verification, lanjut task berikutnya
4. **Jika semua PASS**: stop, return summary

**FORMAT JAWABAN AKHIR:**
```
STATUS: PASS
Files created: package.json, astro.config.mjs, biome.json, tsconfig.json, src/...
Verification: lint=0 errors, tsc=0 errors, dev server=200 OK
```

ATAU

```
STATUS: FAIL
Errors:
- biome.json:15: invalid json
- tsconfig.json:8: "strict" must be true
```

---

## CONTOH PROMPT LENGKAP UNTUK COPY-PASTE

```
claude -p "$(cat <<'EOF'
# CLAUDE CODE PROMPT — Fase 1: Project Foundation & Tooling

## 1. TARGET GOAL & CONTEXT
**Proyek**: AI Auto Content Generator (internal tool mandiri)
**Lokasi**: D:/PROJECT/content_generator/
**Referensi**: PRD.md, ARCHITECTURE.md, TASK_LIST.md (Fase 1), CLAUDE.md
**Tujuan**: Initialize Astro project + tooling (Biome, TS strict, dependencies) sehingga npm run dev jalan di port 4321 dengan 0 error lint/typecheck.

## 2. FILE BOUNDARIES
**BOLEH DIBUAT/DIUBAH**: package.json, astro.config.mjs, biome.json, tsconfig.json, .gitignore, src/entry.tsx, src/env.d.ts, src/pages/index.astro, src/layouts/Layout.astro, public/favicon.svg, .vscode/settings.json
**TIDAK BOLEH DISINGGUNG**: PRD.md, ARCHITECTURE.md, TASK_LIST.md, agent.md, CLAUDE.md, .git/, db/, functions/, src/lib/server/

## 3. SPECIFIC RULES (DARI CLAUDE.md)
- TypeScript STRICT: strict=true, noUncheckedIndexedAccess=true, isolatedModules=true
- NO any — gunakan unknown + type guards
- Zod untuk SEMUA API input validation
- Biome config: 2 spaces, single quotes, trailing commas all, semicolons always
- Import order: external → internal → relative
- File naming: kebab-case files, PascalCase React components

## 4. VERIFICATION & OUTPUT CONTROL
JALANKAN SETELAH SELESAI:
npm run lint -- --write
npx tsc --noEmit
npm run dev & sleep 5 && curl -s http://localhost:4321 | head -20

OUTPUT HANYA: STATUS: PASS/FAIL + baris error spesifik jika FAIL

## TASKS
1.1 nvs use lts && npm create astro@latest -- --template basics --yes --install
1.2 npm i react react-dom zod date-fns clsx tailwindcss postcss autoprefixer @tailwindcss/vite && npm i -D @biomejs/biome drizzle-orm @neondatabase/serverless better-sqlite3 vitest
1.3 npx @biomejs/biome init → edit biome.json per config di atas
1.4 npx tailwindcss init → buat src/styles/global.css dengan @import "tailwindcss"
1.5 Run all verification commands

EKSEKUSI BERURUTAN. FIX ERROR SEBELUM LANJUT. RETURN RINGKASAN AKHIR SAJA.
EOF
)" --dangerously-skip-permissions
```

---

**SIAP DIEKSEKUSI.** Copy prompt di atas, paste ke terminal, atau simpan ke file `phase1-prompt.txt` lalu:
```bash
claude -p "$(cat phase1-prompt.txt)" --dangerously-skip-permissions
```