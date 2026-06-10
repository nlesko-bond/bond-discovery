import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HostPortalV2FilterPill } from '@/components/host-shell/v2/ui/HostPortalV2FilterPill';
import { HostPortalV2Collapse } from '@/components/host-shell/v2/ui/HostPortalV2Collapse';
import { HostPortalV2OptionList } from '@/components/host-shell/v2/ui/HostPortalV2OptionList';

const ACCENT = '#1d4ed8';

describe('HostPortalV2FilterPill', () => {
  it('is a button with aria-expanded/aria-controls and an active count badge', () => {
    const onToggle = vi.fn();
    render(
      <HostPortalV2FilterPill
        label="Age"
        activeCount={2}
        isOpen={false}
        panelId="panel-1"
        accentColor={ACCENT}
        onToggle={onToggle}
      />,
    );
    const trigger = screen.getByRole('button', { name: /age/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'panel-1');
    expect(trigger).toHaveTextContent('2');

    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('reflects the open state and hides the badge at zero selections', () => {
    render(
      <HostPortalV2FilterPill
        label="Location"
        activeCount={0}
        isOpen
        panelId="panel-2"
        accentColor={ACCENT}
        onToggle={() => undefined}
      />,
    );
    const trigger = screen.getByRole('button', { name: /location/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveTextContent(/^Location$/);
  });
});

describe('HostPortalV2Collapse', () => {
  it('hides closed content from AT and makes it inert; open content is exposed', () => {
    const { container, rerender } = render(
      <HostPortalV2Collapse open={false} id="panel-x">
        <button type="button">Inside</button>
      </HostPortalV2Collapse>,
    );
    const region = container.querySelector('#panel-x') as HTMLElement;
    expect(region).toHaveAttribute('aria-hidden', 'true');
    expect(region.hasAttribute('inert')).toBe(true);
    expect(region.className).toContain('grid-rows-[0fr]');

    rerender(
      <HostPortalV2Collapse open id="panel-x">
        <button type="button">Inside</button>
      </HostPortalV2Collapse>,
    );
    expect(region).toHaveAttribute('aria-hidden', 'false');
    expect(region.hasAttribute('inert')).toBe(false);
    expect(region.className).toContain('grid-rows-[1fr]');
  });
});

describe('HostPortalV2OptionList', () => {
  const options = [
    { id: '6-8', label: 'Ages 6–8', count: 4 },
    { id: '9-12', label: 'Ages 9–12', count: 0 },
  ];

  it('renders a multiselect listbox with aria-selected options and counts', () => {
    render(
      <HostPortalV2OptionList
        label="Age"
        options={options}
        selectedIds={['6-8']}
        onToggleOption={() => undefined}
        onClear={() => undefined}
        accentColor={ACCENT}
      />,
    );
    const listbox = screen.getByRole('listbox', { name: 'Age' });
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');

    const selected = screen.getByRole('option', { name: /ages 6–8/i });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveTextContent('4');
    expect(screen.getByRole('option', { name: /ages 9–12/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('applies instantly on toggle and exposes a per-filter Clear', () => {
    const onToggleOption = vi.fn();
    const onClear = vi.fn();
    render(
      <HostPortalV2OptionList
        label="Age"
        options={options}
        selectedIds={['6-8']}
        onToggleOption={onToggleOption}
        onClear={onClear}
        accentColor={ACCENT}
      />,
    );
    fireEvent.click(screen.getByRole('option', { name: /ages 9–12/i }));
    expect(onToggleOption).toHaveBeenCalledWith('9-12');

    fireEvent.click(screen.getByRole('button', { name: /clear age/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides the Clear control when nothing is selected', () => {
    render(
      <HostPortalV2OptionList
        label="Age"
        options={options}
        selectedIds={[]}
        onToggleOption={() => undefined}
        onClear={() => undefined}
        accentColor={ACCENT}
      />,
    );
    expect(screen.queryByRole('button', { name: /clear age/i })).toBeNull();
  });
});
