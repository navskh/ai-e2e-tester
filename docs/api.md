# API 스펙

## REST API

### POST /api/tests — 테스트 실행

```json
{
  "prompt": "테스트 지시 내용 (필수)",
  "setup": "사전 작업 지시. 로그인 등 (선택)",
  "options": {
    "reuseAuth": true,
    "browserType": "chromium",
    "headless": true,
    "targetUrl": "https://example.com"
  }
}
```

| 필드 | 필수 | 설명 |
|------|:---:|------|
| `prompt` | O | 실제 테스트 시나리오. 무엇을 검증할지 구체적으로 기술 |
| `setup` | | 테스트 전 사전 작업 (로그인 등). 생략하면 바로 prompt 실행 |
| `options.reuseAuth` | | `true`면 캐시된 인증 상태 재사용. 기본값 `false` |
| `options.browserType` | | `chromium` / `firefox` / `webkit`. 기본값 `chromium` |
| `options.headless` | | `false`면 브라우저 UI 표시. 기본값 `true` |
| `options.targetUrl` | | 도메인 추출용 URL. 생략 시 prompt/setup에서 자동 추출 |

**응답** (201):
```json
{
  "success": true,
  "data": {
    "id": "테스트ID",
    "prompt": "...",
    "status": "pending",
    "startedAt": "2026-03-18T..."
  }
}
```

### GET /api/tests — 목록 조회

쿼리 파라미터:
| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `page` | 1 | 페이지 번호 |
| `pageSize` | 20 | 한 페이지 항목 수 (최대 100) |
| `status` | | 필터: passed, failed, running 등 |
| `sortBy` | startedAt | 정렬 기준: startedAt / durationMs |
| `sortOrder` | desc | asc / desc |

### GET /api/tests/:id — 상세 조회

test_runs + test_steps + conversations 전체 반환.

### DELETE /api/tests/:id — 취소/삭제

실행 중이면 취소 후 삭제. 관련 steps, conversations도 함께 삭제.

---

## WebSocket

**연결**: `ws://localhost:4820/ws`

### Client → Server

```typescript
// 테스트 시작
{ type: 'test:start', prompt: string, setup?: string, options?: { reuseAuth?: boolean, ... } }

// 테스트 취소
{ type: 'test:cancel', testRunId: string }

// AI 질문에 대한 응답 (ask_user)
{ type: 'clarification:response', testRunId: string, questionId: string, answer: string }
```

### Server → Client

```typescript
{ type: 'test:started', testRunId: string }
{ type: 'step:started', testRunId: string, step: { stepIndex, tool, input } }
{ type: 'step:completed', testRunId: string, step: { stepIndex, tool, result, status } }
{ type: 'step:failed', testRunId: string, step: { stepIndex, tool, result, status } }
{ type: 'screenshot:captured', testRunId: string, stepIndex: number, url: string }
{ type: 'ai:thinking', testRunId: string, content: string }
{ type: 'ai:tool_call', testRunId: string, command: string }
{ type: 'ai:status', testRunId: string, status: string }
{ type: 'ai:clarification', testRunId: string, questionId: string, question: string }
{ type: 'test:completed', testRunId: string, status: TestStatus, summary: string | null }
{ type: 'error', message: string }
```

### 스크린샷 접근

`GET /api/screenshots/{filename}` — 정적 파일 서빙
