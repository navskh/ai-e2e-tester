# 디렉토리 구조

```
ai-e2e-tester/
├── apps/
│   ├── server/src/                    # 백엔드 서버
│   │   ├── ai/                        # AI 관련 모듈
│   │   │   ├── system-prompt.ts       # 테스트/setup 시스템 프롬프트
│   │   │   ├── verdict-parser.ts      # TEST_VERDICT 파싱 유틸리티
│   │   │   ├── context-builder.ts     # 접근성 트리 추출 (snapshot용)
│   │   │   └── tools/                 # [레거시] 미사용, 삭제 금지
│   │   │
│   │   ├── services/                  # 핵심 서비스
│   │   │   ├── ai-agent.ts            # Claude Code SDK query() 래퍼
│   │   │   ├── mcp-browser-server.ts  # MCP 브라우저 도구 서버 (18개 도구)
│   │   │   ├── test-orchestrator.ts   # 테스트 라이프사이클 관리
│   │   │   ├── browser-manager.ts     # Playwright 세션 생성/종료
│   │   │   ├── auth-state-manager.ts  # storageState 캐싱/복원/만료
│   │   │   ├── session-store.ts       # WS 세션 + clarification 관리
│   │   │   └── mail.ts               # 이메일 알림 (nodemailer)
│   │   │
│   │   ├── routes/                    # HTTP/WS 라우트
│   │   │   ├── api/tests.ts           # REST API (CRUD)
│   │   │   ├── api/health.ts          # 헬스체크
│   │   │   ├── api/docs.ts            # API 문서
│   │   │   ├── ws/handler.ts          # WebSocket 핸들러
│   │   │   └── internal/pw.ts         # [레거시] curl용 Playwright 래퍼, 삭제 금지
│   │   │
│   │   ├── db/                        # 데이터베이스
│   │   │   ├── schema.ts              # Drizzle ORM 스키마 (3 테이블)
│   │   │   ├── client.ts              # DB 연결
│   │   │   └── init.ts                # DB 초기화
│   │   │
│   │   ├── config.ts                  # 환경 설정 (.env 로드)
│   │   ├── index.ts                   # 서버 진입점
│   │   └── utils/logger.ts            # pino 로거
│   │
│   └── web/                           # 프론트엔드 (Vite + React)
│
├── packages/
│   └── shared/src/                    # 공유 타입
│       ├── types/test-run.ts          # TestRun, TestStep, TestRunCreateRequest
│       ├── types/ws-messages.ts       # ServerMessage, ClientMessage
│       ├── types/api.ts               # ApiResponse, PaginationQuery
│       └── constants/ws-events.ts     # WS 이벤트 상수
│
├── data/                              # 런타임 데이터 (gitignore)
│   ├── test-runs.db                   # SQLite 데이터베이스
│   ├── screenshots/                   # 테스트 스크린샷
│   └── auth-states/                   # 도메인별 인증 캐시
│
├── docs/                              # 프로젝트 문서
├── ecosystem.config.cjs               # PM2 설정
├── CLAUDE.md                          # Claude Code 컨텍스트 (이 문서 참조)
└── package.json                       # 모노레포 루트
```

## DB 스키마 (3 테이블)

### test_runs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | nanoid |
| prompt | TEXT | 테스트 지시 |
| setup | TEXT | 사전 작업 지시 (nullable) |
| status | TEXT | pending/running/paused/passed/failed/cancelled |
| summary | TEXT | AI 판정 결과 요약 |
| started_at | TEXT | 시작 시각 (ISO) |
| completed_at | TEXT | 완료 시각 |
| duration_ms | INTEGER | 소요 시간 |

### test_steps
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | nanoid |
| test_run_id | TEXT FK | test_runs 참조 (cascade delete) |
| step_index | INTEGER | 실행 순서 |
| tool | TEXT | 도구 이름 (navigate, click 등) |
| input | JSON | 도구 입력 파라미터 |
| result | TEXT | 실행 결과 |
| status | TEXT | running/passed/failed/skipped |
| screenshot_path | TEXT | 스크린샷 파일명 |
| created_at | TEXT | 시각 |

### conversations
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | nanoid |
| test_run_id | TEXT FK | test_runs 참조 (cascade delete) |
| role | TEXT | assistant/user/system |
| content | TEXT | 메시지 내용 |
| created_at | TEXT | 시각 |
