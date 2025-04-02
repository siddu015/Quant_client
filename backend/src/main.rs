// Import section
use actix_web::{web, App, HttpServer};
use actix_cors::Cors;
use std::env;
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;
use env_logger::Builder;
use log::LevelFilter;
use std::fs::File;
use env_logger::fmt::Color;
use std::io::Write;

// Import modules
mod models;
mod db;
mod auth;
mod handlers;
mod gmail;
mod cache;

// Main function
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenv().ok();
    
    // Configure logging
    Builder::new()
        .filter_level(LevelFilter::Info)
        .format_timestamp(None)
        .format_target(false)
        .init();
    
    // Database setup
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to create pool");
    
    db::init(&pool).await.expect("Failed to initialize database");
    
    // Create Gmail client
    let gmail_client = gmail::create_gmail_client();
    
    // Create Redis cache
    let redis_cache = cache::create_redis_cache();
    
    // Server setup
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("0.0.0.0:{}", port);
    
    log::info!("Server starting on {}", bind_address);
    log::info!("Frontend URL: {}", auth::FRONTEND_URL);

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(gmail_client.clone()))
            .app_data(web::Data::new(redis_cache.clone()))
            .wrap(cors)
            // Base routes
            .route("/", web::get().to(handlers::welcome))
            // Auth routes
            .route("/auth/google", web::get().to(handlers::auth_google))
            .route("/auth/google/callback", web::get().to(handlers::auth_google_callback))
            .route("/api/user", web::get().to(handlers::get_user_info))
            .route("/api/logout", web::post().to(handlers::logout))
            // Email routes
            .route("/api/emails", web::get().to(handlers::get_emails))
            .route("/api/emails", web::post().to(handlers::send_email))
            .route("/api/emails/{id}", web::get().to(handlers::get_email))
            .route("/api/emails/{id}/read", web::post().to(handlers::mark_email_as_read))
            // Cache control routes
            .route("/api/emails/refresh", web::post().to(handlers::refresh_emails))
            // Admin routes
            .route("/admin/users", web::get().to(handlers::list_users))
            // Label routes
            .route("/api/labels", web::get().to(handlers::get_labels))
    })
        .bind(&bind_address)?
        .run()
        .await
}
