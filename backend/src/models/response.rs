use serde::Serialize;

#[derive(Serialize)]
pub struct UserResponse {
    pub authenticated: bool,
    pub email: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub message: Option<String>,
}
