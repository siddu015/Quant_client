use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::error::Error;
use log::info;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KeyPair {
    pub public_key: String,
    pub secret_key: String,
}

/// Store a user's key pair in the database
pub async fn store_keypair(pool: &PgPool, email: &str, keypair: &KeyPair) -> Result<(), Box<dyn Error>> {
    sqlx::query!(
        r#"
        INSERT INTO user_keys (email, public_key, private_key, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (email) 
        DO UPDATE SET public_key = $2, private_key = $3, updated_at = NOW()
        "#,
        email,
        keypair.public_key,
        keypair.secret_key
    )
    .execute(pool)
    .await?;
    
    info!("Stored key pair for user: {}", email);
    Ok(())
}

/// Retrieve a user's key pair from the database
pub async fn get_keypair(pool: &PgPool, email: &str) -> Result<Option<KeyPair>, Box<dyn Error>> {
    let record = sqlx::query!(
        r#"
        SELECT public_key, private_key FROM user_keys
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(record.map(|r| KeyPair {
        public_key: r.public_key,
        secret_key: r.private_key,
    }))
}

/// Retrieve a user's public key from the database
pub async fn get_public_key(pool: &PgPool, email: &str) -> Result<Option<String>, Box<dyn Error>> {
    let record = sqlx::query!(
        r#"
        SELECT public_key FROM user_keys
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(record.map(|r| r.public_key))
} 