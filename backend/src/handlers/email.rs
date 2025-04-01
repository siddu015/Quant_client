use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use base64::{encode_config, STANDARD};

use crate::db;
use crate::models::SendEmailRequest;
use crate::gmail::{GmailClient, parse_gmail_message};

type DbPool = web::Data<sqlx::PgPool>;
type GmailClientData = web::Data<std::sync::Arc<GmailClient>>;

// Send a new email
pub async fn send_email(
    req: HttpRequest,
    email_req: web::Json<SendEmailRequest>,
    db_pool: DbPool,
    gmail_client: GmailClientData,
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                // User is authenticated, check if they have a refresh token
                if let Some(refresh_token) = refresh_token {
                    // Create raw email message in base64url format
                    let raw_message = encode_config(
                        format!(
                            "From: {}\r\nTo: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=UTF-8\r\nMIME-Version: 1.0\r\n\r\n{}",
                            email,
                            email_req.recipient_email,
                            email_req.subject,
                            email_req.body
                        ),
                        STANDARD
                    );
                    
                    // Get access token
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            // Send the email using Gmail API
                            match gmail_client.send_message(&email, &access_token, raw_message).await {
                                Ok(_) => {
                                    // Store the email in our database
                                    match db::store_email(
                                        db_pool.get_ref(),
                                        &email,
                                        &email,
                                        &email_req.recipient_email,
                                        &email_req.subject,
                                        &email_req.body,
                                    ).await {
                                        Ok(email_id) => {
                                            println!("Email sent via Gmail API: {} -> {}", email, email_req.recipient_email);
                                            return HttpResponse::Ok().json(json!({
                                                "success": true,
                                                "email_id": email_id,
                                                "message": "Email sent successfully"
                                            }));
                                        }
                                        Err(e) => {
                                            println!("Database error when storing sent email: {}", e);
                                            return HttpResponse::InternalServerError().json(json!({
                                                "success": false,
                                                "error": "Email sent but failed to store in database",
                                                "details": format!("{}", e)
                                            }));
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("Gmail API error when sending email: {}", e);
                                    return HttpResponse::InternalServerError().json(json!({
                                        "success": false,
                                        "error": "Failed to send email via Gmail API",
                                        "details": format!("{}", e)
                                    }));
                                }
                            }
                        }
                        Err(e) => {
                            println!("Error getting Gmail access token: {}", e);
                            return HttpResponse::InternalServerError().json(json!({
                                "success": false,
                                "error": "Failed to get Gmail access token",
                                "details": format!("{}", e)
                            }));
                        }
                    }
                } else {
                    // Fallback to storing email in database only
                    match db::store_email(
                        db_pool.get_ref(),
                        &email,
                        &email,
                        &email_req.recipient_email,
                        &email_req.subject,
                        &email_req.body,
                    ).await {
                        Ok(email_id) => {
                            println!("Email stored (no Gmail API): {} -> {}", email, email_req.recipient_email);
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "email_id": email_id,
                                "message": "Email stored in database only (no Gmail API)"
                            }));
                        }
                        Err(e) => {
                            println!("Database error when sending email: {}", e);
                            return HttpResponse::InternalServerError().json(json!({
                                "success": false,
                                "error": "Failed to store email",
                                "details": format!("{}", e)
                            }));
                        }
                    }
                }
            }
            Ok(None) => {
                println!("Invalid session token when sending email");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                println!("Database error during authentication check: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
    // No session cookie found
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
}

// Get all emails for the current user (both sent and received)
pub async fn get_emails(
    req: HttpRequest,
    db_pool: DbPool,
    gmail_client: GmailClientData,
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                println!("Getting emails for authenticated user: {}", email);
                if let Some(refresh_token) = refresh_token {
                    println!("User has refresh token, attempting to fetch emails from Gmail API");
                    // Try to get emails from Gmail API
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            println!("Successfully obtained access token for Gmail API, length: {}", access_token.len());
                            
                            let mut received_emails = Vec::new();
                            let mut sent_emails = Vec::new();
                            
                            // Get received emails
                            println!("Fetching received emails from Gmail API");
                            match gmail_client.get_messages(&email, &access_token, Some("in:inbox")).await {
                                Ok(received_messages) => {
                                    println!("Received {} message IDs from Gmail API", received_messages.len());
                                    
                                    // Get details for each message
                                    for msg_id in &received_messages[0..std::cmp::min(20, received_messages.len())] {
                                        println!("Fetching details for message ID: {}", msg_id.id);
                                        if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                            let (subject, sender, sender_name, recipient, body) = parse_gmail_message(&message);
                                            println!("Parsed message: subject='{}', from='{}'", subject, sender);
                                            
                                            if !sender.is_empty() && !recipient.is_empty() {
                                                // Create a database-style email object
                                                let email_obj = crate::models::Email {
                                                    id: Uuid::new_v4().to_string(),
                                                    sender_id: sender.clone(),
                                                    sender_email: sender,
                                                    sender_name: Some(sender_name),
                                                    recipient_email: recipient,
                                                    subject,
                                                    body,
                                                    sent_at: message.internal_date.unwrap_or_else(|| "".to_string()),
                                                    read_at: None, // We don't have this info from Gmail API
                                                    gmail_id: Some(message.id.clone()),
                                                };
                                                
                                                // Add to received emails
                                                received_emails.push(email_obj);
                                            } else {
                                                println!("Skipping message with empty sender or recipient");
                                            }
                                        } else {
                                            println!("Failed to fetch details for message ID: {}", msg_id.id);
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("Error fetching received emails from Gmail API: {}", e);
                                }
                            }
                            
                            // Get sent emails
                            println!("Fetching sent emails from Gmail API");
                            match gmail_client.get_messages(&email, &access_token, Some("in:sent")).await {
                                Ok(sent_messages) => {
                                    println!("Received {} sent message IDs from Gmail API", sent_messages.len());
                                    
                                    // Get details for each message
                                    for msg_id in &sent_messages[0..std::cmp::min(20, sent_messages.len())] {
                                        println!("Fetching details for sent message ID: {}", msg_id.id);
                                        if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                            let (subject, sender, sender_name, recipient, body) = parse_gmail_message(&message);
                                            println!("Parsed sent message: subject='{}', to='{}'", subject, recipient);
                                            
                                            if !sender.is_empty() && !recipient.is_empty() {
                                                // Create a database-style email object
                                                let email_obj = crate::models::Email {
                                                    id: Uuid::new_v4().to_string(),
                                                    sender_id: sender.clone(),
                                                    sender_email: sender,
                                                    sender_name: Some(sender_name),
                                                    recipient_email: recipient,
                                                    subject,
                                                    body,
                                                    sent_at: message.internal_date.unwrap_or_else(|| "".to_string()),
                                                    read_at: Some("2023-01-01T00:00:00Z".to_string()), // Assume sent emails are read
                                                    gmail_id: Some(message.id.clone()),
                                                };
                                                
                                                // Add to sent emails
                                                sent_emails.push(email_obj);
                                            } else {
                                                println!("Skipping sent message with empty sender or recipient");
                                            }
                                        } else {
                                            println!("Failed to fetch details for sent message ID: {}", msg_id.id);
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("Error fetching sent emails from Gmail API: {}", e);
                                }
                            }
                            
                            println!("Returning {} received and {} sent emails from Gmail API", received_emails.len(), sent_emails.len());
                            // Return the emails from Gmail API
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "sent": sent_emails,
                                "received": received_emails,
                                "source": "gmail"
                            }));
                        }
                        Err(e) => {
                            // Log the error but continue to fallback to database
                            println!("Error getting Gmail access token: {}", e);
                        }
                    }
                } else {
                    println!("User does not have a refresh token, falling back to database");
                }
                
                // Fallback to database emails if Gmail API didn't work
                // Get sent emails from database
                let sent_result = db::get_emails_for_user(db_pool.get_ref(), &email, true).await;
                // Get received emails from database
                let received_result = db::get_emails_for_user(db_pool.get_ref(), &email, false).await;
                
                match (sent_result, received_result) {
                    (Ok(sent), Ok(received)) => {
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "sent": sent,
                            "received": received,
                            "source": "database"
                        }));
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        println!("Database error when fetching emails: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Failed to fetch emails",
                            "details": format!("{}", e)
                        }));
                    }
                }
            }
            Ok(None) => {
                println!("Invalid session token when fetching emails");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                println!("Database error during authentication check: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
    // No session cookie found
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
}

// Get a specific email by ID
pub async fn get_email(
    req: HttpRequest,
    path: web::Path<String>,
    db_pool: DbPool,
    gmail_client: GmailClientData,
) -> impl Responder {
    let email_id = path.into_inner();
    
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                // First check if this is a Gmail ID (starts with numbers/letters, not UUID format)
                if let Some(refresh_token) = refresh_token {
                    // Check if this looks like a Gmail ID (not a UUID)
                    if !email_id.contains('-') {
                        // Try to get the email from Gmail API
                        match gmail_client.get_token(&email, &refresh_token).await {
                            Ok(access_token) => {
                                match gmail_client.get_message_detail(&email, &access_token, &email_id).await {
                                    Ok(message) => {
                                        let (subject, sender, sender_name, recipient, body) = parse_gmail_message(&message);
                                        
                                        if !sender.is_empty() && !recipient.is_empty() {
                                            // Create a database-style email object
                                            let email_obj = crate::models::Email {
                                                id: email_id.clone(),
                                                sender_id: sender.clone(),
                                                sender_email: sender,
                                                sender_name: Some(sender_name),
                                                recipient_email: recipient,
                                                subject,
                                                body,
                                                sent_at: message.internal_date.unwrap_or_else(|| "".to_string()),
                                                read_at: None,
                                                gmail_id: Some(message.id.clone()),
                                            };
                                            
                                            return HttpResponse::Ok().json(json!({
                                                "success": true,
                                                "email": email_obj,
                                                "source": "gmail"
                                            }));
                                        }
                                    }
                                    Err(e) => {
                                        println!("Error fetching email from Gmail API: {}", e);
                                        // Fall through to database lookup
                                    }
                                }
                            }
                            Err(e) => {
                                println!("Error getting Gmail access token: {}", e);
                                // Fall through to database lookup
                            }
                        }
                    }
                }
                
                // Get the email from database
                match db::get_email(db_pool.get_ref(), &email_id).await {
                    Ok(Some(found_email)) => {
                        // Check if user is either sender or recipient
                        if found_email.sender_email == email || found_email.recipient_email == email {
                            // Mark as read if user is recipient and email is not read yet
                            if found_email.recipient_email == email && found_email.read_at.is_none() {
                                // In a real implementation, we would update the read status
                            }
                            
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "email": found_email,
                                "source": "database"
                            }));
                        } else {
                            return HttpResponse::Forbidden().json(json!({
                                "success": false,
                                "error": "You don't have permission to view this email"
                            }));
                        }
                    }
                    Ok(None) => {
                        return HttpResponse::NotFound().json(json!({
                            "success": false,
                            "error": "Email not found"
                        }));
                    }
                    Err(e) => {
                        println!("Database error when fetching email: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Failed to fetch email",
                            "details": format!("{}", e)
                        }));
                    }
                }
            }
            Ok(None) => {
                println!("Invalid session token when fetching email");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                println!("Database error during authentication check: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
    // No session cookie found
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
}
