# MCP 브라우저 도구

MCP 서버명: `browser` → 도구 이름 형식: `mcp__browser__{tool_name}`

모든 도구는 `tracked()` 래퍼로 감싸져 있어 자동으로:
- DB에 test_steps 기록
- WS로 step:started/completed/failed 브로드캐스트
- 에러 시 자동 스크린샷 + hasToolError 플래그 설정

## 네비게이션

| 도구 | 파라미터 | 스크린샷 | 설명 |
|------|----------|:---:|------|
| `navigate` | `url: string` | O | URL로 이동. domcontentloaded 대기. 30초 타임아웃 |
| `go_back` | (없음) | | 브라우저 뒤로 가기 |
| `reload` | (없음) | O | 페이지 새로고침 |

## 인터랙션

| 도구 | 파라미터 | 스크린샷 | 설명 |
|------|----------|:---:|------|
| `click` | `selector: string` | O | 요소 클릭. 10초 타임아웃 |
| `type_text` | `selector: string, text: string, clear?: boolean(기본 true)` | | 텍스트 입력. clear=true면 fill(), false면 pressSequentially() |
| `select_option` | `selector: string, value: string` | | 드롭다운 옵션 선택 |
| `hover` | `selector: string` | | 요소 호버 |
| `press_key` | `key: string` | | 키보드 입력 (Enter, Tab, Escape 등) |

## 페이지 정보

| 도구 | 파라미터 | 반환 | 설명 |
|------|----------|------|------|
| `snapshot` | (없음) | 접근성 트리 (텍스트) | 페이지 구조 파악용. 셀렉터 찾기에 필수 |
| `screenshot` | `fullPage?: boolean(기본 false)` | base64 이미지 | 현재 화면 캡처 |

## Assertion

assertion 도구는 성공 시 `textResult`, 실패 시 `errorResult`(isError: true)를 반환한다.
실패 시 `hasToolError` 플래그가 설정되어 AI가 PASS를 선언해도 서버에서 FAIL로 오버라이드한다.

| 도구 | 파라미터 | 실패 시 스크린샷 | 설명 |
|------|----------|:---:|------|
| `assert_visible` | `selector: string, timeout?: number(기본 5000)` | O | 요소 표시 여부 확인 |
| `assert_text` | `selector: string, expected: string, exact?: boolean(기본 false)` | O | 텍스트 일치 확인. exact=false면 includes() |
| `assert_url` | `expected: string, exact?: boolean(기본 false)` | | URL 일치 확인 |

## 추출

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `get_text` | `selector: string` | 요소의 textContent 추출 |
| `get_attribute` | `selector: string, attribute: string` | 요소의 특정 속성값 추출 |

## 대기

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `wait_for_element` | `selector: string, state?: 'visible'/'hidden'/'attached'/'detached'(기본 visible), timeout?: number(기본 10000)` | 요소가 특정 상태에 도달할 때까지 대기 |
| `wait` | `ms: number` | 고정 시간 대기. 최대 10초 |

## 사용자 상호작용

| 도구 | 파라미터 | 설명 |
|------|----------|------|
| `ask_user` | `question: string` | 사용자에게 질문하고 답변 대기. WS clarification 메커니즘 사용 |

## 셀렉터 형식 (Playwright)

```
text=Submit              → 보이는 텍스트로 찾기
role=button[name="OK"]   → ARIA role로 찾기
[data-testid="login"]    → data 속성으로 찾기
#email                   → ID로 찾기
.btn-primary             → 클래스로 찾기
input[type="email"]      → 속성으로 찾기
```
