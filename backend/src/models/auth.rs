use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct AuthQuery {
    pub code: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct GoogleUserInfo {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    #[serde(skip_serializing)]
    pub refresh_token: Option<String>,
}
