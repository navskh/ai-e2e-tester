export type TestStatus = 'pending' | 'running' | 'paused' | 'passed' | 'warning' | 'failed' | 'cancelled';
export type StepStatus = 'running' | 'passed' | 'failed' | 'skipped';

export interface TestRun {
  id: string;
  prompt: string;
  setup: string | null;
  status: TestStatus;
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  steps: TestStep[];
  conversations: Conversation[];
}

export interface TestStep {
  id: string;
  testRunId: string;
  stepIndex: number;
  tool: string;
  input: Record<string, unknown>;
  result: string | null;
  status: StepStatus;
  screenshotPath: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  testRunId: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  createdAt: string;
}

export interface TestRunCreateRequest {
  prompt: string;
  setup?: string;
  options?: {
    targetUrl?: string;
    browserType?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    timeout?: number;
    reuseAuth?: boolean;
  };
}

export interface FailedAtInfo {
  step: number;
  action: string;
  target: string;
  expected: string;
  actual: string;
  screenshotUrl?: string;
}

export interface WarningInfo {
  step: number;
  message: string;
}

export interface StepStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestResultDetail {
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  failedAt: FailedAtInfo | null;
  warnings: WarningInfo[];
  steps: StepStats;
}

export interface TestRunListResponse {
  items: TestRun[];
  total: number;
  page: number;
  pageSize: number;
}
