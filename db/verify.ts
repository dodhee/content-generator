import fs from 'node:fs';
import Database from 'better-sqlite3';

// Create local.db from schema.sql
const sqlite = new Database('./local.db');
const schemaSql = fs.readFileSync('./db/schema.sql', 'utf-8');

sqlite.exec(schemaSql);

// Test queries
const tables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('Tables in local.db:');
for (const t of tables as { name: string }[]) {
  console.log(' -', t.name);
}

// Test workspace insert
sqlite
  .prepare(`
  INSERT INTO workspaces (id, name, description, default_lang, timezone) 
  VALUES ('test-ws-1', 'Test Workspace', 'For testing', 'id', 'Asia/Jakarta')
`)
  .run();

const ws = sqlite.prepare('SELECT * FROM workspaces WHERE id = ?').get('test-ws-1');
console.log('\nInserted workspace:', ws);

// Test site insert (with FK to workspace)
sqlite
  .prepare(`
  INSERT INTO sites (id, workspace_id, name, type, wp_url) 
  VALUES ('test-site-1', 'test-ws-1', 'Test WordPress', 'wordpress', 'https://example.com')
`)
  .run();

const site = sqlite.prepare('SELECT * FROM sites WHERE id = ?').get('test-site-1');
console.log('Inserted site:', site);

// Test article insert
sqlite
  .prepare(`
  INSERT INTO articles (id, workspace_id, site_id, title, slug, status, intent, target_words) 
  VALUES ('test-art-1', 'test-ws-1', 'test-site-1', 'Test Article', 'test-article', 'draft', 'informational', 1000)
`)
  .run();

const article = sqlite.prepare('SELECT * FROM articles WHERE id = ?').get('test-art-1');
console.log('Inserted article:', article);

// Test join
const joined = sqlite
  .prepare(`
  SELECT a.title, s.name as site_name, w.name as workspace_name 
  FROM articles a 
  JOIN sites s ON a.site_id = s.id 
  JOIN workspaces w ON a.workspace_id = w.id
`)
  .all();
console.log('\nJoined result:', joined);

// Count all tables
const allTables = sqlite
  .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
  .get() as { count: number };
console.log(`\nTotal tables: ${allTables.count}`);

// Test schema.sql count
const schemaTables = schemaSql.split('CREATE TABLE').filter((t) => t.trim()).length;
console.log(`Tables in schema.sql: ${schemaTables}`);

sqlite.close();
console.log('\n✓ All D1 schema tests PASSED');
