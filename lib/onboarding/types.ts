export interface StepLink {
  label: string;
  url: string;
  icon: string;
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
}

export interface Template {
  id: string;
  name: string;
  steps: TemplateStep[];
  is_default: boolean;
  created_at: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  contact_email: string | null;
  pin: string | null;
  template_id: string | null;
  assigned_rep: string | null;
  status: 'active' | 'completed' | 'paused' | 'archived';
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
