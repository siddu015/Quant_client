use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Email {
    pub id: Option<i32>,
    pub sender_id: String,
    pub sender_email: String,
    pub recipient_email: String,
    pub subject: String,
    pub body: String,
    pub sent_at: Option<String>,
    pub read_at: Option<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmailPreview {
    pub id: i32,
    pub sender_email: String,
    pub recipient_email: String,
    pub subject: String,
    pub sent_at: String,
    pub read_at: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct SendEmailRequest {
    pub recipient_email: String,
    pub subject: String,
    pub body: String,
}
