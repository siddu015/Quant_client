use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct AuthQuery {
    pub code: String,
}

#[derive(Deserialize, Serialize)]
pub struct GoogleUserInfo {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
}
