use std::env;
use oauth2::{
    AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl, 
    basic::BasicClient
};

// Create OAuth client
pub fn create_oauth_client() -> BasicClient {
    let google_client_id = env::var("GOOGLE_CLIENT_ID")
        .expect("GOOGLE_CLIENT_ID must be set");
    let google_client_secret = env::var("GOOGLE_CLIENT_SECRET")
        .expect("GOOGLE_CLIENT_SECRET must be set");
    let redirect_uri = env::var("GOOGLE_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:8080/auth/google/callback".to_string());
        
    BasicClient::new(
        ClientId::new(google_client_id),
        Some(ClientSecret::new(google_client_secret)),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string()).unwrap(),
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string()).unwrap()),
    )
        .set_redirect_uri(RedirectUrl::new(redirect_uri).unwrap())
}
