import { describe, it, expect } from 'vitest';
import { transformEvent } from '@/lib/transformers';

/** Bond session event list item shape (spotsLeft on root). */
describe('transformEvent spotsLeft', () => {
  it('maps spotsLeft to spotsRemaining', () => {
    const e = transformEvent({
      id: 4502899,
      sessionId: 'sess-1',
      spotsLeft: 18,
      maxParticipants: 20,
      participantsNumber: 2,
    });
    expect(e.spotsRemaining).toBe(18);
    expect(e.maxParticipants).toBe(20);
    expect(e.currentParticipants).toBe(2);
  });

  it('ignores non-numeric capacity object (expand=capacity)', () => {
    const e = transformEvent({
      id: 1,
      sessionId: 's',
      spotsLeft: 10,
      maxParticipants: 20,
      participantsNumber: 10,
      capacity: { not: 'a number' },
    });
    expect(e.spotsRemaining).toBe(10);
  });
});
