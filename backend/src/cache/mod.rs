use redis::{Client, AsyncCommands, RedisError};
use std::env;
use std::sync::Arc;
use crate::models::Email;
use crate::gmail::GmailMessageId;

// Constants for cache TTL
const EMAIL_CACHE_TTL: usize = 900; // 15 minutes (reduced from 1 hour)
const MESSAGE_LIST_CACHE_TTL: usize = 300; // 5 minutes (reduced from 10 minutes)

pub struct RedisCache {
    client: Client,
}

impl RedisCache {
    pub fn new() -> Result<Self, RedisError> {
        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let client = Client::open(redis_url)?;
        
        Ok(Self {
            client,
        })
    }
    
    // Connect to Redis and get a connection
    async fn get_connection(&self) -> Result<redis::aio::Connection, RedisError> {
        let conn = self.client.get_async_connection().await?;
        Ok(conn)
    }
    
    // Cache a list of message IDs for a user and query
    pub async fn cache_message_ids(&self, user_id: &str, query: &str, messages: &[GmailMessageId]) -> Result<(), RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("messages:{}:{}", user_id, query);
        
        // Serialize the messages to JSON
        let json = serde_json::to_string(messages).map_err(|e| {
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let _: () = conn.set_ex(&cache_key, json, MESSAGE_LIST_CACHE_TTL).await?;
        
        println!("Cached {} message IDs for user {} with query {}", messages.len(), user_id, query);
        Ok(())
    }
    
    // Get cached message IDs for a user and query
    pub async fn get_cached_message_ids(&self, user_id: &str, query: &str) -> Result<Option<Vec<GmailMessageId>>, RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("messages:{}:{}", user_id, query);
        
        // Get from Redis
        let result: Option<String> = conn.get(&cache_key).await?;
        
        if let Some(json) = result {
            // Deserialize the JSON
            match serde_json::from_str::<Vec<GmailMessageId>>(&json) {
                Ok(messages) => {
                    println!("Retrieved {} cached message IDs for user {} with query {}", messages.len(), user_id, query);
                    Ok(Some(messages))
                },
                Err(e) => {
                    println!("Error deserializing cached message IDs: {}", e);
                    Ok(None)
                }
            }
        } else {
            println!("No cached message IDs found for user {} with query {}", user_id, query);
            Ok(None)
        }
    }
    
    // Cache a single email message
    pub async fn cache_email(&self, user_id: &str, message_id: &str, email: &Email) -> Result<(), RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("email:{}:{}", user_id, message_id);
        
        // Serialize the email to JSON
        let json = serde_json::to_string(email).map_err(|e| {
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let _: () = conn.set_ex(&cache_key, json, EMAIL_CACHE_TTL).await?;
        
        println!("Cached email {} for user {}", message_id, user_id);
        Ok(())
    }
    
    // Get a cached email
    pub async fn get_cached_email(&self, user_id: &str, message_id: &str) -> Result<Option<Email>, RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("email:{}:{}", user_id, message_id);
        
        // Get from Redis
        let result: Option<String> = conn.get(&cache_key).await?;
        
        if let Some(json) = result {
            // Deserialize the JSON
            match serde_json::from_str::<Email>(&json) {
                Ok(email) => {
                    println!("Retrieved cached email {} for user {}", message_id, user_id);
                    Ok(Some(email))
                },
                Err(e) => {
                    println!("Error deserializing cached email: {}", e);
                    Ok(None)
                }
            }
        } else {
            println!("No cached email found for user {} with message ID {}", user_id, message_id);
            Ok(None)
        }
    }
    
    // Cache a list of emails (sent or received)
    pub async fn cache_emails(&self, user_id: &str, category: &str, emails: &[Email]) -> Result<(), RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("emails:{}:{}", user_id, category);
        
        // Serialize the emails to JSON
        let json = serde_json::to_string(emails).map_err(|e| {
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        // Store in Redis with an expiration
        let _: () = conn.set_ex(&cache_key, json, EMAIL_CACHE_TTL).await?;
        
        println!("Cached {} {} emails for user {}", emails.len(), category, user_id);
        Ok(())
    }
    
    // Get cached emails (sent or received)
    pub async fn get_cached_emails(&self, user_id: &str, category: &str) -> Result<Option<Vec<Email>>, RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Create a cache key
        let cache_key = format!("emails:{}:{}", user_id, category);
        
        // Get from Redis
        let result: Option<String> = conn.get(&cache_key).await?;
        
        if let Some(json) = result {
            // Deserialize the JSON
            match serde_json::from_str::<Vec<Email>>(&json) {
                Ok(emails) => {
                    println!("Retrieved {} cached {} emails for user {}", emails.len(), category, user_id);
                    Ok(Some(emails))
                },
                Err(e) => {
                    println!("Error deserializing cached emails: {}", e);
                    Ok(None)
                }
            }
        } else {
            println!("No cached {} emails found for user {}", category, user_id);
            Ok(None)
        }
    }
    
    // Invalidate cache for a user when refresh is requested
    pub async fn invalidate_user_cache(&self, user_id: &str) -> Result<(), RedisError> {
        let mut conn = self.get_connection().await?;
        
        // Pattern for all user's cache entries
        let pattern = format!("*:{}:*", user_id);
        
        // Find all keys matching the pattern
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut conn)
            .await?;
        
        // Delete all found keys
        if !keys.is_empty() {
            let _: () = redis::cmd("DEL")
                .arg(keys.clone())
                .query_async(&mut conn)
                .await?;
                
            println!("Invalidated {} cache entries for user {}", keys.len(), user_id);
        }
        
        Ok(())
    }
}

// Create a shared Redis cache
pub fn create_redis_cache() -> Arc<RedisCache> {
    match RedisCache::new() {
        Ok(cache) => {
            println!("Redis cache initialized successfully");
            Arc::new(cache)
        },
        Err(e) => {
            println!("Failed to initialize Redis cache: {}. Continuing without caching.", e);
            // Return a dummy cache that does nothing
            Arc::new(RedisCache { 
                client: Client::open("redis://localhost:6379").expect("Failed to create dummy Redis client")
            })
        }
    }
} 