import { describe, it, expect } from 'vitest';
import {
  buildHostPortalSessionCards,
  buildProductRegistrationHref,
  isSessionClosedByAvailabilityStatus,
} from '@/lib/host-shell/session-card-model';
import {
  mockConfig,
  mockProgram,
  mockSession,
  mockProduct,
} from '../../fixtures/mockData';
import type { Session } from '@/types';

describe('isSessionClosedByAvailabilityStatus', () => {
  it('treats unavailable and expired as closed', () => {
    expect(isSessionClosedByAvailabilityStatus('unavailable')).toBe(true);
    expect(isSessionClosedByAvailabilityStatus('expired')).toBe(true);
    expect(isSessionClosedByAvailabilityStatus('available')).toBe(false);
  });
});

describe('buildProductRegistrationHref', () => {
  it('includes productId in registration URL when open', () => {
    const href = buildProductRegistrationHref(
      'https://bondsports.co/programs/test-program',
      'product-99',
      true,
    );
    expect(href).toContain('productId=product-99');
    expect(href).toContain('skipToProducts=true');
  });

  it('omits deep-link params when registration is closed', () => {
    const href = buildProductRegistrationHref(
      'https://bondsports.co/programs/test-program',
      'product-99',
      false,
    );
    expect(href).toBe('https://bondsports.co/programs/test-program');
    expect(href).not.toContain('productId');
  });
});

describe('buildHostPortalSessionCards', () => {
  it('builds one card per session with session-level fields only', () => {
    const sessionWithSport = { ...mockSession, sport: 'soccer' };
    const program = { ...mockProgram, sessions: [sessionWithSport, ...(mockProgram.sessions ?? []).slice(1)] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards.length).toBe(2);
    const first = cards.find((card) => card.sessionId === mockSession.id);
    expect(first?.name).toBe(mockSession.name);
    expect(first?.description).toBe(mockSession.description);
    expect(first?.sport).toBe('soccer');
    expect(first?.products.length).toBeGreaterThan(0);
  });

  it('marks closed when availabilityStatus is unavailable', () => {
    const session: Session = {
      ...mockSession,
      availabilityStatus: 'unavailable',
    };
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards[0].isClosed).toBe(true);
    expect(cards[0].products.every((product) => product.registerDisabled)).toBe(true);
  });

  it('formats prices with two decimal places', () => {
    const product = {
      ...mockProduct,
      prices: [{ id: 'p1', price: 267.5, currency: 'USD' }],
    };
    const session: Session = {
      ...mockSession,
      products: [product],
    };
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards[0].products[0].priceLabel).toBe('$267.50');
  });

  it('reads segments from paginated session payload', () => {
    const session = {
      ...mockSession,
      segments: {
        data: [{ id: 'seg-1', sessionId: mockSession.id, name: 'Week 1', startDate: '2026-06-01', endDate: '2026-06-07' }],
      },
    } as unknown as Session;
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards[0].segments).toHaveLength(1);
    expect(cards[0].segments[0].name).toBe('Week 1');
  });

  it('exposes a collapsed register URL without expanding the card', () => {
    const session: Session = {
      ...mockSession,
      availabilityStatus: 'available',
      products: [mockProduct],
    };
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards[0].registerUrl).toBeTruthy();
    expect(cards[0].hasMultipleRegisterOptions).toBe(false);
    expect(cards[0].registerProductId).toBe(cards[0].products[0]?.id);
  });

  it('uses session-level register URL when multiple products exist', () => {
    const secondProduct = { ...mockProduct, id: 'product-2', name: 'Product 2' };
    const session: Session = {
      ...mockSession,
      availabilityStatus: 'available',
      products: [mockProduct, secondProduct],
    };
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    expect(cards[0].hasMultipleRegisterOptions).toBe(true);
    expect(cards[0].registerUrl).toBeTruthy();
    expect(cards[0].registerUrl).not.toContain('productId=');
  });

  it('puts productId on product registration URLs when open', () => {
    const session: Session = {
      ...mockSession,
      availabilityStatus: 'available',
    };
    const program = { ...mockProgram, sessions: [session] };
    const cards = buildHostPortalSessionCards([program], mockConfig);
    const product = cards[0].products[0];
    expect(product.registrationUrl).toContain(`productId=${product.id}`);
  });
});
