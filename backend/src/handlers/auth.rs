use actix_web::{web, HttpResponse, Responder};
use serde_json::json;
use oauth2::{AuthorizationCode, CsrfToken, Scope, TokenResponse};
use oauth2::reqwest::async_http_client;

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
    // Check if code is provided
    if query.code.is_empty() {
        println!("Error: No authorization code provided");
        return HttpResponse::BadRequest().json(json!({
            "error": "No authorization code provided"
        }));
    }

    let code = AuthorizationCode::new(query.code.clone());
    let client = auth::create_oauth_client();

    // Exchange the authorization code for an access token
    let token_result = match client
        .exchange_code(code)
        .request_async(async_http_client)
        .await {
            Ok(token) => token,
            Err(e) => {
                println!("Token exchange error: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Failed to exchange authorization code for token",
                    "details": format!("{}", e)
                }));
            }
        };

    // Get the refresh token if available
    let refresh_token = token_result
        .refresh_token()
        .map(|token| token.secret().clone());
    
    println!("Refresh token received: {:?}", refresh_token);

    // Get user info from Google
    let user_info = match auth::get_google_user_info(token_result.access_token().secret()).await {
        Ok(info) => info,
        Err(e) => {
            println!("User info error: {}", e);
            return HttpResponse::InternalServerError().json(json!({
                "error": "Failed to get user information from Google",
                "details": format!("{}", e)
            }));
        }
    };
    
    // Generate a unique session token
    let session_token = auth::generate_session_token();
    
    // Store user in database with refresh token
    if let Err(e) = db::store_user(
        db_pool.get_ref(),
        &user_info.email,
        &user_info.name,
        &user_info.picture,
        &session_token,
        &refresh_token,
    ).await {
        println!("Database error: {}", e);
        return HttpResponse::InternalServerError().json(json!({
            "error": "Failed to store user information",
            "details": format!("{}", e)
        }));
    }

    // Create session cookie
    let cookie = auth::create_session_cookie(&session_token);

    // Log successful login
    println!("User logged in: {} ({})", user_info.name.unwrap_or_else(|| "Unknown".to_string()), user_info.email);

    // Redirect to dashboard
    HttpResponse::Found()
        .append_header(("Location", format!("{}/dashboard", auth::FRONTEND_URL)))
        .cookie(cookie)
        .finish()
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
