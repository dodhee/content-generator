// GET /api/health
export function onRequest(_context: { request: Request; env: Env }): Response {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
