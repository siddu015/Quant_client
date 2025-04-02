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
}

export interface SendEmailRequest {
  recipient_email: string;
  subject: string;
  body: string;
}
