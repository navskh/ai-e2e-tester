import type { FastifyInstance } from 'fastify';
import { eq, desc, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client.js';
import { testOrchestrator } from '../../services/test-orchestrator.js';
import { nanoid } from 'nanoid';

export async function testRoutes(app: FastifyInstance) {
  // POST /api/tests — submit a new test
  app.post('/api/tests', async (request, reply) => {
    const { prompt, setup, options } = request.body as { prompt: string; setup?: string; options?: Record<string, unknown> };

    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ success: false, error: 'prompt is required' });
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(schema.testRuns).values({
      id,
      prompt,
      setup: setup ?? null,
      status: 'pending',
      startedAt: now,
    });

    // Start test orchestration in background (don't await)
    const fullOptions = { ...options, setup };
    testOrchestrator.runTest(id, prompt, fullOptions).catch(() => {});

    return reply.status(201).send({
      success: true,
      data: { id, prompt, status: 'pending', startedAt: now },
    });
  });

  // GET /api/tests — list tests
  app.get('/api/tests', async (request) => {
    const { page = 1, pageSize = 20, status, sortBy = 'startedAt', sortOrder = 'desc' } = request.query as Record<string, string>;
    const pageNum = Number(page);
    const size = Math.min(Number(pageSize), 100);
    const offset = (pageNum - 1) * size;

    let query = db.select().from(schema.testRuns);

    if (status) {
      query = query.where(eq(schema.testRuns.status, status as any)) as any;
    }

    const orderCol = sortBy === 'durationMs' ? schema.testRuns.durationMs : schema.testRuns.startedAt;
    const items = await (query as any)
      .orderBy(sortOrder === 'asc' ? orderCol : desc(orderCol))
      .limit(size)
      .offset(offset);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(schema.testRuns);
    const total = countResult[0]?.count ?? 0;

    return { success: true, data: { items, total, page: pageNum, pageSize: size } };
  });

  // GET /api/tests/:id — get test detail
  app.get('/api/tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const run = await db.select().from(schema.testRuns).where(eq(schema.testRuns.id, id)).get();
    if (!run) return reply.status(404).send({ success: false, error: 'Test not found' });

    const steps = await db.select().from(schema.testSteps)
      .where(eq(schema.testSteps.testRunId, id))
      .orderBy(schema.testSteps.stepIndex);

    const convos = await db.select().from(schema.conversations)
      .where(eq(schema.conversations.testRunId, id))
      .orderBy(schema.conversations.createdAt);

    return { success: true, data: { ...run, steps, conversations: convos } };
  });

  // DELETE /api/tests/:id — cancel/delete test
  app.delete('/api/tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const run = await db.select().from(schema.testRuns).where(eq(schema.testRuns.id, id)).get();
    if (!run) return reply.status(404).send({ success: false, error: 'Test not found' });

    if (run.status === 'running' || run.status === 'paused') {
      await testOrchestrator.cancelTest(id);
    }

    await db.delete(schema.testSteps).where(eq(schema.testSteps.testRunId, id));
    await db.delete(schema.conversations).where(eq(schema.conversations.testRunId, id));
    await db.delete(schema.testRuns).where(eq(schema.testRuns.id, id));

    return { success: true, data: { deleted: id } };
  });
}
