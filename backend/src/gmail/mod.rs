use reqwest::{Client, Error as ReqwestError};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde_json::json;

// Gmail API token response
#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: i64,
    pub token_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
}

// Gmail API message response
#[derive(Debug, Deserialize)]
pub struct SendMessageResponse {
    pub id: String,
    pub thread_id: String,
    pub label_ids: Option<Vec<String>>,
}

// Gmail API message
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GmailMessage {
    pub id: String,
    pub thread_id: String,
    pub label_ids: Option<Vec<String>>,
    pub snippet: Option<String>,
    pub payload: Option<GmailPayload>,
    pub internal_date: Option<String>,
}

// Gmail API message payload
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GmailPayload {
    pub headers: Option<Vec<GmailHeader>>,
    pub parts: Option<Vec<GmailPart>>,
    pub body: Option<GmailBody>,
    pub mime_type: Option<String>,
}

// Gmail API message header
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GmailHeader {
    pub name: String,
    pub value: String,
}

// Gmail API message part
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GmailPart {
    pub part_id: Option<String>,
    pub mime_type: Option<String>,
    pub filename: Option<String>,
    pub headers: Option<Vec<GmailHeader>>,
    pub body: Option<GmailBody>,
    pub parts: Option<Vec<GmailPart>>,
}

// Gmail API message body
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GmailBody {
    pub size: Option<i64>,
    pub data: Option<String>,
    pub attachment_id: Option<String>,
}

// Gmail API message list response
#[derive(Debug, Deserialize)]
pub struct GmailMessageListResponse {
    pub messages: Option<Vec<GmailMessageId>>,
    pub next_page_token: Option<String>,
    pub result_size_estimate: Option<i32>,
}

// Gmail API message ID
#[derive(Debug, Deserialize)]
pub struct GmailMessageId {
    pub id: String,
    pub thread_id: String,
}

// Token cache for Gmail API
pub struct TokenCache {
    access_token: String,
    expires_at: Instant,
}

// Gmail client
pub struct GmailClient {
    http_client: Client,
    token_cache: RwLock<HashMap<String, TokenCache>>,
}

impl GmailClient {
    // Create a new Gmail client
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
            token_cache: RwLock::new(HashMap::new()),
        }
    }

    // Get token for Gmail API
    pub async fn get_token(&self, user_id: &str, refresh_token: &str) -> Result<String, ReqwestError> {
        // Check cache first
        {
            let token_cache = self.token_cache.read().await;
            if let Some(cached) = token_cache.get(user_id) {
                if cached.expires_at > Instant::now() + Duration::from_secs(60) {
                    println!("Using cached token for {}", user_id);
                    return Ok(cached.access_token.clone());
                }
            }
        }

        // Get new token
        let client_id = std::env::var("GOOGLE_CLIENT_ID").expect("GOOGLE_CLIENT_ID must be set");
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").expect("GOOGLE_CLIENT_SECRET must be set");

        println!("Refreshing token for user {} with refresh_token {}", user_id, refresh_token);

        let params = [
            ("client_id", client_id.clone()),
            ("client_secret", client_secret.clone()),
            ("refresh_token", refresh_token.to_string()),
            ("grant_type", "refresh_token".to_string()),
        ];

        // Debug output
        println!("Token refresh request - URL: https://oauth2.googleapis.com/token");
        println!("Token refresh params - client_id: {}, refresh_token: {}", client_id, refresh_token);

        let response = self.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;
        
        // Check for error status
        if !response.status().is_success() {
            let status = response.status();
            let error = response.text().await.unwrap_or_else(|_| "Could not get error text".to_string());
            println!("Token refresh error: Status {} - {}", status, error);
            // Create a dummy request that will fail to generate a ReqwestError
            return Err(self.http_client.get("error://example.com").send().await.unwrap_err());
        } else {
            let token_response = response.json::<TokenResponse>().await?;

            // Cache the token
            let expires_at = Instant::now() + Duration::from_secs(token_response.expires_in as u64 - 300); // 5 min buffer
            let access_token = token_response.access_token.clone();

            let mut token_cache = self.token_cache.write().await;
            token_cache.insert(
                user_id.to_string(),
                TokenCache {
                    access_token: access_token.clone(),
                    expires_at,
                },
            );

            println!("Successfully refreshed token for {}", user_id);
            Ok(access_token)
        }
    }

    // Get emails from Gmail
    pub async fn get_messages(&self, user_id: &str, access_token: &str, query: Option<&str>) -> Result<Vec<GmailMessageId>, ReqwestError> {
        let query_param = query.unwrap_or(""); 
        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/{}/messages?q={}",
            user_id, query_param
        );
        
        println!("Fetching Gmail messages: {}", url);
        
        let response = match self.http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await {
                Ok(resp) => resp,
                Err(e) => {
                    println!("Error fetching messages: {}", e);
                    return Err(e);
                }
            };
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Could not get error text".to_string());
            println!("Gmail API error: Status {} - {}", status, error_text);
            // Create a dummy request that will fail to generate a ReqwestError
            return Err(self.http_client.get("error://example.com").send().await.unwrap_err());
        }

        let response_data = match response.json::<GmailMessageListResponse>().await {
            Ok(data) => data,
            Err(e) => {
                println!("Error parsing message list response: {}", e);
                return Err(e);
            }
        };

        let messages = response_data.messages.unwrap_or_default();
        println!("Successfully fetched {} Gmail messages", messages.len());
        
        Ok(messages)
    }

    // Get message details
    pub async fn get_message_detail(&self, user_id: &str, access_token: &str, message_id: &str) -> Result<GmailMessage, ReqwestError> {
        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/{}/messages/{}",
            user_id, message_id
        );
        
        println!("Fetching Gmail message detail: {}", url);

        let response = match self.http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await {
                Ok(resp) => resp,
                Err(e) => {
                    println!("Error fetching message detail: {}", e);
                    return Err(e);
                }
            };
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Could not get error text".to_string());
            println!("Gmail API error: Status {} - {}", status, error_text);
            // Create a dummy request that will fail to generate a ReqwestError
            return Err(self.http_client.get("error://example.com").send().await.unwrap_err());
        }

        let message = match response.json::<GmailMessage>().await {
            Ok(msg) => msg,
            Err(e) => {
                println!("Error parsing message detail response: {}", e);
                return Err(e);
            }
        };

        println!("Successfully fetched Gmail message {}", message_id);
        Ok(message)
    }

    // Send a message
    pub async fn send_message(&self, user_id: &str, access_token: &str, raw_message: String) -> Result<SendMessageResponse, ReqwestError> {
        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/{}/messages/send",
            user_id
        );
        
        println!("Sending Gmail message: {} with token length {}", url, access_token.len());

        let body = json!({
            "raw": raw_message
        });

        let response = match self.http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .json(&body)
            .send()
            .await {
                Ok(resp) => resp,
                Err(e) => {
                    println!("Error sending message: {}", e);
                    return Err(e);
                }
            };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Could not get error text".to_string());
            println!("Gmail API error when sending: Status {} - {}", status, error_text);
            // Create a dummy request that will fail to generate a ReqwestError
            return Err(self.http_client.get("error://example.com").send().await.unwrap_err());
        }

        let send_response = match response.json::<SendMessageResponse>().await {
            Ok(resp) => resp,
            Err(e) => {
                println!("Error parsing send message response: {}", e);
                return Err(e);
            }
        };

        println!("Successfully sent Gmail message with ID: {}", send_response.id);
        Ok(send_response)
    }
}

// Create a shared Gmail client
pub fn create_gmail_client() -> Arc<GmailClient> {
    Arc::new(GmailClient::new())
}

// Helper to extract email address from a header value
pub fn extract_email_address(header_value: &str) -> String {
    if let Some(start) = header_value.find('<') {
        if let Some(end) = header_value.find('>') {
            if start < end {
                return header_value[start+1..end].to_string();
            }
        }
    }
    header_value.to_string()
}

// Helper to extract sender name from header value
pub fn extract_sender_name(header_value: &str) -> String {
    if let Some(start) = header_value.find('<') {
        if start > 0 {
            let name = header_value[0..start].trim();
            if name.starts_with('"') && name.ends_with('"') {
                return name[1..name.len()-1].to_string();
            }
            return name.to_string();
        }
    }
    "".to_string()
}

// Parse Gmail message to extract useful parts
pub fn parse_gmail_message(message: &GmailMessage) -> (String, String, String, String, String) {
    // Default values
    let mut subject = String::new();
    let mut sender = String::new();
    let mut sender_name = String::new();
    let mut recipient = String::new();
    let mut body = String::new();
    
    // Extract headers
    if let Some(payload) = &message.payload {
        if let Some(headers) = &payload.headers {
            for header in headers {
                match header.name.as_str() {
                    "Subject" => subject = header.value.clone(),
                    "From" => {
                        sender = extract_email_address(&header.value);
                        sender_name = extract_sender_name(&header.value);
                    },
                    "To" => recipient = extract_email_address(&header.value),
                    _ => {}
                }
            }
        }
        
        // Extract body
        body = extract_message_body(payload);
    }
    
    (subject, sender, sender_name, recipient, body)
}

// Recursively extract message body from Gmail message parts
fn extract_message_body(payload: &GmailPayload) -> String {
    // Check for body in the current payload
    if let Some(body) = &payload.body {
        if let Some(data) = &body.data {
            if let Ok(decoded) = base64::decode(data.replace('-', "+").replace('_', "/")) {
                if let Ok(text) = String::from_utf8(decoded) {
                    return text;
                }
            }
        }
    }
    
    // Check parts recursively
    if let Some(parts) = &payload.parts {
        for part in parts {
            if let Some(mime_type) = &part.mime_type {
                if mime_type == "text/plain" {
                    if let Some(body) = &part.body {
                        if let Some(data) = &body.data {
                            if let Ok(decoded) = base64::decode(data.replace('-', "+").replace('_', "/")) {
                                if let Ok(text) = String::from_utf8(decoded) {
                                    return text;
                                }
                            }
                        }
                    }
                }
            }
            
            // Recursively check nested parts
            if let Some(nested_parts) = &part.parts {
                if !nested_parts.is_empty() {
                    let nested_payload = GmailPayload {
                        headers: part.headers.clone(),
                        parts: Some(nested_parts.clone()),
                        body: part.body.clone(),
                        mime_type: part.mime_type.clone(),
                    };
                    let body = extract_message_body(&nested_payload);
                    if !body.is_empty() {
                        return body;
                    }
                }
            }
        }
    }
    
    String::new()
}

// A simple function that returns a reqwest error with the given message
