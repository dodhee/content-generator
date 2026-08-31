// src/lib/server/db/env.d.ts
// Environment type declarations for Cloudflare Pages Functions
// This provides type shims for Cloudflare runtime APIs

// Re-export Env type for use in Pages Functions
export interface Env {
  // D1 Database
  DB: D1Database;
  // KV Namespace (secrets + cache)
  KV: KVNamespace;
  // R2 Bucket (media assets, exports)
  R2: R2Bucket;
  // Durable Object (generation/publish queue)
  QUEUE: DurableObjectNamespace;
  // AI model configs (set via Pages Dashboard → Settings → Variables)
  NINE_ROUTER_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  // OAuth (set via Pages Dashboard → Settings → Secrets)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Google OAuth2 (Blogger) — set via Pages Dashboard → Settings → Secrets
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
