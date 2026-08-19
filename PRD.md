# Product Requirement Document (PRD) - AI Auto Content Generator

## 1. Ringkasan Eksekutif & Visi

**Nama Proyek**: AI Auto Content Generator (Internal Tool)
**Tujuan**: Aplikasi web mandiri untuk mengelola jaringan situs pribadi (WordPress, Blogger, Astro/static) — generate konten AI berkualitas, jadwalkan, dan publish otomatis ke multi-CMS.
**Masalah yang Diselesaikan**:
- Manual writing + copy-paste ke tiap CMS = lambat, error-prone, tidak konsisten
- Tidak ada single source of truth untuk content calendar across sites
- Brand voice hilang saat pakai AI generic
- Tidak ada visibility cross-site internal linking opportunities
- Cost AI tidak terkendali, tidak ada routing model berbasis kualitas/harga

**Target User**: Solo developer/owner yang mengelola 5-50 situs niche (affiliate, ads, lead gen)
**Scope**: Internal tool only — no multi-tenant SaaS, no public signup

---

## 2. User Stories & Acceptance Criteria

### Epic 1: Workspace & Site Management

**US-01**: Sebagai owner, saya ingin membuat **Workspace** untuk mengelompokkan situs by brand/niche agar terisolasi.
- [ ] AC-01: Bisa create workspace dengan nama, deskripsi, default language (ID/EN)
- [ ] AC-02: Workspace punya settings terpisah: AI model defaults, tone presets, publishing timezone
- [ ] AC-03: Row-level isolation — data workspace A tidak bocor ke workspace B

**US-02**: Sebagai owner, saya ingin **menghubungkan situs** (WordPress, Blogger, Astro/Git) ke workspace.
- [ ] AC-01: WordPress — input URL, username, app password; test connection & list categories/tags
- [ ] AC-02: Blogger — OAuth2 flow; pilih blog ID; list labels
- [ ] AC-03: Astro/Git — GitHub App install; pilih repo, branch, content path (src/content/posts); test commit
- [ ] AC-04: Generic Webhook — URL + secret; custom payload mapping
- [ ] AC-05: Setiap site punya config terpisah: default category, author, featured image handling, canonical URL pattern

### Epic 2: AI Content Generation

**US-03**: Sebagai owner, saya ingin **generate artikel** dari topik/keyword dengan pipeline Outline → Review → Full Article.
- [ ] AC-01: Input: topik/keyword, niche, target words, intent (informational/commercial/transactional), tone preset
- [ ] AC-02: Step 1 — Generate outline (H2/H3 structure, key points per section, suggested FAQ)
- [ ] AC-03: Step 2 — Edit outline inline (drag-drop reorder, add/remove sections, edit points)
- [ ] AC-04: Step 3 — Generate full article per section (streaming), dengan accept/reject/regenerate per section
- [ ] AC-05: Output: markdown dengan frontmatter (title, description, tags, categories, date, canonical, og:image)

**US-04**: Sebagai owner, saya ingin **Style DNA** — AI belajar brand voice dari existing content site.
- [ ] AC-01: Trigger "Analyze Site" — crawl 50-200 existing posts (via REST API / Git / sitemap)
- [ ] AC-02: Extract: avg sentence length, vocabulary diversity, transition phrases, heading depth, CTA patterns, formatting quirks
- [ ] AC-03: Generate few-shot examples (3-5 paragraphs) yang representatif
- [ ] AC-04: Auto-inject ke prompt sebagai few-shot untuk semua generasi di site tersebut
- [ ] AC-05: Re-analyze button untuk refresh saat style berubah

**US-05**: Sebagai owner, saya ingin **multi-model routing** otomatis berdasarkan kompleksitas & cost.
- [ ] AC-01: Define model tiers: cheap (haiku/3.5-sonnet), balanced (sonnet), premium (opus/claude-4)
- [ ] AC-02: Auto-route: listicle/how-to → cheap; expert review/technical deep-dive → premium
- [ ] AC-03: Manual override per article
- [ ] AC-04: Track cost per article, per site, per model; monthly report

**US-06**: Sebagai owner, saya ingin **Content Opportunity Radar** — auto-suggest topic dari trends + calendar.
- [ ] AC-01: Input: niche keywords, target geo (ID/US/Global)
- [ ] AC-02: Fetch Google Trends (free/RSS) + holiday/events calendar
- [ ] AC-03: Output: ranked opportunities — keyword, trend score, search intent, suggested angle, outline preview
- [ ] AC-04: One-click "Queue 5 articles" → masuk generation queue dengan schedule otomatis

### Epic 3: Content Management & Calendar

**US-07**: Sebagai owner, saya ingin **Content Calendar** visual drag-drop per site.
- [ ] AC-01: View: monthly/weekly per site; filter by status (draft, queued, scheduled, published, failed)
- [ ] AC-02: Drag article ke slot tanggal/jam → auto-set publish datetime
- [ ] AC-03: Recurring slots: "Setiap Senin 07:00", "Tanggal 1 & 15"
- [ ] AC-04: Bulk actions: reschedule, duplicate to other site, delete

**US-08**: Sebagai owner, saya ingin **Version History & Diff** per artikel.
- [ ] AC-01: Simpan snapshot setiap save/generate/regenerate
- [ ] AC-02: Visual diff (side-by-side, inline) antar versi
- [ ] AC-03: Restore ke versi sebelumnya satu klik

**US-09**: Sebagai owner, saya ingin **Media Management** terintegrasi.
- [ ] AC-01: AI image gen (Pollinations/FLUX) dari prompt di editor
- [ ] AC-02: Auto alt text, compress (WebP, max 1200px), upload ke R2/Cloudflare Images
- [ ] AC-03: Insert ke markdown dengan syntax `![alt](url)` + frontmatter `og:image`

### Epic 4: Publishing & Integration

**US-10**: Sebagai owner, saya ingin **Publish ke WordPress** reliable.
- [ ] AC-01: Create/update post via REST API v2 (auth: App Password)
- [ ] AC-02: Support: categories, tags, featured image (upload media), Yoast/RankMath meta fields
- [ ] AC-03: Schedule publish (WP native future date) atau immediate
- [ ] AC-04: Post-publish verify: fetch URL, check status 200, canonical match, indexable
- [ ] AC-05: Retry logic: exponential backoff max 3x; dead-letter queue untuk manual review

**US-11**: Sebagai owner, saya ingin **Publish ke Blogger** reliable.
- [ ] AC-01: OAuth2 token refresh otomatis
- [ ] AC-02: Create/update post via Blogger API v3; labels, schedule
- [ ] AC-03: Image upload via Blogger media API (atau host di R2 + inject URL)
- [ ] AC-04: Post-publish verify sama WP

**US-12**: Sebagai owner, saya ingin **Publish ke Astro/Static via Git**.
- [ ] AC-01: Generate `.md/.mdx` file dengan frontmatter lengkap ke `src/content/posts/{slug}.md`
- [ ] AC-02: Commit + push via GitHub App (scoped token, no PAT di UI)
- [ ] AC-03: Trigger GitHub Actions deploy (detect workflow file atau generic `deploy.yml`)
- [ ] AC-04: Wait for deploy success (poll Actions API) → mark published dengan live URL

**US-13**: Sebagai owner, saya ingin **Publish Queue & Monitoring** terpusat.
- [ ] AC-01: Dashboard: pending, processing, success, failed (last 24h/7d/30d)
- [ ] AC-02: Failed items — show error, retry button, view payload
- [ ] AC-03: Drift detection: re-fetch published content daily → diff vs source → alert + auto-repair queue

### Epic 5: Quality & Safety

**US-14**: Sebagai owner, saya ingin **Quality Gates** sebelum publish.
- [ ] AC-01: Plagiarism check (Copyleaks free tier / local fingerprint) — threshold configurable
- [ ] AC-02: AI detection score (GPTZero / HeuristicAIDetector) — warning only, not block
- [ ] AC-03: Readability metrics (Flesch-Kincaid ID/EN) — target score per niche
- [ ] AC-04: Fact-check assist: highlight claims → "Verify" button → search DuckDuckGo/SerpAPI → attach source
- [ ] AC-05: Brand safety: blocked terms list per site; auto-flag atau auto-replace

**US-15**: Sebagai owner, saya ingin **Legal/Compliance Pack** auto-inject.
- [ ] AC-01: Detect affiliate links → inject FTC disclosure (configurable position/template)
- [ ] AC-02: Detect health/medical terms → inject medical disclaimer
- [ ] AC-03: Detect EU traffic (via Cloudflare geo) → inject GDPR notice
- [ ] AC-04: ID jurisdiction: UU ITE, PPN disclaimer templates

### Epic 6: Analytics & Observability

**US-16**: Sebagai owner, saya ingin **Usage Dashboard**.
- [ ] AC-01: Tokens used, estimated cost (per model pricing table), articles generated
- [ ] AC-02: Per site: articles published, success rate, avg time to publish
- [ ] AC-03: Editor acceptance rate per section type (intro, H2, FAQ, conclusion)
- [ ] AC-04: Cost per published article trend

**US-17**: Sebagai owner, saya ingin **Audit Log** lengkap.
- [ ] AC-01: Log: generate, edit, schedule, publish, retry, verify, drift-detect
- [ ] AC-02: Filter by: workspace, site, user (future), date range, action type
- [ ] AC-03: Export CSV/JSON

---

## 3. Persyaratan Non-Fungsional

| Kategori | Requirement |
|----------|-------------|
| **Performa** | Generate outline < 10s; full article (2000 words) < 60s streaming; UI response < 200ms |
| **Skalabilitas** | Support 50 sites, 500 articles/bulan, 10 concurrent generations |
| **Keamanan** | Secrets encrypted at rest (Cloudflare KV secrets); OAuth tokens auto-refresh; no secrets in client |
| **Reliabilitas** | Publish success rate > 99%; queue durability (Durable Objects); exactly-once semantics |
| **Biaya** | Run di Cloudflare Free Tier (Workers, Pages, D1, KV, R2); AI via 9Router/OpenRouter (BYOK) |
| **Offline-first** | Editor works offline (IndexedDB cache); sync when online |
| **Aksesibilitas** | WCAG 2.1 AA; keyboard navigation; screen reader support |

---

## 4. Out of Scope (v1.0)

- Multi-user collaboration / roles / permissions
- Public API / webhooks untuk external integration
- White-label / embedding di client sites
- Advanced SEO: keyword research, SERP tracking, backlink analysis
- Social media auto-post (Twitter, LinkedIn, FB)
- Video/audio content generation
- E-commerce product description specialization
- Team workflow: assignment, review approval chain
- Mobile app (PWA acceptable)