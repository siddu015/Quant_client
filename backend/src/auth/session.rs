use actix_web::cookie::Cookie;
use uuid::Uuid;

// Generate a session token
pub fn generate_session_token() -> String {
    Uuid::new_v4().to_string()
}

// Create a session cookie
pub fn create_session_cookie(session_token: &str) -> Cookie<'static> {
    Cookie::build("session", session_token.to_owned())
        .path("/")
        .http_only(true)
        .secure(false) // For development on localhost
        .same_site(actix_web::cookie::SameSite::Lax)
        .max_age(actix_web::cookie::time::Duration::days(7)) // Make session last for 7 days
        .finish()
}

// Create a logout cookie (expired session cookie)
pub fn create_logout_cookie() -> Cookie<'static> {
    Cookie::build("session", String::new())
        .path("/")
        .http_only(true)
        .secure(false)
        .same_site(actix_web::cookie::SameSite::Lax)
        .max_age(actix_web::cookie::time::Duration::seconds(-1)) // Negative duration makes it expire immediately
        .finish()
}
