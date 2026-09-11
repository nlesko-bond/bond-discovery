import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PageEditorProgramsSection } from '@/app/admin/pages/[slug]/sections/PageEditorProgramsSection';
import type { IPageConfig } from '@/app/admin/pages/[slug]/page-config-types';

function makeConfig(features: Partial<IPageConfig['features']> = {}): IPageConfig {
  return {
    id: 'p1',
    name: 'Test',
    slug: 'test',
    branding: { companyName: 'Test', primaryColor: '#000', secondaryColor: '#111' },
    organizationIds: ['1'],
    features: {
      showPricing: false,
      showAvailability: true,
      showMembershipBadges: true,
      showAgeGender: true,
      enableFilters: ['search'],
      defaultView: 'programs',
      allowViewToggle: true,
      ...features,
    },
  };
}

function renderSection(config: IPageConfig) {
  const setConfig = vi.fn();
  render(
    <PageEditorProgramsSection
      config={config}
      setConfig={setConfig}
      activeTableColumns={['date']}
      updateTableColumns={vi.fn()}
    />,
  );
  return setConfig;
}

describe('PageEditorProgramsSection display groups', () => {
  it('renders the Program cards / Session cards / Page groups with the pricing controls', () => {
    renderSection(makeConfig());
    expect(screen.getByRole('heading', { name: 'Program cards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session cards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page & schedule options' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show program price/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Exclude \$0 options from the program price/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show session pricing/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Show full session titles/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Program order/ })).toBeInTheDocument();
  });

  it('session pricing inherits the program price switch when unset', () => {
    renderSection(makeConfig({ showPricing: false }));
    expect(screen.getByRole('checkbox', { name: /Show session pricing/ })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: /Session card price/ })).toBeDisabled();
  });

  it('session pricing can be on while the program price is off', () => {
    renderSection(makeConfig({ showPricing: false, showSessionPricing: true }));
    expect(screen.getByRole('checkbox', { name: /Show program price/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show session pricing/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /Session card price/ })).toBeEnabled();
  });

  it('writes showSessionPricing without touching showPricing', () => {
    const setConfig = renderSection(makeConfig({ showPricing: false }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Show session pricing/ }));
    expect(setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({ showPricing: false, showSessionPricing: true }),
      }),
    );
  });

  it('shows the program type reorder list only for the program_type sort', () => {
    renderSection(makeConfig({ programSort: 'program_type' }));
    expect(screen.getByTestId('program-type-order')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Class down' })).toBeEnabled();
  });
});
