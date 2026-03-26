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

export interface FormResponseRow {
  answerTitleId: number;
  createdAt: string;
  user: FormResponseUser | null;
  /** questionId -> display string */
  answers: Record<number, { display: string; linkUrl?: string; checkmark?: boolean }>;
}

export interface FormResponsesPage {
  questionnaireTitle: string | null;
  columns: QuestionColumnMeta[];
  rows: FormResponseRow[];
  nextCursor: { createdAt: string; id: number } | null;
}
