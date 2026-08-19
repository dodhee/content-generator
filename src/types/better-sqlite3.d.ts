// TypeScript declarations for 'better-sqlite3'
declare module 'better-sqlite3' {
  export default class Database {
    constructor(path: string, options?: { verbose?: (sql: string) => void });
    exec(sql: string): this;
    prepare(sql: string): PreparedStatement;
    close(): void;
    pragma(schema: string): unknown;
  }

  export interface PreparedStatement {
    bind(...values: unknown[]): this;
    get(...values: unknown[]): unknown;
    all(...values: unknown[]): unknown[];
    run(...values: unknown[]): { changes: number; lastInsertRowid: number };
    maps: Map<unknown, unknown>;
    iterate(...values: unknown[]): AsyncGenerator<unknown>;
  }
}
