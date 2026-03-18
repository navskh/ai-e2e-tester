# 아키텍처

## 시스템 구조

```
사용자 (웹UI / REST API / WebSocket)
    │
    ▼
Fastify 서버 (localhost:4820)
    │
    ▼
TestOrchestrator
    │
    ├── BrowserManager
    │     └── Playwright 브라우저 생성/관리
    │         (chromium/firefox/webkit, viewport 1280x720)
    │
    ├── AuthStateManager
    │     └── 도메인별 storageState 캐싱/복원/만료
    │
    ├── AIAgent (setup용 / 본 테스트용)
    │     ├── Claude Code SDK query() 호출
    │     │     → 별도 Node 프로세스로 cli.js spawn
    │     │     → Anthropic API와 통신
    │     │
    │     └── MCP Browser Server (인프로세스)
    │           └── 18개 브라우저 도구
    │               → Playwright Page 직접 조작
    │               → 결과: text + image(base64 스크린샷)
    │
    ├── SessionStore
    │     └── WebSocket 세션 + clarification(사용자 질문) 관리
    │
    └── Mail
          └── 테스트 결과 이메일 알림 (SMTP)
```

## 테스트 실행 흐름

### 기본 흐름

```
1. 사용자가 프롬프트 제출 (REST POST 또는 WS test:start)
2. TestOrchestrator:
   a. DB에 test_runs 레코드 생성 (status: pending → running)
   b. BrowserManager로 Playwright 브라우저 실행
   c. AIAgent 생성 및 run() 호출
3. AIAgent:
   a. 시스템 프롬프트 + 사용자 프롬프트로 query() 호출
   b. SDK가 별도 프로세스 spawn → Anthropic API 통신
   c. AI가 tool_use 블록 생성 → MCP 서버가 Playwright 액션 수행
   d. 결과(text + 스크린샷)를 AI에게 피드백 → 반복
   e. AI가 TEST_VERDICT: PASS/FAIL 출력
4. TestOrchestrator:
   a. verdict 파싱 → 결과 판정
   b. DB 업데이트 (passed/failed)
   c. WS로 test:completed 브로드캐스트
   d. 이메일 알림 발송
   e. 브라우저 세션 종료
```

### setup + reuseAuth 흐름

```
1. 요청에 setup + reuseAuth: true 포함
2. TestOrchestrator:
   a. 프롬프트에서 도메인 추출
   b. 캐시된 storageState 확인
   c-1. 캐시 있음 → storageState로 브라우저 생성 → 바로 본 테스트
   c-2. 캐시 없음 → 일반 브라우저 생성
        → setup 에이전트 실행 (로그인 등, maxTurns: 30)
        → 성공 시 storageState 저장
        → 같은 브라우저로 본 테스트 실행
```

## Claude Code SDK 연동

### query() 호출

```typescript
const conversation = query({
  prompt,
  options: {
    customSystemPrompt: systemPrompt,
    maxTurns: 200,
    allowedTools: ['mcp__browser__navigate', ...],
    disallowedTools: ['Bash', 'Read', 'Write', ...],
    mcpServers: { browser: mcpServer },
    permissionMode: 'bypassPermissions',
  },
});
```

- `query()`는 `AsyncGenerator<SDKMessage>`를 반환
- 메시지 타입: `system`(init), `assistant`(텍스트/tool_use), `result`(최종 결과)
- `permissionMode: 'bypassPermissions'`로 도구 사용 시 사용자 확인 생략
- `disallowedTools`로 Bash, WebFetch 등 기본 도구 차단 (MCP 도구만 사용)

### MCP 서버 연결

```typescript
const mcpServer = createSdkMcpServer({
  name: 'browser',
  tools: [
    tool('navigate', 'Go to URL', { url: z.string() }, handler),
    // ...
  ],
});
```

- `createSdkMcpServer()`로 인프로세스 MCP 서버 생성
- `tool()` 헬퍼로 도구 정의, zod v3 스키마로 입력 검증
- SDK CLI 프로세스와 인프로세스 통신

### 턴(turn)

AI 응답 1번 + tool 실행 결과 피드백 = 1턴.
- 본 테스트: maxTurns 200 (실제로는 토큰 한도로 더 일찍 종료될 수 있음)
- setup: maxTurns 30 (환경변수 `SETUP_MAX_TURNS`로 변경 가능)

## 데이터 흐름 3갈래

| 채널 | 용도 | 저장소 |
|------|------|--------|
| DB (SQLite) | test_runs, test_steps, conversations — 영구 저장 | `data/test-runs.db` |
| WebSocket | 실시간 UI 업데이트 (step 진행, 스크린샷, AI 사고과정) | 메모리 |
| Email | 테스트 완료 시 결과 알림 | SMTP 발송 |
