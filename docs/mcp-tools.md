# MCP 브라우저 도구

MCP 서버명: `browser` → 도구 이름 형식: `mcp__browser__{tool_name}`

모든 도구는 `tracked()` 래퍼로 감싸져 있어 자동으로:
- DB에 test_steps 기록
- WS로 step:started/completed/failed 브로드캐스트
- 에러 시 자동 스크린샷 + hasToolError 플래그 설정

## 요소 타겟팅 (ref vs selector)

대부분의 도구는 **ref** 또는 **selector** 두 가지 방식으로 요소를 지정할 수 있다.

| 방식 | 파라미터 | 예시 | 설명 |
|------|----------|------|------|
| ref (우선) | `ref: number` | `ref=3` | `snapshot`이 반환한 ref 번호. `[data-ete-ref="3"]` 셀렉터로 변환됨 |
| selector (폴백) | `selector: string` | `selector="#email"` | Playwright 셀렉터 직접 지정 |

- 두 값 중 하나만 제공하면 됨
- ref 사용 시 먼저 `snapshot`을 호출하여 ref 맵을 확보해야 함
- DOM 변경 후에는 ref 번호가 바뀌므로 `snapshot` 재호출 필요

## 네비게이션

| 도구 | 파라미터 | 스크린샷 | 설명 |
|------|----------|:---:|------|
| `navigate` | `url: string` | O | URL로 이동. domcontentloaded 대기. 30초 타임아웃 |
| `go_back` | (없음) | | 브라우저 뒤로 가기 |
| `reload` | (없음) | O | 페이지 새로고침 |

## 인터랙션

| 도구 | 파라미터 | 스크린샷 | 설명 |
|------|----------|:---:|------|
| `click` | `ref?, selector?` | O | 요소 클릭. 10초 타임아웃 |
| `type_text` | `ref?, selector?, text: string, clear?: boolean(기본 true)` | | 텍스트 입력. clear=true면 fill(), false면 pressSequentially() |
| `select_option` | `ref?, selector?, value: string` | | 드롭다운 옵션 선택 |
| `hover` | `ref?, selector?` | | 요소 호버 |
| `press_key` | `key: string` | | 키보드 입력 (Enter, Tab, Escape 등) |

## 페이지 정보

| 도구 | 파라미터 | 반환 | 설명 |
|------|----------|------|------|
| `snapshot` | (없음) | ref 맵 (텍스트) + 스크린샷 | 페이지의 인터랙티브 요소를 ref 번호로 매핑. DOM에 `data-ete-ref` 속성 주입 |
| `screenshot` | `fullPage?: boolean(기본 false)` | base64 이미지 | 현재 화면 캡처 |

### snapshot 반환 형식

```
[ref=1] heading "대시보드"
[ref=2] link "업무 관리" href="/tasks"
[ref=3] button "제출" (disabled)
[ref=4] input type=text placeholder="검색..."
[ref=5] select value="전체"
```

- 보이는 요소만 수집 (getBoundingClientRect width/height > 0)
- viewport 3배 이상 아래 요소 제외 (토큰 절약)
- 대상: a, button, input, select, textarea, [role="button/link/tab/menuitem/checkbox/radio/switch"], [tabindex], h1~h6, label, img, nav, main

## Assertion

assertion 도구는 성공 시 `textResult`, 실패 시 `errorResult`(isError: true)를 반환한다.
실패 시 `hasAssertionFailure` 플래그가 설정되어 AI가 PASS를 선언해도 서버에서 FAIL로 오버라이드한다.

| 도구 | 파라미터 | 실패 시 스크린샷 | 설명 |
|------|----------|:---:|------|
| `assert_visible` | `ref?, selector?, timeout?: number(기본 5000)` | O | 요소 표시 여부 확인 |
| `assert_text` | `ref?, selector?, expected: string, exact?: boolean(기본 false)` | O | 텍스트 일치 확인. exact=false면 includes() |
| `assert_url` | `expected: string, exact?: boolean(기본 false)` | | URL 일치 확인 |

## 추출

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `get_text` | `ref?, selector?` | 요소의 textContent 추출 |
| `get_attribute` | `ref?, selector?, attribute: string` | 요소의 특정 속성값 추출 |

## 검사 (시각적 검증)

| 도구 | 파라미터 | 스크린샷 | 설명 |
|------|----------|:---:|------|
| `inspect` | `ref?, selector?, properties?: string[]` | O (요소) | 요소 상세 정보 반환: outerHTML, text, computedStyle, boundingBox, attributes + 요소 스크린샷 |
| `get_computed_style` | `ref?, selector?, properties: string[]` | | 지정한 CSS 속성값 조회 |
| `get_bounding_box` | `ref?, selector?` | | 요소의 x, y, width, height 반환 |

### inspect 반환 예시

```json
{
  "target": "ref=3",
  "tagName": "button",
  "outerHTML": "<button class=\"btn\">제출</button>",
  "text": "제출",
  "boundingBox": { "x": 100, "y": 200, "width": 80, "height": 36 },
  "computedStyle": { "color": "rgb(255, 255, 255)", "backgroundColor": "rgb(59, 130, 246)", ... },
  "attributes": { "class": "btn", "data-ete-ref": "3" }
}
```

## 대기

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `wait_for_element` | `ref?, selector?, state?: 'visible'/'hidden'/'attached'/'detached'(기본 visible), timeout?: number(기본 10000)` | 요소가 특정 상태에 도달할 때까지 대기 |
| `wait` | `ms: number` | 고정 시간 대기. 최대 10초 |

## 모니터링

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `console_messages` | `level?: 'all'/'error'/'warning'/'log'(기본 all), limit?: number(기본 50)` | 브라우저 콘솔 메시지 조회. FIFO 500개 유지 |
| `network_requests` | `urlPattern?: string, statusFilter?: 'all'/'errors'/'success'(기본 all), limit?: number(기본 50)` | 네트워크 요청/응답 조회. FIFO 500개 유지 |

### console_messages 반환 예시

```json
{
  "total": 12,
  "returned": 12,
  "messages": [
    { "type": "error", "text": "Uncaught TypeError: Cannot read property...", "timestamp": 1711234567890 },
    { "type": "log", "text": "[App] initialized", "timestamp": 1711234567891 }
  ]
}
```

### network_requests 반환 예시

```json
{
  "total": 45,
  "returned": 3,
  "entries": [
    { "method": "GET", "url": "https://api.example.com/users", "status": 200, "resourceType": "fetch", "responseTime": 142, "startTime": 1711234567890 },
    { "method": "POST", "url": "https://api.example.com/login", "status": 401, "resourceType": "fetch", "responseTime": 89, "startTime": 1711234567900 },
    { "method": "GET", "url": "https://cdn.example.com/image.png", "resourceType": "image", "failure": "net::ERR_CONNECTION_REFUSED", "startTime": 1711234567910 }
  ]
}
```

## 사용자 상호작용

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `ask_user` | `question: string` | 사용자에게 질문하고 답변 대기. WS clarification 메커니즘 사용 |

## 요소 타겟팅 방식 (셀렉터 형식)

ref 번호가 없을 때 사용하는 Playwright 셀렉터 형식:

```
text=Submit              → 보이는 텍스트로 찾기
role=button[name="OK"]   → ARIA role로 찾기
[data-testid="login"]    → data 속성으로 찾기
#email                   → ID로 찾기
.btn-primary             → 클래스로 찾기
input[type="email"]      → 속성으로 찾기
```
