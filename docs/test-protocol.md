# ETE 구조화된 테스트 프로토콜 (Structured Test Protocol)

> 버전: 1.0.0 | 최종 수정: 2026-03-18

## 1. 개요

기존 테스트 요청은 자유 텍스트 프롬프트 한 덩어리로 전달되어 AI가 자의적으로 해석한다.
이를 **구조화된 포맷**으로 변경하여:

- 테스트 정확도를 높이고
- assertion별 개별 판정을 가능하게 하며
- 외부 시스템(jabis-monitoring 등)과의 연동을 표준화한다.

### 하위 호환

| 조건 | 동작 모드 |
|------|-----------|
| `assertions` 필드 있음 | **구조화 모드** (이 문서의 규약 적용) |
| `prompt` 필드만 있음 | **레거시 모드** (기존 자유 텍스트 방식) |
| `assertions` + `prompt` 동시 존재 | **구조화 모드 우선** (`prompt` 무시) |

---

## 2. 요청 포맷 (Request)

```json
{
  "targetUrl": "https://jabis.jinhakapply.com/dev/",
  "scenario": "개발자 대시보드 렌더링 확인",
  "setup": "로그인 절차 문자열 (선택)",
  "actions": [
    { "type": "click", "target": "'업무 관리' 그룹 펼치기" },
    { "type": "click", "target": "'전자결재' 메뉴 클릭" },
    { "type": "scroll", "target": "페이지 하단으로 스크롤" }
  ],
  "assertions": [
    {
      "id": "A1",
      "check": "'JABIS 프로젝트', '사내 사이트', '시스템 알림', '서비스 상태' 4개 통계 카드가 표시된다",
      "severity": "critical"
    },
    {
      "id": "A2",
      "check": "'시스템 상태' 영역에 'ENS', 'Grafana', '원서접수' 3개 서비스 카드가 3열 그리드로 표시된다",
      "severity": "critical"
    },
    {
      "id": "A3",
      "check": "'프로덕션 사이트 현황' 테이블이 표시된다",
      "severity": "major"
    },
    {
      "id": "A4",
      "check": "우측에 '시스템 알림' 카드와 '사내 사이트' 퀵 링크 카드가 표시된다",
      "severity": "minor"
    }
  ],
  "options": {
    "reuseAuth": true,
    "browserType": "chromium",
    "headless": true,
    "timeout": 300000
  }
}
```

### 2.1 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `targetUrl` | string | **필수** | 테스트 시작 시 이동할 URL |
| `scenario` | string | **필수** | 테스트 시나리오 이름 |
| `setup` | string | 선택 | 로그인 등 사전 작업 (자연어). 기존 setup 필드와 동일 |
| `actions` | Action[] | 선택 | assertion 검증 전에 순서대로 실행할 동작 목록 |
| `assertions` | Assertion[] | **필수** | 검증 항목 목록 (1개 이상) |
| `options` | Options | 선택 | 실행 옵션 |

### 2.2 Action 타입

| type | 설명 | target | value |
|------|------|--------|-------|
| `navigate` | 페이지 이동 | - | 이동할 URL |
| `click` | 요소 클릭 | 클릭 대상 (자연어) | - |
| `input` | 텍스트 입력 | 입력 필드 대상 (자연어) | 입력할 값 |
| `scroll` | 스크롤 | 스크롤 방향/대상 (자연어) | - |
| `hover` | 마우스 오버 | 호버 대상 (자연어) | - |
| `select_option` | 드롭다운 선택 | 셀렉트 박스 대상 (자연어) | 선택할 옵션 값 |
| `press_key` | 키보드 입력 | - | 키 조합 (예: `Enter`, `Ctrl+A`) |
| `wait` | 대기 | 대기 조건 (자연어, 선택) | 대기 시간 ms (숫자) |

- `target`: AI가 이해할 수 있는 자연어 대상 설명
- `value`: 타입에 따라 입력값 / URL / 키 조합 / 대기 시간 등

### 2.3 Assertion 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | **필수** | 고유 식별자 (예: `A1`, `A2`) |
| `check` | string | **필수** | 검증 조건을 자연어로 기술 |
| `severity` | string | **필수** | 심각도: `critical` / `major` / `minor` |

### 2.4 Options

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `reuseAuth` | boolean | `false` | 인증 상태 캐시 재사용 여부 |
| `browserType` | string | `"chromium"` | 브라우저 종류 (`chromium` / `firefox` / `webkit`) |
| `headless` | boolean | `true` | 헤드리스 모드 |
| `timeout` | number | `300000` | 전체 테스트 제한 시간 (ms). 기본 5분 |

---

## 3. 응답 포맷 (Response)

```json
{
  "testRunId": "trun_abc123",
  "status": "failed",
  "summary": "4개 assertion 중 1개 실패 (A2)",
  "results": [
    {
      "id": "A1",
      "status": "passed",
      "severity": "critical",
      "detail": "4개 통계 카드 모두 확인됨"
    },
    {
      "id": "A2",
      "status": "failed",
      "severity": "critical",
      "detail": "'원서접수' 카드를 찾을 수 없음",
      "screenshotUrl": "/api/screenshots/trun_abc123_A2.png"
    },
    {
      "id": "A3",
      "status": "passed",
      "severity": "major",
      "detail": "테이블 정상 표시"
    },
    {
      "id": "A4",
      "status": "passed",
      "severity": "minor",
      "detail": "우측 카드 2개 확인됨"
    }
  ],
  "steps": {
    "total": 49,
    "passed": 37,
    "failed": 12,
    "skipped": 0
  },
  "durationMs": 176900
}
```

### 3.1 필드 정의

| 필드 | 타입 | 설명 |
|------|------|------|
| `testRunId` | string | 테스트 실행 고유 ID (요청-응답 추적용) |
| `status` | string | 전체 판정: `passed` / `warning` / `failed` |
| `summary` | string | 전체 결과 한 줄 요약 |
| `results` | Result[] | assertion별 개별 결과 |
| `steps` | StepStats | 전체 실행 스텝 통계 |
| `durationMs` | number | 전체 소요 시간 (ms) |

### 3.2 Result 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | **필수** | 요청의 assertion id와 매칭 |
| `status` | string | **필수** | `passed` / `failed` |
| `severity` | string | **필수** | 요청에서 지정한 심각도 (echo back) |
| `detail` | string | **필수** | 판정 근거 (자연어) |
| `screenshotUrl` | string | 선택 | 실패 시 해당 시점 스크린샷 경로 |

---

## 4. 전체 판정 로직

```
if (critical assertion 중 하나라도 failed)
  → status = "failed"

else if (major assertion 중 하나라도 failed)
  → status = "warning"

else
  → status = "passed"
```

- **minor** 실패는 `results`에 기록만 하고 전체 판정에 영향 없음
- AI가 PASS 판정을 내려도 assertion 도구 실행 결과가 실패이면 해당 assertion은 `failed` 처리

---

## 5. 텍스트 인식 규칙

1. assertion의 `check`에서 **따옴표로 감싼 텍스트** (예: `'ENS'`, `'원서접수'`)는 DOM `textContent`에서 **정확히 매칭**해야 한다
2. **스크린샷 기반 시각 인식이 아닌**, DOM에서 직접 텍스트를 추출하여 비교할 것
3. 정확한 매칭이 불가능한 경우:
   - 해당 assertion을 `failed`로 처리
   - `detail`에 **실제 발견된 텍스트**를 기재

---

## 6. 실행 흐름

```
1. targetUrl로 navigate
2. setup이 있으면 사전 작업 실행 (로그인 등)
   └ reuseAuth: true면 캐시된 인증 상태 재사용 시도
3. actions를 순서대로 실행
4. assertions를 순서대로 검증
   └ 각 assertion마다 개별 판정 (passed / failed)
5. severity 기반 전체 판정 산출
6. 응답 반환
```

---

## 7. 예제

### 7.1 요청 - 로그인 후 대시보드 확인

```json
{
  "targetUrl": "https://jabis.jinhakapply.com/dev/",
  "scenario": "개발자 대시보드 렌더링 확인",
  "setup": "Microsoft OAuth 로그인을 수행한다. 이메일: test@jinhakapply.com",
  "actions": [
    { "type": "wait", "value": "3000" },
    { "type": "click", "target": "'업무 관리' 그룹 펼치기" }
  ],
  "assertions": [
    {
      "id": "A1",
      "check": "'JABIS 프로젝트' 통계 카드가 표시된다",
      "severity": "critical"
    },
    {
      "id": "A2",
      "check": "페이지 타이틀에 '대시보드' 텍스트가 포함된다",
      "severity": "major"
    }
  ],
  "options": {
    "reuseAuth": true,
    "timeout": 300000
  }
}
```

### 7.2 응답 - 전체 통과

```json
{
  "testRunId": "trun_x7k9m2",
  "status": "passed",
  "summary": "2개 assertion 모두 통과",
  "results": [
    { "id": "A1", "status": "passed", "severity": "critical", "detail": "'JABIS 프로젝트' 카드 확인됨" },
    { "id": "A2", "status": "passed", "severity": "major", "detail": "타이틀에 '대시보드' 텍스트 포함 확인" }
  ],
  "steps": { "total": 12, "passed": 12, "failed": 0, "skipped": 0 },
  "durationMs": 45200
}
```

### 7.3 레거시 모드 (기존 호환)

```json
{
  "prompt": "https://jabis.jinhakapply.com에 접속하여 대시보드가 정상 렌더링되는지 확인해줘",
  "setup": "Microsoft OAuth 로그인",
  "options": { "reuseAuth": true }
}
```

레거시 모드에서는 기존과 동일하게 AI 자유 판정 방식으로 동작한다.
