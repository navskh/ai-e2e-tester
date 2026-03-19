# AI E2E Tester

범용 AI 기반 E2E 웹 테스트 도구. Claude Code SDK로 AI가 Playwright 브라우저를 직접 조작하며 테스트를 수행한다.

## 문서

상세 문서는 `docs/` 디렉토리를 참조.

- [아키텍처](docs/architecture.md) — 시스템 구조, 동작 흐름, 핵심 컴포넌트
- [디렉토리 구조](docs/directory-structure.md) — 파일/폴더 배치와 역할
- [API 스펙](docs/api.md) — REST API, WebSocket, 요청/응답 형식
- [테스트 판정 규칙](docs/verdict-rules.md) — PASS/FAIL 판정 로직, assertion 동작
- [인증 캐싱 (setup + reuseAuth)](docs/auth-caching.md) — 로그인 자동화, storageState 재사용
- [MCP 브라우저 도구](docs/mcp-tools.md) — 23개 도구 목록, 파라미터, 반환값
- [실행 및 배포](docs/running.md) — 개발/PM2/ngrok 실행 방법

## 주의사항

- zod는 반드시 **v3** 사용. v4는 MCP SDK의 `zod-to-json-schema`와 비호환.
- `allowedTools`는 도구를 "제한"하지 않음. 기본 도구 차단은 `disallowedTools` 사용.
- `ai/tools/` 디렉토리와 `routes/internal/pw.ts`는 레거시. 삭제하지 말 것.
- PM2 실행 중이면 dev 모드와 포트 충돌. PM2 먼저 stop 후 dev 실행.

## 기술 스택

Node.js, TypeScript(ESM), pnpm 모노레포, Fastify, SQLite(Drizzle ORM), Playwright, Claude Code SDK, zod v3, PM2
