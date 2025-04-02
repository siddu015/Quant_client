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
  read_at: string | null;
  gmail_id?: string;
  label_ids?: string[];
  important?: boolean;
  category?: string;
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
}
