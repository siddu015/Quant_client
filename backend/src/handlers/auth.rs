use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use oauth2::{AuthorizationCode, CsrfToken, Scope, TokenResponse};
use oauth2::reqwest::async_http_client;
use reqwest;
use uuid;
use actix_web::cookie::Cookie;

use crate::db;
use crate::auth;
use crate::models::*;

type DbPool = web::Data<sqlx::PgPool>;

pub async fn auth_google() -> impl Responder {
    let client = auth::create_oauth_client();

    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("profile".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.readonly".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.send".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.modify".to_string()))
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent")
        .url();

    println!("Auth URL: {}", auth_url);
    HttpResponse::Found().append_header(("Location", auth_url.to_string())).finish()
}

pub async fn auth_google_callback(
    query: web::Query<AuthQuery>,
    db_pool: DbPool,
) -> impl Responder {
    let client = auth::create_oauth_client();
    
    // Exchange the code for a token
    let code = AuthorizationCode::new(query.code.clone());
    
    match client
        .exchange_code(code)
        .request_async(async_http_client)
        .await
    {
        Ok(token) => {
            println!("Successfully exchanged auth code for token");
            
            // Get refresh token
            let refresh_token = token.refresh_token().map(|t| t.secret().clone());
            
            if let Some(ref refresh) = refresh_token {
                println!("Received refresh token, length: {}", refresh.len());
            } else {
                println!("No refresh token received! User won't be able to use Gmail API");
            }
            
            // Get the access token
            let access_token = token.access_token().secret();
            println!("Received access token, length: {}", access_token.len());
            
            // Get user info from Google
            let user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo";
            let user_info_response = reqwest::Client::new()
                .get(user_info_url)
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await;
                
            match user_info_response {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<GoogleUserInfo>().await {
                            Ok(mut user_info) => {
                                println!("Retrieved user info for: {}", user_info.email);
                                
                                // Add the refresh token to the user info
                                user_info.refresh_token = refresh_token.clone();
                                
                                // Fix profile picture URL - ensure it's using HTTPS
                                if let Some(ref pic_url) = user_info.picture {
                                    if pic_url.starts_with("http://") {
                                        user_info.picture = Some(pic_url.replace("http://", "https://"));
                                    }
                                    
                                    // Ensure the picture URL doesn't have size restrictions that are too small
                                    // Google sometimes returns a small sized image by default
                                    if let Some(ref mut pic_url) = user_info.picture {
                                        if pic_url.contains("=s") {
                                            // Replace the size parameter with a larger one (s256-c instead of s96-c)
                                            *pic_url = pic_url.replace("=s96-c", "=s256-c");
                                        }
                                    }
                                }
                                
                                // Generate a session token
                                let session_token = uuid::Uuid::new_v4().to_string();
                                
                                // Store the user and session in the database
                                match db::store_user(
                                    db_pool.get_ref(),
                                    &user_info.email,
                                    &user_info.name,
                                    &user_info.picture,
                                    &session_token,
                                    &refresh_token,
                                ).await {
                                    Ok(_) => {
                                        println!("Stored user session for: {}", user_info.email);
                                        
                                        // Create a cookie with the session token
                                        let cookie = Cookie::build("session", session_token)
                                            .path("/")
                                            .max_age(actix_web::cookie::time::Duration::days(7))
                                            .http_only(true)
                                            .finish();
                                            
                                        // Redirect to the frontend with the cookie
                                        println!("Redirecting to frontend: {}", auth::FRONTEND_URL);
                                        HttpResponse::Found()
                                            .cookie(cookie)
                                            .append_header(("Location", auth::FRONTEND_URL.clone()))
                                            .finish()
                                    },
                                    Err(e) => {
                                        println!("Error storing user session: {}", e);
                                        HttpResponse::InternalServerError().json(json!({
                                            "error": "Database error",
                                            "details": format!("{}", e)
                                        }))
                                    }
                                }
                            },
                            Err(e) => {
                                println!("Error parsing user info: {}", e);
                                HttpResponse::InternalServerError().json(json!({
                                    "error": "Failed to parse user info",
                                    "details": format!("{}", e)
                                }))
                            }
                        }
                    } else {
                        println!("Error response from Google API: {}", response.status());
                        HttpResponse::InternalServerError().json(json!({
                            "error": "Failed to get user info",
                            "details": format!("Status: {}", response.status())
                        }))
                    }
                },
                Err(e) => {
                    println!("Error requesting user info: {}", e);
                    HttpResponse::InternalServerError().json(json!({
                        "error": "Failed to request user info",
                        "details": format!("{}", e)
                    }))
                }
            }
        },
        Err(e) => {
            println!("Error exchanging code for token: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "error": "Failed to exchange code for token",
                "details": format!("{}", e)
            }))
        }
    }
}

pub async fn logout() -> impl Responder {
    // Create an expired cookie to clear the session
    let expired_cookie = auth::create_logout_cookie();
    
    println!("User logged out");
    
    // Return a response with the expired cookie and redirect to welcome page
    HttpResponse::Found()
        .append_header(("Location", format!("{}", auth::FRONTEND_URL)))
        .cookie(expired_cookie)
        .json(json!({
            "success": true,
            "message": "Logged out successfully"
        }))
}
