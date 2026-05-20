import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseHostRegistrationPath,
  isHostRoutedLinkBehavior,
  tryHostRoutedRegistrationNavigate,
} from '@/lib/host-shell/navigation';

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

describe('isHostRoutedLinkBehavior', () => {
  it('is true only for host_routed', () => {
    expect(isHostRoutedLinkBehavior('host_routed')).toBe(true);
    expect(isHostRoutedLinkBehavior('in_frame')).toBe(false);
    expect(isHostRoutedLinkBehavior(undefined)).toBe(false);
  });
});

describe('tryHostRoutedRegistrationNavigate', () => {
  const originalSelf = window.self;
  const originalTop = window.top;
  const postMessage = vi.fn();

  beforeEach(() => {
    postMessage.mockClear();
    vi.stubGlobal('parent', { postMessage });
    Object.defineProperty(window, 'self', { value: {}, configurable: true });
    Object.defineProperty(window, 'top', { value: {}, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'self', { value: originalSelf, configurable: true });
    Object.defineProperty(window, 'top', { value: originalTop, configurable: true });
    vi.unstubAllGlobals();
  });

  it('posts bond:navigate when host_routed inside iframe', () => {
    const handled = tryHostRoutedRegistrationNavigate(
      '/programs/x?skipToProducts=true',
      'host_routed',
      'https://bondsports.co',
    );
    expect(handled).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'bond:navigate',
        path: '/programs/x',
        search: '?skipToProducts=true',
      },
      '*',
    );
  });

  it('does nothing for new_tab', () => {
    const handled = tryHostRoutedRegistrationNavigate('/programs/x', 'new_tab');
    expect(handled).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
