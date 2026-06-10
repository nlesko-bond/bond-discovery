'use client';

import { BarChart3, Database, FileText, ListFilter, Palette, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_EDITOR_SECTIONS, type PageEditorSectionId } from '../page-config-types';

const SECTION_ICONS: Record<PageEditorSectionId, LucideIcon> = {
  page: FileText,
  appearance: Palette,
  programs: ListFilter,
  registration: BarChart3,
  data: Database,
};

interface IPageEditorSectionNavProps {
  activeSection: PageEditorSectionId;
  onSectionChange: (section: PageEditorSectionId) => void;
}

export function PageEditorSectionNav({
  activeSection,
  onSectionChange,
}: IPageEditorSectionNavProps) {
  return (
    <nav className="space-y-1" aria-label="Page configuration sections">
      {PAGE_EDITOR_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              activeSection === section.id
                ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            <Icon
              size={18}
              className={cn(
                'mt-0.5 shrink-0',
                activeSection === section.id ? 'text-indigo-600' : 'text-gray-400',
              )}
            />
            <span>
              <span className="block text-sm font-semibold">{section.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{section.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
