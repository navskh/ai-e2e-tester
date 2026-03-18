import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Marked } from 'marked';

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langClass}>${text}</code></pre>`;
    },
  },
});

function buildDocsPage(markdownHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI E2E Tester — API Docs</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233b82f6'/%3E%3Cstop offset='100%25' style='stop-color:%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='128' height='128' rx='28' fill='url(%23bg)'/%3E%3Cpath d='M52 30h24v22l18 36c2 4-1 8-5 8H39c-4 0-7-4-5-8l18-36V30z' fill='none' stroke='white' stroke-width='5' stroke-linejoin='round'/%3E%3Cline x1='48' y1='30' x2='80' y2='30' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3Cpath d='M47 76l9-18h16l9 18c2 4-1 8-5 8H52c-4 0-7-4-5-8z' fill='rgba(255,255,255,0.3)'/%3E%3Ccircle cx='96' cy='28' r='4' fill='white' opacity='0.9'/%3E%3Ccircle cx='104' cy='40' r='2.5' fill='white' opacity='0.7'/%3E%3Ccircle cx='88' cy='18' r='2.5' fill='white' opacity='0.7'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark-dimmed.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0b0f19;
      --surface: #131927;
      --surface2: #1a2236;
      --border: #1e2a42;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --heading: #f0f6fc;
      --accent: #818cf8;
      --accent-dim: #6366f1;
      --green: #7ee787;
      --yellow: #fbbf24;
      --red: #f87171;
      --code-bg: #0d1117;
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      font-size: 15px;
    }

    /* Layout */
    .layout { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      overflow-y: auto;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 24px 0;
      z-index: 100;
    }

    .sidebar-logo {
      padding: 0 20px 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }

    .sidebar-logo h1 {
      font-size: 16px;
      color: var(--heading);
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .sidebar-logo .badge {
      display: inline-block;
      margin-top: 6px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--accent-dim);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
    }

    .sidebar nav { padding: 0 12px; }

    .sidebar a {
      display: block;
      padding: 6px 12px;
      border-radius: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      transition: all 0.15s;
    }

    .sidebar a:hover { color: var(--heading); background: var(--surface2); }
    .sidebar a.depth-2 { padding-left: 24px; font-size: 12px; }
    .sidebar a.depth-2::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--border); margin-right: 8px; vertical-align: middle; }

    /* Main content */
    .content {
      margin-left: 280px;
      flex: 1;
      max-width: 860px;
      padding: 48px 56px 120px;
    }

    /* Typography */
    .content h1 {
      font-size: 32px;
      font-weight: 800;
      color: var(--heading);
      margin: 48px 0 12px;
      letter-spacing: -0.5px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .content h1:first-child { margin-top: 0; }

    .content h2 {
      font-size: 22px;
      font-weight: 700;
      color: var(--heading);
      margin: 40px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .content h3 {
      font-size: 17px;
      font-weight: 600;
      color: var(--heading);
      margin: 28px 0 8px;
    }

    .content h4 {
      font-size: 15px;
      font-weight: 600;
      color: #e5e7eb;
      margin: 20px 0 6px;
    }

    .content p { margin: 0 0 14px; }

    .content a { color: var(--accent); text-decoration: none; }
    .content a:hover { text-decoration: underline; }

    .content strong { color: var(--heading); font-weight: 600; }
    .content em { color: #e5e7eb; }

    .content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }

    .content blockquote {
      border-left: 3px solid var(--accent-dim);
      padding: 10px 16px;
      margin: 14px 0;
      background: var(--surface);
      border-radius: 0 8px 8px 0;
      color: var(--text-muted);
    }

    .content blockquote p { margin: 0; }

    /* Lists */
    .content ul, .content ol { padding-left: 22px; margin: 0 0 14px; }
    .content li { margin: 4px 0; }
    .content li > ul, .content li > ol { margin: 4px 0 4px; }

    /* Inline code */
    .content code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 13px;
      background: var(--surface2);
      color: var(--yellow);
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* Code blocks */
    .content pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0;
      overflow: hidden;
      margin: 12px 0 18px;
      position: relative;
    }

    .content pre code {
      display: block;
      background: none;
      color: #adbac7;
      padding: 18px 20px;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
    }

    /* highlight.js overrides for our theme */
    .content pre code.hljs {
      background: var(--code-bg);
      padding: 18px 20px;
    }

    /* Language label */
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 16px;
      background: #161b22;
      border-bottom: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .code-header .lang-label {
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--accent);
    }

    .code-header .copy-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 2px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
    }

    .code-header .copy-btn:hover {
      color: var(--heading);
      border-color: var(--text-muted);
      background: var(--surface2);
    }

    .code-header .copy-btn.copied {
      color: var(--green);
      border-color: var(--green);
    }

    /* Tables */
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 18px;
      font-size: 13px;
    }

    .content thead { background: var(--surface); }

    .content th {
      padding: 10px 14px;
      border: 1px solid var(--border);
      color: var(--heading);
      font-weight: 600;
      text-align: left;
    }

    .content td {
      padding: 8px 14px;
      border: 1px solid var(--border);
      color: var(--text);
    }

    .content tr:hover td { background: var(--surface); }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #2a3a5a; }

    /* Mobile */
    @media (max-width: 900px) {
      .sidebar { display: none; }
      .content { margin-left: 0; padding: 24px 20px 80px; }
    }

    /* Top bar for mobile */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 16px;
      align-items: center;
      z-index: 200;
      font-size: 14px;
      font-weight: 600;
      color: var(--heading);
    }

    @media (max-width: 900px) {
      .mobile-header { display: flex; }
      .content { padding-top: 72px; }
    }
  </style>
</head>
<body>
  <div class="mobile-header">AI E2E Tester — API Docs</div>
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <h1>AI E2E Tester</h1>
        <span class="badge">API v0.1.0</span>
      </div>
      <nav id="sidebar-nav"></nav>
    </aside>
    <main class="content" id="content">
      ${markdownHtml}
    </main>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/python.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/yaml.min.js"></script>
  <script>
    // Syntax highlighting
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);

      // Add language header + copy button
      const pre = block.parentElement;
      const langMatch = block.className.match(/language-(\\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      const header = document.createElement('div');
      header.className = 'code-header';

      const langLabel = document.createElement('span');
      langLabel.className = 'lang-label';
      langLabel.textContent = lang || 'code';
      header.appendChild(langLabel);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(block.textContent || '').then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
      header.appendChild(copyBtn);

      pre.insertBefore(header, block);
    });

    // Build sidebar navigation from headings
    const content = document.getElementById('content');
    const nav = document.getElementById('sidebar-nav');
    const headings = content.querySelectorAll('h1, h2, h3');

    headings.forEach((h, i) => {
      const id = 'section-' + i;
      h.id = id;
      const depth = parseInt(h.tagName[1]);
      if (depth > 3) return;
      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = h.textContent;
      if (depth >= 2) a.classList.add('depth-2');
      nav.appendChild(a);
    });
  </script>
</body>
</html>`;
}

let cachedHtml: string | null = null;
const isDev = process.env.NODE_ENV !== 'production';

export async function docsRoutes(app: FastifyInstance) {
  app.get('/docs', async (_request, reply) => {
    if (!cachedHtml || isDev) {
      const mdPath = resolve(import.meta.dirname ?? '.', '../../../../../API.md');
      const markdown = readFileSync(mdPath, 'utf-8');
      const rendered = await marked.parse(markdown);
      cachedHtml = buildDocsPage(rendered);
    }
    reply.type('text/html').send(cachedHtml);
  });
}
