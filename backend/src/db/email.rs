use sqlx::{PgPool, Row, types::time};
use crate::models::Email;
use uuid::Uuid;

// Create the emails table if it doesn't exist
pub async fn init_email_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS emails (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id TEXT NOT NULL,
            sender_email TEXT NOT NULL,
            sender_name TEXT,
            recipient_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at TIMESTAMPTZ,
            gmail_id TEXT
        )
        "#
    )
    .execute(pool)
    .await?;
    
    println!("Emails table initialized successfully");
    Ok(())
}

// Store a new email in the database
pub async fn store_email(
    pool: &PgPool,
    sender_id: &str,
    sender_email: &str,
    recipient_email: &str,
    subject: &str,
    body: &str,
) -> Result<String, sqlx::Error> {
    // Generate a new UUID
    let email_uuid = Uuid::new_v4();
    let email_id = email_uuid.to_string();
    
    sqlx::query(
        r#"
        INSERT INTO emails (id, sender_id, sender_email, recipient_email, subject, body)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#
    )
    .bind(email_uuid) // Bind the UUID directly, not the string
    .bind(sender_id)
    .bind(sender_email)
    .bind(recipient_email)
    .bind(subject)
    .bind(body)
    .execute(pool)
    .await?;
    
    Ok(email_id)
}

// Helper function to format timestamp as ISO string
fn format_timestamp(timestamp: Option<time::OffsetDateTime>) -> Option<String> {
    timestamp.map(|ts| ts.to_string())
}

// Get emails for a user (either sent or received)
pub async fn get_emails_for_user(
    pool: &PgPool,
    email: &str,
    is_sender: bool,
) -> Result<Vec<Email>, sqlx::Error> {
    let query = if is_sender {
        r#"
        SELECT id, sender_id, sender_email, sender_name, recipient_email, subject, body, sent_at, read_at, gmail_id
        FROM emails
        WHERE sender_email = $1
        ORDER BY sent_at DESC
        "#
    } else {
        r#"
        SELECT id, sender_id, sender_email, sender_name, recipient_email, subject, body, sent_at, read_at, gmail_id
        FROM emails
        WHERE recipient_email = $1
        ORDER BY sent_at DESC
        "#
    };
    
    let rows = sqlx::query(query)
        .bind(email)
        .fetch_all(pool)
        .await?;
    
    let emails = rows.into_iter().map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        
        Email {
            id: row.get("id"),
            sender_id: row.get("sender_id"),
            sender_email: row.get("sender_email"),
            sender_name: row.get("sender_name"),
            recipient_email: row.get("recipient_email"),
            subject: row.get("subject"),
            body: row.get("body"),
            sent_at: format_timestamp(sent_at).unwrap_or_else(|| "".to_string()),
            read_at: format_timestamp(read_at),
            gmail_id: row.get("gmail_id"),
        }
    }).collect();
    
    Ok(emails)
}

// Get a specific email by ID (UUID string)
pub async fn get_email(
    pool: &PgPool,
    email_id: &str,
) -> Result<Option<Email>, sqlx::Error> {
    // Parse the string ID into a UUID
    let uuid = match Uuid::parse_str(email_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            // If it's not a valid UUID, return None
            return Ok(None);
        }
    };

    let row = sqlx::query(
        r#"
        SELECT id, sender_id, sender_email, sender_name, recipient_email, subject, body, sent_at, read_at, gmail_id
        FROM emails
        WHERE id = $1
        "#
    )
    .bind(uuid)
    .fetch_optional(pool)
    .await?;
    
    let email = row.map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        
        Email {
            id: row.get("id"),
            sender_id: row.get("sender_id"),
            sender_email: row.get("sender_email"),
            sender_name: row.get("sender_name"),
            recipient_email: row.get("recipient_email"),
            subject: row.get("subject"),
            body: row.get("body"),
            sent_at: format_timestamp(sent_at).unwrap_or_else(|| "".to_string()),
            read_at: format_timestamp(read_at),
            gmail_id: row.get("gmail_id"),
        }
    });
    
    Ok(email)
}
