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

- Try to store the fetched emails in cache
- Use Redis for caching
- Improve the fetching speed by using redis caching.
- Reduce the amount of time to fetch emails from gmail. Instead of fetching all the emails from the Gmail try to fetch the most recent gmails for present to reduce the workload on database and CPU.
- Whenever I fetch via refresh or compose the entire mails are fetching from Gmail API, instead they should be fetched from redis.
