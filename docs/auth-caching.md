# 인증 캐싱 (setup + reuseAuth)

## 개요

테스트마다 반복되는 로그인을 최적화하기 위한 기능.
Playwright의 `storageState` (쿠키 + localStorage)를 도메인별로 캐싱하여 재사용한다.

## 사용법

### API 호출

```json
{
  "prompt": "직원 근태 현황 페이지에서 배지 색상 확인",
  "setup": "https://app.example.com 에 접속해서 ID: user@test.com PW: pass123 로 로그인",
  "options": { "reuseAuth": true }
}
```

### 동작

| 상황 | 결과 |
|------|------|
| 첫 실행 (캐시 없음) | setup 에이전트가 로그인 수행 → storageState 저장 → 본 테스트 |
| 재실행 (캐시 있음, 유효) | 로그인 건너뜀 → storageState 복원 → 본 테스트만 |
| 재실행 (캐시 만료) | setup 에이전트가 다시 로그인 → storageState 재저장 |
| `reuseAuth` 미지정/false | 매번 setup 실행 (캐시 안 씀) |
| `setup` 미지정 | 기존처럼 prompt만 실행 |

## 캐시 관리

### 저장 위치
`data/auth-states/{domain-hash}.json`

도메인은 URL에서 자동 추출 (prompt, setup, targetUrl 순서로 탐색).
해시는 SHA-256의 앞 16자.

### 파일 형식
```json
{
  "savedAt": "2026-03-18T14:30:00.000Z",
  "storageState": {
    "cookies": [...],
    "origins": [{ "origin": "https://...", "localStorage": [...] }]
  }
}
```

### TTL (만료)
- 기본: 4시간 (14,400,000ms)
- 환경변수: `AUTH_STATE_TTL_MS`
- 만료된 캐시는 다음 접근 시 자동 삭제

### 자동 무효화
- 본 테스트가 실패 + 캐시된 인증 사용 시 → 캐시 자동 삭제
- 이유: 인증 만료로 인한 실패일 가능성

### 수동 무효화
```typescript
authStateManager.invalidateState('app.example.com');
```

## setup 에이전트

| 항목 | 값 |
|------|-----|
| 프롬프트 | `buildSetupPrompt()` — 로그인 전용 간결한 프롬프트 |
| maxTurns | 30 (환경변수 `SETUP_MAX_TURNS`) |
| 판정 | 본 테스트와 동일 (TEST_VERDICT 필요) |
| 실패 시 | 본 테스트 실행하지 않고 전체 테스트 실패 |

setup과 본 테스트는 같은 브라우저 세션을 공유한다.
setup이 끝나면 로그인된 상태의 페이지를 그대로 본 테스트 에이전트가 이어받는다.

## 설정

| 환경변수 | 기본값 | 설명 |
|---------|--------|------|
| `AUTH_STATE_DIR` | `./data/auth-states` | 캐시 저장 디렉토리 |
| `AUTH_STATE_TTL_MS` | `14400000` (4시간) | 캐시 만료 시간 |
| `SETUP_MAX_TURNS` | `30` | setup 에이전트 최대 턴 |
