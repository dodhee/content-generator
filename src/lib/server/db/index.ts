// src/lib/server/db/index.ts
// D1 database connection + typed query helpers

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Connection factory
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

// Env type (imports global D1Database, KVNamespace from types.d.ts)
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  QUEUE: DurableObjectNamespace;
  NINE_ROUTER_API_KEY?: string;
  NINE_ROUTER_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
