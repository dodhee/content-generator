// src/lib/server/db/types.ts
// Cloudflare Workers type imports
// For local dev, we use the global types.d.ts declarations
// In production, these types are provided by the Cloudflare runtime

// Type re-exports for convenience
export type D1Database = typeof globalThis extends { DB: infer T } ? T : never;
export type KVNamespace = typeof globalThis extends { KV: infer T } ? T : never;
export type R2Bucket = typeof globalThis extends { R2: infer T } ? T : never;
export type DurableObjectNamespace = typeof globalThis extends { QUEUE: infer T } ? T : never;

// Env type for Pages Functions (uses Cloudflare global types)
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  QUEUE: DurableObjectNamespace;
  // AI model configs (set via Pages Dashboard → Settings → Variables)
  NINE_ROUTER_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  // OAuth (set via Pages Dashboard → Settings → Secrets)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
