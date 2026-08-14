import type { RosterPageConfig } from '@/types/rosters';

export type RosterEditorSectionId =
  | 'page'
  | 'programs'
  | 'appearance'
  | 'privacy'
  | 'access';

export interface PartnerGroupOption {
  id: string;
  name: string;
  hasApiKey: boolean;
}

export interface IRosterEditorSectionProps {
  config: RosterPageConfig;
  patch: (updates: Partial<RosterPageConfig>) => void;
}

export interface IRosterPageSectionProps extends IRosterEditorSectionProps {
  partnerGroups: PartnerGroupOption[];
  /** Free-text mirror of organizationIds so a half-typed list isn't destroyed. */
  organizationIdsInput: string;
  setOrganizationIdsInput: (value: string) => void;
  slugInput: string;
  setSlugInput: (value: string) => void;
}

export interface IRosterProgramsSectionProps extends IRosterEditorSectionProps {
  programIdsInput: string;
  setProgramIdsInput: (value: string) => void;
  pinnedInput: string;
  setPinnedInput: (value: string) => void;
}

export interface IRosterAccessSectionProps extends IRosterEditorSectionProps {
  viewerPassword: string;
  setViewerPassword: (value: string) => void;
  staffPassword: string;
  setStaffPassword: (value: string) => void;
}

export const ROSTER_EDITOR_SECTIONS: ReadonlyArray<{
  id: RosterEditorSectionId;
  label: string;
  description: string;
}> = [
  { id: 'page', label: 'Page', description: 'Name, slug, customer, organizations, status' },
  {
    id: 'programs',
    label: 'Leagues & Seasons',
    description: 'Which programs and sessions this page covers',
  },
  { id: 'appearance', label: 'Appearance', description: 'Colours, fonts, logo, hero text' },
  {
    id: 'privacy',
    label: 'Privacy & Fields',
    description: 'What a viewer sees, and what staff can additionally see',
  },
  { id: 'access', label: 'Access & Export', description: 'Passwords, printing, search indexing' },
];
