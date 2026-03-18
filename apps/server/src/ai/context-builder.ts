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
