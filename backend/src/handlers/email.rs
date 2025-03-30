use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;

use crate::db;
use crate::models::SendEmailRequest;

type DbPool = web::Data<sqlx::PgPool>;

// Send a new email
pub async fn send_email(
    req: HttpRequest,
    email_req: web::Json<SendEmailRequest>,
    db_pool: DbPool,
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _))) => {
                // User is authenticated, send the email
                match db::store_email(
                    db_pool.get_ref(),
                    &email, // sender_id is the user's email
                    &email, // sender_email
                    &email_req.recipient_email,
                    &email_req.subject,
                    &email_req.body,
                ).await {
                    Ok(email_id) => {
                        println!("Email sent: {} -> {}", email, email_req.recipient_email);
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "email_id": email_id,
                            "message": "Email sent successfully"
                        }));
                    }
                    Err(e) => {
                        println!("Database error when sending email: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Failed to send email",
                            "details": format!("{}", e)
                        }));
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
) -> impl Responder {
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _))) => {
                // Get sent emails
                let sent_result = db::get_sent_emails(db_pool.get_ref(), &email).await;
                // Get received emails
                let received_result = db::get_received_emails(db_pool.get_ref(), &email).await;
                
                match (sent_result, received_result) {
                    (Ok(sent), Ok(received)) => {
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "sent": sent,
                            "received": received
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
    path: web::Path<i32>,
    db_pool: DbPool,
) -> impl Responder {
    let email_id = path.into_inner();
    
    // Check if user is authenticated
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, _, _))) => {
                // Get the email
                match db::get_email_by_id(db_pool.get_ref(), email_id).await {
                    Ok(Some(found_email)) => {
                        // Check if user is either sender or recipient
                        if found_email.sender_email == email || found_email.recipient_email == email {
                            // Mark as read if user is recipient
                            if found_email.recipient_email == email {
                                let _ = db::mark_email_as_read(db_pool.get_ref(), email_id).await;
                            }
                            
                            return HttpResponse::Ok().json(json!({
                                "success": true,
                                "email": found_email
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
