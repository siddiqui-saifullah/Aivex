# Aivex Backend

A robust Node.js/Express backend server providing APIs for project management, AI services, real-time chat, and user authentication.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Real-time Communication**: Socket.io
- **Database**: MongoDB
- **Caching**: Redis
- **AI Integration**: Gemini API

## Project Structure

```
├── ai handlers/     # AI processing handlers
├── config/          # Configuration (CORS, etc.)
├── controllers/     # Request handlers
├── db/              # Database connection
├── errors/          # Custom error classes
├── middleware/      # Express middleware
├── models/          # Database models (MongoDB)
├── routes/          # API routes
├── services/        # Business logic layer
├── socket/          # Socket.io handlers
├── utils/           # Utility functions
├── validators/      # Input validation
├── app.ts           # Express app setup
├── server.ts        # Server entry point
└── package.json
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB connection
- Redis (optional, for caching)
- npm 

### Installation

```bash
# Install dependencies
npm install

# Development (TypeScript, auto-reload via tsx)
npm run dev

# Production: compile to dist/ then run the compiled server
npm run build
npm start

# Type-check without emitting
npm run typecheck
```

## Environment Variables

Create a `.env` file in `backend/` with:

```
MONGO_URL=mongodb+srv://...          # MongoDB connection string
JWT_SECRET=a-long-random-string
GEMINI_API_KEY=your_gemini_api_key
REDIS_HOST=...
REDIS_PORT=6379
REDIS_PASSWORD=...
REDIS_TLS=true                       # if your Redis provider supports TLS (most cloud ones do)
PORT=3000

# Admin dashboard (/admin): emails allowed to see site-wide usage, comma separated
ADMIN_EMAILS=you@example.com
# Locked out? Set this once (8+ chars), deploy, sign in, then delete it
# ADMIN_RESET_PASSWORD=a-new-password

# Optional: cloud code runner for C, C++, Java, Python, Go, Rust, ...
PISTON_URL=http://your-piston-host:2000
PISTON_TOKEN=                         # only if your Piston instance requires one
```

## Code Runner (C, C++, Java, Python, ...)

Node.js projects run in the browser (WebContainer), and C and C++ are compiled
to WebAssembly and run in the browser too. Other languages are sent to a
[Piston](https://github.com/engineer-man/piston) sandbox through `POST /run`. The public Piston API now requires a token, so self-host it for
free, e.g. on an Oracle Cloud "Always Free" VM (or any Linux box with Docker):

```bash
docker run -d --name piston --privileged -p 2000:2000 \
  -v piston-data:/piston --restart unless-stopped \
  ghcr.io/engineer-man/piston
# list installable runtimes, then install the ones you want (one-time)
curl -s localhost:2000/api/v2/packages | head
curl -X POST localhost:2000/api/v2/packages -H 'Content-Type: application/json' \
  -d '{"language":"gcc","version":"10.2.0"}'      # C and C++
curl -X POST localhost:2000/api/v2/packages -H 'Content-Type: application/json' \
  -d '{"language":"java","version":"15.0.2"}'
curl -X POST localhost:2000/api/v2/packages -H 'Content-Type: application/json' \
  -d '{"language":"python","version":"3.10.0"}'
```

(Use the versions shown by the list command.)

Then set `PISTON_URL=http://<vm-ip>:2000` on the backend (keep port 2000
firewalled to the backend's IP). Without `PISTON_URL`, the Run button for
these languages shows "Code runner is not configured".

## Security checklist (ports and services)

The backend only needs one public port: the HTTPS port Render gives it. Every
other service should be reachable only by the backend:

- **MongoDB Atlas**: Network Access must not allow `0.0.0.0/0` if you can
  avoid it (Render's paid plans have static outbound IPs to allow instead);
  use a database user with a long random password that can only access this
  database.
- **Redis**: always set a password, and `REDIS_TLS=true` when the provider
  supports TLS, so the password isn't sent in plain text.
- **Piston (code runner)**: port 2000 runs any code it is sent and has no
  login of its own. Never leave it open to the internet: firewall it to the
  backend, or put it behind a reverse proxy (Caddy/nginx with HTTPS) that
  only accepts requests whose `Authorization` header equals a long random
  secret, and set the same secret as `PISTON_TOKEN`.
- **Secrets**: `JWT_SECRET` should be 32+ random characters; remove
  `ADMIN_RESET_PASSWORD` after using it.

Built in: security headers (helmet), CORS limited to the site's origins,
login limited to 10 attempts per account and 50 per IP per 15 minutes,
sign-ups to 10 per IP per hour, and per-user limits on code runs and AI calls.

## API Endpoints

### User Routes (`/users`)
- POST `/` - Register user
- POST `/login` - User login
- GET `/` - Get user profile
- PATCH `/:userId` - Update user profile

### Project Routes (`/projects`)
- POST `/` - Create project
- GET `/` - Get all user projects
- GET `/:projectId` - Get project by ID
- PATCH `/:projectId` - Update project files
- PATCH `/:projectId/name` - Update project name
- PATCH `/:projectId/invite` - Invite users to project
- PATCH `/:projectId/leave` - Leave project
- DELETE `/:projectId` - Delete project
- POST `/:projectId/issues` - Report issue

### Project Chat Routes (`/projects/:projectId/chats`)
- Real-time collaborative chat per project
- Message management
- File patch support

### AI Routes (`/ai`)
- **Note**: Currently for testing purposes only
- AI-powered text extraction (Gemini API)
- AI services integration

## Features

- RESTful API architecture
- Real-time WebSocket communication
- JWT-based authentication
- Error handling middleware
- CORS support
- Input validation
- Redis caching
- MongoDB integration

## Middleware

- `auth.middleware.ts` - JWT authentication
- `error.middleware.ts` - Global error handler
- `project.middleware.ts` - Project-related middleware
- `socketAuth.middleware.ts` - Socket.io authentication
- `validate.middleware.ts` - Input validation

## Models

- **User Model** - User accounts and profiles
- **Project Model** - Project data
- **Chat Model** - Chat messages
- **Issue Model** - Project issues

## Services

- `ai.service.ts` - AI operations
- `chats.service.ts` - Chat operations
- `project.service.ts` - Project operations
- `redis.service.ts` - Caching layer
- `user.service.ts` - User operations


## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
