import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from '@/lib/csv';

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('Blue Team')).toBe('Blue Team');
    expect(csvEscape('')).toBe('');
  });

  it('quotes values containing a comma', () => {
    expect(csvEscape('Doe, John')).toBe('"Doe, John"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('toCsv', () => {
  it('joins a header row and body rows with CRLF', () => {
    const csv = toCsv(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('A,B\r\n1,2\r\n3,4');
  });

  it('emits only the header row when there are no rows', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A,B');
  });

  it('escapes headers, not just cells', () => {
    // spaceColumnLabel is admin-editable free text and can contain a comma.
    const csv = toCsv(['Field, Court'], [['Field 3']]);
    expect(csv).toBe('"Field, Court"\r\nField 3');
  });

  it('renders null and undefined as empty fields', () => {
    expect(toCsv(['A', 'B', 'C'], [[null, undefined, '']])).toBe('A,B,C\r\n,,');
  });

  it('stringifies numbers', () => {
    expect(toCsv(['#'], [[7], [0]])).toBe('#\r\n7\r\n0');
  });

  it('keeps a cell containing a comma in one field', () => {
    const csv = toCsv(['Player', 'Position'], [['Doe, John', 'Forward']]);
    expect(csv).toBe('Player,Position\r\n"Doe, John",Forward');
  });
});
