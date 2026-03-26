'use client';

import { deleteStaff } from './actions';

export function DeleteStaffForm({ id }: { id: string }) {
  return (
    <form
      action={deleteStaff.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm('Remove this staff record?')) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Remove
      </button>
    </form>
  );
}
