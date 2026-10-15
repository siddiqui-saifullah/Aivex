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

Create a `.env` file in the root directory with:

```
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=your_redis_url
GEMINI_API_KEY=your_gemini_api_key
CORS_ORIGIN=http://localhost:5173
PORT=5000
```

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
