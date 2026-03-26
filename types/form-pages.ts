/**
 * Supabase form_pages + API DTOs for staff form responses viewer
 */

export interface FormPageBranding {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo: string | null;
}

export interface FormPageConfig {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  organization_id: number;
  default_questionnaire_id: number;
  allowed_questionnaire_ids: number[] | null;
  /** When true, staff UI hides the form dropdown and always uses default_questionnaire_id */
  staff_lock_to_default_questionnaire: boolean;
  branding: FormPageBranding;
  staff_password_hash: string | null;
  staff_password_updated_at: string | null;
  default_range_days: number;
  max_range_days_cap: number;
  titles_per_page: number;
  created_at: string;
  updated_at: string;
}

/** Admin API / UI — never expose password hash */
export type FormPageConfigAdmin = Omit<FormPageConfig, 'staff_password_hash'> & {
  has_staff_password: boolean;
};

export interface QuestionnaireListItem {
  id: number;
  title: string | null;
}

export interface QuestionColumnMeta {
  id: number;
  questionnaireId: number;
  ordinal: number | null;
  questionType: string | null;
  question: string | null;
  metaData: unknown;
}

export interface FormResponseUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

/** Persisted per (form page, Bond answer title id) in Discovery Supabase */
export type StaffInquiryStatus = 'pending' | 'in_progress' | 'resolved';

export const STAFF_INQUIRY_STATUS_LABELS: Record<StaffInquiryStatus, string> = {
  pending: 'New',
  in_progress: 'In progress',
  resolved: 'Done',
};

export interface FormResponseRow {
  answerTitleId: number;
  createdAt: string;
  user: FormResponseUser | null;
  /** questionId -> display string */
  answers: Record<number, { display: string; linkUrl?: string; checkmark?: boolean }>;
  /** Staff workflow status; omitted or pending = not yet set in DB */
  staffStatus?: StaffInquiryStatus;
}

export interface FormResponsesPage {
  questionnaireTitle: string | null;
  columns: QuestionColumnMeta[];
  rows: FormResponseRow[];
  nextCursor: { createdAt: string; id: number } | null;
  /** When true, rows are only new submissions since since*; client must merge and keep the existing load-more cursor */
  incremental?: boolean;
}
