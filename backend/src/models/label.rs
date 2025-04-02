use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GmailLabel {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String, // "system" or "user"
    #[serde(rename = "messageListVisibility")]
    pub message_list_visibility: Option<String>,
    #[serde(rename = "labelListVisibility")]
    pub label_list_visibility: Option<String>,
    pub color: Option<LabelColor>,
    // Added fields for counts
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none")]
    pub total_messages: Option<i32>,
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none")]
    pub unread_messages: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LabelColor {
    #[serde(rename = "textColor")]
    pub text_color: String,
    #[serde(rename = "backgroundColor")]
    pub background_color: String,
} 