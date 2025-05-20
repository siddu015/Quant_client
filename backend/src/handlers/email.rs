use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use base64::{encode_config, STANDARD};
use log::{info, error, warn};

use crate::db;
use crate::models::SendEmailRequest;
use crate::gmail::{GmailClient, parse_gmail_message, GmailMessage};
use crate::cache::RedisCache;

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
                    // Check if encryption is requested
                    let should_encrypt = email_req.encrypt.unwrap_or(false);
                    let (_, _, raw_encrypted_content) = if should_encrypt {
                        // Get recipient's public key
                        match crate::encryption::keys::get_public_key(db_pool.get_ref(), &email_req.recipient_email).await {
                            Ok(Some(public_key)) => {
                                // Encrypt the message
                                match crate::encryption::encrypt_message(&email_req.body, &public_key) {
                                    Ok(encrypted_msg) => {
                                        // Serialize the encrypted message
                                        match crate::encryption::serialize_encrypted_message(&encrypted_msg) {
                                            Ok(content) => {
                                                let encrypted_subject = crate::encryption::format_encrypted_subject(&email_req.subject);
                                                let encrypted_body = crate::encryption::format_encrypted_body();
                                                (encrypted_subject, encrypted_body, Some(content))
                                            },
                                            Err(e) => {
                                                error!("Failed to serialize encrypted message: {}", e);
                                                return HttpResponse::InternalServerError().json(json!({
                                                    "success": false,
                                                    "error": "Failed to encrypt message",
                                                    "details": format!("{}", e)
                                                }));
                                            }
                                        }
                                    },
                                    Err(e) => {
                                        error!("Failed to encrypt message: {}", e);
                                        return HttpResponse::InternalServerError().json(json!({
                                            "success": false,
                                            "error": "Failed to encrypt message",
                                            "details": format!("{}", e)
                                        }));
                                    }
                                }
                            },
                            Ok(None) => {
                                // No public key found for recipient
                                error!("No public key found for recipient: {}", email_req.recipient_email);
                                // Generate a key pair for the recipient
                                match crate::encryption::generate_keypair() {
                                    Ok(keypair) => {
                                        // Store the key pair
                                        if let Err(e) = crate::encryption::keys::store_keypair(db_pool.get_ref(), &email_req.recipient_email, &keypair).await {
                                            error!("Failed to store key pair: {}", e);
                                        }
                                        // Send without encryption this time
                                        (email_req.subject.clone(), email_req.body.clone(), None)
                                    },
                                    Err(e) => {
                                        error!("Failed to generate key pair: {}", e);
                                        (email_req.subject.clone(), email_req.body.clone(), None)
                                    }
                                }
                            },
                            Err(e) => {
                                error!("Failed to get public key: {}", e);
                                return HttpResponse::InternalServerError().json(json!({
                                    "success": false,
                                    "error": "Failed to get recipient's public key",
                                    "details": format!("{}", e)
                                }));
                            }
                        }
                    } else {
                        // No encryption requested
                        (email_req.subject.clone(), email_req.body.clone(), None)
                    };
                    
                    // Store original message in database
                    let email_id = match db::store_email(
                        db_pool.get_ref(),
                        &email,
                        &email,
                        &email_req.recipient_email,
                        &email_req.subject,
                        &email_req.body,
                        should_encrypt,
                        raw_encrypted_content.as_deref(),
                    ).await {
                        Ok(id) => id,
                        Err(e) => {
                            error!("Database error: {}", e);
                            return HttpResponse::InternalServerError().json(json!({
                                "success": false,
                                "error": "Failed to store email in database",
                                "details": format!("{}", e)
                            }));
                        }
                    };
                    
                    // Generate view link for the notification email
                    let view_link = format!("{}/?view={}", crate::auth::FRONTEND_URL, email_id);
                    
                    // Get sender's name from database
                    let sender_name = match db::get_user_info(db_pool.get_ref(), &email).await {
                        Ok(Some(user_info)) => user_info.name.unwrap_or_else(|| email.clone()),
                        _ => email.clone(), // Fallback to email if user info not available
                    };
                    
                    // Create placeholder message for Gmail notification
                    let placeholder_subject = format!("[Quant Client] New secure message from {}", sender_name);
                    let placeholder_body = format!(
                        "You've received a new message from **{}** via Quant Client.\n\n\
                        To view the full message, please click here: [Quant Client]({})\n\n\
                        This is a notification email. The actual message content is securely stored in Quant Client.",
                        sender_name, view_link
                    );
                    
                    let raw_message = encode_config(
                        format!(
                            "From: {}\r\nTo: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=UTF-8\r\nMIME-Version: 1.0\r\n\r\n{}",
                            email,
                            email_req.recipient_email,
                            placeholder_subject,
                            placeholder_body
                        ),
                        STANDARD
                    );
                    
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            match gmail_client.send_message(&email, &access_token, raw_message).await {
                                Ok(message) => {
                                    // Create email object based on our stored message
                                    let email_obj = crate::models::Email {
                                        id: email_id.clone(),
                                        sender_id: email.clone(),
                                        sender_email: email.clone(),
                                        sender_name: None, // We could fetch this from user profile
                                        recipient_email: email_req.recipient_email.clone(),
                                        subject: email_req.subject.clone(),
                                        body: email_req.body.clone(),
                                        sent_at: chrono::Utc::now().to_rfc3339(),
                                        read_at: None,
                                        gmail_id: Some(message.id.clone()), // Store reference to notification email
                                        label_ids: Some(vec!["SENT".to_string()]),
                                        is_encrypted: should_encrypt,
                                        raw_encrypted_content: raw_encrypted_content,
                                    };

                                    // Update cache with our email object
                                    if let Err(e) = redis_cache.update_email_lists(&email, &email_obj, true).await {
                                        error!("Failed to update cache: {}", e);
                                    }

                                    info!("Email sent and stored in database: {} -> {}", email, email_req.recipient_email);
                                    
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
                                        "error": "Failed to send notification email",
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
    _gmail_client: GmailClientData,
    _redis_cache: RedisCacheData,
) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, _))) => {
                let filter = query.into_inner();
                let force_refresh = filter.force_refresh.unwrap_or(false);
                
                // Get emails directly from our database
                let mut all_emails = Vec::new();
                
                // Get sent emails
                match db::email::get_emails_for_user(db_pool.get_ref(), &email, true, Some(&filter)).await {
                    Ok(sent) => {
                        all_emails.extend(sent);
                    },
                    Err(e) => {
                        error!("Database error retrieving sent emails: {}", e);
                    }
                }
                
                // Get received emails
                match db::email::get_emails_for_user(db_pool.get_ref(), &email, false, Some(&filter)).await {
                    Ok(received) => {
                        all_emails.extend(received);
                    },
                    Err(e) => {
                        error!("Database error retrieving received emails: {}", e);
                    }
                }
                
                // Apply any additional filters from the request
                let filtered_emails = apply_filters_to_emails(all_emails, &filter);
                
                // Create paginated response
                let page = filter.page.unwrap_or(0);
                let page_size = filter.page_size.unwrap_or(50);
                
                let total_items = filtered_emails.len();
                let total_pages = (total_items as f64 / page_size as f64).ceil() as i32;
                
                let start = (page * page_size) as usize;
                let end = (start + page_size as usize).min(filtered_emails.len());
                
                let emails_page = if start < filtered_emails.len() {
                    filtered_emails[start..end].to_vec()
                } else {
                    Vec::new()
                };
                
                return HttpResponse::Ok().json(json!({
                    "success": true,
                    "emails": emails_page,
                    "totalPages": total_pages,
                    "currentPage": page,
                    "cached": !force_refresh,
                    "message": "Emails retrieved from database",
                }));
            }
            Ok(None) => {
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Invalid session"
                }));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    } else {
        return HttpResponse::Unauthorized().json(json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }
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
                info!("Manual refresh requested for user: {}", email);
                
                // If refresh token exists, get emails from Gmail
                if let Some(refresh_token) = refresh_token.clone() {
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            // We only need to fetch the most recent emails
                            // For a refresh, we limit to the most recent 20 emails
                            // This makes refresh much faster than a full sync
                            const REFRESH_LIMIT: usize = 20;
                            
                            // Get the timestamp of last sync to optimize refresh
                            let _last_sync_timestamp = redis_cache.get_last_sync(&email).await.unwrap_or(None);
                            
                            // Fetch inbox messages (most recent only)
                            let received_future = async {
                                if let Ok(messages) = gmail_client.get_messages_with_limit(&email, &access_token, None, REFRESH_LIMIT).await {
                                let mut received_emails = Vec::new();
                                    
                                    // Use futures to process messages concurrently
                                    use futures::{stream, StreamExt};
                                    const CONCURRENT_REQUESTS: usize = 5;
                                    
                                    let message_stream = stream::iter(messages)
                                        .map(|msg_id| {
                                            let email_clone = email.clone();
                                            let access_token_clone = access_token.clone();
                                            let gmail_client_clone = gmail_client.clone();
                                            
                                            async move {
                                                if let Ok(message) = gmail_client_clone.get_message_detail(&email_clone, &access_token_clone, &msg_id.id).await {
                                                    if let Some(email_obj) = process_gmail_message(&message, &email_clone) {
                                                        // Only include emails addressed to the user
                                                        if email_obj.recipient_email == email_clone {
                                                            Some(email_obj)
                                                        } else {
                                                            None
                                                        }
                                                    } else {
                                                        None
                                                    }
                                                } else {
                                                    None
                                                }
                                            }
                                        })
                                        .buffer_unordered(CONCURRENT_REQUESTS);
                                    
                                    let mut results = message_stream.collect::<Vec<_>>().await;
                                    for result in results.drain(..) {
                                        if let Some(email_obj) = result {
                                            received_emails.push(email_obj);
                                        }
                                    }
                                    
                                    Some(received_emails)
                                } else {
                                    None
                                }
                            };
                            
                            // Fetch sent emails (most recent only)
                            let sent_future = async {
                                if let Ok(messages) = gmail_client.get_messages_with_limit(&email, &access_token, Some("in:sent"), REFRESH_LIMIT).await {
                                let mut sent_emails = Vec::new();
                                    
                                    // Use futures to process messages concurrently
                                    use futures::{stream, StreamExt};
                                    const CONCURRENT_REQUESTS: usize = 5;
                                    
                                    let message_stream = stream::iter(messages)
                                        .map(|msg_id| {
                                            let email_clone = email.clone();
                                            let access_token_clone = access_token.clone();
                                            let gmail_client_clone = gmail_client.clone();
                                            
                                            async move {
                                                if let Ok(message) = gmail_client_clone.get_message_detail(&email_clone, &access_token_clone, &msg_id.id).await {
                                                    if let Some(email_obj) = process_gmail_message(&message, &email_clone) {
                                                        // Only include emails where user is the sender
                                                        if email_obj.sender_email == email_clone {
                                                            Some(email_obj)
                                                        } else {
                                                            None
                                                        }
                                                    } else {
                                                        None
                                                    }
                                                } else {
                                                    None
                                                }
                                            }
                                        })
                                        .buffer_unordered(CONCURRENT_REQUESTS);
                                    
                                    let mut results = message_stream.collect::<Vec<_>>().await;
                                    for result in results.drain(..) {
                                        if let Some(email_obj) = result {
                                            sent_emails.push(email_obj);
                                        }
                                    }
                                    
                                    Some(sent_emails)
                                } else {
                                    None
                                }
                            };
                            
                            // Execute both futures concurrently
                            let (received_result, sent_result) = tokio::join!(received_future, sent_future);
                            
                            // Update cache with new emails
                            let mut new_emails = Vec::new();
                            
                            if let Some(received) = received_result {
                                // Get the existing cache
                                if let Ok(Some((mut cached_received, _, _))) = redis_cache.get_cached_emails_paginated(&email, "received", 0, None).await {
                                    // Create a set of existing ids for fast lookup
                                    let existing_ids: std::collections::HashSet<String> = cached_received.iter()
                                        .map(|e| e.id.clone())
                                        .collect();
                                    
                                    // Add new emails to the beginning
                                    for new_email in &received {
                                        if !existing_ids.contains(&new_email.id) {
                                            cached_received.insert(0, new_email.clone());
                                            new_emails.push(new_email.clone());
                                        }
                                    }
                                    
                                    // Update the cache with a reasonable TTL (4 hours)
                                    let cache_ttl = Some(4 * 60 * 60); // 4 hours in seconds
                                    redis_cache.cache_emails_paginated(&email, "received", &cached_received, cache_ttl).await
                                        .unwrap_or_else(|e| error!("Failed to update received emails cache: {}", e));
                                } else {
                                    // No existing cache, just cache the fetched emails
                                    redis_cache.cache_emails_paginated(&email, "received", &received, None).await
                                        .unwrap_or_else(|e| error!("Failed to cache received emails: {}", e));
                                    new_emails.extend(received.clone());
                                }
                            }
                            
                            if let Some(sent) = sent_result {
                                // Get the existing cache
                                if let Ok(Some((mut cached_sent, _, _))) = redis_cache.get_cached_emails_paginated(&email, "sent", 0, None).await {
                                    // Create a set of existing ids for fast lookup
                                    let existing_ids: std::collections::HashSet<String> = cached_sent.iter()
                                        .map(|e| e.id.clone())
                                        .collect();
                                    
                                    // Add new emails to the beginning
                                    for new_email in &sent {
                                        if !existing_ids.contains(&new_email.id) {
                                            cached_sent.insert(0, new_email.clone());
                                            new_emails.push(new_email.clone());
                                        }
                                    }
                                    
                                    // Update the cache with a reasonable TTL (4 hours)
                                    let cache_ttl = Some(4 * 60 * 60); // 4 hours in seconds
                                    redis_cache.cache_emails_paginated(&email, "sent", &cached_sent, cache_ttl).await
                                        .unwrap_or_else(|e| error!("Failed to update sent emails cache: {}", e));
                                } else {
                                    // No existing cache, just cache the fetched emails
                                    redis_cache.cache_emails_paginated(&email, "sent", &sent, None).await
                                        .unwrap_or_else(|e| error!("Failed to cache sent emails: {}", e));
                                    new_emails.extend(sent.clone());
                                }
                            }
                            
                            // Update last sync timestamp
                            let current_time = chrono::Utc::now().timestamp();
                            redis_cache.set_last_sync(&email).await
                                .unwrap_or_else(|e| error!("Failed to update last sync timestamp: {}", e));
                            
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "message": "Emails refreshed successfully",
                                "new_emails": new_emails.len(),
                                "last_sync": current_time
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
                } else {
                    return HttpResponse::BadRequest().json(json!({
                        "success": false,
                        "error": "No Gmail refresh token found"
                    }));
                }
            }
            Ok(None) => {
                error!("Invalid session");
                HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }))
            }
            Err(e) => {
                error!("Database error: {}", e);
                HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }))
            }
        }
    } else {
    HttpResponse::Unauthorized().json(json!({
        "success": false,
        "error": "Not authenticated"
    }))
    }
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
                
                // Store a clone of refresh_token to avoid ownership issues
                let refresh_token_clone = refresh_token.clone();
                
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
                                            let is_encrypted = subject.contains("[Q-ENCRYPTED]");
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
                                                is_encrypted,
                                                raw_encrypted_content: None,
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
                                // Mark email as read in database and update label_ids
                                let now = chrono::Utc::now().to_rfc3339();
                                let mut updated_email = found_email.clone();
                                updated_email.read_at = Some(now.clone());
                                
                                // Remove UNREAD label if it exists
                                if let Some(ref mut labels) = updated_email.label_ids {
                                    if let Some(pos) = labels.iter().position(|label| label == "UNREAD") {
                                        labels.remove(pos);
                                        info!("Removed UNREAD label for email {}", email_id);
                                    }
                                }
                                
                                // Update in database
                                if let Some(gmail_id) = &updated_email.gmail_id {
                                    if let Some(refresh_token) = &refresh_token_clone {
                                        // Update read status in Gmail via API
                                        if let Ok(access_token) = gmail_client.get_token(&email, refresh_token).await {
                                            let _ = gmail_client.modify_message(
                                                &email, 
                                                &access_token, 
                                                gmail_id, 
                                                &vec![], // add labels (none)
                                                &vec!["UNREAD".to_string()] // remove labels (UNREAD)
                                            ).await;
                                            info!("Updated read status in Gmail for email {}", gmail_id);
                                        }
                                    }
                                }
                                
                                // Update cache with new read status
                                if let Some(ref gmail_id) = updated_email.gmail_id {
                                    let _ = redis_cache.cache_email(&email, gmail_id, &updated_email).await;
                                    info!("Updated cache with read status for email {}", gmail_id);
                                }
                                
                                return HttpResponse::Ok().json(json!({
                                    "success": true,
                                    "email": updated_email,
                                    "source": "database",
                                    "read_updated": true
                                }));
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
fn process_gmail_message(message: &GmailMessage, _user_email: &str) -> Option<crate::models::Email> {
    let (subject, from_email, from_name, to_email, body) = parse_gmail_message(message);
    
    let date = message.internal_date.clone().unwrap_or_else(|| "".to_string());
    
    Some(crate::models::Email {
        id: Uuid::new_v4().to_string(),
        sender_id: from_email.clone(),
        sender_email: from_email,
        sender_name: Some(from_name),
        recipient_email: to_email,
        subject: subject.clone(),
        body: body,
        sent_at: date,
        read_at: None,
        gmail_id: Some(message.id.clone()),
        label_ids: message.label_ids.clone(),
        is_encrypted: subject.contains("[Q-ENCRYPTED]"),
        raw_encrypted_content: None,
    })
}

// Mark an email as read
pub async fn mark_email_as_read(
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
                info!("Marking email {} as read for user {}", email_id, email);
                
                // Get the email to check ownership and current read status
                match db::get_email(db_pool.get_ref(), &email_id).await {
                    Ok(Some(found_email)) => {
                        // Check if user is recipient (only recipients can mark as read)
                        if found_email.recipient_email != email {
                            return HttpResponse::Forbidden().json(json!({
                                "success": false,
                                "error": "You can only mark emails where you are the recipient as read"
                            }));
                        }
                        
                        // Check if already read
                        if found_email.read_at.is_some() {
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "email": found_email,
                                "message": "Email already marked as read"
                            }));
                        }
                        
                        // Mark email as read in database and update label_ids
                        let now = chrono::Utc::now().to_rfc3339();
                        let mut updated_email = found_email.clone();
                        updated_email.read_at = Some(now.clone());
                        
                        // Remove UNREAD label if it exists
                        if let Some(ref mut labels) = updated_email.label_ids {
                            if let Some(pos) = labels.iter().position(|label| label == "UNREAD") {
                                labels.remove(pos);
                                info!("Removed UNREAD label for email {}", email_id);
                            }
                        }
                        
                        // If it has a Gmail ID, update in Gmail
                        if let Some(gmail_id) = &updated_email.gmail_id {
                            if let Some(refresh_token) = &refresh_token {
                                // Update read status in Gmail via API
                                if let Ok(access_token) = gmail_client.get_token(&email, refresh_token).await {
                                    match gmail_client.modify_message(
                                        &email, 
                                        &access_token, 
                                        gmail_id, 
                                        &vec![], // add labels (none)
                                        &vec!["UNREAD".to_string()] // remove labels (UNREAD)
                                    ).await {
                                        Ok(_) => info!("Updated read status in Gmail for email {}", gmail_id),
                                        Err(e) => warn!("Failed to update Gmail labels: {}", e),
                                    }
                                }
                            }
                        }
                        
                        // Update cache with new read status
                        if let Some(ref gmail_id) = updated_email.gmail_id {
                            let _ = redis_cache.cache_email(&email, gmail_id, &updated_email).await;
                            info!("Updated cache with read status for email {}", gmail_id);
                        }
                        
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "email": updated_email,
                            "message": "Email marked as read"
                        }));
                    }
                    Ok(None) => {
                        return HttpResponse::NotFound().json(json!({
                            "success": false,
                            "error": "Email not found"
                        }));
                    }
                    Err(e) => {
                        error!("Database error when getting email: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Internal server error"
                        }));
                    }
                }
            }
            Ok(None) => {
                info!("Session not found: {}", session_token);
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            }
            Err(e) => {
                error!("Database error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": "Internal server error"
                }));
            }
        }
    } else {
        info!("No session cookie found");
        return HttpResponse::Unauthorized().json(json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }
}

// Generate encryption keys for a user
pub async fn generate_encryption_keys(
    req: HttpRequest,
    db_pool: DbPool,
) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, _))) => {
                // Check if user already has keys
                match crate::encryption::keys::get_keypair(db_pool.get_ref(), &email).await {
                    Ok(Some(_)) => {
                        // User already has keys
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "message": "Encryption keys already exist"
                        }));
                    },
                    Ok(None) => {
                        // Generate new key pair
                        match crate::encryption::generate_keypair() {
                            Ok(keypair) => {
                                // Store the key pair
                                match crate::encryption::keys::store_keypair(db_pool.get_ref(), &email, &keypair).await {
                                    Ok(_) => {
                                        info!("Generated and stored encryption keys for user: {}", email);
                                        return HttpResponse::Ok().json(json!({
                                            "success": true,
                                            "message": "Encryption keys generated successfully"
                                        }));
                                    },
                                    Err(e) => {
                                        error!("Failed to store key pair: {}", e);
                                        return HttpResponse::InternalServerError().json(json!({
                                            "success": false,
                                            "error": "Failed to store encryption keys",
                                            "details": format!("{}", e)
                                        }));
                                    }
                                }
                            },
                            Err(e) => {
                                error!("Failed to generate key pair: {}", e);
                                return HttpResponse::InternalServerError().json(json!({
                                    "success": false,
                                    "error": "Failed to generate encryption keys",
                                    "details": format!("{}", e)
                                }));
                            }
                        }
                    },
                    Err(e) => {
                        error!("Failed to check for existing keys: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Failed to check for existing keys",
                            "details": format!("{}", e)
                        }));
                    }
                }
            },
            Ok(None) => {
                error!("Invalid session");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            },
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

// Decrypt an email message
pub async fn decrypt_email(
    req: HttpRequest,
    path: web::Path<String>,
    db_pool: DbPool,
) -> impl Responder {
    let email_id = path.into_inner();
    
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, _))) => {
                // Get the email from the database
                match db::get_email(db_pool.get_ref(), &email_id).await {
                    Ok(Some(email_obj)) => {
                        // Check if the email is encrypted and has raw content
                        if email_obj.is_encrypted {
                            if let Some(ref raw_content) = email_obj.raw_encrypted_content {
                                // Get the user's private key
                                match crate::encryption::keys::get_keypair(db_pool.get_ref(), &email).await {
                                    Ok(Some(keypair)) => {
                                        // Parse the encrypted content
                                        match crate::encryption::deserialize_encrypted_message(&raw_content) {
                                            Ok(encrypted_msg) => {
                                                // Decrypt the message
                                                match crate::encryption::decrypt_message(&encrypted_msg, &keypair.secret_key) {
                                                    Ok(decrypted_body) => {
                                                        // Create a new email object with the decrypted body
                                                        let decrypted_subject = crate::encryption::extract_original_subject(&email_obj.subject);
                                                        
                                                        let mut decrypted_email = email_obj.clone();
                                                        decrypted_email.subject = decrypted_subject;
                                                        decrypted_email.body = decrypted_body;
                                                        
                                                        return HttpResponse::Ok().json(json!({
                                                            "success": true,
                                                            "email": decrypted_email
                                                        }));
                                                    },
                                                    Err(e) => {
                                                        error!("Failed to decrypt message: {}", e);
                                                        return HttpResponse::InternalServerError().json(json!({
                                                            "success": false,
                                                            "error": "Failed to decrypt message",
                                                            "details": format!("{}", e)
                                                        }));
                                                    }
                                                }
                                            },
                                            Err(e) => {
                                                error!("Failed to parse encrypted message: {}", e);
                                                return HttpResponse::InternalServerError().json(json!({
                                                    "success": false,
                                                    "error": "Failed to parse encrypted message",
                                                    "details": format!("{}", e)
                                                }));
                                            }
                                        }
                                    },
                                    Ok(None) => {
                                        error!("No encryption keys found for user: {}", email);
                                        return HttpResponse::BadRequest().json(json!({
                                            "success": false,
                                            "error": "No encryption keys found"
                                        }));
                                    },
                                    Err(e) => {
                                        error!("Failed to get encryption keys: {}", e);
                                        return HttpResponse::InternalServerError().json(json!({
                                            "success": false,
                                            "error": "Failed to get encryption keys",
                                            "details": format!("{}", e)
                                        }));
                                    }
                                }
                            } else {
                                return HttpResponse::BadRequest().json(json!({
                                    "success": false,
                                    "error": "Email is marked as encrypted but has no encrypted content"
                                }));
                            }
                        } else {
                            return HttpResponse::BadRequest().json(json!({
                                "success": false,
                                "error": "Email is not encrypted"
                            }));
                        }
                    },
                    Ok(None) => {
                        return HttpResponse::NotFound().json(json!({
                            "success": false,
                            "error": "Email not found"
                        }));
                    },
                    Err(e) => {
                        error!("Database error: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "error": "Database error",
                            "details": format!("{}", e)
                        }));
                    }
                }
            },
            Ok(None) => {
                error!("Invalid session");
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Not authenticated"
                }));
            },
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