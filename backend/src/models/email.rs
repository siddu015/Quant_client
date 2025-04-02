use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
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
    pub label_ids: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmailPreview {
    pub id: String,
    pub sender_email: String,
    pub sender_name: Option<String>,
    pub recipient_email: String,
    pub subject: String,
    pub sent_at: String,
    pub read_at: Option<String>,
    pub gmail_id: Option<String>,
    pub label_ids: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
pub struct SendEmailRequest {
    pub recipient_email: String,
    pub subject: String,
    pub body: String,
}

#[derive(Deserialize, Debug, Default)]
pub struct EmailFilter {
    pub label: Option<String>,
    pub is_read: Option<bool>,
    pub search: Option<String>,
    pub sender: Option<String>,
    pub recipient: Option<String>,
    pub sort_by: Option<SortField>,
    pub sort_order: Option<SortOrder>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq, Eq)]
pub enum SortField {
    #[default]
    #[serde(rename = "date")]
    Date,
    #[serde(rename = "sender")]
    Sender,
    #[serde(rename = "subject")]
    Subject,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq, Eq)]
pub enum SortOrder {
    #[default]
    #[serde(rename = "desc")]
    Desc,
    #[serde(rename = "asc")]
    Asc,
}
