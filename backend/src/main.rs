use actix_web::{web, App, HttpResponse, HttpServer, Responder, cookie::Cookie};
use actix_cors::Cors;
use std::env;
use serde_json::json;
use oauth2::{AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl, basic::BasicClient, reqwest::async_http_client, AuthorizationCode, CsrfToken, Scope, TokenResponse};
use serde::Deserialize;
use rand::Rng;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

type SessionMap = Arc<Mutex<HashMap<String, String>>>;

async fn welcome() -> impl Responder {
    HttpResponse::Ok().json(json!({"message": "Welcome to Q-Client Backend"}))
}

async fn login() -> impl Responder {
    HttpResponse::Ok().json(json!({"message": "Login page - Google OAuth implemented"}))
}

async fn auth_google() -> impl Responder {
    let client = BasicClient::new(
        ClientId::new(env::var("GOOGLE_CLIENT_ID").unwrap()),
        Some(ClientSecret::new(env::var("GOOGLE_CLIENT_SECRET").unwrap())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string()).unwrap(),
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string()).unwrap()),
    )
        .set_redirect_uri(RedirectUrl::new("http://localhost:8080/auth/google/callback".to_string()).unwrap());

    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("profile".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .url();

    HttpResponse::Found().append_header(("Location", auth_url.to_string())).finish()}

#[derive(Deserialize)]
struct AuthQuery {
    code: String,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
    email: String,
}

async fn auth_google_callback(
    query: web::Query<AuthQuery>,
    state: web::Data<SessionMap>,
) -> impl Responder {
    let code = AuthorizationCode::new(query.code.clone());

    let client = BasicClient::new(
        ClientId::new(env::var("GOOGLE_CLIENT_ID").unwrap()),
        Some(ClientSecret::new(env::var("GOOGLE_CLIENT_SECRET").unwrap())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string()).unwrap(),
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string()).unwrap()),
    )
        .set_redirect_uri(RedirectUrl::new("http://localhost:8080/auth/google/callback".to_string()).unwrap());

    let token_result = client
        .exchange_code(code)
        .request_async(async_http_client)
        .await
        .unwrap();

    let user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo";
    let user_info: GoogleUserInfo = reqwest::Client::new()
        .get(user_info_url)
        .bearer_auth(token_result.access_token().secret())
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    let session_token = rand::thread_rng()
        .gen::<[u8; 32]>()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();

    let mut sessions = state.lock().unwrap();
    sessions.insert(session_token.clone(), user_info.email);

    let cookie = Cookie::build("session", session_token)
        .path("/")
        .http_only(true)
        .secure(false) // For development on localhost
        .same_site(actix_web::cookie::SameSite::None)
        .finish();

    HttpResponse::Found()
        .append_header(("Location", "http://localhost:3000/dashboard"))
        .cookie(cookie)
        .finish()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("0.0.0.0:{}", port);

    let sessions = web::Data::new(Arc::new(Mutex::new(HashMap::<String, String>::new())));
    println!("Server starting on {}", bind_address);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .app_data(sessions.clone())
            .wrap(cors)
            .route("/", web::get().to(welcome))
            .route("/login", web::get().to(login))
            .route("/auth/google", web::get().to(auth_google))
            .route("/auth/google/callback", web::get().to(auth_google_callback))
    })
        .bind(&bind_address)?
        .run()
        .await
}
