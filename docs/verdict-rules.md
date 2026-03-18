# 테스트 판정 규칙

## 판정 흐름

```
AI 대화 종료
    │
    ├─ SDK result.subtype !== 'success' (턴 소진, 실행 에러)
    │   → 무조건 FAIL
    │
    ├─ SDK result.subtype === 'success'
    │   ├─ TEST_VERDICT 파싱 시도
    │   │
    │   ├─ TEST_VERDICT: PASS
    │   │   ├─ 서버 측 hasToolError === true → FAIL (오버라이드)
    │   │   └─ hasToolError === false → PASS
    │   │
    │   ├─ TEST_VERDICT: FAIL → FAIL
    │   │
    │   └─ TEST_VERDICT 없음 → FAIL (기본값)
    │
    └─ 대화 종료 without result message → FAIL
```

## PASS 조건 (모두 충족)

1. AI가 `TEST_VERDICT: PASS`를 명시적으로 출력
2. 서버 측에서 tool error 미감지 (`hasToolError === false`)

## FAIL 조건 (하나라도 해당)

- AI가 `TEST_VERDICT: FAIL` 출력
- AI가 `TEST_VERDICT`를 출력하지 않음
- 턴 소진 (`error_max_turns`)
- 실행 중 에러 (`error_during_execution`)
- assertion 도구 실패
- 브라우저 도구 에러 발생
- AI가 PASS 선언했지만 서버에서 tool error 감지 시 → FAIL 오버라이드

## TEST_VERDICT 형식

AI가 마지막에 반드시 출력해야 하는 형식:

```
TEST_VERDICT: PASS
REASON: 모든 배지 색상이 정상적으로 확인됨

TEST_VERDICT: FAIL
REASON: '소통' 메뉴를 찾을 수 없음
```

파싱: `verdict-parser.ts`에서 정규식 `TEST_VERDICT:\s*(PASS|FAIL)` 매칭.

## 서버 측 플래그

`McpBrowserContext`에서 추적:

| 플래그 | 설정 시점 | 용도 |
|--------|----------|------|
| `assertionExecuted` | assert_* 도구 호출 시 | (현재 로깅용, 향후 교차 검증 가능) |
| `hasAssertionFailure` | assertion 도구 실패 시 | AI가 PASS해도 FAIL로 오버라이드 |

## assertion 도구 동작

### 성공 시
- `textResult` 반환 (isError 미설정)
- 예: `{ success: true, assertion: 'text', result: 'PASS' }`

### 실패 시
- `errorResult` 반환 (`isError: true`)
- 스크린샷 첨부 (assert_visible, assert_text)
- `hasToolError = true` 설정
- 예: `ASSERTION FAILED: Expected text "로그인" in "#title", but got "회원가입". The test should FAIL.`

이렇게 하면 AI가 assertion 실패를 "도구는 정상, 결과만 다름"으로 오해하는 것을 방지한다.

## 시스템 프롬프트 판정 지시

AI에게 전달되는 핵심 규칙:
- assertion 도구 없이 PASS 선언 금지
- 요청된 요소를 찾지 못하면 즉시 FAIL
- 유사 요소 클릭 금지 — 정확히 일치하는 요소만
- assertion 실패 시 즉시 최종 verdict 출력
- 시각적 확인만으로 PASS 금지
