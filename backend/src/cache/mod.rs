use redis::{Client, AsyncCommands, RedisError};
use std::env;
use std::sync::Arc;
use std::time::Duration;
use crate::models::{Email, GmailLabel};
use crate::gmail::GmailMessageId;
use log::{debug, error, info};

// Constants for cache TTL
const EMAIL_CACHE_TTL: usize = 7200; // Increase to 2 hours
const MESSAGE_LIST_CACHE_TTL: usize = 3600; // Increase to 1 hour
const LABEL_CACHE_TTL: usize = 14400; // Increase to 4 hours
const RETRY_DELAY: Duration = Duration::from_secs(1);
const MAX_RETRIES: u32 = 3;
const DEFAULT_PAGE_SIZE: usize = 50;

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
        // Get current email lists
        let category = if is_sent { "sent" } else { "received" };
        
        if let Ok(Some((mut emails, page, total_pages))) = self.get_cached_emails_paginated(user_id, category, 0, None).await {
            // Only update the first page which contains the most recent emails
            if page == 0 {
                // Add the new email to the beginning (or update existing)
                let existing_idx = emails.iter().position(|e| e.id == email.id);
                if let Some(idx) = existing_idx {
                    emails[idx] = email.clone();
                } else {
                    emails.insert(0, email.clone());
                    
                    // If page is full, remove the last item
                    if emails.len() > DEFAULT_PAGE_SIZE {
                        emails.pop();
                    }
                }
                
                // Cache the updated page
                let mut conn = self.get_connection_with_retry().await?;
                let page_key = format!("emails:{}:{}:page:0", user_id, category);
                
                let json = serde_json::to_string(&emails).map_err(|e| {
                    error!("Failed to serialize updated email page: {}", e);
                    RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
                })?;
                
                let _: () = conn.set_ex::<_, _, ()>(&page_key, &json, EMAIL_CACHE_TTL).await?;
                
                // Update index (this is a simplification - ideally we'd update the entire index)
                // For production, you'd need to rebuild the entire index
                
                info!("Updated first page of emails for {} with new/updated email", category);
            }
        }
        
        // Always cache the individual email
        self.cache_email(user_id, &email.id, email).await?;
        
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

    // Cache emails with pagination support
    pub async fn cache_emails_paginated(&self, user_id: &str, category: &str, emails: &[Email], page_size: Option<usize>) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        
        // Store total count
        let count_key = format!("emails:{}:{}:count", user_id, category);
        let _: () = conn.set_ex(&count_key, emails.len(), EMAIL_CACHE_TTL).await?;
        
        // Store emails in pages
        let chunks = emails.chunks(page_size);
        for (i, chunk) in chunks.enumerate() {
            let page_key = format!("emails:{}:{}:page:{}", user_id, category, i);
            let json = serde_json::to_string(chunk).map_err(|e| {
                error!("Failed to serialize email page: {}", e);
                RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
            })?;
            
            let _: () = conn.set_ex::<_, _, ()>(&page_key, &json, EMAIL_CACHE_TTL).await?;
        }
        
        // Store index of emails for quick lookup
        let index_key = format!("emails:{}:{}:index", user_id, category);
        let index: Vec<(String, usize, usize)> = emails.iter().enumerate().map(|(i, email)| {
            (email.id.clone(), i / page_size, i % page_size)
        }).collect();
        
        let index_json = serde_json::to_string(&index).map_err(|e| {
            error!("Failed to serialize email index: {}", e);
            RedisError::from((redis::ErrorKind::IoError, "Serialization error", e.to_string()))
        })?;
        
        let _: () = conn.set_ex::<_, _, ()>(&index_key, &index_json, EMAIL_CACHE_TTL).await?;
        
        info!("Cached {} emails in {} pages for {}", emails.len(), (emails.len() as f64 / page_size as f64).ceil(), category);
        Ok(())
    }

    // Get cached emails with pagination support
    pub async fn get_cached_emails_paginated(&self, user_id: &str, category: &str, page: usize, page_size: Option<usize>) -> Result<Option<(Vec<Email>, usize, usize)>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        
        // Check if we have emails cached
        let count_key = format!("emails:{}:{}:count", user_id, category);
        let total_count: Option<usize> = conn.get(&count_key).await?;
        
        if let Some(count) = total_count {
            let page_key = format!("emails:{}:{}:page:{}", user_id, category, page);
            
            match conn.get::<_, Option<String>>(&page_key).await {
                Ok(Some(json)) => match serde_json::from_str(&json) {
                    Ok(emails) => {
                        info!("Retrieved page {} of {} emails from cache", page, category);
                        let total_pages = (count as f64 / page_size as f64).ceil() as usize;
                        Ok(Some((emails, page, total_pages)))
                    },
                    Err(e) => {
                        error!("Failed to deserialize emails page: {}", e);
                        let _: () = conn.del(&page_key).await?;
                        Ok(None)
                    }
                },
                Ok(None) => {
                    info!("No cached email page found for {}", category);
                    Ok(None)
                },
                Err(e) => {
                    error!("Failed to get cached email page: {}", e);
                    Err(e)
                }
            }
        } else {
            Ok(None)
        }
    }

    // Get email by ID efficiently from cache
    pub async fn get_cached_email_by_id(&self, user_id: &str, category: &str, email_id: &str) -> Result<Option<Email>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        
        // First check direct cache
        let direct_key = format!("email:{}:{}", user_id, email_id);
        if let Ok(Some(json)) = conn.get::<_, Option<String>>(&direct_key).await {
            if let Ok(email) = serde_json::from_str(&json) {
                return Ok(Some(email));
            }
        }
        
        // If not found in direct cache, check index
        let index_key = format!("emails:{}:{}:index", user_id, category);
        
        if let Ok(Some(index_json)) = conn.get::<_, Option<String>>(&index_key).await {
            if let Ok(index) = serde_json::from_str::<Vec<(String, usize, usize)>>(&index_json) {
                if let Some((_, page_num, idx)) = index.iter().find(|(id, _, _)| id == email_id) {
                    let page_key = format!("emails:{}:{}:page:{}", user_id, category, page_num);
                    
                    if let Ok(Some(page_json)) = conn.get::<_, Option<String>>(&page_key).await {
                        if let Ok(emails) = serde_json::from_str::<Vec<Email>>(&page_json) {
                            if let Some(email) = emails.get(*idx) {
                                return Ok(Some(email.clone()));
                            }
                        }
                    }
                }
            }
        }
        
        Ok(None)
    }

    // Update sync timestamp
    pub async fn set_last_sync(&self, user_id: &str) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let key = format!("last_sync:{}", user_id);
        let now = chrono::Utc::now().timestamp();
        let _: () = conn.set_ex::<_, _, ()>(&key, now, 86400).await?;
        Ok(())
    }

    // Get last sync timestamp
    pub async fn get_last_sync(&self, user_id: &str) -> Result<Option<i64>, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let key = format!("last_sync:{}", user_id);
        conn.get::<_, Option<i64>>(&key).await
    }

    // Track email read status
    pub async fn mark_email_read(&self, user_id: &str, email_id: &str) -> Result<(), RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let key = format!("read:{}:{}", user_id, email_id);
        let now = chrono::Utc::now().timestamp();
        let _: () = conn.set_ex::<_, _, ()>(&key, now, 86400 * 30).await?; // Keep for 30 days
        Ok(())
    }

    // Check if email was read
    pub async fn was_email_read(&self, user_id: &str, email_id: &str) -> Result<bool, RedisError> {
        let mut conn = self.get_connection_with_retry().await?;
        let key = format!("read:{}:{}", user_id, email_id);
        let exists: bool = conn.exists(&key).await?;
        Ok(exists)
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