use quantum_email_backend::encryption;
use std::{io::{self, Write}, thread, time::Duration};
use colored::*;

fn main() {
    println!("{}", "=== QUANTUM ENCRYPTION DEMONSTRATION ===".bright_purple().bold());
    println!("{}", "This tool demonstrates the quantum-resistant encryption used in the email system.".bright_white());
    println!("{}", "Kyber-768 is a post-quantum cryptographic algorithm that is resistant to quantum computer attacks.".bright_white());
    println!();
    
    // Generate key pair
    print!("🔑 Generating quantum-resistant keypair... ");
    io::stdout().flush().unwrap();
    slow_animation(1);
    
    let keypair = encryption::generate_keypair().expect("Failed to generate keypair");
    println!("{}", "DONE".green().bold());
    
    // Show key details
    println!("📋 Public key size: {} bytes (base64 encoded)".bright_cyan(), keypair.public_key.len());
    println!("🔒 Private key size: {} bytes (base64 encoded)".bright_red(), keypair.secret_key.len());
    println!();
    
    // Get message from user
    println!("📝 Enter a message to encrypt:");
    let mut message = String::new();
    io::stdin().read_line(&mut message).expect("Failed to read line");
    message = message.trim().to_string();
    
    if message.is_empty() {
        // Use a default message if user didn't enter anything
        message = "This is a top secret quantum encrypted message! No quantum computer will be able to crack this.".to_string();
        println!("Using default message: \"{}\"", message);
    }
    
    println!();
    println!("{}", "QUANTUM ENCRYPTION PROCESS".bright_blue().bold());
    
    // Animate the encryption process
    println!("🔑 Using Kyber-768 public key");
    slow_animation(1);
    
    println!("🧮 Performing post-quantum key encapsulation");
    slow_animation(2);
    
    println!("🔐 Generating shared secret");
    slow_animation(1);
    
    println!("📊 Applying quantum-derived XOR cipher");
    slow_animation(2);
    
    // Encrypt the message
    let encrypted = encryption::encrypt_message(&message, &keypair.public_key)
        .expect("Failed to encrypt message");
    
    // Display encrypted output
    println!();
    println!("{}", "🔒 ENCRYPTED OUTPUT".bright_green().bold());
    visualize_encryption(&message, &encrypted.ciphertext);
    
    // Decryption
    println!();
    println!("{}", "QUANTUM DECRYPTION PROCESS".bright_magenta().bold());
    
    println!("🔑 Using Kyber-768 private key");
    slow_animation(1);
    
    println!("🧮 Performing post-quantum key decapsulation");
    slow_animation(2);
    
    println!("🔓 Recovering shared secret");
    slow_animation(1);
    
    println!("📊 Applying quantum-derived XOR decipher");
    slow_animation(2);
    
    // Decrypt the message
    let decrypted = encryption::decrypt_message(&encrypted, &keypair.secret_key)
        .expect("Failed to decrypt message");
    
    // Show decryption result
    println!();
    println!("{}", "🔓 DECRYPTION RESULT".bright_yellow().bold());
    println!("Original: {}", message.bright_white());
    println!("Decrypted: {}", decrypted.green());
    
    if message == decrypted {
        println!();
        println!("{}", "✅ QUANTUM CRYPTOGRAPHY DEMONSTRATION SUCCESSFUL".green().bold());
    } else {
        println!();
        println!("{}", "❌ ERROR: Decryption failed".red().bold());
    }
}

// Slow animation for terminal output
fn slow_animation(seconds: u64) {
    let chars = vec!['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let duration = Duration::from_millis(100);
    let iterations = seconds * 10;
    
    for i in 0..iterations {
        print!("\r   {} Processing...", chars[i as usize % chars.len()]);
        io::stdout().flush().unwrap();
        thread::sleep(duration);
    }
    println!("\r   {} Done!           ", "✓".green());
}

// Visualize the encryption transformation
fn visualize_encryption(original: &str, encrypted: &str) {
    let padded_text = if original.len() > 30 {
        format!("{}...", &original[0..30])
    } else {
        original.to_string()
    };
    
    println!("Original text: {}", padded_text.bright_white());
    
    // Show encryption animation
    let stages = 8;
    for i in 0..=stages {
        let progress = i as f64 / stages as f64;
        let cutoff = (padded_text.len() as f64 * progress) as usize;
        
        let mut transformed = String::new();
        for (idx, c) in padded_text.chars().enumerate() {
            if idx < cutoff {
                // Show encrypted character
                transformed.push_str(&format!("{}", "█".bright_cyan()));
            } else {
                // Show original character
                transformed.push(c);
            }
        }
        
        print!("\rTransforming: {}", transformed);
        io::stdout().flush().unwrap();
        thread::sleep(Duration::from_millis(300));
    }
    println!();
    
    // Display a portion of the base64 encrypted text
    let encrypted_sample = if encrypted.len() > 40 {
        format!("{}...", &encrypted[0..40])
    } else {
        encrypted.to_string()
    };
    
    println!("Encrypted: {}", encrypted_sample.bright_cyan());
    
    // Add a visual separator
    println!("Kyber-768 {}", "▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒".bright_blue());
}