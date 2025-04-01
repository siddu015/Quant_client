// Import handlers from modules
mod welcome;
mod auth;
mod user;
mod email;
mod admin;

// Export handlers from modules
pub use welcome::welcome;
pub use auth::{auth_google, auth_google_callback, logout};
pub use user::get_user_info;
pub use email::{send_email, get_emails, get_email, refresh_emails};
pub use admin::list_users;
