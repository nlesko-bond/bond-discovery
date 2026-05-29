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
            'Replace this template’s steps with the canonical onboarding checklist (spaces CSV upload, kickoff split, etc.)? Existing org progress is unchanged; only the step definitions update.',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-primary hover:underline">
        Reset steps to canonical checklist
      </button>
    </form>
  );
}
