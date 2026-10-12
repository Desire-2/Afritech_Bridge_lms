/**
 * Dependency-free DOM-based HTML sanitizer for surfaces that inject stored
 * HTML via `dangerouslySetInnerHTML` (e.g. project descriptions).
 *
 * For markdown, do NOT use this file: markdown goes through the shared
 * react-markdown pipeline in `src/lib/markdown.ts`, which sanitizes with
 * `rehype-sanitize` after `rehype-raw`. Keeping one markdown policy avoids
 * the divergent/regex-based sanitizers this module used to export.
 *
 * Only for use in client components (requires DOMParser).
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col',
  'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
  'tr', 'u', 'ul', 'var', 'wbr',
]);

const ALLOWED_ATTRS = new Set([
  'align', 'alt', 'class', 'colspan', 'datetime', 'href', 'id', 'lang',
  'rowspan', 'src', 'srcset', 'start', 'title', 'type', 'value',
]);

const DANGEROUS_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template',
  'link', 'meta', 'base', 'form', 'input', 'textarea', 'select', 'button',
  'canvas', 'svg', 'math',
]);

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('data:')
  ) {
    return false;
  }
  return true;
}

function sanitizeNode(node: Node): void {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (DANGEROUS_TAGS.has(tagName) || !ALLOWED_TAGS.has(tagName)) {
    // Keep text content of unknown wrappers (e.g. <custom-thing>foo</custom-thing>
    // becomes "foo") but drop dangerous containers entirely.
    if (DANGEROUS_TAGS.has(tagName)) {
      element.parentNode?.removeChild(element);
    } else {
      const fragment = element.ownerDocument!.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      element.parentNode?.replaceChild(fragment, element);
    }
    return;
  }

  // Strip disallowed / dangerous attributes.
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }
    if (!ALLOWED_ATTRS.has(name)) {
      element.removeAttribute(attr.name);
      continue;
    }
    if ((name === 'href' || name === 'src' || name === 'srcset') && !isSafeUrl(value)) {
      element.removeAttribute(attr.name);
    }
  }

  // <a> without a safe href should not be focusable/clickable traps.
  if (tagName === 'a' && !element.hasAttribute('href')) {
    element.removeAttribute('target');
  }

  // Recurse over a static child list (mutations during traversal are fine
  // because Array.from snapshots first).
  for (const child of Array.from(element.childNodes)) {
    sanitizeNode(child);
  }
}

/**
 * Sanitize an HTML string for safe injection via dangerouslySetInnerHTML.
 * Returns '' for non-string input. Requires a DOM (client-only).
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || html === '') return '';
  if (typeof DOMParser === 'undefined') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const child of Array.from(doc.body.childNodes)) {
    sanitizeNode(child);
  }
  return doc.body.innerHTML;
}
