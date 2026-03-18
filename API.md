# AI E2E Tester — API Documentation

> AI 기반 E2E 브라우저 테스트를 API 요청으로 실행하고 결과를 조회할 수 있는 REST + WebSocket API

**Base URL:** `http://localhost:4820` (기본값, `PORT` 환경변수로 변경 가능)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [REST API](#rest-api)
  - [Health Check](#health-check)
  - [테스트 생성 및 실행](#테스트-생성-및-실행)
  - [테스트 목록 조회](#테스트-목록-조회)
  - [테스트 상세 조회](#테스트-상세-조회)
  - [테스트 삭제/취소](#테스트-삭제취소)
  - [스크린샷 조회](#스크린샷-조회)
- [WebSocket API](#websocket-api)
  - [연결](#연결)
  - [Client → Server 메시지](#client--server-메시지)
  - [Server → Client 메시지](#server--client-메시지)
- [Data Models](#data-models)
- [사용 예시](#사용-예시)
  - [cURL 기본 사용](#curl-기본-사용)
  - [Node.js / TypeScript](#nodejs--typescript)
  - [Python](#python)
  - [WebSocket 실시간 모니터링](#websocket-실시간-모니터링)
  - [CI/CD 파이프라인 연동](#cicd-파이프라인-연동)
- [에러 처리](#에러-처리)
- [환경 설정](#환경-설정)

---

## Quick Start

```bash
# 1. 테스트 실행
curl -X POST http://localhost:4820/api/tests \
  -H "Content-Type: application/json" \
  -d '{"prompt": "https://example.com 에 접속해서 페이지 타이틀이 Example Domain 인지 확인해줘"}'

# 2. 응답에서 id 확인 → 결과 폴링
curl http://localhost:4820/api/tests/{id}
```

---

## Authentication

`AUTH_TOKEN` 환경변수가 설정된 경우, 모든 API 요청에 토큰을 포함해야 합니다.

```
Authorization: Bearer <your-token>
```

`AUTH_TOKEN`이 비어 있으면(기본값) 인증 없이 사용 가능합니다.

---

## REST API

모든 응답은 공통 래퍼 형식을 따릅니다:

```json
{
  "success": true,
  "data": { ... }
}
```

에러 시:

```json
{
  "success": false,
  "error": "에러 메시지"
}
```

---

### Health Check

서버 상태를 확인합니다.

```
GET /api/health
```

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 123456,
    "version": "0.1.0"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `string` | 항상 `"ok"` |
| `uptime` | `number` | 서버 가동 시간 (ms) |
| `version` | `string` | 서버 버전 |

---

### 테스트 생성 및 실행

자연어 프롬프트로 E2E 테스트를 생성하고 백그라운드에서 실행합니다.

```
POST /api/tests
```

**Request Body**

```json
{
  "prompt": "https://my-app.com 에 접속해서 로그인 페이지로 이동하고, admin@test.com / password123 으로 로그인한 뒤 대시보드가 표시되는지 확인해줘",
  "options": {
    "browserType": "chromium",
    "headless": true
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `prompt` | `string` | **Yes** | 테스트 시나리오를 자연어로 설명 |
| `options` | `object` | No | 실행 옵션 |
| `options.browserType` | `"chromium" \| "firefox" \| "webkit"` | No | 브라우저 종류 (기본: `"chromium"`) |
| `options.headless` | `boolean` | No | 헤드리스 모드 (기본: `true`) |

**Response** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "abc123xyz",
    "prompt": "https://my-app.com 에 접속해서...",
    "status": "pending",
    "startedAt": "2026-02-22T10:30:00.000Z"
  }
}
```

> **Note:** 테스트는 비동기로 실행됩니다. 응답의 `id`를 사용해 상태를 폴링하거나, WebSocket으로 실시간 진행 상황을 받을 수 있습니다.

---

### 테스트 목록 조회

실행된 테스트 목록을 페이지네이션으로 조회합니다.

```
GET /api/tests
```

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | `number` | `1` | 페이지 번호 |
| `pageSize` | `number` | `20` | 페이지 크기 (최대 100) |
| `status` | `string` | — | 상태 필터: `pending`, `running`, `paused`, `passed`, `failed`, `cancelled` |
| `sortBy` | `string` | `startedAt` | 정렬 기준: `startedAt` 또는 `durationMs` |
| `sortOrder` | `string` | `desc` | 정렬 방향: `asc` 또는 `desc` |

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "abc123xyz",
        "prompt": "https://my-app.com 로그인 테스트",
        "status": "passed",
        "summary": "로그인 성공 확인, 대시보드 정상 표시",
        "startedAt": "2026-02-22T10:30:00.000Z",
        "completedAt": "2026-02-22T10:30:45.000Z",
        "durationMs": 45000
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 테스트 상세 조회

특정 테스트의 전체 실행 결과를 조회합니다. 실행 단계(steps)와 대화 기록(conversations)이 포함됩니다.

```
GET /api/tests/:id
```

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "abc123xyz",
    "prompt": "https://my-app.com 로그인 테스트",
    "status": "passed",
    "summary": "모든 검증 통과",
    "startedAt": "2026-02-22T10:30:00.000Z",
    "completedAt": "2026-02-22T10:30:45.000Z",
    "durationMs": 45000,
    "steps": [
      {
        "id": "step_001",
        "testRunId": "abc123xyz",
        "stepIndex": 1,
        "tool": "navigate",
        "input": { "url": "https://my-app.com" },
        "result": "{\"success\":true,\"url\":\"https://my-app.com/\",\"title\":\"My App\"}",
        "status": "passed",
        "screenshotPath": "abc123xyz_step1_1708600200000.png",
        "createdAt": "2026-02-22T10:30:01.000Z"
      },
      {
        "id": "step_002",
        "testRunId": "abc123xyz",
        "stepIndex": 2,
        "tool": "snapshot",
        "input": {},
        "result": "{\"url\":\"https://my-app.com/\",\"title\":\"My App\",\"snapshot\":\"...\"}",
        "status": "passed",
        "screenshotPath": null,
        "createdAt": "2026-02-22T10:30:03.000Z"
      }
    ],
    "conversations": [
      {
        "id": "conv_001",
        "testRunId": "abc123xyz",
        "role": "user",
        "content": "https://my-app.com 로그인 테스트",
        "createdAt": "2026-02-22T10:30:00.000Z"
      },
      {
        "id": "conv_002",
        "testRunId": "abc123xyz",
        "role": "assistant",
        "content": "my-app.com에 접속하여 로그인 테스트를 시작하겠습니다...",
        "createdAt": "2026-02-22T10:30:01.000Z"
      }
    ]
  }
}
```

**Error** `404 Not Found`

```json
{
  "success": false,
  "error": "Test not found"
}
```

---

### 테스트 삭제/취소

실행 중인 테스트를 취소하거나, 완료된 테스트를 삭제합니다.

```
DELETE /api/tests/:id
```

- `running` 또는 `paused` 상태의 테스트는 먼저 취소된 후 삭제됩니다.
- 관련된 steps, conversations 데이터도 함께 삭제됩니다.

**Response** `200 OK`

```json
{
  "success": true,
  "data": {
    "deleted": "abc123xyz"
  }
}
```

---

### 스크린샷 조회

테스트 실행 중 촬영된 스크린샷 이미지를 조회합니다.

```
GET /api/screenshots/:filename
```

`filename`은 테스트 상세 조회 응답의 `steps[].screenshotPath`에서 확인할 수 있습니다.

**Response:** PNG 이미지 바이너리

---

## WebSocket API

실시간으로 테스트 진행 상황을 모니터링하거나, WebSocket을 통해 테스트를 시작할 수 있습니다.

### 연결

```
ws://localhost:4820/ws
```

연결 시 자동으로 세션이 생성됩니다.

---

### Client → Server 메시지

#### `test:start` — 테스트 시작

```json
{
  "type": "test:start",
  "prompt": "https://example.com 접속 후 타이틀 확인",
  "options": {
    "targetUrl": "https://example.com",
    "browserType": "chromium",
    "headless": true,
    "timeout": 60000
  }
}
```

#### `test:cancel` — 테스트 취소

```json
{
  "type": "test:cancel",
  "testRunId": "abc123xyz"
}
```

#### `clarification:response` — AI 질문에 대한 사용자 응답

AI가 테스트 도중 `ask_user`로 질문한 경우, 이 메시지로 답변합니다.

```json
{
  "type": "clarification:response",
  "testRunId": "abc123xyz",
  "questionId": "q_001",
  "answer": "admin@test.com"
}
```

---

### Server → Client 메시지

| type | 설명 | 주요 필드 |
|------|------|-----------|
| `test:started` | 테스트 실행 시작됨 | `testRunId` |
| `step:started` | 단계 실행 시작 | `testRunId`, `step.stepIndex`, `step.tool`, `step.input` |
| `step:completed` | 단계 성공 완료 | `testRunId`, `step.stepIndex`, `step.tool`, `step.result`, `step.status` |
| `step:failed` | 단계 실패 | `testRunId`, `step.stepIndex`, `step.tool`, `step.result`, `step.status` |
| `screenshot:captured` | 스크린샷 촬영됨 | `testRunId`, `stepIndex`, `url` |
| `ai:thinking` | AI 추론 과정 | `testRunId`, `content` |
| `ai:tool_call` | AI가 실행한 명령 | `testRunId`, `command` |
| `ai:status` | AI 상태 메시지 | `testRunId`, `status` |
| `ai:clarification` | AI가 사용자에게 질문 | `testRunId`, `questionId`, `question` |
| `test:completed` | 테스트 종료 | `testRunId`, `status`, `summary` |
| `error` | 에러 발생 | `message` |

#### 메시지 상세 예시

**`test:started`**
```json
{ "type": "test:started", "testRunId": "abc123xyz" }
```

**`step:started`**
```json
{
  "type": "step:started",
  "testRunId": "abc123xyz",
  "step": {
    "stepIndex": 1,
    "tool": "navigate",
    "input": { "url": "https://example.com", "_description": "페이지 이동: https://example.com" }
  }
}
```

**`step:completed`**
```json
{
  "type": "step:completed",
  "testRunId": "abc123xyz",
  "step": {
    "stepIndex": 1,
    "tool": "navigate",
    "result": "{\"success\":true,\"url\":\"https://example.com/\",\"title\":\"Example Domain\"}",
    "status": "passed"
  }
}
```

**`ai:clarification`** — 답변이 필요함
```json
{
  "type": "ai:clarification",
  "testRunId": "abc123xyz",
  "questionId": "q_001",
  "question": "로그인에 사용할 이메일 주소를 알려주세요."
}
```

**`test:completed`**
```json
{
  "type": "test:completed",
  "testRunId": "abc123xyz",
  "status": "passed",
  "summary": "모든 테스트 단계가 성공적으로 완료되었습니다."
}
```

---

## Data Models

### TestRun

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 고유 ID (nanoid) |
| `prompt` | `string` | 테스트 프롬프트 |
| `status` | `TestStatus` | 테스트 상태 |
| `summary` | `string \| null` | AI가 생성한 결과 요약 |
| `startedAt` | `string` | 시작 시각 (ISO 8601) |
| `completedAt` | `string \| null` | 종료 시각 (ISO 8601) |
| `durationMs` | `number \| null` | 실행 소요 시간 (ms) |

### TestStatus

```
"pending" | "running" | "paused" | "passed" | "failed" | "cancelled"
```

| 상태 | 설명 |
|------|------|
| `pending` | 대기 중 (DB 생성 직후) |
| `running` | 실행 중 |
| `paused` | 일시정지 (사용자 입력 대기 등) |
| `passed` | 테스트 통과 |
| `failed` | 테스트 실패 |
| `cancelled` | 사용자에 의해 취소됨 |

### TestStep

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 고유 ID |
| `testRunId` | `string` | 소속 테스트 ID |
| `stepIndex` | `number` | 단계 순서 (1부터 시작) |
| `tool` | `string` | 실행된 액션 이름 |
| `input` | `object` | 액션 파라미터 |
| `result` | `string \| null` | 실행 결과 (JSON 문자열) |
| `status` | `StepStatus` | 단계 상태: `running`, `passed`, `failed`, `skipped` |
| `screenshotPath` | `string \| null` | 스크린샷 파일명 |
| `createdAt` | `string` | 생성 시각 (ISO 8601) |

### Conversation

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 고유 ID |
| `testRunId` | `string` | 소속 테스트 ID |
| `role` | `"assistant" \| "user" \| "system"` | 메시지 역할 |
| `content` | `string` | 메시지 내용 |
| `createdAt` | `string` | 생성 시각 (ISO 8601) |

### 브라우저 액션 (tool) 목록

테스트 단계에서 실행되는 브라우저 액션들입니다.

| 액션 | 파라미터 | 설명 |
|------|----------|------|
| `navigate` | `url` | URL로 이동 |
| `go_back` | — | 뒤로 가기 |
| `reload` | — | 페이지 새로고침 |
| `click` | `selector` | 요소 클릭 |
| `type_text` | `selector`, `text`, `clear?` | 텍스트 입력 |
| `select_option` | `selector`, `value` | 드롭다운 선택 |
| `hover` | `selector` | 호버 |
| `press_key` | `key` | 키보드 입력 |
| `assert_visible` | `selector`, `timeout?` | 요소 표시 확인 |
| `assert_text` | `selector`, `expected`, `exact?` | 텍스트 확인 |
| `assert_url` | `expected`, `exact?` | URL 확인 |
| `snapshot` | — | 접근성 트리 캡처 (페이지 구조 분석) |
| `get_text` | `selector` | 요소 텍스트 추출 |
| `get_attribute` | `selector`, `attribute` | 요소 속성 추출 |
| `screenshot` | `fullPage?` | 스크린샷 촬영 |
| `wait_for_element` | `selector`, `state?`, `timeout?` | 요소 대기 |
| `wait` | `ms` | 고정 대기 (최대 10초) |
| `ask_user` | `question` | 사용자에게 질문 |

---

## 사용 예시

### cURL 기본 사용

```bash
# 테스트 실행
TEST_ID=$(curl -s -X POST http://localhost:4820/api/tests \
  -H "Content-Type: application/json" \
  -d '{"prompt": "https://example.com 에 접속해서 타이틀이 Example Domain 인지 확인해줘"}' \
  | jq -r '.data.id')

echo "Test ID: $TEST_ID"

# 상태 폴링 (완료될 때까지)
while true; do
  STATUS=$(curl -s http://localhost:4820/api/tests/$TEST_ID | jq -r '.data.status')
  echo "Status: $STATUS"
  case $STATUS in
    passed|failed|cancelled) break ;;
  esac
  sleep 3
done

# 최종 결과 확인
curl -s http://localhost:4820/api/tests/$TEST_ID | jq '.data | {status, summary, durationMs}'
```

### Node.js / TypeScript

```typescript
const BASE_URL = 'http://localhost:4820';

// 테스트 실행
async function runE2ETest(prompt: string, options?: {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
}) {
  const res = await fetch(`${BASE_URL}/api/tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, options }),
  });
  const { data } = await res.json();
  return data.id;
}

// 결과 폴링
async function waitForResult(testId: string, intervalMs = 3000): Promise<any> {
  while (true) {
    const res = await fetch(`${BASE_URL}/api/tests/${testId}`);
    const { data } = await res.json();

    if (['passed', 'failed', 'cancelled'].includes(data.status)) {
      return data;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// 사용
const testId = await runE2ETest(
  'https://my-app.com 에 접속하여 회원가입 플로우를 테스트해줘'
);
const result = await waitForResult(testId);
console.log(`결과: ${result.status} — ${result.summary}`);
console.log(`소요 시간: ${result.durationMs}ms, 단계 수: ${result.steps.length}`);
```

### Python

```python
import requests
import time

BASE_URL = "http://localhost:4820"

def run_e2e_test(prompt: str, browser_type: str = "chromium", headless: bool = True) -> str:
    """테스트를 실행하고 test ID를 반환합니다."""
    res = requests.post(f"{BASE_URL}/api/tests", json={
        "prompt": prompt,
        "options": {
            "browserType": browser_type,
            "headless": headless,
        }
    })
    return res.json()["data"]["id"]

def wait_for_result(test_id: str, poll_interval: float = 3.0) -> dict:
    """테스트 완료까지 폴링하고 결과를 반환합니다."""
    while True:
        res = requests.get(f"{BASE_URL}/api/tests/{test_id}")
        data = res.json()["data"]
        if data["status"] in ("passed", "failed", "cancelled"):
            return data
        time.sleep(poll_interval)

# 사용
test_id = run_e2e_test("https://my-app.com 로그인 → 대시보드 이동 확인")
result = wait_for_result(test_id)

print(f"결과: {result['status']}")
print(f"요약: {result['summary']}")
print(f"소요 시간: {result['durationMs']}ms")
print(f"실행 단계: {len(result['steps'])}단계")

# 실패한 단계 확인
for step in result["steps"]:
    if step["status"] == "failed":
        print(f"  실패 단계 #{step['stepIndex']}: {step['tool']} → {step['result']}")
```

### WebSocket 실시간 모니터링

```javascript
// 브라우저 또는 Node.js (ws 패키지 사용)
const ws = new WebSocket('ws://localhost:4820/ws');

ws.onopen = () => {
  // 테스트 시작
  ws.send(JSON.stringify({
    type: 'test:start',
    prompt: 'https://example.com 접속 후 h1 텍스트 확인',
    options: { browserType: 'chromium', headless: true },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'test:started':
      console.log(`테스트 시작: ${msg.testRunId}`);
      break;

    case 'ai:status':
      console.log(`상태: ${msg.status}`);
      break;

    case 'step:started':
      console.log(`단계 #${msg.step.stepIndex} 시작: ${msg.step.tool}`);
      break;

    case 'step:completed':
      console.log(`단계 #${msg.step.stepIndex} 완료: ${msg.step.status}`);
      break;

    case 'step:failed':
      console.error(`단계 #${msg.step.stepIndex} 실패: ${msg.step.result}`);
      break;

    case 'screenshot:captured':
      console.log(`스크린샷: http://localhost:4820${msg.url}`);
      break;

    case 'ai:clarification':
      // AI가 질문을 하는 경우 → 답변 전송
      console.log(`AI 질문: ${msg.question}`);
      ws.send(JSON.stringify({
        type: 'clarification:response',
        testRunId: msg.testRunId,
        questionId: msg.questionId,
        answer: '답변 내용',
      }));
      break;

    case 'test:completed':
      console.log(`테스트 종료: ${msg.status}`);
      console.log(`요약: ${msg.summary}`);
      ws.close();
      break;

    case 'error':
      console.error(`에러: ${msg.message}`);
      break;
  }
};
```

### CI/CD 파이프라인 연동

#### GitHub Actions

```yaml
name: E2E Tests
on: [push]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - name: Run E2E Test
        run: |
          # 테스트 실행
          RESPONSE=$(curl -s -X POST ${{ secrets.E2E_TESTER_URL }}/api/tests \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.E2E_AUTH_TOKEN }}" \
            -d '{"prompt": "https://staging.my-app.com 에서 로그인 후 대시보드 확인"}')

          TEST_ID=$(echo $RESPONSE | jq -r '.data.id')

          # 폴링 (최대 5분)
          for i in $(seq 1 100); do
            RESULT=$(curl -s ${{ secrets.E2E_TESTER_URL }}/api/tests/$TEST_ID)
            STATUS=$(echo $RESULT | jq -r '.data.status')

            if [ "$STATUS" = "passed" ]; then
              echo "E2E Test Passed!"
              echo $RESULT | jq '.data.summary'
              exit 0
            elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ]; then
              echo "E2E Test Failed!"
              echo $RESULT | jq '.data.summary'
              exit 1
            fi

            sleep 3
          done

          echo "E2E Test Timeout"
          exit 1
```

#### Shell Script (범용)

```bash
#!/bin/bash
# e2e-test.sh — 다른 프로젝트에서 AI E2E 테스터 호출용 스크립트

E2E_URL="${E2E_TESTER_URL:-http://localhost:4820}"
TIMEOUT=300  # 5분 타임아웃

run_test() {
  local prompt="$1"
  local response=$(curl -s -X POST "$E2E_URL/api/tests" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"$prompt\"}")

  echo "$response" | jq -r '.data.id'
}

wait_result() {
  local test_id="$1"
  local elapsed=0

  while [ $elapsed -lt $TIMEOUT ]; do
    local result=$(curl -s "$E2E_URL/api/tests/$test_id")
    local status=$(echo "$result" | jq -r '.data.status')

    case $status in
      passed|failed|cancelled)
        echo "$result"
        return 0
        ;;
    esac

    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo '{"error": "timeout"}'
  return 1
}

# 사용: ./e2e-test.sh "https://my-app.com 로그인 테스트"
TEST_ID=$(run_test "$1")
echo "Test started: $TEST_ID"
RESULT=$(wait_result "$TEST_ID")
echo "$RESULT" | jq '.'
```

---

## 에러 처리

| HTTP 상태 | 상황 | 응답 |
|-----------|------|------|
| `400` | 필수 파라미터 누락 | `{"success": false, "error": "prompt is required"}` |
| `404` | 테스트 또는 리소스 없음 | `{"success": false, "error": "Test not found"}` |
| `500` | 서버 내부 오류 | `{"success": false, "error": "에러 상세"}` |

WebSocket 에러:

```json
{ "type": "error", "message": "Invalid message format" }
```

---

## 환경 설정

서버의 `.env` 파일 또는 환경변수로 설정합니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `4820` | 서버 포트 |
| `HOST` | `0.0.0.0` | 바인딩 호스트 |
| `DB_PATH` | `./data/test-runs.db` | SQLite DB 경로 |
| `SCREENSHOTS_DIR` | `./data/screenshots` | 스크린샷 저장 경로 |
| `LOG_LEVEL` | `info` | 로그 레벨 (`debug`, `info`, `warn`, `error`) |
| `AUTH_TOKEN` | (없음) | API 인증 토큰 (비어있으면 인증 비활성화) |
| `MAX_CONCURRENT_TESTS` | `3` | 동시 실행 가능 테스트 수 |

---

## Rate Limits & 제약사항

- 동시 실행 가능 테스트 수: 기본 3개 (`MAX_CONCURRENT_TESTS`)
- `wait` 액션 최대 대기: 10초
- 페이지네이션 최대 페이지 크기: 100
- AI 에이전트 최대 턴: 200
- 브라우저 네비게이션 타임아웃: 30초
- 요소 조작 타임아웃: 10초
- 어서션 타임아웃: 5초 (기본)
