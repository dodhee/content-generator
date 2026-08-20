// src/env.d.ts
// Environment type declarations for Cloudflare Pages Functions

/// <reference path="./lib/server/db/types.d.ts" />

// Re-export Env for runtime use in functions
export type { Env };

// ExecutionContext re-export
export type { ExecutionContext };
