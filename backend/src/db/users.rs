use sqlx::{PgPool, Row};

// Store or update user in database
pub async fn store_user(
    pool: &PgPool,
    email: &str,
    name: &Option<String>,
    picture: &Option<String>,
    session_token: &str,
    refresh_token: &Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO users (email, name, picture, session_token, refresh_token)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET name = $2, picture = $3, session_token = $4, 
            refresh_token = CASE WHEN $5 IS NOT NULL THEN $5 ELSE users.refresh_token END,
            updated_at = NOW()
        "#
    )
    .bind(email)
    .bind(name)
    .bind(picture)
    .bind(session_token)
    .bind(refresh_token)
    .execute(pool)
    .await?;
    
    Ok(())
}

// Get user by session token
pub async fn get_user_by_session(
    pool: &PgPool,
    session_token: &str,
) -> Result<Option<(String, Option<String>, Option<String>, Option<String>)>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT email, name, picture, refresh_token FROM users
        WHERE session_token = $1
        "#
    )
    .bind(session_token)
    .fetch_optional(pool)
    .await?;
    
    Ok(row.map(|r| (
        r.get("email"),
        r.get("name"),
        r.get("picture"),
        r.get("refresh_token"),
    )))
}

// Get user refresh token by email
pub async fn get_user_refresh_token(
    pool: &PgPool,
    email: &str,
) -> Result<Option<String>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT refresh_token FROM users
        WHERE email = $1
        "#
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;
    
    Ok(row.and_then(|r| r.get("refresh_token")))
}

// List all users (for debugging)
pub async fn list_users(pool: &PgPool) -> Result<Vec<(String, Option<String>)>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT email, name FROM users
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(rows.into_iter().map(|r| (
        r.get("email"),
        r.get("name"),
    )).collect())
}
