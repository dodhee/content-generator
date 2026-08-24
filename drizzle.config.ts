import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:local.db',
  },
});
