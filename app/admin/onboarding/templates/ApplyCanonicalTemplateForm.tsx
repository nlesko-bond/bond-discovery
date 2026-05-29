'use client';

import { applyCanonicalTemplateSteps } from './actions';

export function ApplyCanonicalTemplateForm({ templateId }: { templateId: string }) {
  return (
    <form
      action={applyCanonicalTemplateSteps.bind(null, templateId)}
      className="mt-2"
      onSubmit={(e) => {
        if (
          !confirm(
            'Replace this template’s steps with the official Onboarding Template checklist (12 steps, kickoff after Add Employees, spaces + GL CSV uploads)? Existing org progress is unchanged; only step definitions update.',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-primary hover:underline">
        Reset to Onboarding Template checklist
      </button>
    </form>
  );
}
