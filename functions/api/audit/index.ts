import type { Env } from '../../../src/env';
import { listAuditLogs } from '../../../src/lib/server/audit';
import { validateSession } from '../../../src/lib/server/auth';

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  const workspaceId = sessionResult.user.workspace_id;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? undefined;
  const since = url.searchParams.get('since') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const logs = await listAuditLogs(env.DB, workspaceId, {
    action,
    since,
    limit,
  });

  return new Response(JSON.stringify(logs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
