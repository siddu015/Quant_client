use sqlx::{PgPool, Row, types::time};
use crate::models::{Email, EmailFilter, SortField, SortOrder};
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
            gmail_id TEXT,
            is_encrypted BOOLEAN DEFAULT FALSE,
            raw_encrypted_content TEXT
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
    is_encrypted: bool,
    raw_encrypted_content: Option<&str>,
) -> Result<String, sqlx::Error> {
    // Generate a new UUID
    let email_uuid = Uuid::new_v4();
    let email_id = email_uuid.to_string();
    
    let query = match raw_encrypted_content {
        Some(content) => {
            sqlx::query(
                r#"
                INSERT INTO emails (id, sender_id, sender_email, recipient_email, subject, body, is_encrypted, raw_encrypted_content)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#
            )
            .bind(email_uuid)
            .bind(sender_id)
            .bind(sender_email)
            .bind(recipient_email)
            .bind(subject)
            .bind(body)
            .bind(is_encrypted)
            .bind(content)
        },
        None => {
            sqlx::query(
                r#"
                INSERT INTO emails (id, sender_id, sender_email, recipient_email, subject, body, is_encrypted)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#
            )
            .bind(email_uuid)
            .bind(sender_id)
            .bind(sender_email)
            .bind(recipient_email)
            .bind(subject)
            .bind(body)
            .bind(is_encrypted)
        }
    };
    
    query.execute(pool).await?;
    
    Ok(email_id)
}

// Helper function to format timestamp as ISO string
fn format_timestamp(timestamp: Option<time::OffsetDateTime>) -> Option<String> {
    timestamp.map(|ts| ts.to_string())
}

// Get emails for a user with filtering and sorting options
pub async fn get_emails_for_user(
    pool: &PgPool,
    email: &str,
    is_sender: bool,
    filter: Option<&EmailFilter>,
) -> Result<Vec<Email>, sqlx::Error> {
    // Base query for either sent or received emails
    let mut query_string = String::from(
        if is_sender {
            r#"
            SELECT e.id::text, e.sender_id, e.sender_email, e.sender_name, 
                   e.recipient_email, e.subject, e.body, e.sent_at, e.read_at, e.gmail_id,
                   ARRAY_AGG(el.label_id) FILTER (WHERE el.label_id IS NOT NULL) AS label_ids
            FROM emails e
            LEFT JOIN email_labels el ON e.id = el.email_id
            WHERE e.sender_email = $1
            "#
        } else {
            r#"
            SELECT e.id::text, e.sender_id, e.sender_email, e.sender_name, 
                   e.recipient_email, e.subject, e.body, e.sent_at, e.read_at, e.gmail_id,
                   ARRAY_AGG(el.label_id) FILTER (WHERE el.label_id IS NOT NULL) AS label_ids
            FROM emails e
            LEFT JOIN email_labels el ON e.id = el.email_id
            WHERE e.recipient_email = $1
            "#
        }
    );
    
    // Add filter conditions if provided
    let mut params = Vec::new();
    
    params.push(email.to_string());
    
    if let Some(filter) = filter {
        // Filter by label
        if let Some(label) = &filter.label {
            query_string.push_str(&format!(" AND e.id IN (SELECT email_id FROM email_labels WHERE label_id = ${}", params.len() + 1));
            params.push(label.to_string());
        }
        
        // Filter by read status
        if let Some(is_read) = filter.is_read {
            if is_read {
                query_string.push_str(" AND e.read_at IS NOT NULL");
            } else {
                query_string.push_str(" AND e.read_at IS NULL");
            }
        }
        
        // Filter by search term (subject, body, sender, recipient)
        if let Some(search) = &filter.search {
            let search_param = format!("%{}%", search);
            query_string.push_str(&format!(" AND (e.subject ILIKE ${} OR e.body ILIKE ${} OR e.sender_email ILIKE ${} OR e.recipient_email ILIKE ${})",
                params.len() + 1, params.len() + 1, params.len() + 1, params.len() + 1));
            params.push(search_param);
        }
        
        // Filter by sender
        if let Some(sender) = &filter.sender {
            query_string.push_str(&format!(" AND e.sender_email ILIKE ${}", params.len() + 1));
            params.push(format!("%{}%", sender));
        }
        
        // Filter by recipient
        if let Some(recipient) = &filter.recipient {
            query_string.push_str(&format!(" AND e.recipient_email ILIKE ${}", params.len() + 1));
            params.push(format!("%{}%", recipient));
        }
    }
    
    // Group by to handle the array_agg
    query_string.push_str(" GROUP BY e.id");
    
    // Add sorting
    if let Some(filter) = filter {
        let sort_field = filter.sort_by.as_ref().unwrap_or(&SortField::Date);
        let sort_order = filter.sort_order.as_ref().unwrap_or(&SortOrder::Desc);
        
        let order_direction = match sort_order {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        };
        
        match sort_field {
            SortField::Date => query_string.push_str(&format!(" ORDER BY e.sent_at {}", order_direction)),
            SortField::Sender => query_string.push_str(&format!(" ORDER BY e.sender_email {}", order_direction)),
            SortField::Subject => query_string.push_str(&format!(" ORDER BY e.subject {}", order_direction)),
        }
    } else {
        // Default sort
        query_string.push_str(" ORDER BY e.sent_at DESC");
    }
    
    // Add limit and offset
    if let Some(filter) = filter {
        if let Some(limit) = filter.limit {
            query_string.push_str(&format!(" LIMIT {}", limit));
        }
        
        if let Some(offset) = filter.offset {
            query_string.push_str(&format!(" OFFSET {}", offset));
        }
    }
    
    // Build the query
    let mut query = sqlx::query(&query_string);
    
    // Bind parameters
    for param in params {
        query = query.bind(param);
    }
    
    // Execute the query
    let rows = query.fetch_all(pool).await?;
    
    // Convert rows to emails
    let emails = rows.into_iter().map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        let label_ids: Option<Vec<String>> = row.try_get("label_ids").ok();
        
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
            label_ids,
            is_encrypted: row.try_get("is_encrypted").unwrap_or(false),
            raw_encrypted_content: row.try_get("raw_encrypted_content").ok(),
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
        SELECT e.id, e.sender_id, e.sender_email, e.sender_name, e.recipient_email, 
               e.subject, e.body, e.sent_at, e.read_at, e.gmail_id,
               ARRAY_AGG(el.label_id) FILTER (WHERE el.label_id IS NOT NULL) AS label_ids
        FROM emails e
        LEFT JOIN email_labels el ON e.id = el.email_id
        WHERE e.id = $1
        GROUP BY e.id
        "#
    )
    .bind(uuid)
    .fetch_optional(pool)
    .await?;
    
    let email = row.map(|row| {
        let sent_at: Option<time::OffsetDateTime> = row.get("sent_at");
        let read_at: Option<time::OffsetDateTime> = row.get("read_at");
        let label_ids: Option<Vec<String>> = row.try_get("label_ids").ok();
        
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
            label_ids,
            is_encrypted: row.try_get("is_encrypted").unwrap_or(false),
            raw_encrypted_content: row.try_get("raw_encrypted_content").ok(),
        }
    });
    
    Ok(email)
}

// Store label IDs for an email
pub async fn add_labels_to_email(
    pool: &PgPool,
    email_id: &str,
    label_ids: &[String],
) -> Result<(), sqlx::Error> {
    // Parse the string ID into a UUID
    let uuid = match Uuid::parse_str(email_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            // If it's not a valid UUID, return an error
            return Err(sqlx::Error::RowNotFound);
        }
    };
    
    // Add each label ID to the email_labels table
    for label_id in label_ids {
        sqlx::query(
            r#"
            INSERT INTO email_labels (email_id, label_id)
            VALUES ($1, $2)
            ON CONFLICT (email_id, label_id) DO NOTHING
            "#
        )
        .bind(uuid)
        .bind(label_id)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}

// Remove a label from an email
pub async fn remove_label_from_email(
    pool: &PgPool,
    email_id: &str,
    label_id: &str,
) -> Result<(), sqlx::Error> {
    // Parse the string ID into a UUID
    let uuid = match Uuid::parse_str(email_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            // If it's not a valid UUID, return an error
            return Err(sqlx::Error::RowNotFound);
        }
    };
    
    sqlx::query(
        r#"
        DELETE FROM email_labels
        WHERE email_id = $1 AND label_id = $2
        "#
    )
    .bind(uuid)
    .bind(label_id)
    .execute(pool)
    .await?;
    
    Ok(())
}
