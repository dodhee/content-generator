# CLAUDE.md — Coding Guidelines

## Language & Framework
- **Primary Language**: TypeScript (strict mode)
- **Framework**: Astro + React/Preact islands
- **Backend**: Cloudflare Pages Functions (`functions/`)
- **Database**: D1 (SQLite-based), queries via Drizzle ORM

## Type Safety (NO `any`)
- **Strict TS**: `strict: true, noUncheckedIndexedAccess: true, isolatedModules: true`
- **NO `any`**: Always use `unknown` + type guards, or proper interfaces
- **Zod for runtime validation**: All API inputs validated with Zod schemas
- Import types explicitly when splitting value/type:
  ```ts
  import type { User } from './types';
  import { getUser } from './db';
  ```

## Code Style (Biome)
- **Formatter**: Biome (not Prettier)
- **Indent**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Always required
- **Trailing commas**: All multiline
- **Import order**: External → internal → relative (Biome handles via `--write`)
- Run lint: `npm run lint`
- Fix: `npm run lint -- --write`

## File Naming Convention
- **Files**: kebab-case (`user-profile.astro`, `wordpress-api.ts`)
- **Directories**: kebab-case (`content-generator/`)
- **React components**: PascalCase (`CalendarGrid.tsx`)

## API Design Rules
- **All API routes** live in `functions/api/`
- **Router**: `functions/api/[[path]].ts` re-exports route handlers
- **Validation**: Every PUT/POST body validated with Zod schema
- **Errors**: Return structured JSON `{ error: string, code?: string }`
- **HTTP Methods**: Follow REST conventions strictly

## Database Rules
- **D1 binding**: Only access via `env.DB` inside Pages Functions
- **Drizzle**: Use typed queries, never raw SQL strings in production code
- **Migrations**: One feature per migration file (`0002_...`, `0003_...`)
- **Local dev**: `npm run db:push` (uses local `local.db`)

## Security Rules
- **Secrets**: Never log, never send to client, always from `env.*` or KV
- **OAuth tokens**: Encrypted before storing in KV
- **CORS**: Not configured (same-origin only)

## Environment Separation
- **Local dev**: `.dev.vars` for secrets (never committed)
- **Production**: Set via `npx wrangler pages secret put`
- **Local server**: `npx wrangler pages dev` (port 8787)

## Component Rules (Astro/React)
- **Astro components** (`.astro`): Use for static layout, server-rendered
- **React components** (`.tsx`): Only where client interaction needed (calendar drag-drop, live forms)
- **Props**: Always typed, no `any`
- **Styling**: TailwindCSS + `@tailwind base/components/utilities`

## Testing Rules
- **Vitest**: Unit tests in `src/lib/**/*.test.ts`
- **Coverage target**: ≥80% for logic layers
- Run: `npm run test:unit`
- Before PR: `npm run lint && npm run test:unit && npx tsc --noEmit`

## Commit Rules
- `fase-X: [desc]`
- Example: `fase-1: project foundation + biome config`
- Squash commits per phase before merging

## Documentation
- Every new module: add JSDoc comment on export functions
- Every API endpoint: write Zod schema + example payload in docstring
