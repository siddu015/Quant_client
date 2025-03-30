use sqlx::{PgPool, Row, types::time};
use crate::models::Email;

// Create the emails table if it doesn't exist
pub async fn init_email_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS emails (
            id SERIAL PRIMARY KEY,
            sender_id TEXT NOT NULL,
            sender_email TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at TIMESTAMPTZ,
            status TEXT NOT NULL DEFAULT 'sent'
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
) -> Result<i32, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO emails (sender_id, sender_email, recipient_email, subject, body)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#
    )
    .bind(sender_id)
    .bind(sender_email)
    .bind(recipient_email)
    .bind(subject)
    .bind(body)
    .fetch_one(pool)
    .await?;
    
    Ok(row.get("id"))
}

// Helper function to format timestamp as ISO string
fn format_timestamp(timestamp: Option<time::OffsetDateTime>) -> Option<String> {
    timestamp.map(|ts| ts.to_string())
}

// Get emails sent by a specific user
pub async fn get_sent_emails(
    pool: &PgPool,
    sender_email: &str,
) -> Result<Vec<Email>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, sender_id, sender_email, recipient_email, subject, body, sent_at, read_at, status
        FROM emails
        WHERE sender_email = $1
        ORDER BY sent_at DESC
        "#
    )
    .bind(sender_email)
    .fetch_all(pool)
    .await?;
    
    let emails = rows.into_iter().map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        
        Email {
            id: Some(row.get("id")),
            sender_id: row.get("sender_id"),
            sender_email: row.get("sender_email"),
            recipient_email: row.get("recipient_email"),
            subject: row.get("subject"),
            body: row.get("body"),
            sent_at: format_timestamp(sent_at),
            read_at: format_timestamp(read_at),
            status: row.get("status"),
        }
    }).collect();
    
    Ok(emails)
}

// Get emails received by a specific user
pub async fn get_received_emails(
    pool: &PgPool,
    recipient_email: &str,
) -> Result<Vec<Email>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, sender_id, sender_email, recipient_email, subject, body, sent_at, read_at, status
        FROM emails
        WHERE recipient_email = $1
        ORDER BY sent_at DESC
        "#
    )
    .bind(recipient_email)
    .fetch_all(pool)
    .await?;
    
    let emails = rows.into_iter().map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        
        Email {
            id: Some(row.get("id")),
            sender_id: row.get("sender_id"),
            sender_email: row.get("sender_email"),
            recipient_email: row.get("recipient_email"),
            subject: row.get("subject"),
            body: row.get("body"),
            sent_at: format_timestamp(sent_at),
            read_at: format_timestamp(read_at),
            status: row.get("status"),
        }
    }).collect();
    
    Ok(emails)
}

// Get a specific email by ID
pub async fn get_email_by_id(
    pool: &PgPool,
    email_id: i32,
) -> Result<Option<Email>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT id, sender_id, sender_email, recipient_email, subject, body, sent_at, read_at, status
        FROM emails
        WHERE id = $1
        "#
    )
    .bind(email_id)
    .fetch_optional(pool)
    .await?;
    
    let email = row.map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        
        Email {
            id: Some(row.get("id")),
            sender_id: row.get("sender_id"),
            sender_email: row.get("sender_email"),
            recipient_email: row.get("recipient_email"),
            subject: row.get("subject"),
            body: row.get("body"),
            sent_at: format_timestamp(sent_at),
            read_at: format_timestamp(read_at),
            status: row.get("status"),
        }
    });
    
    Ok(email)
}

// Mark an email as read
pub async fn mark_email_as_read(
    pool: &PgPool,
    email_id: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE emails
        SET read_at = NOW()
        WHERE id = $1 AND read_at IS NULL
        "#
    )
    .bind(email_id)
    .execute(pool)
    .await?;
    
    Ok(())
}
