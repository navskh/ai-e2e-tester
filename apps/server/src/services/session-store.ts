import type { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

interface Session {
  ws: WebSocket;
  testRunId: string | null;
  pendingClarifications: Map<string, {
    resolve: (answer: string) => void;
    reject: (err: Error) => void;
  }>;
}

class SessionStore {
  private sessions = new Map<string, Session>();

  add(sessionId: string, ws: WebSocket): void {
    this.sessions.set(sessionId, {
      ws,
      testRunId: null,
      pendingClarifications: new Map(),
    });
    logger.info({ sessionId }, 'WS session added');
  }

  remove(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Reject any pending clarifications
      for (const [, pending] of session.pendingClarifications) {
        pending.reject(new Error('Session disconnected'));
      }
      this.sessions.delete(sessionId);
      logger.info({ sessionId }, 'WS session removed');
    }
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  setTestRunId(sessionId: string, testRunId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.testRunId = testRunId;
  }

  findByTestRunId(testRunId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.testRunId === testRunId) return session;
    }
    return undefined;
  }

  send(sessionId: string, message: unknown): void {
    const session = this.sessions.get(sessionId);
    if (session && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify(message));
    }
  }

  sendToTestRun(testRunId: string, message: unknown): void {
    const session = this.findByTestRunId(testRunId);
    if (session && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify(message));
    }
  }

  addClarification(testRunId: string, questionId: string): Promise<string> {
    const session = this.findByTestRunId(testRunId);
    if (!session) {
      return Promise.reject(new Error('No active session for this test run'));
    }

    return new Promise<string>((resolve, reject) => {
      session.pendingClarifications.set(questionId, { resolve, reject });
    });
  }

  resolveClarification(testRunId: string, questionId: string, answer: string): boolean {
    const session = this.findByTestRunId(testRunId);
    if (!session) return false;

    const pending = session.pendingClarifications.get(questionId);
    if (pending) {
      pending.resolve(answer);
      session.pendingClarifications.delete(questionId);
      return true;
    }
    return false;
  }
}

export const sessionStore = new SessionStore();
