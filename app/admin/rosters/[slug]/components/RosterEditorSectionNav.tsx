'use client';

import { CalendarRange, FileText, Lock, Palette, ShieldCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROSTER_EDITOR_SECTIONS, type RosterEditorSectionId } from '../roster-editor-types';

const SECTION_ICONS: Record<RosterEditorSectionId, LucideIcon> = {
  page: FileText,
  programs: CalendarRange,
  appearance: Palette,
  privacy: ShieldCheck,
  access: Lock,
};

interface Props {
  activeSection: RosterEditorSectionId;
  onSectionChange: (section: RosterEditorSectionId) => void;
}

export function RosterEditorSectionNav({ activeSection, onSectionChange }: Props) {
  return (
    <nav className="space-y-1" aria-label="Roster page configuration sections">
      {ROSTER_EDITOR_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              active
                ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                : 'text-gray-700 hover:bg-gray-50'
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{section.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{section.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
