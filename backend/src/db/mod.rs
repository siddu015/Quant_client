// Import all database-related modules
mod users;
mod email;
mod init;
mod labels;
mod migrations;

// Export functions from modules
pub use users::store_user;
pub use users::get_user_by_session;
pub use users::list_users;

pub use email::store_email;
pub use email::get_email;

pub use labels::store_label;
pub use labels::get_labels_for_user;

pub use init::init;

pub use migrations::migrate_profile_pictures;
