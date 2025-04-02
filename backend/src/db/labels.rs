use sqlx::PgPool;
use sqlx::Row;
use crate::models::GmailLabel;

pub async fn store_label(
    pool: &PgPool,
    user_id: &str,
    label: &GmailLabel,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO labels (
            id, user_id, name, type, message_list_visibility, 
            label_list_visibility, text_color, background_color
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            message_list_visibility = EXCLUDED.message_list_visibility,
            label_list_visibility = EXCLUDED.label_list_visibility,
            text_color = EXCLUDED.text_color,
            background_color = EXCLUDED.background_color
        "#
    )
    .bind(&label.id)
    .bind(user_id)
    .bind(&label.name)
    .bind(&label.type_)
    .bind(label.message_list_visibility.as_deref())
    .bind(label.label_list_visibility.as_deref())
    .bind(label.color.as_ref().map(|c| &c.text_color))
    .bind(label.color.as_ref().map(|c| &c.background_color))
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_labels_for_user(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<GmailLabel>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT 
            id, name, type, message_list_visibility, 
            label_list_visibility, text_color, background_color,
            total_messages, unread_messages
        FROM labels
        WHERE user_id = $1
        ORDER BY name
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut labels = Vec::new();
    for row in rows {
        let text_color_result = row.try_get::<Option<String>, _>("text_color");
        let bg_color_result = row.try_get::<Option<String>, _>("background_color");
        
        let color = match (text_color_result, bg_color_result) {
            (Ok(Some(text)), Ok(Some(bg))) => {
                Some(crate::models::LabelColor {
                    text_color: text,
                    background_color: bg,
                })
            },
            _ => None
        };

        labels.push(GmailLabel {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            type_: row.try_get("type").unwrap_or_default(),
            message_list_visibility: row.try_get("message_list_visibility").unwrap_or(None),
            label_list_visibility: row.try_get("label_list_visibility").unwrap_or(None),
            color,
            total_messages: row.try_get("total_messages").unwrap_or(None),
            unread_messages: row.try_get("unread_messages").unwrap_or(None),
        });
    }

    Ok(labels)
}

// Create labels table during database initialization
pub async fn init_labels_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Create the labels table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS labels (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            message_list_visibility TEXT,
            label_list_visibility TEXT,
            text_color TEXT,
            background_color TEXT,
            total_messages INTEGER,
            unread_messages INTEGER
        )
        "#
    )
    .execute(pool)
    .await?;
    
    // Create the email_labels join table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS email_labels (
            email_id UUID REFERENCES emails(id),
            label_id TEXT REFERENCES labels(id),
            PRIMARY KEY (email_id, label_id)
        )
        "#
    )
    .execute(pool)
    .await?;
    
    println!("Labels tables initialized successfully");
    Ok(())
} 