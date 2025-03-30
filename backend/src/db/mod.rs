// Import and re-export components
mod init;
mod users;
mod email;

// Re-export public items
pub use init::init;
pub use users::*;
pub use email::{
    store_email, 
    get_sent_emails, 
    get_received_emails, 
    get_email_by_id, 
    mark_email_as_read
};
