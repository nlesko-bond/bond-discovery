import { describe, it, expect } from 'vitest';
import { parseHostRegistrationPath } from '@/lib/host-shell/navigation';

describe('parseHostRegistrationPath', () => {
  it('parses absolute consumer URLs', () => {
    const result = parseHostRegistrationPath(
      'https://bondsports.co/programs/1/session/2?skipToProducts=true',
      'https://bondsports.co',
    );
    expect(result.path).toBe('/programs/1/session/2');
    expect(result.search).toBe('?skipToProducts=true');
  });

  it('parses relative linkSEO paths', () => {
    const result = parseHostRegistrationPath(
      '/programs/abc?productId=9',
      'https://bondsports.co',
    );
    expect(result.path).toBe('/programs/abc');
    expect(result.search).toBe('?productId=9');
  });
});
