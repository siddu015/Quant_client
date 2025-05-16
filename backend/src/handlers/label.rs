use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;

use crate::db;
use crate::gmail::GmailClient;
use crate::cache::RedisCache;

type DbPool = web::Data<sqlx::PgPool>;
type GmailClientData = web::Data<std::sync::Arc<GmailClient>>;
type RedisCacheData = web::Data<std::sync::Arc<RedisCache>>;

pub async fn get_labels(
    req: HttpRequest,
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
                println!("Getting labels for authenticated user: {}", email);
                
                // First try to get labels from Redis cache
                match redis_cache.get_cached_labels(&email).await {
                    Ok(Some(cached_labels)) => {
                        println!("Using cached labels: {}", cached_labels.len());
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "labels": cached_labels,
                            "source": "cache"
                        }));
                    }
                    _ => println!("No cached labels found, fetching from Gmail API"),
                }
                
                // If no cache, try to get from Gmail API
                if let Some(refresh_token) = refresh_token {
                    match gmail_client.get_token(&email, &refresh_token).await {
                        Ok(access_token) => {
                            match gmail_client.get_labels(&email, &access_token).await {
                                Ok(labels) => {
                                    println!("Retrieved {} labels from Gmail API", labels.len());
                                    
                                    // Store in database and cache
                                    for label in &labels {
                                        if let Err(e) = db::store_label(db_pool.get_ref(), &email, label).await {
                                            println!("Error storing label {}: {}", label.id, e);
                                        }
                                    }
                                    
                                    // Cache the labels
                                    let _ = redis_cache.cache_labels(&email, &labels).await;
                                    
                                    return HttpResponse::Ok().json(json!({
                                        "success": true,
                                        "labels": labels,
                                        "source": "gmail"
                                    }));
                                }
                                Err(e) => {
                                    println!("Error fetching labels from Gmail API: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            println!("Error getting Gmail access token: {}", e);
                        }
                    }
                }
                
                // Fallback to database labels
                match db::get_labels_for_user(db_pool.get_ref(), &email).await {
                    Ok(labels) => {
                        return HttpResponse::Ok().json(json!({
                            "success": true,
                            "labels": labels,
                            "source": "database"
                        }));
                    }
                    Err(e) => {
                        println!("Database error when fetching labels: {}", e);
                        return HttpResponse::InternalServerError().json(json!({
                            "success": false,
                            "error": "Failed to fetch labels",
                            "details": format!("{}", e)
                        }));
                    }
                }
            }
            Ok(None) => {
                println!("Invalid session token when fetching labels");
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