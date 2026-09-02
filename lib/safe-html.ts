/**
 * Sanitizer for operator-entered rich-text HTML coming from the Bond API
 * (program / session / product descriptions authored in Bond's back office).
 *
 * `sanitizeDescriptionHtml` produces markup safe for dangerouslySetInnerHTML
 * by REBUILDING the string: only bare allowlisted tags are emitted
 * (attributes are always dropped, except a validated `href` on links),
 * unknown tags are removed with their inner text kept, and any stray `<`
 * left in text is escaped. Script-like elements lose their content entirely.
 * Text entities (`&ndash;` etc.) are left as-is — the browser decodes them.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
]);

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|svg|math|title|textarea|noscript|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
// Tag token with quote-aware attribute body so `>` inside quoted attributes
// doesn't end the tag early.
const TAG_TOKEN = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
const HREF_ATTR = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Sanitizes rich-text HTML for rendering. Returns undefined when the input is
 * empty or has no visible text left after sanitizing.
 */
export function sanitizeDescriptionHtml(html?: string): string | undefined {
  if (!html) return undefined;

  const source = html.replace(HTML_COMMENT, '').replace(DROP_WITH_CONTENT, '');

  const out: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_TOKEN.lastIndex = 0;
  while ((match = TAG_TOKEN.exec(source))) {
    out.push(source.slice(lastIndex, match.index).replace(/</g, '&lt;'));
    lastIndex = TAG_TOKEN.lastIndex;

    const isClosing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (tag === 'a') {
      if (isClosing) {
        out.push('</a>');
      } else {
        const href = match[3]?.match(HREF_ATTR);
        const url = href?.[1] ?? href?.[2] ?? href?.[3] ?? '';
        out.push(
          SAFE_HREF.test(url)
            ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">`
            : '<a>',
        );
      }
    } else if (ALLOWED_TAGS.has(tag)) {
      out.push(isClosing ? `</${tag}>` : `<${tag}>`);
    }
    // Unknown tags are dropped; their inner text was already kept above.
  }
  out.push(source.slice(lastIndex).replace(/</g, '&lt;'));

  const result = out
    .join('')
    // Quill-style empty paragraphs (`<p><br></p>`) only add stray gaps.
    .replace(/<p>(?:\s|&nbsp;|<br>)*<\/p>/gi, '')
    .trim();

  const visibleText = result
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return visibleText ? result : undefined;
}
