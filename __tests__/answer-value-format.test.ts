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

  it('accepts json/jsonb already parsed as object (node-pg)', () => {
    const obj = {
      street: '1 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    };
    expect(formatAnswerValue(obj, 'address').display).toContain('Boston');
  });

  it('boolean / waiver true shows checkmark flag', () => {
    expect(formatAnswerValue('true', 'boolean')).toEqual({ display: '', checkmark: true });
    expect(formatAnswerValue('1', 'waiver')).toEqual({ display: '', checkmark: true });
    const obj = { value: true };
    expect(formatAnswerValue(obj, 'terms')).toEqual({ display: '', checkmark: true });
  });

  it('boolean false shows em dash', () => {
    expect(formatAnswerValue('false', 'boolean')).toEqual({ display: '—' });
  });

  it('formats ISO date for date question types', () => {
    const r = formatAnswerValue('2026-07-16T18:43:00.000Z', 'date');
    expect(r.display).toMatch(/2026/);
    expect(r.display).not.toContain('T');
    expect(r.display).not.toContain('18:43:00.000Z');
  });

  it('treats { value: true } as checkmark even when questionType is unknown', () => {
    const raw = JSON.stringify({ value: true });
    expect(formatAnswerValue(raw, 'SomeCustomType')).toEqual({
      display: '',
      checkmark: true,
    });
  });

  it('joins single- and multi-select string arrays', () => {
    const one = JSON.stringify({ value: ['Adult 2 '] });
    expect(formatAnswerValue(one, 'singleselect').display).toBe('Adult 2');
    const multi = JSON.stringify({
      value: ['Visiting Team Locker Room', 'Balcony Meeting Room'],
    });
    expect(formatAnswerValue(multi, 'multiselect').display).toBe(
      'Visiting Team Locker Room, Balcony Meeting Room'
    );
  });

  it('Bond PascalCase Value for boolean and arrays', () => {
    expect(formatAnswerValue(JSON.stringify({ Value: true }), 'Terms')).toEqual({
      display: '',
      checkmark: true,
    });
    expect(
      formatAnswerValue(JSON.stringify({ Value: ['One', 'Two'] }), 'dropdown').display
    ).toBe('One, Two');
    expect(formatAnswerValue({ Value: true } as unknown, null)).toEqual({
      display: '',
      checkmark: true,
    });
  });

  it('double-encoded JSON string unwraps to formatted value', () => {
    const inner = JSON.stringify({ Value: ['A', 'B'] });
    const outer = JSON.stringify(inner);
    expect(formatAnswerValue(outer, null).display).toBe('A, B');
  });
});
