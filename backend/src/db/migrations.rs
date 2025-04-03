use sqlx::PgPool;
use log::info;

/// Migrates existing user profile picture URLs to ensure they use HTTPS and have proper size
pub async fn migrate_profile_pictures(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("Running migration: Update profile picture URLs");
    
    // Update HTTP URLs to HTTPS
    let http_updated = sqlx::query(
        r#"
        UPDATE users
        SET picture = REPLACE(picture, 'http://', 'https://')
        WHERE picture LIKE 'http://%'
        "#
    )
    .execute(pool)
    .await?;
    
    info!("Updated {} profile picture URLs from HTTP to HTTPS", http_updated.rows_affected());
    
    // Update small size images to larger ones
    let size_updated = sqlx::query(
        r#"
        UPDATE users
        SET picture = REPLACE(picture, '=s96-c', '=s256-c')
        WHERE picture LIKE '%=s96-c%'
        "#
    )
    .execute(pool)
    .await?;
    
    info!("Updated {} profile picture URLs with larger size", size_updated.rows_affected());
    
    Ok(())
} 