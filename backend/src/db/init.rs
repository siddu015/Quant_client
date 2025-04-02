use sqlx::PgPool;
use crate::db::email::init_email_table;
use crate::db::labels::init_labels_table;

pub async fn init(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Create the users table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            picture TEXT,
            session_token TEXT,
            refresh_token TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;
    
    // Initialize email table
    init_email_table(pool).await?;
    
    // Initialize labels table
    init_labels_table(pool).await?;
    
    println!("Database initialized successfully");
    Ok(())
}
