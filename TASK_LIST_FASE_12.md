# TASK_LIST — Fase 12: Dashboard Root + Global Navigation

**Tanggal dibuat**: 2026-08-27
**Alasan**: Inkonsistensi antara PRD (dashboard di root) vs implementasi (root static, `/sites` manual); tidak ada navigasi antar halaman

---

## Fase 12 — Dashboard Root + Global Navigation

**Input:**
- Fase 5.4b: Sites UI (`/sites` + `SitesManager.tsx`) ✅
- Fase 7: Calendar (`/calendar` + `CalendarGrid.tsx`) ✅
- Fase 10.3-10.4: Publish Queue (`/publish-queue` + `PublishQueueTable.tsx`) ✅
- Fase 9.5: OAuth callback redirect ke `/sites` ✅
- PRD Epic 3 US-07: Content Calendar visual
- ARCHITECTURE.md: Dashboard = entry point setelah login

**Output:**
- Root `/` = Dashboard utama dengan stats + today's schedule + quick actions
- Global navigation component (`Navigation.tsx`) di semua authed pages
- OAuth callback redirect ke `/` (bukan `/sites`)
- User flow konsisten: Login → Dashboard → Sites/Calendar/Queue via nav

**Scope Boundaries:**
- Fase ini TIDAK membuat fitur "New Article" (akan di fase 13)
- Stats API endpoint (`/api/dashboard/stats`) akan dibuat minimal (mock dulu, real nanti)
- Navigation mobile responsive tapi tidak perlu hamburger menu animasi kompleks

---

## 12.1 — Root Dashboard Page (`src/pages/index.astro`)

**Files:**
- `src/pages/index.astro` (replace existing static placeholder)

**Tasks:**
1. Hapus `export const prerender = true;`
2. Server-side session check:
   ```typescript
   const cookieHeader = Astro.request.headers.get('Cookie');
   const token = getSessionFromCookie(cookieHeader);
   if (!token) {
     return Astro.redirect('/api/auth/login');
   }
   ```
3. Layout structure:
   ```astro
   <Layout title="Dashboard">
     <Navigation client:load workspaceId={session.workspace_id} />
     <main class="container mx-auto px-6 py-8">
       <DashboardStats client:load />
       <TodaySchedule client:load />
       <QuickActions />
     </main>
   </Layout>
   ```

**Acceptance Criteria:**
- [ ] Unauthenticated user → redirect `/api/auth/login`
- [ ] Authenticated user → render dashboard layout
- [ ] `npx tsc --noEmit` clean
- [ ] No hydration errors in browser console

**Verification:**
```bash
curl -I https://apps.codevx.web.id/ 2>&1 | grep -E "HTTP|Location"
# Expected: HTTP 302 → /api/auth/login (jika tidak ada cookie)
# atau HTTP 200 (jika ada valid session cookie)
```

---

## 12.2 — Dashboard Stats Component (`src/components/DashboardStats.tsx`)

**Files:**
- `src/components/DashboardStats.tsx` (new)
- `functions/api/dashboard/stats.ts` (new API endpoint)

**Tasks:**
1. API endpoint `/api/dashboard/stats`:
   - Input: workspace_id dari session
   - Query D1:
     - Total articles last 7 days
     - Scheduled today (status='scheduled', DATE(scheduled_for) = DATE('now'))
     - Failed publishes (publish_queue.status='failed')
     - AI cost MTD (usage_stats, SUM estimated_cost_usd WHERE recordedAt >= start of month)
   - Output JSON:
     ```typescript
     {
       articles_7d: { total: 15, change_pct: +20 },
       scheduled_today: 3,
       failed_publishes: 1,
       cost_mtd: 2.45
     }
     ```

2. React component:
   - Fetch `/api/dashboard/stats` on mount
   - Grid 4 kolom (responsive: 1 col mobile, 2 col tablet, 4 col desktop)
   - Card per stat: icon + number + label + trend badge
   - Loading skeleton
   - Error state: "Failed to load stats"

**Acceptance Criteria:**
- [ ] API returns valid JSON untuk workspace yang ada artikel
- [ ] API returns zeros untuk workspace baru (empty state)
- [ ] Component renders 4 stat cards
- [ ] Failed state ditampilkan jika fetch error
- [ ] Biome + TSC clean

**Verification:**
```bash
curl -H "Cookie: cg_session=VALID_TOKEN" https://apps.codevx.web.id/api/dashboard/stats | jq .
npx biome check src/components/DashboardStats.tsx
npx tsc --noEmit
```

---

## 12.3 — Today's Schedule Component (`src/components/TodaySchedule.tsx`)

**Files:**
- `src/components/TodaySchedule.tsx` (new)

**Tasks:**
1. Fetch `/api/calendar/slots?date=today&workspace_id=X` (reuse existing endpoint)
2. Compact table:
   - Kolom: Time | Site | Article | Status | Actions
   - Max 10 rows, link "View Full Calendar" jika > 10
3. Actions: [Edit] (disabled for MVP), [Reschedule] (disabled for MVP)
4. Empty state: "No articles scheduled today. [View Calendar]"

**Acceptance Criteria:**
- [ ] Fetch slots untuk hari ini (timezone dari workspace)
- [ ] Render max 10 slots, sorted by slot_datetime ASC
- [ ] Link ke `/calendar` jika ada lebih dari 10
- [ ] Empty state ditampilkan jika tidak ada slots
- [ ] Biome + TSC clean

**Verification:**
```bash
# Assume workspace dengan scheduled articles hari ini
curl https://apps.codevx.web.id/api/calendar/slots?date=2026-08-27&workspace_id=ws_123 | jq '.slots | length'
```

---

## 12.4 — Global Navigation Component (`src/components/Navigation.tsx`)

**Files:**
- `src/components/Navigation.tsx` (new)

**Tasks:**
1. Nav structure:
   ```tsx
   <nav className="bg-slate-900 border-b border-slate-800">
     <div className="container mx-auto px-6 py-4 flex justify-between items-center">
       <div className="flex items-center gap-8">
         <Logo />
         <NavLinks active={currentPath} />
       </div>
       <UserMenu workspaceId={workspaceId} />
     </div>
   </nav>
   ```

2. NavLinks: Dashboard | Sites | Calendar | Queue
   - Active state: `text-cyan-400 border-b-2 border-cyan-400`
   - Inactive: `text-slate-400 hover:text-slate-100`
   - Detect active via `window.location.pathname` (client-side)

3. UserMenu:
   - Avatar placeholder (first letter of username)
   - Dropdown: Workspace ID (read-only for MVP) | Logout
   - Logout button → POST `/api/auth/logout`

**Acceptance Criteria:**
- [ ] Nav bar fixed/sticky top
- [ ] Active link highlighted berdasarkan current route
- [ ] Logout button clears session + redirect `/api/auth/login`
- [ ] Responsive: min-width 320px, max-width 1280px container
- [ ] Biome + TSC clean

**Verification:**
```bash
# Visual test: klik setiap nav link, cek active state
# Logout test:
curl -X POST -H "Cookie: cg_session=TOKEN" https://apps.codevx.web.id/api/auth/logout -I | grep "Set-Cookie"
# Expected: Set-Cookie: cg_session=; Max-Age=0
```

---

## 12.5 — Wire Navigation to Existing Pages

**Files:**
- `src/layouts/Layout.astro` (modify)
- `src/pages/sites.astro` (modify)
- `src/pages/calendar.astro` (modify)
- `src/pages/publish-queue.astro` (modify)

**Tasks:**
1. Layout.astro:
   - Add prop `showNav?: boolean = false`
   - Conditional render Navigation:
     ```astro
     {showNav && <Navigation client:load workspaceId={workspaceId} />}
     ```

2. Update pages:
   - `sites.astro`: `<Layout showNav={true} workspaceId={session.workspace_id}>`
   - `calendar.astro`: same
   - `publish-queue.astro`: same
   - `index.astro` (dashboard): same

3. Remove duplicate headers/titles dari page content (sudah ada di nav)

**Acceptance Criteria:**
- [ ] Navigation tampil di `/`, `/sites`, `/calendar`, `/publish-queue`
- [ ] Navigation TIDAK tampil di `/api/auth/login` (no layout)
- [ ] Active state berubah saat navigasi antar halaman
- [ ] No layout shift/flash saat page load
- [ ] Biome + TSC clean

**Verification:**
```bash
npm run build
# Expected: no hydration warnings, no TS errors
npx tsc --noEmit
npx biome check src/
```

---

## 12.6 — OAuth Callback Redirect Consistency

**Files:**
- `functions/api/auth/callback.ts` (modify line 210)

**Tasks:**
1. Change redirect dari `/sites` ke `/`:
   ```diff
   - Location: `${url.origin}/sites`,
   + Location: `${url.origin}/`,
   ```

**Acceptance Criteria:**
- [ ] OAuth callback success → redirect root `/`
- [ ] Root dashboard load dengan session valid
- [ ] User bisa navigasi ke Sites via nav bar

**Verification:**
```bash
# Manual OAuth test: login via GitHub, verify redirect ke /
# Check browser Network tab: callback 302 → Location: /
```

---

## 12.7 — End-to-End Navigation Flow Test

**Manual Test Checklist:**
- [ ] **Login flow**: `/` → redirect login → GitHub OAuth → callback → dashboard `/`
- [ ] **Dashboard**: Stats cards load, today schedule load, quick action buttons visible
- [ ] **Nav to Sites**: klik "Sites" nav → `/sites` page load, nav highlight "Sites"
- [ ] **Nav to Calendar**: klik "Calendar" → `/calendar` load, nav highlight "Calendar"
- [ ] **Nav to Queue**: klik "Queue" → `/publish-queue` load, nav highlight "Queue"
- [ ] **Nav to Dashboard**: klik "Dashboard" → `/` load, nav highlight "Dashboard"
- [ ] **Logout**: klik logout → session cleared, redirect `/api/auth/login`
- [ ] **Direct URL access**: paste `/calendar` tanpa session → redirect login

**Verification:**
```bash
# Build production bundle
npm run build

# Local preview
npx wrangler pages dev dist --kv KV --d1 DB

# Deploy ke staging
wrangler pages deploy dist --project-name=content-generator
```

---

## Summary

**Total Tasks**: 7 subtasks (12.1 - 12.7)

**Dependencies:**
- Fase 5.4b (Sites UI) ✅
- Fase 7 (Calendar) ✅
- Fase 10.3-10.4 (Publish Queue) ✅

**Post-Fase 12 State:**
- Root `/` = functional dashboard (bukan static placeholder)
- Semua pages terhubung via global nav
- OAuth redirect consistency (callback → root)
- User experience sesuai PRD: Login → Dashboard → Navigate

**Next Fase (13):**
- Article generation UI (outline → review → full article)
- New Article flow dari dashboard quick action
