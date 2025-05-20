# Quantum Email Client Setup Guide for Windows

This guide will walk you through setting up the Quantum Email Client project on Windows from scratch.

## 1. Install Rust

1. Download the Rust installer for Windows from [rustup.rs](https://rustup.rs/)
2. Run the downloaded file `rustup-init.exe`
3. Follow the prompts to install Rust (accept the default installation options)
4. Restart your terminal or command prompt
5. Verify installation:
   ```
   rustc --version
   cargo --version
   ```

## 2. Install PostgreSQL

1. Download the PostgreSQL installer for Windows from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Choose the components to install (select all)
4. Choose installation directory (default is fine)
5. Set a password for the postgres user (remember this password!)
6. Keep the default port (5432)
7. Select the default locale
8. Complete the installation
9. Launch pgAdmin (installed with PostgreSQL) to verify the installation

### Create Database and User

1. Open Command Prompt as administrator and connect to PostgreSQL:

   ```
   psql -U postgres
   ```

   Enter the password you set during installation

2. Create the database and user:
   ```sql
   CREATE DATABASE quant_client;
   CREATE USER username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE quant_client TO username;
   ```
3. Exit psql by typing `\q`

## 3. Install Redis

1. Redis Windows installation via Memurai (Redis Windows alternative):

   - Download Memurai from [Memurai.com](https://www.memurai.com/get-memurai)
   - Run the installer and follow the instructions
   - Memurai will run as a Windows service automatically

2. Alternatively, install Redis using WSL (Windows Subsystem for Linux):
   - Enable WSL by opening PowerShell as administrator and running:
     ```
     dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
     dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
     ```
   - Restart your computer
   - Download and install WSL 2 from [Microsoft](https://wslstoremarketplace.microsoft.com/en-us/collection)
   - Install Ubuntu from Microsoft Store
   - Open Ubuntu and set up your username and password
   - Update packages and install Redis:
     ```
     sudo apt update
     sudo apt install redis-server
     sudo service redis-server start
     ```
   - Verify Redis is working:
     ```
     redis-cli ping
     ```
     Should return "PONG"

## 4. Install Node.js

1. Download Node.js installer (v16 or later) from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the setup wizard
3. Verify installation:
   ```
   node --version
   npm --version
   ```

## 5. Clone the Repository

1. Install Git from [git-scm.com](https://git-scm.com/download/win) if not already installed
2. Open Command Prompt and clone the repository:
   ```
   git clone [repository_url]
   cd quantum-email-client
   ```

## 6. Set Up Backend Environment

1. Navigate to the backend folder:

   ```
   cd backend
   ```

2. Create a `.env` file in the backend directory with the following content:

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

3. Build and run the backend:

   ```
   cargo build
   cargo run --bin quantum-email-backend
   ```

4. In a separate terminal, you can run the quantum encryption demo:
   ```
   cargo run --bin demo_quantum
   ```

## 7. Set Up Frontend Environment

1. Open a new Command Prompt and navigate to the frontend folder:

   ```
   cd path\to\quantum-email-client\frontend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the frontend directory with:

   ```
   REACT_APP_API_URL=http://localhost:8080/api
   ```

4. Start the frontend development server:

   ```
   npm start
   ```

5. The application should automatically open in your default browser at http://localhost:3000

## 8. Troubleshooting

- **Port conflicts**: If port 8080 is already in use, modify the PORT value in the backend .env file
- **PostgreSQL connection issues**: Verify your database is running with `pg_isready` command
- **Redis connection issues**: If using Memurai, check Windows Services to verify it's running
- **Rust compilation errors**: Run `cargo check` to identify issues before building
- **Missing libraries**: Ensure you have the Microsoft Visual C++ Build Tools installed for Rust compilation

## 9. Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Configure the OAuth consent screen
6. Create an OAuth client ID for a Web application
7. Add `http://localhost:8080/api/auth/google/callback` as an authorized redirect URI
8. Copy the Client ID and Client Secret to your backend .env file
