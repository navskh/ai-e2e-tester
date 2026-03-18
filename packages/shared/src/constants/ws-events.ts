export const WS_EVENTS = {
  // Server → Client
  TEST_STARTED: 'test:started',
  STEP_STARTED: 'step:started',
  STEP_COMPLETED: 'step:completed',
  STEP_FAILED: 'step:failed',
  SCREENSHOT_CAPTURED: 'screenshot:captured',
  AI_THINKING: 'ai:thinking',
  AI_CLARIFICATION: 'ai:clarification',
  TEST_COMPLETED: 'test:completed',
  ERROR: 'error',

  // Client → Server
  TEST_START: 'test:start',
  TEST_CANCEL: 'test:cancel',
  CLARIFICATION_RESPONSE: 'clarification:response',
} as const;
