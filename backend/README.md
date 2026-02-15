# Aivex Backend

A robust Node.js/Express backend server providing APIs for project management, AI services, real-time chat, and user authentication.

## Tech Stack

- **Runtime**: Node.js
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
├── app.js           # Express app setup
├── server.js        # Server entry point
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

# Start development server
npm start

# Or with nodemon for development
npm run dev
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

### User Routes (`/api/users`)
- Authentication and user management

### Project Routes (`/api/projects`)
- Project CRUD operations
- Project collaboration

### Chat Routes (`/api/project/chat`)
- Real-time project chat

### AI Routes (`/api/ai`)
- AI-powered text extraction
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

- `auth.middleware.js` - JWT authentication
- `error.middleware.js` - Global error handler
- `project.middleware.js` - Project-related middleware
- `socketAuth.middleware.js` - Socket.io authentication
- `validate.middleware.js` - Input validation

## Models

- **User Model** - User accounts and profiles
- **Project Model** - Project data
- **Chat Model** - Chat messages
- **Issue Model** - Project issues

## Services

- `ai.service.js` - AI operations
- `chats.service.js` - Chat operations
- `project.service.js` - Project operations
- `redis.service.js` - Caching layer
- `user.service.js` - User operations

## Contributing

[Contribution guidelines here]

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
