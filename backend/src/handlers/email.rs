use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;
use uuid::Uuid;
use base64::{encode_config, STANDARD};
use std::env;

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
                                            // Invalidate the user's cache to ensure the sent email appears
                                            let _ = redis_cache.invalidate_user_cache(&email).await;
                                            println!("Email sent via Gmail API: {} -> {}, cache invalidated", email, email_req.recipient_email);
                                            
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
    query: web::Query<crate::models::EmailFilter>,
    db_pool: DbPool,
    gmail_client: GmailClientData,
    redis_cache: RedisCacheData,
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _, refresh_token))) => {
                println!("Getting emails for authenticated user: {} with filters: {:?}", email, query);
                
                // First try to get emails from Redis cache
                let mut use_cache = true;
                
                // Create a cache key that includes the filters
                let cache_key = format!("{}:{}:{}:{}:{}:{}",
                    query.label.as_deref().unwrap_or(""),
                    query.is_read.unwrap_or(false),
                    query.search.as_deref().unwrap_or(""),
                    query.sender.as_deref().unwrap_or(""),
                    query.recipient.as_deref().unwrap_or(""),
                    match &query.sort_by {
                        Some(sort) => match sort {
                            SortField::Date => "date",
                            SortField::Sender => "sender",
                            SortField::Subject => "subject",
                        },
                        None => ""
                    }
                );
                
                // Check cache for filtered results first
                if let Ok(Some(cached_filtered)) = redis_cache.get_cached_emails(&email, &cache_key).await {
                    println!("Using cached filtered emails: {} emails", cached_filtered.len());
                    return HttpResponse::Ok().json(json!({
                        "success": true,
                        "emails": cached_filtered
                    }));
                }
                
                // If we don't have cached filtered results, get base emails from cache
                let cached_received = match redis_cache.get_cached_emails(&email, "received").await {
                    Ok(Some(emails)) => emails,
                    _ => {
                        use_cache = false;
                        Vec::new()
                    }
                };
                
                let cached_sent = match redis_cache.get_cached_emails(&email, "sent").await {
                    Ok(Some(emails)) => emails,
                    _ => {
                        use_cache = false;
                        Vec::new()
                    }
                };
                
                if use_cache {
                    println!("Using cached base emails: {} sent, {} received", cached_sent.len(), cached_received.len());
                    
                    // Combine and apply filters
                    let mut all_emails = [cached_sent, cached_received].concat();
                    all_emails = apply_filters_to_emails(all_emails, &query);
                    
                    // Cache the filtered results
                    if !all_emails.is_empty() {
                        let _ = redis_cache.cache_emails(&email, &cache_key, &all_emails).await;
                        println!("Cached filtered results with key: {}", cache_key);
                    }
                    
                    // Start background refresh
                    if let Some(refresh_token) = refresh_token.clone() {
                        let email_clone = email.clone();
                        let gmail_client_clone = gmail_client.clone();
                        let redis_cache_clone = redis_cache.clone();
                        
                        tokio::spawn(async move {
                            println!("Starting background refresh for {}", email_clone);
                            if let Ok(token) = gmail_client_clone.get_token(&email_clone, &refresh_token).await {
                                // Refresh inbox messages
                                if let Ok(messages) = gmail_client_clone.get_messages(&email_clone, &token, Some("in:inbox")).await {
                                    let mut received_emails = Vec::new();
                                    let limit = std::cmp::min(20, messages.len());
                                    
                                    for msg_id in &messages[0..limit] {
                                        if let Ok(message) = gmail_client_clone.get_message_detail(&email_clone, &token, &msg_id.id).await {
                                            if let Some(email_obj) = process_gmail_message(&message, &email_clone) {
                                                let _ = redis_cache_clone.cache_email(&email_clone, &message.id, &email_obj).await;
                                                received_emails.push(email_obj);
                                            }
                                        }
                                    }
                                    
                                    if !received_emails.is_empty() {
                                        let _ = redis_cache_clone.cache_emails(&email_clone, "received", &received_emails).await;
                                        println!("Updated received emails cache for {}", email_clone);
                                    }
                                }
                                
                                // Refresh sent messages
                                if let Ok(messages) = gmail_client_clone.get_messages(&email_clone, &token, Some("in:sent")).await {
                                    let mut sent_emails = Vec::new();
                                    let limit = std::cmp::min(20, messages.len());
                                    
                                    for msg_id in &messages[0..limit] {
                                        if let Ok(message) = gmail_client_clone.get_message_detail(&email_clone, &token, &msg_id.id).await {
                                            if let Some(email_obj) = process_gmail_message(&message, &email_clone) {
                                                let _ = redis_cache_clone.cache_email(&email_clone, &message.id, &email_obj).await;
                                                sent_emails.push(email_obj);
                                            }
                                        }
                                    }
                                    
                                    if !sent_emails.is_empty() {
                                        let _ = redis_cache_clone.cache_emails(&email_clone, "sent", &sent_emails).await;
                                        println!("Updated sent emails cache for {}", email_clone);
                                    }
                                }
                            }
                        });
                    }
                    
                    return HttpResponse::Ok().json(json!({
                        "success": true,
                        "emails": all_emails
                    }));
                }
                
                // If Gmail API is available, fetch emails directly
                if let Some(refresh_token) = refresh_token {
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            let mut all_emails = Vec::new();
                            
                            // Build Gmail query from filters
                            let mut gmail_query = String::new();
                            
                            // Convert our filters to Gmail query syntax
                            if let Some(label) = &query.label {
                                gmail_query.push_str(&format!("label:{} ", label));
                            }
                            
                            if let Some(is_read) = query.is_read {
                                if is_read {
                                    gmail_query.push_str("is:read ");
                                } else {
                                    gmail_query.push_str("is:unread ");
                                }
                            }
                            
                            if let Some(search) = &query.search {
                                gmail_query.push_str(&format!("{} ", search));
                            }
                            
                            if let Some(sender) = &query.sender {
                                gmail_query.push_str(&format!("from:{} ", sender));
                            }
                            
                            if let Some(recipient) = &query.recipient {
                                gmail_query.push_str(&format!("to:{} ", recipient));
                            }
                            
                            // Use the Gmail query we constructed
                            let query_param = if !gmail_query.is_empty() {
                                Some(gmail_query.as_str())
                            } else {
                                None
                            };
                            
                            // Get messages from Gmail API
                            match gmail_client.get_messages(&email, &access_token, query_param).await {
                                Ok(messages) => {
                                    println!("Retrieved {} Gmail messages with filters: {:?}", messages.len(), query);
                                    
                                    // Process messages
                                    let limit = std::cmp::min(50, messages.len());
                                    
                                    for msg_id in &messages[0..limit] {
                                        if let Ok(message) = gmail_client.get_message_detail(&email, &access_token, &msg_id.id).await {
                                            let (subject, sender, sender_name, recipient, body) = parse_gmail_message(&message);
                                            
                                            if !sender.is_empty() && !recipient.is_empty() {
                                                let is_sent = message.label_ids.as_ref().map_or(false, |labels| labels.contains(&"SENT".to_string()));
                                                
                                                // Create a database-style email object
                                                let email_obj = crate::models::Email {
                                                    id: Uuid::new_v4().to_string(),
                                                    sender_id: sender.clone(),
                                                    sender_email: sender.clone(),
                                                    sender_name: Some(sender_name),
                                                    recipient_email: recipient.clone(),
                                                    subject: subject.clone(),
                                                    body: body.clone(),
                                                    sent_at: message.internal_date.clone().unwrap_or_else(|| "".to_string()),
                                                    read_at: if is_sent { 
                                                        Some(message.internal_date.clone().unwrap_or_else(|| "".to_string())) 
                                                    } else { 
                                                        None 
                                                    },
                                                    gmail_id: Some(message.id.clone()),
                                                    label_ids: message.label_ids.clone(),
                                                };
                                                
                                                // Store in database (optional, can be disabled)
                                                let _ = db::store_email(
                                                    db_pool.get_ref(),
                                                    &sender,
                                                    &sender,
                                                    &recipient,
                                                    &subject,
                                                    &body,
                                                ).await;
                                                
                                                // Add to our collection
                                                all_emails.push(email_obj);
                                            }
                                        }
                                    }
                                    
                                    // Apply manual filtering for results
                                    all_emails = apply_filters_to_emails(all_emails, &query);
                                    
                                    return HttpResponse::Ok().json(json!({
                                        "success": true,
                                        "emails": all_emails,
                                        "source": "gmail",
                                        "filtered": true
                                    }));
                                }
                                Err(e) => {
                                    println!("Error fetching messages from Gmail API: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            println!("Error getting Gmail access token: {}", e);
                        }
                    }
                }
                
                // Fallback to database if no cache or Gmail API
                let received = match db::get_emails_for_user(db_pool.get_ref(), &email, false, Some(&query)).await {
                    Ok(emails) => emails,
                    Err(e) => {
                        println!("Database error when fetching received emails: {}", e);
                        Vec::new()
                    }
                };
                
                let sent = match db::get_emails_for_user(db_pool.get_ref(), &email, true, Some(&query)).await {
                    Ok(emails) => emails,
                    Err(e) => {
                        println!("Database error when fetching sent emails: {}", e);
                        Vec::new()
                    }
                };
                
                // Combine emails from both queries
                let all_emails = [sent, received].concat();
                
                return HttpResponse::Ok().json(json!({
                    "success": true,
                    "emails": all_emails,
                    "source": "database",
                    "filtered": true
                }));
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
    redis_cache: RedisCacheData,
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Extract user email from cookie (this should be done via DB lookup in production)
        let email = match db::get_user_by_session(&web::Data::new(sqlx::PgPool::connect(&env::var("DATABASE_URL").unwrap()).await.unwrap()), &session_token).await {
            Ok(Some((email, _, _, _))) => email,
            _ => {
                return HttpResponse::Unauthorized().json(json!({
                    "success": false,
                    "error": "Invalid session"
                }));
            }
        };
        
        // Invalidate cache for this user
        match redis_cache.invalidate_user_cache(&email).await {
            Ok(_) => {
                println!("Cache invalidated for user {}", email);
                HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "Email cache refreshed. Please fetch emails again."
                }))
            },
            Err(e) => {
                println!("Error invalidating cache for user {}: {}", email, e);
                HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "error": "Failed to refresh cache",
                    "details": format!("{}", e)
                }))
            }
        }
    } else {
        // No session cookie found
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