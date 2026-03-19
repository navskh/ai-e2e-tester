import type { Page } from 'playwright';

interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
  focused?: boolean;
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
}

function formatNode(node: AccessibilityNode, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const attrs: string[] = [];

  if (node.name) attrs.push(`name="${node.name}"`);
  if (node.value) attrs.push(`value="${node.value}"`);
  if (node.focused) attrs.push('focused');
  if (node.checked !== undefined) attrs.push(`checked=${node.checked}`);
  if (node.disabled) attrs.push('disabled');
  if (node.expanded !== undefined) attrs.push(`expanded=${node.expanded}`);
  if (node.selected) attrs.push('selected');
  if (node.level) attrs.push(`level=${node.level}`);

  const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
  let result = `${prefix}${node.role}${attrStr}\n`;

  if (node.children) {
    for (const child of node.children) {
      result += formatNode(child, indent + 1);
    }
  }

  return result;
}

export async function buildPageContext(page: Page): Promise<string> {
  try {
    const snapshot = await page.accessibility.snapshot();
    if (!snapshot) return 'Page accessibility tree is empty.';
    return formatNode(snapshot as AccessibilityNode);
  } catch {
    return 'Unable to capture accessibility tree.';
  }
}

// === ref-based targeting ===

export interface RefEntry {
  ref: number;
  tag: string;
  text: string;
  role?: string;
  type?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  placeholder?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  value?: string;
}

export interface PageContextWithRefs {
  refMap: RefEntry[];
  formatted: string;
  url: string;
  title: string;
}

const INTERACTIVE_SELECTOR = [
  'a', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="tab"]',
  '[role="menuitem"]', '[role="checkbox"]', '[role="radio"]',
  '[role="switch"]', '[tabindex]:not([tabindex="-1"])',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'label', 'img', 'nav', 'main',
].join(', ');

export async function buildPageContextWithRefs(page: Page): Promise<PageContextWithRefs> {
  const refMap = await page.evaluate((selector: string) => {
    // Clean up previous refs
    document.querySelectorAll('[data-ete-ref]').forEach(el => el.removeAttribute('data-ete-ref'));

    const viewportHeight = window.innerHeight;
    const maxY = viewportHeight * 3;
    const elements = document.querySelectorAll(selector);
    const entries: RefEntry[] = [];
    let refCounter = 1;

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Skip invisible elements
      if (rect.width <= 0 || rect.height <= 0) return;
      // Skip elements too far below viewport (3x)
      if (rect.top > maxY) return;

      const ref = refCounter++;
      el.setAttribute('data-ete-ref', String(ref));

      const htmlEl = el as HTMLElement;
      const inputEl = el as HTMLInputElement;

      const entry: RefEntry = {
        ref,
        tag: el.tagName.toLowerCase(),
        text: (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 100),
      };

      const role = el.getAttribute('role');
      if (role) entry.role = role;

      const type = el.getAttribute('type');
      if (type) entry.type = type;

      if (el.id) entry.id = el.id;

      const name = el.getAttribute('name');
      if (name) entry.name = name;

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) entry.ariaLabel = ariaLabel;

      const placeholder = el.getAttribute('placeholder');
      if (placeholder) entry.placeholder = placeholder;

      const href = el.getAttribute('href');
      if (href) entry.href = href;

      if (htmlEl.hasAttribute('disabled') || inputEl.disabled) entry.disabled = true;

      if ('checked' in inputEl && (inputEl.type === 'checkbox' || inputEl.type === 'radio')) {
        entry.checked = inputEl.checked;
      }

      if ('value' in inputEl && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
        const val = inputEl.value;
        if (val) entry.value = val.slice(0, 100);
      }

      entries.push(entry);
    });

    return entries;
  }, INTERACTIVE_SELECTOR) as RefEntry[];

  // Format for AI consumption
  const lines = refMap.map(e => {
    const parts: string[] = [];
    // Determine display role
    const displayRole = e.role || e.tag;
    parts.push(`[ref=${e.ref}] ${displayRole}`);

    if (e.type) parts.push(`type=${e.type}`);
    if (e.text) parts.push(`"${e.text}"`);
    if (e.ariaLabel && e.ariaLabel !== e.text) parts.push(`aria-label="${e.ariaLabel}"`);
    if (e.placeholder) parts.push(`placeholder="${e.placeholder}"`);
    if (e.href) parts.push(`href="${e.href}"`);
    if (e.id) parts.push(`id="${e.id}"`);
    if (e.name) parts.push(`name="${e.name}"`);
    if (e.value) parts.push(`value="${e.value}"`);
    if (e.disabled) parts.push('(disabled)');
    if (e.checked !== undefined) parts.push(e.checked ? '(checked)' : '(unchecked)');

    return parts.join(' ');
  });

  return {
    refMap,
    formatted: lines.join('\n'),
    url: page.url(),
    title: await page.title(),
  };
}
