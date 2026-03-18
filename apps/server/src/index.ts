import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { healthRoutes } from './routes/api/health.js';
import { testRoutes } from './routes/api/tests.js';
import { docsRoutes } from './routes/api/docs.js';
import { wsRoutes } from './routes/ws/handler.js';
import { internalPwRoutes } from './routes/internal/pw.js';
import { browserManager } from './services/browser-manager.js';
import { initDb } from './db/init.js';

async function main() {
  // Ensure data directories exist
  mkdirSync(config.screenshotsDir, { recursive: true });

  // Initialize database
  initDb();

  const app = Fastify({
    logger: false, // We use pino directly
  });

  // Plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  await app.register(fastifyStatic, {
    root: resolve(config.screenshotsDir),
    prefix: '/api/screenshots/',
    decorateReply: false,
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(testRoutes);
  await app.register(docsRoutes);
  await app.register(wsRoutes);
  await app.register(internalPwRoutes);

  // Serve frontend static files in production (after API routes)
  const publicDir = resolve('./public');
  if (existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      decorateReply: false,
      wildcard: true,
      index: false,
    });

    // Serve index.html for root
    app.get('/', (_request, reply) => {
      const html = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
      reply.type('text/html').send(html);
    });

    // SPA fallback: serve index.html for non-API, non-asset routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/ws') || request.url.startsWith('/internal/') || request.url.startsWith('/docs')) {
        reply.status(404).send({ success: false, error: 'Not found' });
      } else {
        const indexPath = resolve(publicDir, 'index.html');
        const html = readFileSync(indexPath, 'utf-8');
        reply.type('text/html').send(html);
      }
    });
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await browserManager.closeAll();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start
  await app.listen({ port: config.port, host: config.host });
  logger.info(`Server running at http://localhost:${config.port}`);
  logger.info(`WebSocket available at ws://localhost:${config.port}/ws`);
  logger.info(`Health check: http://localhost:${config.port}/api/health`);
  logger.info(`API Docs: http://localhost:${config.port}/docs`);
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
