// src/lib/server/audit.ts
// Audit log operations for tracking workspace/site/article actions

export interface AuditEntry {
  workspaceId?: string;
  siteId?: string;
  articleId?: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogRow {
  id: number;
  workspace_id: string | null;
  site_id: string | null;
  article_id: string | null;
  action: string;
  actor: string;
  details_json: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  action?: string;
  since?: string;
  limit?: number;
}

/**
 * Insert audit entry. Never throws — audit failure must not kill operations.
 */
export async function logAudit(db: D1Database, entry: AuditEntry): Promise<void> {
  try {
    const stmt = db
      .prepare(
        `INSERT INTO audit_log (workspace_id, site_id, article_id, action, actor, details_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.workspaceId ?? null,
        entry.siteId ?? null,
        entry.articleId ?? null,
        entry.action,
        entry.actor ?? 'system',
        entry.details ? JSON.stringify(entry.details) : null,
      );
    await stmt.run();
  } catch {
    // Audit failure silent — no throw
  }
}

/**
 * List audit logs for workspace. Filter by action, since timestamp. Max 200 rows.
 */
export async function listAuditLogs(
  db: D1Database,
  workspaceId: string,
  filters?: AuditLogFilters,
): Promise<AuditLogRow[]> {
  let query = 'SELECT * FROM audit_log WHERE workspace_id = ?';
  const params: unknown[] = [workspaceId];

  if (filters?.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }

  if (filters?.since) {
    query += ' AND created_at >= ?';
    params.push(filters.since);
  }

  query += ' ORDER BY id DESC LIMIT ?';
  const limit = Math.min(filters?.limit ?? 50, 200);
  params.push(limit);

  const stmt = db.prepare(query).bind(...params);
  const result = await stmt.all<AuditLogRow>();
  return result.results ?? [];
}
