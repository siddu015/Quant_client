# Quantum Email Client Setup Guide for macOS

This guide will walk you through setting up the Quantum Email Client project on macOS from scratch.

## 1. Install Rust

1. Open Terminal and run:

   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Follow the prompts and select option 1 for default installation

3. Configure your current shell:

   ```
   source "$HOME/.cargo/env"
   ```

4. Verify installation:
   ```
   rustc --version
   cargo --version
   ```

## 2. Install Homebrew (Package Manager)

1. If not already installed, install Homebrew:

   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Follow the terminal instructions to add Homebrew to your PATH

3. Verify installation:
   ```
   brew --version
   ```

## 3. Install PostgreSQL

1. Install PostgreSQL using Homebrew:

   ```
   brew install postgresql@14
   ```

2. Start the PostgreSQL service:

   ```
   brew services start postgresql@14
   ```

3. Verify PostgreSQL is running:
   ```
   postgres --version
   ```

### Create Database and User

1. Connect to the default postgres database:

   ```
   psql postgres
   ```

2. Create the database and user:

   ```sql
   CREATE DATABASE quant_client;
   CREATE USER username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE quant_client TO username;
   ```

3. Exit psql by typing `\q`

## 4. Install Redis

1. Install Redis using Homebrew:

   ```
   brew install redis
   ```

2. Start the Redis service:

   ```
   brew services start redis
   ```

3. Verify Redis is running:
   ```
   redis-cli ping
   ```
   Should return "PONG"

## 5. Install Node.js

1. Install Node.js (v16 or later) using Homebrew:

   ```
   brew install node
   ```

2. Verify installation:
   ```
   node --version
   npm --version
   ```

## 6. Clone the Repository

1. Install Git if not already installed:

   ```
   brew install git
   ```

2. Clone the repository:
   ```
   git clone [repository_url]
   cd quantum-email-client
   ```

## 7. Set Up Backend Environment

1. Navigate to the backend folder:

   ```
   cd backend
   ```

2. Create a `.env` file in the backend directory:

   ```
   touch .env
   ```

3. Open the `.env` file with your preferred text editor and add:

   ```
   DATABASE_URL=postgres://username:your_password@localhost:5432/quant_client
   REDIS_URL=redis://localhost:6379
   PORT=8080
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
   JWT_SECRET=your_jwt_secret_key
   ```

   Replace the credentials with your own values.

4. Build and run the backend:

   ```
   cargo build
   cargo run --bin quantum-email-backend
   ```

5. In a separate terminal window, you can run the quantum encryption demo:
   ```
   cargo run --bin demo_quantum
   ```

## 8. Set Up Frontend Environment

1. Open a new Terminal window and navigate to the frontend folder:

   ```
   cd path/to/quantum-email-client/frontend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the frontend directory:

   ```
   echo "REACT_APP_API_URL=http://localhost:8080/api" > .env
   ```

4. Start the frontend development server:

   ```
   npm start
   ```

5. The application should automatically open in your default browser at http://localhost:3000

## 9. Troubleshooting

- **Port conflicts**: If port 8080 is already in use:

  ```
  echo "PORT=8081" >> backend/.env
  ```

  And update your frontend .env to match:

  ```
  echo "REACT_APP_API_URL=http://localhost:8081/api" > frontend/.env
  ```

- **PostgreSQL connection issues**:

  - Verify service is running: `brew services list`
  - Restart if needed: `brew services restart postgresql@14`

- **Redis connection issues**:

  - Check service status: `brew services list`
  - Restart if needed: `brew services restart redis`

- **Rust compilation errors**:

  - Update Rust: `rustup update`
  - Use `cargo check` to identify issues before full compilation

- **macOS security concerns**:
  - You might need to approve applications in System Preferences > Security & Privacy

## 10. Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Configure the OAuth consent screen
6. Create an OAuth client ID for a Web application
7. Add `http://localhost:8080/api/auth/google/callback` as an authorized redirect URI
8. Copy the Client ID and Client Secret to your backend .env file
