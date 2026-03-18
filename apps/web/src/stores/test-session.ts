import { create } from 'zustand';
import type { TestStatus } from '@ai-e2e/shared';

export type ExecutionPhase = 'idle' | 'running' | 'clarification' | 'completed';

export interface StepInfo {
  stepIndex: number;
  tool: string;
  input: Record<string, unknown>;
  result?: string | null;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  screenshotUrl?: string;
}

export interface ClarificationInfo {
  questionId: string;
  question: string;
}

export interface ActivityLogEntry {
  id: number;
  timestamp: number;
  type: 'status' | 'thinking' | 'tool_call' | 'step' | 'screenshot' | 'error';
  content: string;
}

interface TestSessionState {
  // Current test
  testRunId: string | null;
  prompt: string;
  phase: ExecutionPhase;
  status: TestStatus | null;
  summary: string | null;

  // Steps
  steps: StepInfo[];

  // Activity log (unified real-time feed)
  activityLog: ActivityLogEntry[];
  currentStatus: string;

  // Clarification
  pendingClarification: ClarificationInfo | null;

  // Screenshots
  screenshots: Array<{ stepIndex: number; url: string }>;

  // Conversations
  conversations: Array<{ role: string; content: string }>;

  // Actions
  startTest: (testRunId: string, prompt: string) => void;
  addStep: (step: Pick<StepInfo, 'stepIndex' | 'tool' | 'input'>) => void;
  updateStep: (step: Pick<StepInfo, 'stepIndex' | 'tool' | 'result' | 'status'>) => void;
  addScreenshot: (stepIndex: number, url: string) => void;
  addThinking: (content: string) => void;
  addToolCall: (command: string) => void;
  setStatus: (status: string) => void;
  setClarification: (info: ClarificationInfo | null) => void;
  completeTest: (status: TestStatus, summary: string | null) => void;
  addConversation: (role: string, content: string) => void;
  reset: () => void;
}

let logCounter = 0;

function createLogEntry(type: ActivityLogEntry['type'], content: string): ActivityLogEntry {
  return { id: ++logCounter, timestamp: Date.now(), type, content };
}

const initialState = {
  testRunId: null as string | null,
  prompt: '',
  phase: 'idle' as ExecutionPhase,
  status: null as TestStatus | null,
  summary: null as string | null,
  steps: [] as StepInfo[],
  activityLog: [] as ActivityLogEntry[],
  currentStatus: '',
  pendingClarification: null as ClarificationInfo | null,
  screenshots: [] as Array<{ stepIndex: number; url: string }>,
  conversations: [] as Array<{ role: string; content: string }>,
};

export const useTestSession = create<TestSessionState>((set) => ({
  ...initialState,

  startTest: (testRunId, prompt) =>
    set({
      ...initialState,
      testRunId,
      prompt,
      phase: 'running',
      status: 'running',
      currentStatus: '테스트 시작 중...',
      activityLog: [createLogEntry('status', '테스트 시작 중...')],
    }),

  addStep: (step) =>
    set((s) => {
      const desc = (step.input as any)?._description ?? step.tool;
      return {
        steps: [...s.steps, { ...step, status: 'running' }],
        activityLog: [...s.activityLog, createLogEntry('step', `▶ ${desc}`)],
      };
    }),

  updateStep: (step) =>
    set((s) => ({
      steps: s.steps.map((st) =>
        st.stepIndex === step.stepIndex
          ? { ...st, result: step.result, status: step.status }
          : st
      ),
      activityLog: [...s.activityLog, createLogEntry(
        step.status === 'failed' ? 'error' : 'step',
        step.status === 'failed'
          ? `✗ #${step.stepIndex} ${step.tool} 실패: ${step.result}`
          : `✓ #${step.stepIndex} ${step.tool} 완료`
      )],
    })),

  addScreenshot: (stepIndex, url) =>
    set((s) => ({
      screenshots: [...s.screenshots, { stepIndex, url }],
      steps: s.steps.map((st) =>
        st.stepIndex === stepIndex ? { ...st, screenshotUrl: url } : st
      ),
      activityLog: [...s.activityLog, createLogEntry('screenshot', `📸 #${stepIndex}단계 스크린샷 촬영`)],
    })),

  addThinking: (content) =>
    set((s) => ({
      conversations: [...s.conversations, { role: 'assistant', content }],
      activityLog: [...s.activityLog, createLogEntry('thinking', content)],
    })),

  addToolCall: (command) =>
    set((s) => ({
      activityLog: [...s.activityLog, createLogEntry('tool_call', command)],
    })),

  setStatus: (status) =>
    set((s) => ({
      currentStatus: status,
      activityLog: [...s.activityLog, createLogEntry('status', status)],
    })),

  setClarification: (info) =>
    set({
      pendingClarification: info,
      phase: info ? 'clarification' : 'running',
    }),

  completeTest: (status, summary) =>
    set((s) => ({
      status,
      summary,
      phase: 'completed',
      currentStatus: status === 'passed' ? '테스트 통과' : status === 'cancelled' ? '테스트 취소됨' : '테스트 실패',
      activityLog: [...s.activityLog, createLogEntry('status',
        status === 'passed' ? '✅ 테스트 통과' : status === 'cancelled' ? '⏹ 테스트 취소됨' : '❌ 테스트 실패'
      )],
    })),

  addConversation: (role, content) =>
    set((s) => ({
      conversations: [...s.conversations, { role, content }],
    })),

  reset: () => set(initialState),
}));
