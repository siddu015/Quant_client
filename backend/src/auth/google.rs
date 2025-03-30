use crate::models::GoogleUserInfo;

// Constants
pub const FRONTEND_URL: &str = "http://localhost:3000";

// Get user info from Google
pub async fn get_google_user_info(access_token: &str) -> Result<GoogleUserInfo, reqwest::Error> {
    let client = reqwest::Client::new();
    let user_info = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?
        .json::<GoogleUserInfo>()
        .await?;
    
    Ok(user_info)
}
