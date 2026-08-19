// src/lib/server/db/types.d.ts
// Minimal type declarations for Cloudflare Workers runtime types
// These are available globally in Workers/D1 runtime context
// but not available during local TypeScript checking without @cloudflare/workers-types

// D1 Database types
declare type D1Database = {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
};

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

// KV Namespace
declare type KVNamespace = {
  get(key: string): Promise<string | null>;
  getWithMetadata<T = unknown>(
    key: string,
  ): Promise<{ value: string | null; metadata: T | null; cacheStatus: string }>;
  put(
    key: string,
    value: string | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; cf?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: { prefix?: string; limit?: number; reverse?: boolean; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cacheStatus: string;
    cursor: string;
  }>;
};

// R2 Bucket
declare type R2Bucket = {
  get(key: string, options?: unknown): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: unknown,
  ): Promise<R2Object>;
  delete(key: string): Promise<R2Object | null>;
  list(options?: unknown): Promise<{ objects: R2Object[]; truncated: boolean; cursor: string }>;
  head(key: string): Promise<R2Object | null>;
};

declare type R2Object = {
  key: string;
  etag: string;
  version: string;
  size: number;
  etagMismatch: boolean;
  httpEtag: string;
  httpLastModified: string;
  httpContentLength: number;
  httpContentRange: string;
  uploaded: string;
  httpMetadata: unknown;
  customMetadata: Record<string, string>;
  storageClass: string;
  checksums: Record<string, string>;
};

declare type R2ObjectBody = R2Object & {
  body: ReadableStream;
};

// Durable Object
declare type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  idFromAny(indexedId: string, id: string): DurableObjectId;
  newUniqueId(requestId?: string): DurableObjectId;
  waitingRoom: boolean;
  get(id: DurableObjectId): DurableObjectStub;
};

declare type DurableObjectId = {
  toString(): string;
  name: string;
};

declare type DurableObjectStub = {
  fetch(request: Request): Promise<Response>;
};

// Env interface
declare interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  QUEUE: DurableObjectNamespace;
  NINE_ROUTER_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
