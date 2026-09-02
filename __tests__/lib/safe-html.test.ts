import { describe, it, expect } from 'vitest';
import { sanitizeDescriptionHtml } from '@/lib/safe-html';

describe('sanitizeDescriptionHtml', () => {
  it('returns undefined for empty input', () => {
    expect(sanitizeDescriptionHtml(undefined)).toBeUndefined();
    expect(sanitizeDescriptionHtml('')).toBeUndefined();
    expect(sanitizeDescriptionHtml('   ')).toBeUndefined();
  });

  it('keeps allowlisted formatting tags without attributes', () => {
    expect(
      sanitizeDescriptionHtml('<p class="x" style="color:red">Hello <strong id="y">world</strong></p>'),
    ).toBe('<p>Hello <strong>world</strong></p>');
    expect(sanitizeDescriptionHtml('<ul><li>One</li><li>Two</li></ul>')).toBe(
      '<ul><li>One</li><li>Two</li></ul>',
    );
    expect(sanitizeDescriptionHtml('Line one<br/>Line two')).toBe('Line one<br>Line two');
  });

  it('drops unknown tags but keeps their inner text', () => {
    expect(sanitizeDescriptionHtml('<div><span>Ages 5-7</span></div>')).toBe('Ages 5-7');
    expect(sanitizeDescriptionHtml('<h1>Big title</h1>')).toBe('Big title');
  });

  it('removes script/style elements including their content', () => {
    expect(sanitizeDescriptionHtml('<p>Safe</p><script>alert(1)</script>')).toBe('<p>Safe</p>');
    expect(sanitizeDescriptionHtml('<style>p{display:none}</style><p>Text</p>')).toBe('<p>Text</p>');
  });

  it('neutralizes event-handler and javascript: vectors', () => {
    expect(sanitizeDescriptionHtml('<img src=x onerror=alert(1)>Hi')).toBe('Hi');
    expect(sanitizeDescriptionHtml('<p onclick="alert(1)">Click</p>')).toBe('<p>Click</p>');
    expect(sanitizeDescriptionHtml('<a href="javascript:alert(1)">link</a>')).toBe('<a>link</a>');
  });

  it('keeps http(s)/mailto links with fixed target and rel', () => {
    expect(sanitizeDescriptionHtml('<a href="https://example.com/x" onclick="p()">site</a>')).toBe(
      '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">site</a>',
    );
    expect(sanitizeDescriptionHtml("<a href='mailto:a@b.co'>mail</a>")).toBe(
      '<a href="mailto:a@b.co" target="_blank" rel="noopener noreferrer">mail</a>',
    );
  });

  it('escapes href characters that could break out of the attribute', () => {
    expect(sanitizeDescriptionHtml('<a href=\'https://e.co/?q="><script>\'>x</a>')).toBe(
      '<a href="https://e.co/?q=&quot;>&lt;script>" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it('escapes stray < left in text', () => {
    expect(sanitizeDescriptionHtml('ages 5 < 7 and up')).toBe('ages 5 &lt; 7 and up');
  });

  it('does not end a tag at > inside a quoted attribute', () => {
    expect(sanitizeDescriptionHtml('<p title="a > b">Text</p>')).toBe('<p>Text</p>');
  });

  it('preserves text entities untouched for the browser to decode', () => {
    expect(sanitizeDescriptionHtml('<p>ages 5&ndash;7 &amp; up</p>')).toBe(
      '<p>ages 5&ndash;7 &amp; up</p>',
    );
  });

  it('strips HTML comments and Quill-style empty paragraphs', () => {
    expect(sanitizeDescriptionHtml('<!-- note --><p>Body</p><p><br></p>')).toBe('<p>Body</p>');
  });

  it('returns undefined when nothing visible remains', () => {
    expect(sanitizeDescriptionHtml('<p><br></p>')).toBeUndefined();
    expect(sanitizeDescriptionHtml('<script>alert(1)</script>')).toBeUndefined();
    expect(sanitizeDescriptionHtml('<div>&nbsp;</div>')).toBeUndefined();
  });
});
