# 실행 및 배포

## 개발 모드

```bash
# PM2 먼저 중지 (포트 충돌 방지)
pm2 stop ai-e2e-tester

# dev 서버 실행 (tsx watch — 파일 변경 시 자동 재시작)
cd ~/ai-e2e-tester/apps/server
pnpm run dev
```

PowerShell에서는 `&&` 대신 `;`으로 명령어 연결:
```powershell
cd ~/ai-e2e-tester/apps/server; pnpm run dev
```

## PM2 (프로덕션)

```bash
# 시작 (ecosystem.config.cjs 기반)
pm2 start ecosystem.config.cjs

# 개별 재시작
pm2 restart ai-e2e-tester

# 로그 확인
pm2 logs ai-e2e-tester --lines 50

# 상태 확인
pm2 list
```

### PM2 프로세스 목록

| 이름 | 역할 | 포트 |
|------|------|------|
| `ai-e2e-tester` | 백엔드 서버 | 4820 |
| `ai-e2e-web` | 프론트엔드 (Vite) | 5173 |
| `ngrok-tester` | ngrok 터널 | - |

## ngrok (외부 접근)

```bash
# ngrok config에 jabis-tester 터널 정의됨
ngrok start jabis-tester
# → https://jabis-tester.ngrok.app
```

ngrok 설정 파일: `%LOCALAPPDATA%/ngrok/ngrok.yml`

ngrok은 포트 4820으로 프록시하므로 서버가 dev든 PM2든 상관없다.

## DB 스키마 변경 시

```bash
cd ~/ai-e2e-tester/apps/server

# Drizzle Kit으로 push (실패할 수 있음)
pnpm run db:push

# 실패 시 직접 SQL로 변경
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/test-runs.db');
db.exec('ALTER TABLE test_runs ADD COLUMN new_column TEXT');
"
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `4820` | 서버 포트 |
| `HOST` | `0.0.0.0` | 바인드 호스트 |
| `DB_PATH` | `./data/test-runs.db` | SQLite 경로 |
| `SCREENSHOTS_DIR` | `./data/screenshots` | 스크린샷 저장 |
| `AUTH_STATE_DIR` | `./data/auth-states` | 인증 캐시 저장 |
| `AUTH_STATE_TTL_MS` | `14400000` | 인증 캐시 TTL (4시간) |
| `SETUP_MAX_TURNS` | `30` | setup 에이전트 최대 턴 |
| `MAX_CONCURRENT_TESTS` | `3` | 동시 실행 테스트 수 |
| `LOG_LEVEL` | `info` | 로그 레벨 |
| `AUTH_TOKEN` | (없음) | API 인증 토큰 (선택) |

`.env` 파일을 `apps/server/` 디렉토리에 두면 자동 로드.
