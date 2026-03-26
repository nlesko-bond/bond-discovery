'use client';

import { deleteTemplate } from './actions';

export function DeleteTemplateForm({ id }: { id: string }) {
  return (
    <form
      action={deleteTemplate.bind(null, id)}
      className="mt-4 border-t border-gray-200 pt-4"
      onSubmit={(e) => {
        if (!confirm('Delete this template? Orgs that use it may need to be reassigned first.')) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Delete template
      </button>
    </form>
  );
}
