// Import and re-export components
mod auth;
mod response;
mod email;
mod label;

// Re-export public items
pub use auth::{AuthQuery, GoogleUserInfo};
pub use response::UserResponse;
pub use email::{Email, SendEmailRequest, EmailFilter, SortField, SortOrder};
pub use label::{GmailLabel, LabelColor};
