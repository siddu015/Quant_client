use serde::{Deserialize, Serialize};
use pqcrypto_kyber::kyber768::{self, keypair, encapsulate, decapsulate};
use base64::{encode_config, decode_config, STANDARD};
use std::error::Error;
use pqcrypto_traits::kem::{PublicKey, SecretKey, Ciphertext, SharedSecret};

pub mod keys;

pub use keys::KeyPair;

const ENCRYPTION_MARKER: &str = "[Q-ENCRYPTED]";

#[derive(Serialize, Deserialize, Debug)]
pub struct EncryptedMessage {
    pub ciphertext: String,   // Base64 encoded ciphertext
    pub encapsulated_key: String,  // Base64 encoded encapsulated key
}

/// Generates a new key pair for post-quantum encryption
pub fn generate_keypair() -> Result<KeyPair, Box<dyn Error>> {
    let (pk, sk) = keypair();
    
    let public_key = encode_config(pk.as_bytes(), STANDARD);
    let secret_key = encode_config(sk.as_bytes(), STANDARD);
    
    Ok(KeyPair {
        public_key,
        secret_key,
    })
}

/// Encrypts a message using the recipient's public key
pub fn encrypt_message(message: &str, public_key_b64: &str) -> Result<EncryptedMessage, Box<dyn Error>> {
    // Decode the public key from base64
    let pk_bytes = decode_config(public_key_b64, STANDARD)?;
    let pk = kyber768::PublicKey::from_bytes(&pk_bytes).map_err(|e| format!("Failed to decode public key: {}", e))?;
    
    // Generate a shared secret and encrypt message
    let (ciphertext, shared_secret) = encapsulate(&pk);
    
    // Use the shared secret to encrypt the message (using XOR for simplicity)
    let mut encrypted_bytes = vec![0u8; message.as_bytes().len()];
    let mut key_bytes = shared_secret.as_bytes().to_vec();
    
    // Extend the key if needed using simple key stretching
    while key_bytes.len() < message.as_bytes().len() {
        key_bytes.extend_from_slice(shared_secret.as_bytes());
    }
    
    // XOR encryption
    for (i, byte) in message.as_bytes().iter().enumerate() {
        encrypted_bytes[i] = byte ^ key_bytes[i];
    }
    
    // Encode the results as base64
    let ciphertext_b64 = encode_config(&encrypted_bytes, STANDARD);
    let encapsulated_key_b64 = encode_config(ciphertext.as_bytes(), STANDARD);
    
    Ok(EncryptedMessage {
        ciphertext: ciphertext_b64,
        encapsulated_key: encapsulated_key_b64,
    })
}

/// Decrypts a message using the recipient's private key
pub fn decrypt_message(encrypted_msg: &EncryptedMessage, secret_key_b64: &str) -> Result<String, Box<dyn Error>> {
    // Decode the private key from base64
    let sk_bytes = decode_config(secret_key_b64, STANDARD)?;
    let sk = kyber768::SecretKey::from_bytes(&sk_bytes).map_err(|e| format!("Failed to decode secret key: {}", e))?;
    
    // Decode the encapsulated key
    let encapsulated_key = decode_config(&encrypted_msg.encapsulated_key, STANDARD)?;
    let ciphertext = kyber768::Ciphertext::from_bytes(&encapsulated_key).map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    
    // Recover the shared secret
    let shared_secret = decapsulate(&ciphertext, &sk);
    
    // Decode the ciphertext
    let encrypted_bytes = decode_config(&encrypted_msg.ciphertext, STANDARD)?;
    
    // Use the shared secret to decrypt the message
    let mut decrypted_bytes = vec![0u8; encrypted_bytes.len()];
    let mut key_bytes = shared_secret.as_bytes().to_vec();
    
    // Extend the key if needed
    while key_bytes.len() < encrypted_bytes.len() {
        key_bytes.extend_from_slice(shared_secret.as_bytes());
    }
    
    // XOR decryption
    for (i, byte) in encrypted_bytes.iter().enumerate() {
        decrypted_bytes[i] = byte ^ key_bytes[i];
    }
    
    // Convert back to UTF-8 string
    let decrypted_message = String::from_utf8(decrypted_bytes)?;
    
    Ok(decrypted_message)
}

/// Checks if a message is encrypted
pub fn is_encrypted(subject: &str) -> bool {
    subject.contains(ENCRYPTION_MARKER)
}

/// Formats a subject line for an encrypted message
pub fn format_encrypted_subject(original_subject: &str) -> String {
    format!("{} {}", ENCRYPTION_MARKER, original_subject)
}

/// Extracts the original subject from an encrypted subject
pub fn extract_original_subject(encrypted_subject: &str) -> String {
    encrypted_subject.replace(ENCRYPTION_MARKER, "").trim().to_string()
}

/// Formats the body of an encrypted email for display in Gmail
pub fn format_encrypted_body() -> String {
    "This message is encrypted and can only be read using the Q-Client.\n\nPlease use your quantum-secure email client to view this message.".to_string()
}

/// Serializes an encrypted message for transmission
pub fn serialize_encrypted_message(encrypted_msg: &EncryptedMessage) -> Result<String, Box<dyn Error>> {
    serde_json::to_string(encrypted_msg).map_err(|e| e.into())
}

/// Deserializes an encrypted message from received data
pub fn deserialize_encrypted_message(data: &str) -> Result<EncryptedMessage, Box<dyn Error>> {
    serde_json::from_str(data).map_err(|e| e.into())
} 