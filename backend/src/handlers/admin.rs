use actix_web::{web, HttpResponse, Responder};
use serde_json::json;

use crate::db;

type DbPool = web::Data<sqlx::PgPool>;

// Admin endpoints for debugging
pub async fn list_users(db_pool: DbPool) -> impl Responder {
    match db::list_users(db_pool.get_ref()).await {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(e) => {
            println!("Database error: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "error": "Database error"
            }))
        }
    }
}
