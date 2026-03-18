import nodemailer from 'nodemailer';
import { Marked } from 'marked';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.office365.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
});

interface TestResult {
  testRunId: string;
  prompt: string;
  status: string;
  summary: string | null;
  durationMs: number;
  stepsCount: number;
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'passed': return '✅';
    case 'warning': return '⚠️';
    case 'failed': return '❌';
    case 'cancelled': return '⏹';
    default: return '⚪';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'passed': return '통과';
    case 'warning': return '경고';
    case 'failed': return '실패';
    case 'cancelled': return '취소됨';
    default: return status;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}초`;
}

// Email-safe inline-styled markdown renderer
const emailMarked = new Marked({
  renderer: {
    heading({ text, depth }) {
      const styles: Record<number, string> = {
        1: 'margin:16px 0 8px;font-size:18px;font-weight:700;color:#f9fafb;',
        2: 'margin:14px 0 6px;font-size:16px;font-weight:600;color:#f9fafb;',
        3: 'margin:12px 0 4px;font-size:14px;font-weight:600;color:#e5e7eb;',
      };
      return `<h${depth} style="${styles[depth] || styles[3]}">${text}</h${depth}>`;
    },
    paragraph({ text }) {
      return `<p style="margin:0 0 10px;font-size:13px;color:#d1d5db;line-height:1.6;">${text}</p>`;
    },
    list({ items, ordered }) {
      const tag = ordered ? 'ol' : 'ul';
      const listStyle = ordered ? 'decimal' : 'disc';
      const inner = items.map(item => item.raw ? this.listitem(item) : '').join('');
      return `<${tag} style="margin:0 0 12px;padding-left:20px;list-style:${listStyle};">${inner}</${tag}>`;
    },
    listitem({ text }) {
      return `<li style="margin:0 0 4px;font-size:13px;color:#d1d5db;line-height:1.5;">${text}</li>`;
    },
    strong({ text }) {
      return `<strong style="font-weight:600;color:#f9fafb;">${text}</strong>`;
    },
    em({ text }) {
      return `<em style="font-style:italic;color:#e5e7eb;">${text}</em>`;
    },
    codespan({ text }) {
      return `<code style="background:#374151;color:#fbbf24;padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace;">${text}</code>`;
    },
    code({ text }) {
      return `<pre style="background:#0d1117;border:1px solid #374151;border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;"><code style="font-size:12px;color:#7ee787;font-family:monospace;white-space:pre-wrap;">${text}</code></pre>`;
    },
    hr() {
      return `<hr style="border:none;border-top:1px solid #374151;margin:16px 0;">`;
    },
    blockquote({ text }) {
      return `<blockquote style="border-left:3px solid #6366f1;padding:8px 12px;margin:8px 0;background:#1e1b4b;border-radius:0 6px 6px 0;">${text}</blockquote>`;
    },
    link({ href, text }) {
      return `<a href="${href}" style="color:#818cf8;text-decoration:underline;">${text}</a>`;
    },
    table({ header, rows }) {
      const bodyRows = (rows as any[]).map((row: any) => {
        if (typeof row === 'string') return `<tr>${row}</tr>`;
        if (row?.text) return `<tr>${row.text}</tr>`;
        return '';
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px;"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
    },
    tablerow({ text }) {
      return `<tr>${text}</tr>`;
    },
    tablecell({ text, header }) {
      const tag = header ? 'th' : 'td';
      const style = header
        ? 'padding:6px 10px;border:1px solid #374151;background:#111827;color:#e5e7eb;font-weight:600;text-align:left;'
        : 'padding:6px 10px;border:1px solid #374151;color:#d1d5db;';
      return `<${tag} style="${style}">${text}</${tag}>`;
    },
  },
});

function renderSummaryHtml(summary: string): string {
  return emailMarked.parse(summary) as string;
}

function buildHtml(result: TestResult): string {
  const emoji = statusEmoji(result.status);
  const label = statusLabel(result.status);
  const bgColor = result.status === 'passed' ? '#065f46' : result.status === 'failed' ? '#7f1d1d' : '#374151';
  const badgeColor = result.status === 'passed' ? '#10b981' : result.status === 'failed' ? '#ef4444' : '#6b7280';

  const summaryHtml = result.summary ? renderSummaryHtml(result.summary) : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- 헤더 -->
    <div style="background:#1f2937;border-radius:12px 12px 0 0;padding:24px;border-bottom:2px solid ${badgeColor};">
      <h1 style="margin:0;font-size:20px;color:#f9fafb;">
        ${emoji} AI E2E 테스트 ${label}
      </h1>
    </div>

    <!-- 본문 -->
    <div style="background:#1f2937;padding:24px;border-radius:0 0 12px 12px;">
      <!-- 상태 배지 -->
      <div style="margin-bottom:20px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${bgColor};color:#f9fafb;font-size:13px;font-weight:600;">
          ${emoji} ${label}
        </span>
      </div>

      <!-- 테스트 설명 -->
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">테스트 설명</div>
        <div style="font-size:14px;color:#e5e7eb;background:#111827;padding:12px;border-radius:8px;border:1px solid #374151;">
          ${escapeHtml(result.prompt)}
        </div>
      </div>

      <!-- 요약 (마크다운 렌더링) -->
      ${summaryHtml ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">결과 요약</div>
        <div style="font-size:13px;background:#111827;padding:16px;border-radius:8px;border:1px solid #374151;">
          ${summaryHtml}
        </div>
      </div>
      ` : ''}

      <!-- 메타 정보 -->
      <div style="display:flex;gap:16px;margin-top:16px;">
        <div style="flex:1;background:#111827;padding:12px;border-radius:8px;border:1px solid #374151;text-align:center;">
          <div style="font-size:11px;color:#9ca3af;">소요 시간</div>
          <div style="font-size:16px;color:#f9fafb;font-weight:600;margin-top:4px;">${formatDuration(result.durationMs)}</div>
        </div>
        <div style="flex:1;background:#111827;padding:12px;border-radius:8px;border:1px solid #374151;text-align:center;">
          <div style="font-size:11px;color:#9ca3af;">실행 단계</div>
          <div style="font-size:16px;color:#f9fafb;font-weight:600;margin-top:4px;">${result.stepsCount}단계</div>
        </div>
      </div>

      <!-- 링크 -->
      <div style="margin-top:20px;text-align:center;">
        <a href="https://jabis-tester.ngrok.app/test/${result.testRunId}"
           style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">
          상세 결과 보기
        </a>
      </div>
    </div>

    <!-- 푸터 -->
    <div style="text-align:center;margin-top:16px;">
      <p style="font-size:11px;color:#6b7280;">AI E2E 테스터 자동 알림</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendTestResultEmail(result: TestResult): Promise<void> {
  const label = statusLabel(result.status);
  const emoji = statusEmoji(result.status);

  try {
    await transporter.sendMail({
      from: 'navskh@jinhakapply.com',
      to: 'navskh@jinhakapply.com',
      subject: `${emoji} [AI E2E] 테스트 ${label} — ${result.prompt.slice(0, 50)}`,
      html: buildHtml(result),
    });
    logger.info({ testRunId: result.testRunId }, 'Test result email sent');
  } catch (err) {
    logger.error({ err, testRunId: result.testRunId }, 'Failed to send test result email');
  }
}
