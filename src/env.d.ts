// src/env.d.ts
// Cloudflare Workers type imports for local dev
// This file provides type declarations for the Cloudflare runtime globals

/// <reference path="./lib/server/db/types.d.ts" />

interface ImportMetaEnv {
  readonly NINE_ROUTER_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly GITHUB_CLIENT_ID?: string;
  readonly GITHUB_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
