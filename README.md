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
