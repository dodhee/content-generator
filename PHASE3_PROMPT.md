# CLAUDE CODE PROMPT — Fase 3: Auth Middleware (GitHub OAuth)

## 1. TARGET GOAL & CONTEXT

**Proyek**: AI Auto Content Generator
**Lokasi**: `D:/PROJECT/content_generator/`
**Referensi**: `PRD.md` (US-02), `ARCHITECTURE.md` (lines 35-50, security model), `CLAUDE.md`

**Tujuan Fase 3**: Implement GitHub OAuth authentication with middleware protection for all `/api/*` routes. User login → session stored in KV → cookie-based auth → protected endpoints return 401 without valid session.

**Hasil Akhir Fase 3**:
- `functions/api/auth/login.ts` — initiates GitHub OAuth redirect
- `functions/api/auth/callback.ts` — handles OAuth callback, fetches user, stores session in KV
- `functions/api/auth/logout.ts` — destroys session
- `functions/_middleware.ts` — auth guard for all `/api/*` routes (except `/api/auth/*`)
- `src/lib/server/auth.ts` — session management utilities (crypto signing, KV storage)
- Test: protected endpoint returns 401; login flow works; session validated on subsequent requests

---

## 2. FILE BOUNDARIES

**FILE YANG BOLEH DIBUAT/DIUBAH:**
```
D:/PROJECT/content_generator/
├── functions/
│   ├── _middleware.ts                    ← CREATE (auth guard)
│   └── api/
│       ├── auth/
│       │   ├── login.ts                  ← CREATE (initiate OAuth)
│       │   ├── callback.ts               ← CREATE (handle callback)
│       │   └── logout.ts                 ← CREATE (destroy session)
├── src/lib/server/
│   └── auth.ts                           ← CREATE (session utils)
├── .dev.vars                             ← UPDATE (add GITHUB_CLIENT_ID/SECRET)
└── package.json                          ← UPDATE (add wrangler dev script)
```

**FILE YANG TIDAK BOLEH DISINGGUNG:**
- `PRD.md`, `ARCHITECTURE.md`, `TASK_LIST.md`, `agent.md`, `CLAUDE.md`
- `.git/`, `node_modules/`, `.astro/`
- `db/`, `src/lib/server/db/`, `src/pages/`, `astro.config.mjs`

---

## 3. SPECIFIC RULES (DARI CLAUDE.md)

### TypeScript (STRICT)
- No `any` — gunakan `unknown` + type guards
- Import types explicitly
- Zod untuk validasi input OAuth callback

### Security
- **Session token**: crypto-signed (HMAC-SHA256), 24h expiry
- **Session storage**: KV (`sessions:{token}` → `{ workspace_id, user_id, user_name, expires_at }`)
- **Secrets**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — from `env` (Pages Dashboard) or `.dev.vars` (local)
- **Cookie**: `httpOnly`, `secure` (in prod), `sameSite=strict`, `path=/`

### API Design
- `GET /api/auth/login` → redirect to GitHub OAuth
- `GET /api/auth/callback?code=xxx&state=xxx` → exchange code → fetch user → create session → redirect to `/` with cookie
- `POST /api/auth/logout` → delete session from KV, clear cookie
- All other `/api/*` → require valid session cookie; 401 if missing/invalid

### Auth Flow (GitHub OAuth)
```
1. User accesses /api/workspaces (protected)
2. Middleware checks session cookie
3. No cookie → 401 {error: "Authentication required", redirect_to: "/api/auth/login"}
4. With cookie → validate HMAC signature → check KV for session
5. Valid session → allow, attach env.user to request
```

---

## 4. VERIFICATION & OUTPUT CONTROL

**COMMAND UNTUK VERIFIKASI:**
```bash
# 1. Install wrangler for local Pages Functions dev
npm install -g wrangler

# 2. Start local dev (simulates Cloudflare runtime)
cd D:/PROJECT/content_generator
echo 'DB=local.db' > .dev.vars
echo 'GITHUB_CLIENT_ID=test_client_id' >> .dev.vars
echo 'GITHUB_CLIENT_SECRET=test_client_secret' >> .dev.vars
npx wrangler pages dev . --port 8787 --compatibility-date=2024-01-01 &

# 3. Test protected endpoint (expect 401)
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/workspaces

# 4. Test login redirect (expect 302)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/auth/login

# 5. Stop dev server
kill %1
```

**OUTPUT YANG DIHARAPKAN:**
- `STATUS: PASS` + summary file created
- Atau `STATUS: FAIL` + specific error lines

---

## INSTRUKSI EKSEKUSI

1. **Buat semua file di atas secara berurutan**
2. **Jalankan verification commands**
3. **Jika error**: fix, re-verify, lanjut
4. **Return**: HANYA `STATUS: PASS/FAIL` + error lines jika FAIL

---

## CONTOH PROMPT LENGKAP

```
claude -p "$(cat <<'EOF'
# CLAUDE CODE PROMPT — Fase 3: Auth Middleware (GitHub OAuth)

## 1. TARGET GOAL & CONTEXT
- Auth via GitHub OAuth v2 (PKCE tidak perlu, App Password flow)
- Session storage in KV, signed with HMAC-SHA256
- Protected: all /api/* routes; Public: /api/auth/*
- Referensi: PRD.md (US-02), ARCHITECTURE.md (security section), CLAUDE.md

## 2. FILE BOUNDARIES
CREATE: functions/_middleware.ts, functions/api/auth/login.ts, functions/api/auth/callback.ts, functions/api/auth/logout.ts, src/lib/server/auth.ts, .dev.vars
UPDATE: package.json (add wrangler dev script)

## 3. SPECIFIC RULES
- TypeScript STRICT: no any, noUncheckedIndexedAccess
- Zod validation untuk callback params
- Session: crypto-signed (HMAC-SHA256), 24h expiry, stored in KV
- Cookie: httpOnly, secure (prod), sameSite=strict, path=/
- GitHub OAuth v2 flow: login redirect → callback → user fetch → session create

## 4. VERIFICATION
npm install -g wrangler
npx wrangler pages dev . --port 8787 --compatibility-date=2024-01-01 &
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/workspaces  # expect 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/auth/login  # expect 302
kill %1

OUTPUT: STATUS: PASS/FAIL + error lines jika FAIL

## TASKS
3.1: Write src/lib/server/auth.ts (session sign/verify, KV helpers, cookie utils)
3.2: Write functions/api/auth/login.ts (redirect to GitHub OAuth)
3.3: Write functions/api/auth/callback.ts (exchange code, fetch user, create session)
3.4: Write functions/api/auth/logout.ts (clear session + cookie)
3.5: Write functions/_middleware.ts (auth guard for /api/* except /api/auth/*)
3.6: Update .dev.vars + package.json (wrangler dev)
3.7: Run verification: wrangler pages dev → curl tests

EKSEKUSI BERURUTAN. FIX ERROR SEBELUM LANJUT.
EOF
)" --dangerously-skip-permissions
```

---

**FILE SIAP DIEKSEKUSI.** Jalanin via:
```bash
cd D:/PROJECT/content_generator
claude -p "$(cat PHASE3_PROMPT.md)" --dangerously-skip-permissions
```