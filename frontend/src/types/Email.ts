// Email.ts
export interface Email {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_name?: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  sent_timestamp?: number; // Numerical timestamp for reliable sorting
  read_at: string | null;
  gmail_id?: string;
  label_ids?: string[];
  important?: boolean;
  category?: string;
  is_encrypted?: boolean;
  raw_encrypted_content?: string;
  is_draft?: boolean; // Added for draft emails
  is_deleted?: boolean; // Added for trash functionality
  attachments?: {
    id: string;
    name: string;
    mime_type: string;
    size: number;
  }[];
}

export interface SendEmailRequest {
  recipient_email: string;
  subject: string;
  body: string;
  encrypt?: boolean;
}

export interface SaveDraftRequest {
  id?: string; // Optional ID for updating existing drafts
  recipient_email: string;
  subject: string;
  body: string;
}

// Added interface for delete email request
export interface DeleteEmailRequest {
  id: string;
  permanently_delete?: boolean; // If true, permanently delete, otherwise move to trash
}

export interface EmailsResponse {
  emails: Email[];
  success: boolean;
  total_pages: number;
  current_page: number;
  cached: boolean;
  last_sync?: number;
}

export interface EmailRefreshResponse {
  success: boolean;
  message: string;
  new_emails: number;
  last_sync?: number;
}

export interface EmailFilter {
  page?: number;
  page_size?: number;
  search?: string;
  sender?: string;
  recipient?: string;
  is_read?: boolean;
  label?: string;
  sort_by?: 'date' | 'sender' | 'subject';
  sort_order?: 'asc' | 'desc';
  force_refresh?: boolean;
  include_deleted?: boolean; // Added to control whether to include deleted emails
  drafts_only?: boolean; // Added to filter for drafts
}
