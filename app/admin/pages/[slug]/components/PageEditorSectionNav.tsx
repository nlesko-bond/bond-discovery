'use client';

import { cn } from '@/lib/utils';
import { PAGE_EDITOR_SECTIONS, type PageEditorSectionId } from '../page-config-types';

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
      {PAGE_EDITOR_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSectionChange(section.id)}
          className={cn(
            'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
            activeSection === section.id
              ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
              : 'text-gray-700 hover:bg-gray-50',
          )}
        >
          <span className="block text-sm font-semibold">{section.label}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{section.description}</span>
        </button>
      ))}
    </nav>
  );
}
