use redis::{Client, AsyncCommands, RedisError};
use std::env;
use std::sync::Arc;
use std::time::Duration;
use crate::models::{Email, GmailLabel};
use crate::gmail::GmailMessageId;
use log::{debug, error, info, warn};

// Constants for cache TTL
const EMAIL_CACHE_TTL: usize = 900; // 15 minutes
const MESSAGE_LIST_CACHE_TTL: usize = 300; // 5 minutes
const LABEL_CACHE_TTL: usize = 3600; // 1 hour
const RETRY_DELAY: Duration = Duration::from_secs(1);
const MAX_RETRIES: u32 = 3;

pub struct RedisCache {
    client: Client,
}

impl RedisCache {
    pub fn new() -> Result<Self, RedisError> {
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        info!("Initializing Redis cache with URL: {}", redis_url);
        let client = Client::open(redis_url)?;
        
        Ok(Self {
            client,
        })
    }
    
    // Connect to Redis with retries
    async fn get_connection_with_retry(&self) -> Result<redis::aio::Connection, RedisError> {
        let mut retries = 0;
        loop {
            match self.client.get_async_connection().await {
                Ok(conn) => {
                    info!("Successfully connected to Redis");
                    return Ok(conn);
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        error!("Failed to connect to Redis after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    warn!("Failed to connect to Redis (attempt {}/{}): {}", retries, MAX_RETRIES, e);
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
        info!("Attempting to cache {} {} emails for user {}", emails.len(), category, user_id);
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("emails:{}:{}", user_id, category);
        info!("Using cache key: {}", cache_key);
        
        // Serialize the emails to JSON
        let json = serde_json::to_string(emails).map_err(|e| {
            error!("Failed to serialize emails: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let mut retries = 0;
        loop {
            match conn.set_ex::<_, _, ()>(&cache_key, &json, EMAIL_CACHE_TTL).await {
                Ok(_) => {
                    info!("Successfully cached {} {} emails for user {}", emails.len(), category, user_id);
                    // Verify the cache was set
                    match conn.get::<_, Option<String>>(&cache_key).await {
                        Ok(Some(_)) => {
                            info!("Verified cache was set for key: {}", cache_key);
                            return Ok(());
                        },
                        Ok(None) => {
                            error!("Cache verification failed - key not found: {}", cache_key);
                            return Err(RedisError::from((redis::ErrorKind::IoError, "Cache verification failed - key not found")));
                        },
                        Err(e) => {
                            error!("Cache verification failed - error: {}", e);
                            return Err(e);
                        }
                    }
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        error!("Failed to cache emails after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    warn!("Failed to cache emails (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Cache a single email
    pub async fn cache_email(&self, user_id: &str, email_id: &str, email: &Email) -> Result<(), RedisError> {
        info!("Attempting to cache email {} for user {}", email_id, user_id);
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("email:{}:{}", user_id, email_id);
        info!("Using cache key: {}", cache_key);
        
        // Serialize the email to JSON
        let json = serde_json::to_string(email).map_err(|e| {
            error!("Failed to serialize email: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let mut retries = 0;
        loop {
            match conn.set_ex::<_, _, ()>(&cache_key, &json, EMAIL_CACHE_TTL).await {
                Ok(_) => {
                    info!("Successfully cached email {} for user {}", email_id, user_id);
                    return Ok(());
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        error!("Failed to cache email after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    warn!("Failed to cache email (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Get a cached email
    pub async fn get_cached_email(&self, user_id: &str, email_id: &str) -> Result<Option<Email>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("email:{}:{}", user_id, email_id);
        debug!("Attempting to get cached email with key: {}", cache_key);
        
        // Get from Redis
        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(json)) => {
                // Deserialize the JSON
                match serde_json::from_str(&json) {
                    Ok(email) => {
                        info!("Successfully retrieved cached email for key: {}", cache_key);
                        Ok(Some(email))
                    },
                    Err(e) => {
                        error!("Failed to deserialize cached email: {}", e);
                        Ok(None)
                    }
                }
            },
            Ok(None) => {
                debug!("No cached email found for key: {}", cache_key);
                Ok(None)
            },
            Err(e) => {
                error!("Error getting cached email: {}", e);
                Err(e)
            }
        }
    }
    
    // Get cached emails for a user
    pub async fn get_cached_emails(&self, user_id: &str, category: &str) -> Result<Option<Vec<Email>>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("emails:{}:{}", user_id, category);
        debug!("Attempting to get cached emails with key: {}", cache_key);
        
        // Get from Redis
        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(json)) => {
                // Deserialize the JSON
                match serde_json::from_str(&json) {
                    Ok(emails) => {
                        info!("Successfully retrieved cached emails for key: {}", cache_key);
                        Ok(Some(emails))
                    },
                    Err(e) => {
                        error!("Failed to deserialize cached emails: {}", e);
                        Ok(None)
                    }
                }
            },
            Ok(None) => {
                debug!("No cached emails found for key: {}", cache_key);
                Ok(None)
            },
            Err(e) => {
                error!("Error getting cached emails: {}", e);
                Err(e)
            }
        }
    }
    
    // Cache labels for a user
    pub async fn cache_labels(&self, user_id: &str, labels: &[GmailLabel]) -> Result<(), RedisError> {
        println!("Attempting to cache {} labels for user {}", labels.len(), user_id);
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("labels:{}", user_id);
        println!("Using cache key: {}", cache_key);
        
        // Serialize the labels to JSON
        let json = serde_json::to_string(labels).map_err(|e| {
            println!("Failed to serialize labels: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let mut retries = 0;
        loop {
            match conn.set_ex::<_, _, ()>(&cache_key, &json, LABEL_CACHE_TTL).await {
                Ok(_) => {
                    println!("Cached {} labels for user {}", labels.len(), user_id);
                    return Ok(());
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        println!("Failed to cache labels after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    println!("Failed to cache labels (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Get cached labels for a user
    pub async fn get_cached_labels(&self, user_id: &str) -> Result<Option<Vec<GmailLabel>>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        
        // Create a cache key
        let cache_key = format!("labels:{}", user_id);
        
        let mut retries = 0;
        loop {
            match conn.get::<_, Option<String>>(&cache_key).await {
                Ok(Some(json)) => {
                    match serde_json::from_str::<Vec<GmailLabel>>(&json) {
                        Ok(labels) => {
                            println!("Retrieved {} cached labels for user {}", labels.len(), user_id);
                            return Ok(Some(labels));
                        },
                        Err(e) => {
                            println!("Error deserializing cached labels: {}", e);
                            // Invalid data in cache, remove it
                            let _: () = conn.del(&cache_key).await?;
                            return Ok(None);
                        }
                    }
                },
                Ok(None) => {
                    println!("No cached labels found for user {}", user_id);
                    return Ok(None);
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        println!("Failed to get cached labels after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    println!("Failed to get cached labels (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
    
    // Invalidate all cached data for a user
    pub async fn invalidate_user_cache(&self, user_id: &str) -> Result<(), RedisError> {
        info!("Invalidating cache for user: {}", user_id);
        let mut conn = self.get_connection_with_retry().await?;
        
        // Get all keys for this user
        let pattern = format!("*:{}:*", user_id);
        let mut retries = 0;
        loop {
            match conn.keys::<_, Vec<String>>(&pattern).await {
                Ok(keys) => {
                    if !keys.is_empty() {
                        info!("Found {} keys to delete for user {}", keys.len(), user_id);
                        for key in keys {
                            match conn.del::<_, ()>(&key).await {
                                Ok(_) => debug!("Deleted key: {}", key),
                                Err(e) => error!("Failed to delete key {}: {}", key, e),
                            }
                        }
                    } else {
                        debug!("No keys found to invalidate for user {}", user_id);
                    }
                    return Ok(());
                },
                Err(e) => {
                    retries += 1;
                    if retries >= MAX_RETRIES {
                        error!("Failed to get keys after {} retries: {}", MAX_RETRIES, e);
                        return Err(e);
                    }
                    warn!("Failed to get keys (attempt {}/{}): {}", retries, MAX_RETRIES, e);
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }
}

// Create a shared Redis cache
pub fn create_redis_cache() -> Arc<RedisCache> {
    match RedisCache::new() {
        Ok(cache) => {
            info!("Redis cache initialized successfully");
            Arc::new(cache)
        },
        Err(e) => {
            error!("Failed to initialize Redis cache: {}. Continuing without caching.", e);
            // Return a dummy cache that does nothing
            Arc::new(RedisCache { 
                client: Client::open("redis://localhost:6379").expect("Failed to create dummy Redis client")
            })
        }
    }
} 