// src/lib/server/db/types.d.ts
// Cloudflare Workers runtime types (D1, KV, R2, DO)
// Ambient declarations for local TypeScript checking

declare type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<{
    success: boolean;
    meta: unknown;
    results: T | null;
    params: Record<string, unknown>;
    summary: unknown;
  }>;
  all<T = unknown>(): Promise<{
    success: boolean;
    results: T[];
    params: Record<string, unknown>;
    summary: unknown;
  }>;
  raw<T = unknown>(): Promise<T[]>;
};

declare type D1Database = {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
};

declare type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<boolean>;
};

declare type R2Bucket = {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: string): Promise<unknown>;
  delete(key: string): Promise<unknown | null>;
  list(options?: unknown): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
};

declare type DurableObjectNamespace = {
  idFromName(name: string): unknown;
  newUniqueId(): unknown;
  get(id: unknown): unknown;
};

// Env interface (global ambient)
interface Env {
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

// ExecutionContext (global ambient)
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}

// PagesFunction type (global ambient)
type PagesFunction<T = unknown> = (context: {
  request: Request;
  env: T;
  params?: Record<string, string>;
  next: (request?: Request) => Promise<Response>;
}) => Promise<Response>;
