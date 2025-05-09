Read and understand the project

what we are trying to build is Quantum Email Clinet application
Problem Statement: Build a quantum secure email client Application by using rust, and use web sockets for seamless sending of email/ receiving emails. Create a very dark theme email application user interface. Use quantum algorithms for secure email transmission by encryptions and decryptions.

- This project is about building a gmail application with a layer of quantum encryption
- Using rust for backend
- Using React Typescript for frontend
- Using Postgres SQL
- Present I have created a backend for gmail login and very basic api calls
- The frontend I have implemented a Welcome, dashboard pages.
- The welcome page helps user to use login button which goes to google login and he can login via the gmail
- Then he redirects to dashboard where a basic UI for compose email and see the emails sent/Recieved
- The user also can logout
- The present phase of the project is very basic

Phase 1: Gmail Integration

- Now Implementing a Gmail API integration in the backend to fetech mails from the gmail by which user loginned
- Then go and create a frontend to see these emails, In frontend there is a dashboard for this try to link it there
- Improve the overall UI/UX with a dark theme with better design

Phase 2: Email Fetching

- Create endpoints to fetch emails from Gmail API and store/cache them in your PostgreSQL database.
- Send emails via Gmail API
- Store the results in your local database as a backup

Phase 3: Using Cache

- Added Redis client library to `Cargo.toml`
- Created a new `cache` module with a `RedisCache` struct
- Implemented methods for caching and retrieving emails and message IDs
- Added proper error handling and fallback for when Redis is unavailable
- Email messages are cached for an hour
- Message IDs are cached for 10 minutes
- Cache is automatically invalidated when sending new emails
- Background refresh tasks update the cache asynchronously

Phase 4:

- Add support for Gmail labels and folders
- Improved the dashbord UI/UX to meet the professional design

Phase 5:

- Implement post-quantum encryption (CRYSTALS-Kyber) for emails
- Add a switch to enable user to tick to send the message as quantum encrypted
- Create simple key generation and storage in PostgreSQL
- Add encryption before sending emails via Gmail API
- Implement decryption for received encrypted emails
- Update UI to indicate encrypted/decrypted status of messages
