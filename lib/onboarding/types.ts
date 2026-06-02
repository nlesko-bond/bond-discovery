export interface StepLink {
  label: string;
  url: string;
  icon: string;
}

export interface TemplateMeta {
  kickoffDividerAfterStepIndex?: number;
}


export interface TemplateStep {
  title: string;
  time: string;
  description: string;
  links: StepLink[];
  note?: string;
  checklist?: string[];
  doneWhen: string;
  optional?: boolean;
  /** When true, checklist shows CSV template download + upload for rentable spaces */
  spacesCsvUpload?: boolean;
  /** When true, checklist shows CSV template download + upload for accounting / GL codes */
  glCodesCsvUpload?: boolean;
  /** When true, checklist shows CSV template download + upload for upcoming programs */
  programsCsvUpload?: boolean;
}

export interface Template {
  id: string;
  name: string;
  steps: TemplateStep[];
  is_default: boolean;
  meta?: TemplateMeta | null;
  created_at: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  /** Bond back-office organization id (from Retool / main Postgres). */
  bond_organization_id?: number | null;
  /** Bond facility ids scoped to this onboarding org. */
  facility_ids?: number[] | null;
  contact_name: string | null;
  contact_email: string | null;
  pin: string | null;
  template_id: string | null;
  assigned_rep: string | null;
  /** HTTPS URL to a logo image, shown on the public onboarding checklist */
  logo_url?: string | null;
  status: 'active' | 'completed' | 'paused' | 'archived';
  /** Current planned launch date (YYYY-MM-DD) for Slack, CS Health, and dashboards */
  expected_launch_date?: string | null;
  /** Actual go-live date (YYYY-MM-DD); CS enters manually in Discovery admin */
  actual_launch_date?: string | null;
  /** First checklist activity (step completion or CSV upload) */
  onboarding_started_at?: string | null;
  spaces_upload_storage_path?: string | null;
  spaces_upload_original_filename?: string | null;
  spaces_uploaded_at?: string | null;
  gl_codes_upload_storage_path?: string | null;
  gl_codes_upload_original_filename?: string | null;
  gl_codes_uploaded_at?: string | null;
  programs_upload_storage_path?: string | null;
  programs_upload_original_filename?: string | null;
  programs_uploaded_at?: string | null;
  onboarding_notify_state?: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface StepProgress {
  id: string;
  org_id: string;
  step_index: number;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

export interface OrgDashboardRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  contact_email: string | null;
  created_at: string;
  completed_at: string | null;
  rep_id: string | null;
  rep_name: string | null;
  rep_email: string | null;
  steps_done: number;
  steps_total: number;
  completion_pct: number | null;
  last_activity: string | null;
}

export interface ActivityLogEntry {
  id: string;
  org_id: string;
  action: string;
  step_index: number | null;
  actor: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'cs_rep';
  notify_email: boolean;
  /** Slack member ID (e.g. U01ABC…) for mentions; optional */
  slack_member_id?: string | null;
  created_at: string;
}
