// src/lib/server/db/index.ts
// D1 database connection + typed query helpers

// Use Cloudflare's global types (available in Worker/DO runtime context)
// This file should only be imported server-side inside Pages Functions

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Connection factory (for Pages Functions)
// Returns a typed Drizzle database instance
export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema });
}

// Type re-exports
export type {
  Workspace,
  Site,
  Article,
  NewWorkspace,
  NewSite,
  NewArticle,
} from './schema';

// Env type for Pages Functions (uses Cloudflare global types)
// D1Database, KVNamespace, R2Bucket, DurableObjectNamespace
// are global types available in the Cloudflare Workers runtime
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
