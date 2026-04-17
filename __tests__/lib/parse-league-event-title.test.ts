import { describe, it, expect } from 'vitest';
import { parseHomeAwayFromEventTitle } from '@/lib/parse-league-event-title';

describe('parseHomeAwayFromEventTitle', () => {
  it('splits on vs', () => {
    expect(parseHomeAwayFromEventTitle('Crimson Kings vs Vipers')).toEqual({
      home: 'Crimson Kings',
      away: 'Vipers',
    });
  });

  it('splits on vs.', () => {
    expect(parseHomeAwayFromEventTitle('Team A vs. Team B')).toEqual({
      home: 'Team A',
      away: 'Team B',
    });
  });

  it('is case insensitive', () => {
    expect(parseHomeAwayFromEventTitle('North VS South')).toEqual({
      home: 'North',
      away: 'South',
    });
  });

  it('returns full string as home when no delimiter', () => {
    expect(parseHomeAwayFromEventTitle('Scrimmage night')).toEqual({
      home: 'Scrimmage night',
      away: '',
    });
  });

  it('handles empty input', () => {
    expect(parseHomeAwayFromEventTitle('')).toEqual({ home: '', away: '' });
  });
});
