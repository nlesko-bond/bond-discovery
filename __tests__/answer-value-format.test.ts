import { describe, expect, it } from 'vitest';
import { formatAnswerValue } from '@/lib/answer-value-format';

describe('formatAnswerValue', () => {
  it('formats address JSON', () => {
    const raw = JSON.stringify({
      street: '715 Standish Avenue',
      city: 'Westfield',
      state: 'NJ',
      zip: '07090',
    });
    expect(formatAnswerValue(raw, 'address').display).toContain('Westfield');
    expect(formatAnswerValue(raw, 'address').display).toContain('07090');
  });

  it('extracts upload URL', () => {
    const raw = JSON.stringify({ value: 'https://example.com/file.pdf' });
    const r = formatAnswerValue(raw, 'other');
    expect(r.linkUrl).toBe('https://example.com/file.pdf');
  });

  it('returns plain text when not JSON', () => {
    expect(formatAnswerValue('hello', null).display).toBe('hello');
  });
});
