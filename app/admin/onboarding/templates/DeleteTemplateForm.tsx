'use client';

import { deleteTemplate } from './actions';

type Props = {
  id: string;
  orgCount: number;
  isDefault: boolean;
};

export function DeleteTemplateForm({ id, orgCount, isDefault }: Props) {
  const blocked = isDefault || orgCount > 0;

  if (blocked) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-600">
          {isDefault
            ? 'Default template cannot be deleted. Choose another default first.'
            : `${orgCount} organization(s) use this template. Reassign them before deleting.`}
        </p>
      </div>
    );
  }

  return (
    <form
      action={deleteTemplate.bind(null, id)}
      className="mt-4 border-t border-gray-200 pt-4"
      onSubmit={(e) => {
        if (!confirm('Delete this template? This cannot be undone.')) {
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
