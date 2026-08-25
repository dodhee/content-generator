export { Queue } from '../functions/durable/queue_DO';

/**
 * Minimal default export — Worker ini hanya host class Queue (Durable Object).
 * Tidak melayani request HTTP; fetch handler bisa return 404.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('Queue DO Worker — no http route', { status: 404 });
  },
};
