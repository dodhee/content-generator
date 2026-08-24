import type { AnyD1Database, DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

export function getDb(env: { DB: AnyD1Database }): DrizzleD1Database<typeof schema> {
  return drizzle(env.DB, { schema });
}
