// Import all database-related modules
mod users;
mod email;
mod init;

// Export functions from modules
pub use users::store_user;
pub use users::get_user_by_session;
pub use users::list_users;

pub use email::store_email;
pub use email::get_email;
pub use email::get_emails_for_user;

pub use init::init;
