// Email.ts
export interface Email {
  id: number;
  sender_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  status: string;
}

export interface SendEmailRequest {
  recipient_email: string;
  subject: string;
  body: string;
}
