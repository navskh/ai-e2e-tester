import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import type { ClientMessage, StructuredTestRequest } from '@ai-e2e/shared';
import { sessionStore } from '../../services/session-store.js';
import { testOrchestrator } from '../../services/test-orchestrator.js';
import { logger } from '../../utils/logger.js';

export async function wsRoutes(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, _request) => {
    const sessionId = nanoid();
    sessionStore.add(sessionId, socket);

    logger.info({ sessionId }, 'WebSocket connected');

    socket.on('message', async (raw: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(raw.toString());

        switch (message.type) {
          case 'test:start': {
            const wsOptions = { ...message.options, setup: message.setup };
            const testRunId = await testOrchestrator.startFromWs(
              sessionId,
              message.prompt,
              wsOptions,
            );
            sessionStore.setTestRunId(sessionId, testRunId);
            break;
          }
          case 'test:start:structured': {
            const structuredRequest: StructuredTestRequest = {
              targetUrl: message.targetUrl,
              scenario: message.scenario,
              setup: message.setup,
              actions: message.actions,
              assertions: message.assertions,
              options: message.options,
            };
            const testRunId = await testOrchestrator.startFromWs(
              sessionId,
              structuredRequest.scenario,
              undefined,
              structuredRequest,
            );
            sessionStore.setTestRunId(sessionId, testRunId);
            break;
          }
          case 'test:cancel': {
            await testOrchestrator.cancelTest(message.testRunId);
            break;
          }
          case 'clarification:response': {
            sessionStore.resolveClarification(
              message.testRunId,
              message.questionId,
              message.answer
            );
            break;
          }
          default:
            logger.warn({ message }, 'Unknown WS message type');
        }
      } catch (err) {
        logger.error({ err }, 'Error processing WS message');
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    socket.on('close', () => {
      sessionStore.remove(sessionId);
      logger.info({ sessionId }, 'WebSocket disconnected');
    });
  });
}
