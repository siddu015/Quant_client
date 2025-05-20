# Quantum Email Client - Database Setup Guide

This guide provides detailed instructions for setting up the PostgreSQL database schema required by the Quantum Email Client application. Follow these steps if you encounter database relation errors like "relation 'user_keys' does not exist".

## Complete Database Schema Setup

Connect to your PostgreSQL database:

**Windows:**

```
psql -U username -d quant_client
```

**macOS:**

```
psql -U username quant_client
```

Enter your password when prompted (`postgres`).

Then execute the following SQL commands to create all necessary tables:

```sql
-- User keys table for quantum encryption
CREATE TABLE IF NOT EXISTS user_keys (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    profile_picture TEXT,
    google_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message_id VARCHAR(255) UNIQUE,
    thread_id VARCHAR(255),
    from_email VARCHAR(255) NOT NULL,
    to_email TEXT[] NOT NULL,
    cc_email TEXT[],
    bcc_email TEXT[],
    subject TEXT,
    body TEXT,
    body_encrypted BOOLEAN DEFAULT false,
    starred BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    labels TEXT[],
    attachment_ids TEXT[],
    received_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Email drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    to_email TEXT[],
    cc_email TEXT[],
    bcc_email TEXT[],
    subject TEXT,
    body TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    theme VARCHAR(50) DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    auto_encryption BOOLEAN DEFAULT false,
    signature TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Exit PostgreSQL by typing `\q` when done.

## Troubleshooting Database Errors

If you encounter errors about missing relations or columns when running the application, you can:

1. Check the error message to identify the missing table or column
2. Connect to the database and create the missing element:

```sql
-- For a missing table (example):
CREATE TABLE missing_table_name (...);

-- For a missing column (example):
ALTER TABLE existing_table ADD COLUMN missing_column_name data_type;
```

3. Look for SQL files or migration scripts in the project repository for the complete schema

## Database Connection Verification

To verify your database connection is working correctly:

**Windows:**

```
psql -U username -d quant_client -c "SELECT 'Connection successful' AS status;"
```

**macOS:**

```
psql -U username quant_client -c "SELECT 'Connection successful' AS status;"
```

This should display "Connection successful" if your database connection is working properly.
