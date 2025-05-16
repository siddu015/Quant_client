# Quantum Email Client

## Introduction

Quantum Email Client is a next-generation secure email application that integrates Gmail's functionality with post-quantum cryptography. It provides a sleek, dark-themed user interface for managing emails while adding a layer of quantum-resistant encryption for enhanced security against future quantum computing threats.

## Features

- **Gmail Integration**: Seamless login and access to Gmail accounts
- **Post-Quantum Encryption**: Uses CRYSTALS-Kyber algorithm for quantum-resistant message encryption
- **Dark Theme UI**: Modern, eye-friendly dark interface for comfortable email management
- **Real-time Communication**: WebSocket implementation for instant email notifications
- **Efficient Caching**: Redis-based caching system for improved performance
- **Email Management**: Compose, send, receive, and organize emails with Gmail label support
- **Secure Authentication**: OAuth2 integration with Google for secure access

## Technology Stack

### Backend

- **Rust**: High-performance, memory-safe programming language
- **Actix-Web**: Asynchronous web framework
- **Tokio**: Async runtime for concurrent processing
- **PostgreSQL**: Persistent data storage
- **Redis**: Email and message ID caching
- **CRYSTALS-Kyber**: Post-quantum cryptographic algorithm

### Frontend

- **React**: Component-based UI library
- **TypeScript**: Type-safe JavaScript
- **TailwindCSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **React Context API**: State management

## Getting Started

### Prerequisites

- Rust (latest stable)
- Node.js (v16+)
- PostgreSQL
- Redis
- Google API credentials

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a `.env` file with the following variables:

   ```
   DATABASE_URL=postgres://username:password@localhost/quantum_email
   REDIS_URL=redis://localhost:6379
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   REDIRECT_URL=http://localhost:3000/auth/callback
   ```

3. Install dependencies and run:
   ```bash
   cargo run
   ```

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with:

   ```
   REACT_APP_API_URL=http://localhost:8080
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

```
quantum-email-client/
├── backend/               # Rust backend application
│   ├── src/
│   │   ├── auth/          # Authentication handlers
│   │   ├── cache/         # Redis caching implementation
│   │   ├── db/            # Database connections and queries
│   │   ├── encryption/    # Quantum encryption algorithms
│   │   ├── gmail/         # Gmail API integration
│   │   ├── handlers/      # API request handlers
│   │   ├── models/        # Data models
│   │   └── main.rs        # Application entry point
│   └── Cargo.toml         # Rust dependencies
│
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React context providers
│   │   ├── pages/         # Application pages
│   │   ├── services/      # API communication
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Utility functions
│   └── package.json       # JavaScript dependencies
```

## Redis Setup for Email Caching

For the email caching functionality, you'll need to install and run Redis:

### Installing Redis

#### Mac

```bash
brew install redis
```

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install redis-server
```

#### Windows

Download and install Redis from: https://github.com/microsoftarchive/redis/releases

### Starting Redis

```bash
# Mac/Linux
redis-server

# Windows (after installation)
# Redis should be running as a service automatically
```

### Configuring Redis URL

The application expects Redis to be available at `redis://localhost:6379`.
You can modify this by changing the `REDIS_URL` in the `.env` file.
