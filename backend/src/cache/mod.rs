use redis::{Client, AsyncCommands, RedisError};
use std::env;
use std::sync::Arc;
use std::time::Duration;
use crate::models::{Email, GmailLabel};
use crate::gmail::GmailMessageId;
use log::{debug, error, info};

// Constants for cache TTL
const EMAIL_CACHE_TTL: usize = 3600; // 1 hour
const MESSAGE_LIST_CACHE_TTL: usize = 1800; // 30 minutes
const LABEL_CACHE_TTL: usize = 7200; // 2 hours
const RETRY_DELAY: Duration = Duration::from_secs(1);
const MAX_RETRIES: u32 = 3;

pub struct RedisCache {
    client: Client,
}

impl RedisCache {
    pub fn new() -> Result<Self, RedisError> {
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        info!("Initializing Redis cache at {}", redis_url);
        let client = Client::open(redis_url)?;
        Ok(Self { client })
    }
    
    // Connect to Redis with retries
    async fn get_connection_with_retry(&self) -> Result<redis::aio::Connection, RedisError> {
        let mut retries = 0;
        loop {
            match self.client.get_async_connection().await {
                Ok(conn) => {
                    info!("Connected to Redis");
                    return Ok(conn);
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        error!("Redis connection failed after {} retries", MAX_RETRIES);
                        return Err(e);
                    }
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Cache a list of message IDs for a user and query
    pub async fn cache_message_ids(&self, user_id: &str, query: &str, messages: &[GmailMessageId]) -> Result<(), RedisError> {
        println!("Attempting to cache {} message IDs for user {} with query {}", messages.len(), user_id, query);
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("messages:{}:{}", user_id, query);
        println!("Using cache key: {}", cache_key);
        
        // Serialize the messages to JSON
        let json = serde_json::to_string(messages).map_err(|e| {
            println!("Failed to serialize messages: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let mut retries = 0;
        loop {
            match conn.set_ex::<_, _, ()>(&cache_key, &json, MESSAGE_LIST_CACHE_TTL).await {
                Ok(_) => {
                    println!("Successfully cached message IDs with TTL {}", MESSAGE_LIST_CACHE_TTL);
                    return Ok(());
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        println!("Failed to cache message IDs after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    println!("Failed to cache message IDs (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Get cached message IDs for a user and query
    pub async fn get_cached_message_ids(&self, user_id: &str, query: &str) -> Result<Option<Vec<GmailMessageId>>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("messages:{}:{}", user_id, query);
        
        let mut retries = 0;
        loop {
            match conn.get::<_, Option<String>>(&cache_key).await {
                Ok(Some(json)) => {
                    match serde_json::from_str::<Vec<GmailMessageId>>(&json) {
                        Ok(messages) => {
                            println!("Retrieved {} cached message IDs for user {} with query {}", messages.len(), user_id, query);
                            return Ok(Some(messages));
                        },
                        Err(e) => {
                            println!("Error deserializing cached message IDs: {}", e);
                            // Invalid data in cache, remove it
                            let _: () = conn.del(&cache_key).await?;
                            return Ok(None);
                        }
                    }
                },
                Ok(None) => {
                    println!("No cached message IDs found for user {} with query {}", user_id, query);
                    return Ok(None);
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        println!("Failed to get cached message IDs after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    println!("Failed to get cached message IDs (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Cache emails for a user
    pub async fn cache_emails(&self, user_id: &str, category: &str, emails: &[Email]) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("emails:{}:{}", user_id, category);
        
        let json = serde_json::to_string(emails).map_err(|e| {
            error!("Failed to serialize emails: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;

        match conn.set_ex::<_, _, ()>(&cache_key, &json, EMAIL_CACHE_TTL).await {
            Ok(_) => {
                info!("Cached {} emails for {}", emails.len(), category);
                Ok(())
            },
            Err(e) => {
                error!("Failed to cache emails: {}", e);
                Err(e)
            }
        }
    }
    
    // Cache a single email
    pub async fn cache_email(&self, user_id: &str, email_id: &str, email: &Email) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("email:{}:{}", user_id, email_id);
        
        let json = serde_json::to_string(email).map_err(|e| {
            error!("Failed to serialize email: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;

        match conn.set_ex::<_, _, ()>(&cache_key, &json, EMAIL_CACHE_TTL).await {
            Ok(_) => {
                info!("Cached email {}", email_id);
                Ok(())
            },
            Err(e) => {
                error!("Failed to cache email: {}", e);
                Err(e)
            }
        }
    }
    
    // Get a cached email
    pub async fn get_cached_email(&self, user_id: &str, email_id: &str) -> Result<Option<Email>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("email:{}:{}", user_id, email_id);

        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(json)) => match serde_json::from_str(&json) {
                Ok(email) => {
                    info!("Retrieved email {} from cache", email_id);
                    Ok(Some(email))
                },
                Err(e) => {
                    error!("Failed to deserialize email: {}", e);
                    let _: () = conn.del(&cache_key).await?;
                    Ok(None)
                }
            },
            Ok(None) => {
                info!("No cached email found for {}", email_id);
                Ok(None)
            },
            Err(e) => {
                error!("Failed to get cached email: {}", e);
                Err(e)
            }
        }
    }
    
    // Get cached emails for a user
    pub async fn get_cached_emails(&self, user_id: &str, category: &str) -> Result<Option<Vec<Email>>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("emails:{}:{}", user_id, category);

        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(json)) => match serde_json::from_str(&json) {
                Ok(emails) => {
                    info!("Retrieved {} emails from cache", category);
                    Ok(Some(emails))
                },
                Err(e) => {
                    error!("Failed to deserialize emails: {}", e);
                    let _: () = conn.del(&cache_key).await?;
                    Ok(None)
                }
            },
            Ok(None) => {
                info!("No cached emails found for {}", category);
                Ok(None)
            },
            Err(e) => {
                error!("Failed to get cached emails: {}", e);
                Err(e)
            }
        }
    }
    
    // Cache labels for a user
    pub async fn cache_labels(&self, user_id: &str, labels: &[GmailLabel]) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("labels:{}", user_id);
        
        let json = serde_json::to_string(labels).map_err(|e| {
            error!("Failed to serialize labels: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;

        match conn.set_ex::<_, _, ()>(&cache_key, &json, LABEL_CACHE_TTL).await {
            Ok(_) => {
                info!("Cached {} labels", labels.len());
                Ok(())
            },
            Err(e) => {
                error!("Failed to cache labels: {}", e);
                Err(e)
            }
        }
    }
    
    // Get cached labels for a user
    pub async fn get_cached_labels(&self, user_id: &str) -> Result<Option<Vec<GmailLabel>>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let cache_key = format!("labels:{}", user_id);

        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(json)) => match serde_json::from_str::<Vec<GmailLabel>>(&json) {
                Ok(labels) => {
                    info!("Retrieved {} labels from cache", labels.len());
                    Ok(Some(labels))
                },
                Err(e) => {
                    error!("Failed to deserialize labels: {}", e);
                    let _: () = conn.del(&cache_key).await?;
                    Ok(None)
                }
            },
            Ok(None) => {
                info!("No cached labels found");
                Ok(None)
            },
            Err(e) => {
                error!("Failed to get cached labels: {}", e);
                Err(e)
            }
        }
    }
    
    // Invalidate all cached data for a user
    pub async fn invalidate_user_cache(&self, user_id: &str) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let pattern = format!("*:{}:*", user_id);

        match conn.keys::<_, Vec<String>>(&pattern).await {
            Ok(keys) => {
                for key in keys {
                    let _: Result<(), RedisError> = conn.del(&key).await;
                }
                info!("Invalidated all cache for user {}", user_id);
                Ok(())
            },
            Err(e) => {
                error!("Failed to invalidate cache: {}", e);
                Err(e)
            }
        }
    }

    pub async fn update_email_lists(&self, user_id: &str, email: &Email, is_sent: bool) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let category = if is_sent { "sent" } else { "received" };
        
        // Get existing list
        match self.get_cached_emails(user_id, category).await? {
            Some(mut emails) => {
                // Add new email at the beginning (most recent)
                emails.insert(0, email.clone());
                // Cache updated list
                self.cache_emails(user_id, category, &emails).await?;
                info!("Updated {} email list cache for {}", category, user_id);
            }
            None => {
                // Create new list with just this email
                self.cache_emails(user_id, category, &vec![email.clone()]).await?;
                info!("Created new {} email list cache for {}", category, user_id);
            }
        }
        
        // Invalidate any filtered caches
        let pattern = format!("emails:{}:*", user_id);
        let keys: Vec<String> = conn.keys(&pattern).await?;
        for key in keys {
            if !key.ends_with(":sent") && !key.ends_with(":received") {
                let _: () = conn.del(&key).await?;
            }
        }
        
        Ok(())
    }

    pub async fn partial_invalidate(&self, user_id: &str) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let pattern = format!("emails:{}:*", user_id);
        
        // Keep base sent/received lists but invalidate filtered results
        let keys: Vec<String> = conn.keys(&pattern).await?;
        for key in keys {
            if !key.ends_with(":sent") && !key.ends_with(":received") {
                let _: () = conn.del(&key).await?;
            }
        }
        
        info!("Partially invalidated cache for user {}", user_id);
        Ok(())
    }
}

// Create a shared Redis cache
pub fn create_redis_cache() -> Arc<RedisCache> {
    match RedisCache::new() {
        Ok(cache) => Arc::new(cache),
        Err(e) => {
            error!("Failed to create Redis cache: {}", e);
            Arc::new(RedisCache { 
                client: Client::open("redis://127.0.0.1:6379").expect("Failed to create Redis client")
            })
        }
    }
} 