use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Email {
    pub id: String,
    pub sender_id: String,
    pub sender_email: String,
    pub sender_name: Option<String>,
    pub recipient_email: String,
    pub subject: String,
    pub body: String,
    pub sent_at: String,
    pub read_at: Option<String>,
    pub gmail_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmailPreview {
    pub id: String,
    pub sender_email: String,
    pub sender_name: Option<String>,
    pub recipient_email: String,
    pub subject: String,
    pub sent_at: String,
    pub read_at: Option<String>,
    pub gmail_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct SendEmailRequest {
    pub recipient_email: String,
    pub subject: String,
    pub body: String,
}
