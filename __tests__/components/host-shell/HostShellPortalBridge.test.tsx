import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HostShellPortalBridge } from '@/components/host-shell/HostShellPortalBridge';

vi.mock('@/lib/host-shell/registration-analytics', () => ({
  getPortalPageSlugFromLocation: () => 'the-yard',
  trackHostShellRegisterClick: vi.fn(),
}));

const SEASON = 'https://bondsports.co/activity/programs/CO_ED-adult-SOCCER/15087/season/S2/122775';

describe('HostShellPortalBridge', () => {
  let postMessage: ReturnType<typeof vi.fn>;
  const originalTop = Object.getOwnPropertyDescriptor(window, 'top');

  beforeEach(() => {
    postMessage = vi.fn();
    // Pretend we are inside the partner iframe.
    Object.defineProperty(window, 'top', { configurable: true, value: {} });
    vi.spyOn(window.parent, 'postMessage').mockImplementation(postMessage);
  });

  afterEach(() => {
    if (originalTop) Object.defineProperty(window, 'top', originalTop);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function clickLink(attrs: Record<string, string>) {
    const anchor = document.createElement('a');
    Object.entries(attrs).forEach(([key, value]) => anchor.setAttribute(key, value));
    anchor.textContent = 'link';
    document.body.appendChild(anchor);
    fireEvent.click(anchor);
  }

  it('still routes register links through the host kit', () => {
    render(<HostShellPortalBridge />);
    clickLink({ href: `${SEASON}?skipToProducts=true`, target: '_blank' });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('lets data-bond-passthrough links open normally', () => {
    render(<HostShellPortalBridge />);
    clickLink({
      href: `${SEASON}/competition?tab=standings`,
      target: '_blank',
      'data-bond-passthrough': 'true',
    });
    expect(postMessage).not.toHaveBeenCalled();
  });
});
