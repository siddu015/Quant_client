# Quantum Email Client

A secure email application integrating Gmail with post-quantum cryptography, providing protection against future quantum computing threats.

## Features

- Gmail integration with quantum-resistant encryption (CRYSTALS-Kyber)
- Dark-themed UI with modern email management
- Real-time notifications via WebSockets
- Redis caching for performance optimization

## Tech Stack

**Backend:** Rust, Actix-Web, Tokio, PostgreSQL, Redis  
**Frontend:** React, TypeScript, TailwindCSS  
**Security:** CRYSTALS-Kyber (post-quantum cryptography)

## Quick Setup

### Prerequisites

- Rust (latest stable)
- Node.js (v16+)
- PostgreSQL (v14+)
- Redis (v6+)
- Google API credentials

### Database Setup

```bash
# Create PostgreSQL database
sudo -u postgres psql
CREATE DATABASE quant_client;
CREATE USER siddu WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE quant_client TO siddu;
```

### Backend

```bash
cd backend

# Run main application
cargo run --bin quantum-email-backend

# Run quantum encryption demo
cargo run --bin demo_quantum
```

### Frontend

```bash
cd frontend
npm install
npm start
# Access at http://localhost:3000
```

## Project Structure

```
quantum-email-client/
├── backend/               # Rust backend application
│   ├── src/               # Application source code
│   └── Cargo.toml         # Rust dependencies
│
├── frontend/              # React TypeScript frontend
│   ├── src/               # Application source code
│   └── package.json       # JavaScript dependencies
```

## Troubleshooting

- **Port conflicts**: Add `PORT=8081` to your `.env` file
- **Connection errors**: Ensure PostgreSQL and Redis are running
- **Frontend issues**: Verify backend is running and API URL is correct
- **Quantum Demo**: Uses simulation mode for encryption visualization
