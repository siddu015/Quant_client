use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use base64::{encode_config, STANDARD};
use std::env;
use log::{info, error};

use crate::db;
use crate::models::SendEmailRequest;
use crate::gmail::{GmailClient, parse_gmail_message, GmailMessage};
use crate::cache::RedisCache;
use crate::models::SortField;

type DbPool = web::Data<sqlx::PgPool>;
type GmailClientData = web::Data<std::sync::Arc<GmailClient>>;
type RedisCacheData = web::Data<std::sync::Arc<RedisCache>>;

// Send a new email
pub async fn send_email(
    req: HttpRequest,
    email_req: web::Json<SendEmailRequest>,
    db_pool: DbPool,
    gmail_client: GmailClientData,
    redis_cache: RedisCacheData,
) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                if let Some(refresh_token) = refresh_token {
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
                    
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            match gmail_client.send_message(&email, &access_token, raw_message).await {
                                Ok(message) => {
                                    // Create email object
                                    let email_obj = crate::models::Email {
                                        id: Uuid::new_v4().to_string(),
                                        sender_id: email.clone(),
                                        sender_email: email.clone(),
                                        sender_name: None,
                                        recipient_email: email_req.recipient_email.clone(),
                                        subject: email_req.subject.clone(),
                                        body: email_req.body.clone(),
                                        sent_at: chrono::Utc::now().to_rfc3339(),
                                        read_at: Some(chrono::Utc::now().to_rfc3339()),
                                        gmail_id: Some(message.id.clone()),
                                        label_ids: Some(vec!["SENT".to_string()]),
                                    };

                                    // Store in database
                                    let _ = db::store_email(
                                        db_pool.get_ref(),
                                        &email,
                                        &email,
                                        &email_req.recipient_email,
                                        &email_req.subject,
                                        &email_req.body,
                                    ).await;

                                    // Update cache
                                    if let Err(e) = redis_cache.update_email_lists(&email, &email_obj, true).await {
                                        error!("Failed to update cache: {}", e);
                                    }

                                    info!("Email sent and cached: {} -> {}", email, email_req.recipient_email);
                                    
                                    return HttpResponse::Ok().json(json!({
                                        "success": true,
                                        "email": email_obj,
                                        "message": "Email sent successfully"
                                    }));
                                }
                                Err(e) => {
                                    error!("Gmail API error: {}", e);
                                    return HttpResponse::InternalServerError().json(json!({
                                        "success": false,
                                        "error": "Failed to send email",
                                        "details": format!("{}", e)
                                    }));
                                }
                            }
                        }
                        Err(e) => {
                            error!("Gmail token error: {}", e);
                            return HttpResponse::InternalServerError().json(json!({
                                "success": false,
                                "error": "Failed to get Gmail token",
                                "details": format!("{}", e)
                            }));
                        }
                    }
                }
            }
            Ok(None) => {
                error!("Invalid session");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
}

// Get all emails for the current user (both sent and received)
pub async fn get_emails(
    req: HttpRequest,
    query: web::Query<crate::models::EmailFilter>,
    db_pool: DbPool,
    gmail_client: GmailClientData,
    redis_cache: RedisCacheData,
) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                info!("Fetching emails for user: {}", email);
                
                // Try cache first
                let cache_key = format!("{}:{}:{}:{}:{}:{}",
                    query.label.as_deref().unwrap_or(""),
                    query.is_read.unwrap_or(false),
                    query.search.as_deref().unwrap_or(""),
                    query.sender.as_deref().unwrap_or(""),
                    query.recipient.as_deref().unwrap_or(""),
                    query.sort_by.as_ref().map_or("", |s| match s {
                        crate::models::SortField::Date => "date",
                        crate::models::SortField::Sender => "sender",
                        crate::models::SortField::Subject => "subject",
                    })
                );

                // Always fetch from Gmail API if refresh token exists
                if let Some(refresh_token) = refresh_token.clone() {
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            let mut all_emails = Vec::new();
                            
                            // Fetch inbox messages
                            if let Ok(messages) = gmail_client.get_messages(&email, &access_token, None).await {
                                let mut received_emails = Vec::new();
                                let limit = std::cmp::min(50, messages.len());
                                
                                for msg_id in &messages[0..limit] {
                                    if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                        if let Some(email_obj) = process_gmail_message(&message, &email) {
                                            let _ = redis_cache.cache_email(&email, &message.id, &email_obj).await;
                                            received_emails.push(email_obj.clone());
                                            all_emails.push(email_obj);
                                        }
                                    }
                                }
                                
                                if !received_emails.is_empty() {
                                    let _ = redis_cache.cache_emails(&email, "received", &received_emails).await;
                                    info!("Cached {} received emails", received_emails.len());
                                }
                            }
                            
                            // Fetch sent messages
                            if let Ok(messages) = gmail_client.get_messages(&email, &access_token, Some("in:sent")).await {
                                let mut sent_emails = Vec::new();
                                let limit = std::cmp::min(50, messages.len());
                                
                                for msg_id in &messages[0..limit] {
                                    if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                        if let Some(email_obj) = process_gmail_message(&message, &email) {
                                            let _ = redis_cache.cache_email(&email, &message.id, &email_obj).await;
                                            sent_emails.push(email_obj.clone());
                                            all_emails.push(email_obj);
                                        }
                                    }
                                }
                                
                                if !sent_emails.is_empty() {
                                    let _ = redis_cache.cache_emails(&email, "sent", &sent_emails).await;
                                    info!("Cached {} sent emails", sent_emails.len());
                                }
                            }
                            
                            // Sort and filter emails
                            all_emails = apply_filters_to_emails(all_emails, &query);
                            
                            // Cache filtered results
                            if !all_emails.is_empty() {
                                let _ = redis_cache.cache_emails(&email, &cache_key, &all_emails).await;
                            }
                            
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "emails": all_emails,
                                "source": "gmail"
                            }));
                        }
                        Err(e) => {
                            error!("Gmail token error: {}", e);
                            // Fall back to cache
                        }
                    }
                }
                
                // Fall back to cache if Gmail API fails or no refresh token
                if let Ok(Some(cached)) = redis_cache.get_cached_emails(&email, &cache_key).await {
                    info!("Emails retrieved from cache");
                    return HttpResponse::Ok().json(json!({
                        "success": true,
                        "emails": cached,
                        "source": "cache"
                    }));
                }
                
                // Final fallback to database
                info!("Fetching emails from database");
                let received = match db::get_emails_for_user(db_pool.get_ref(), &email, false, Some(&query)).await {
                    Ok(emails) => emails,
                    Err(e) => {
                        error!("Database error (received): {}", e);
                        Vec::new()
                    }
                };
                
                let sent = match db::get_emails_for_user(db_pool.get_ref(), &email, true, Some(&query)).await {
                    Ok(emails) => emails,
                    Err(e) => {
                        error!("Database error (sent): {}", e);
                        Vec::new()
                    }
                };
                
                let all_emails = [sent, received].concat();
                
                return HttpResponse::Ok().json(json!({
                    "success": true,
                    "emails": all_emails,
                    "source": "database"
                }));
            }
            Ok(None) => {
                error!("Invalid session token");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
}

// Apply filters directly to a list of emails (for cached results)
fn apply_filters_to_emails(emails: Vec<crate::models::Email>, filter: &crate::models::EmailFilter) -> Vec<crate::models::Email> {
    let mut filtered_emails = emails;
    
    // Filter by label
    if let Some(label) = &filter.label {
        filtered_emails = filtered_emails.into_iter().filter(|email| {
            email.label_ids.as_ref().map_or(false, |labels| labels.contains(label))
        }).collect();
    }
    
    // Filter by read status
    if let Some(is_read) = filter.is_read {
        filtered_emails = filtered_emails.into_iter().filter(|email| {
            if is_read {
                email.read_at.is_some()
            } else {
                email.read_at.is_none()
            }
        }).collect();
    }
    
    // Filter by search term
    if let Some(search) = &filter.search {
        let search_lower = search.to_lowercase();
        filtered_emails = filtered_emails.into_iter().filter(|email| {
            email.subject.to_lowercase().contains(&search_lower) ||
            email.body.to_lowercase().contains(&search_lower) ||
            email.sender_email.to_lowercase().contains(&search_lower) ||
            email.recipient_email.to_lowercase().contains(&search_lower)
        }).collect();
    }
    
    // Filter by sender
    if let Some(sender) = &filter.sender {
        let sender_lower = sender.to_lowercase();
        filtered_emails = filtered_emails.into_iter().filter(|email| {
            email.sender_email.to_lowercase().contains(&sender_lower)
        }).collect();
    }
    
    // Filter by recipient
    if let Some(recipient) = &filter.recipient {
        let recipient_lower = recipient.to_lowercase();
        filtered_emails = filtered_emails.into_iter().filter(|email| {
            email.recipient_email.to_lowercase().contains(&recipient_lower)
        }).collect();
    }
    
    // Apply sorting
    if let Some(sort_by) = &filter.sort_by {
        use crate::models::SortField;
        
        filtered_emails.sort_by(|a, b| {
            let order = match sort_by {
                SortField::Date => a.sent_at.cmp(&b.sent_at),
                SortField::Sender => a.sender_email.cmp(&b.sender_email),
                SortField::Subject => a.subject.cmp(&b.subject),
            };
            
            if let Some(sort_order) = &filter.sort_order {
                use crate::models::SortOrder;
                match sort_order {
                    SortOrder::Asc => order,
                    SortOrder::Desc => order.reverse(),
                }
            } else {
                // Default to descending
                order.reverse()
            }
        });
    } else {
        // Default sort by date descending
        filtered_emails.sort_by(|a, b| b.sent_at.cmp(&a.sent_at));
    }
    
    // Apply limit and offset
    let offset = filter.offset.unwrap_or(0);
    let limit = filter.limit.unwrap_or(usize::MAX);
    
    if offset > 0 || limit < filtered_emails.len() {
        let start = std::cmp::min(offset, filtered_emails.len());
        let end = std::cmp::min(start + limit, filtered_emails.len());
        filtered_emails = filtered_emails[start..end].to_vec();
    }
    
    filtered_emails
}

// Force refresh emails from Gmail API
pub async fn refresh_emails(
    req: HttpRequest,
    db_pool: DbPool,
    gmail_client: GmailClientData,
    redis_cache: RedisCacheData,
) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                if let Some(refresh_token) = refresh_token {
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            // First, invalidate all cached data for this user
                            let _ = redis_cache.invalidate_user_cache(&email).await;
                            info!("Refreshing emails for {}", email);
                            
                            let mut all_emails = Vec::new();
                            
                            // Fetch inbox messages with newer_than filter
                            if let Ok(messages) = gmail_client.get_messages(&email, &access_token, None).await {
                                let mut received_emails = Vec::new();
                                let limit = std::cmp::min(50, messages.len());
                                
                                for msg_id in &messages[0..limit] {
                                    if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                        if let Some(email_obj) = process_gmail_message(&message, &email) {
                                            let _ = redis_cache.cache_email(&email, &message.id, &email_obj).await;
                                            received_emails.push(email_obj.clone());
                                            all_emails.push(email_obj);
                                        }
                                    }
                                }
                                
                                if !received_emails.is_empty() {
                                    let _ = redis_cache.cache_emails(&email, "received", &received_emails).await;
                                    info!("Cached {} received emails", received_emails.len());
                                }
                            }
                            
                            // Fetch sent messages
                            if let Ok(messages) = gmail_client.get_messages(&email, &access_token, Some("in:sent")).await {
                                let mut sent_emails = Vec::new();
                                let limit = std::cmp::min(50, messages.len());
                                
                                for msg_id in &messages[0..limit] {
                                    if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                        if let Some(email_obj) = process_gmail_message(&message, &email) {
                                            let _ = redis_cache.cache_email(&email, &message.id, &email_obj).await;
                                            sent_emails.push(email_obj.clone());
                                            all_emails.push(email_obj);
                                        }
                                    }
                                }
                                
                                if !sent_emails.is_empty() {
                                    let _ = redis_cache.cache_emails(&email, "sent", &sent_emails).await;
                                    info!("Cached {} sent emails", sent_emails.len());
                                }
                            }
                            
                            // Sort all emails by date
                            all_emails.sort_by(|a, b| b.sent_at.cmp(&a.sent_at));
                            
                            info!("Email refresh complete. Total emails: {}", all_emails.len());
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "message": "Emails refreshed successfully",
                                "emails": all_emails,
                                "count": all_emails.len()
                            }));
                        }
                        Err(e) => {
                            error!("Gmail token error: {}", e);
                            return HttpResponse::InternalServerError().json(json!({
                                "success": false,
                                "error": "Failed to get Gmail token",
                                "details": format!("{}", e)
                            }));
                        }
                    }
                }
            }
            Ok(None) => {
                error!("Invalid session");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    }
    
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
    redis_cache: RedisCacheData,
) -> impl Responder {
    let email_id = path.into_inner();
    
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                // First try to get from cache if it's a Gmail ID
                if let Some(gmail_id) = email_id.strip_prefix("gmail_") {
                    match redis_cache.get_cached_email(&email, gmail_id).await {
                        Ok(Some(cached_email)) => {
                            println!("Retrieved email {} from cache", gmail_id);
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "email": cached_email,
                                "source": "cache"
                            }));
                        },
                        _ => {
                            println!("Email {} not found in cache", gmail_id);
                            // Continue to try other methods
                        }
                    }
                }
                
                // Check if this is a Gmail ID (starts with numbers/letters, not UUID format)
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
                                                id: Uuid::new_v4().to_string(),
                                                sender_id: sender.clone(),
                                                sender_email: sender,
                                                sender_name: Some(sender_name),
                                                recipient_email: recipient,
                                                subject,
                                                body,
                                                sent_at: message.internal_date.unwrap_or_else(|| "".to_string()),
                                                read_at: None,
                                                gmail_id: Some(message.id.clone()),
                                                label_ids: message.label_ids.clone(),
                                            };
                                            
                                            // Cache the email
                                            let _ = redis_cache.cache_email(&email, &message.id, &email_obj).await;
                                            
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
                            
                            // Cache the email if it has a Gmail ID
                            if let Some(ref gmail_id) = found_email.gmail_id {
                                let _ = redis_cache.cache_email(&email, gmail_id, &found_email).await;
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

// Helper function to process a Gmail message into our Email model
fn process_gmail_message(message: &GmailMessage, user_email: &str) -> Option<crate::models::Email> {
    let (subject, sender, sender_name, recipient, body) = parse_gmail_message(message);
    
    if !sender.is_empty() && !recipient.is_empty() {
        Some(crate::models::Email {
            id: Uuid::new_v4().to_string(),
            sender_id: sender.clone(),
            sender_email: sender,
            sender_name: Some(sender_name),
            recipient_email: recipient,
            subject,
            body,
            sent_at: message.internal_date.clone().unwrap_or_else(|| "".to_string()),
            read_at: None,
            gmail_id: Some(message.id.clone()),
            label_ids: message.label_ids.clone(),
        })
    } else {
        None
    }
} 