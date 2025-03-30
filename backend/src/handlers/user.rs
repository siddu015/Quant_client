use actix_web::{web, HttpResponse, Responder, HttpRequest};
use serde_json::json;

use crate::db;
use crate::models::UserResponse;

type DbPool = web::Data<sqlx::PgPool>;

pub async fn get_user_info(req: HttpRequest, db_pool: DbPool) -> impl Responder {
    if let Some(cookie) = req.cookie("session") {
        let session_token = cookie.value().to_string();
        
        // Look up user by session token
        match db::get_user_by_session(db_pool.get_ref(), &session_token).await {
            Ok(Some((email, name, picture))) => {
                println!("User authenticated: {}", email);
                return HttpResponse::Ok().json(UserResponse {
                    authenticated: true,
                    email: Some(email),
                    name,
                    picture,
                    message: None,
                });
            }
            Ok(None) => {
                println!("Invalid session token: {}", session_token);
                return HttpResponse::Ok().json(UserResponse {
                    authenticated: false,
                    email: None,
                    name: None,
                    picture: None,
                    message: Some("Invalid session".to_string()),
                });
            }
            Err(e) => {
                println!("Database error during authentication check: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "error": "Database error",
                    "details": format!("{}", e)
                }));
            }
        }
    } else {
        println!("No session cookie found");
    }
    
    HttpResponse::Ok().json(UserResponse {
        authenticated: false,
        email: None,
        name: None,
        picture: None,
        message: None,
    })
}
