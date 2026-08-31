// functions/api/opportunity/radar.ts
// GET /api/opportunity/radar — scan trends + holidays for content opportunities

import type { Env } from '../../../src/env';
import { validateSession } from '../../../src/lib/server/auth';
import { scanOpportunities } from '../../../src/lib/server/opportunity/radar';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  const url = new URL(request.url);
  const niche = url.searchParams.get('niche') || 'general';
  const geo = url.searchParams.get('geo') || 'Global';

  try {
    const result = await scanOpportunities(env, niche, geo);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
