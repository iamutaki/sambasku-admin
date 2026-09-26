export type LegalDocumentType = 'terms' | 'privacy';
export type LegalDocumentStatus = 'draft' | 'published' | 'archived';

export interface LegalDocument {
  id: string;
  document_type: LegalDocumentType;
  version: string;
  title: string;
  body_markdown: string;
  status: LegalDocumentStatus;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AppSettingItem {
  key: string;
  value: string | null;
  updated_at: string | null;
  updated_by: string | null;
}
