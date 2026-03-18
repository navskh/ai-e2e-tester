import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return {
      success: true,
      data: {
        status: 'ok',
        uptime: Date.now() - startTime,
        version: '0.1.0',
      },
    };
  });
}
