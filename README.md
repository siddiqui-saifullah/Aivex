# Aivex

Aivex is a full-stack AI-powered browser-based development platform that enables project creation, collaboration, and real-time code interaction — all without local setup.

It combines AI-assisted development, project management, and secure real-time collaboration using a scalable MERN architecture.

---

## 🚀 Core Capabilities

- AI-powered code generation with structured JSON output
- Project-based workspace management
- Real-time collaborative chat per project
- Secure JWT authentication with Redis token blacklisting
- WebSocket integration for live updates
- Issue reporting system
- File tree persistence and project state management

---

## 🏗 Architecture Overview

Aivex follows a modular monorepo structure:

```
├── backend/          # Node.js + Express API
├── frontend/         # React + Vite client
└── README.md         # This file
```

### Backend Stack
- Node.js
- Express
- MongoDB + Mongoose
- JWT Authentication
- Redis (token blacklist)
- Socket.io
- Gemini AI API

### Frontend Stack
- React
- Vite
- Context API
- Modular routing & layouts
- Service-based API architecture

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- MongoDB instance
- Redis instance

---

### 1️⃣ Backend Setup

```bash
cd backend
npm install
npm run dev
```

Create a `.env` file in `/backend`:

```env
GEMINI_API_KEY=your-key
MONGO_URL=
JWT_SECRET=
PORT=3000
REDIS_HOST=
REDIS_PASSWORD=
REDIS_PORT=
```

### 2️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on: `http://localhost:5173`

---

## 🔐 Security Model

- JWT-based authentication
- Middleware-protected routes
- Redis-backed logout token invalidation
- Socket-level authentication and project membership validation
- Centralized error handling

---

## 📡 Real-Time Collaboration

- Project-specific chat channels
- Message expiration support
- File patch support in chat
- WebSocket-based live updates

---

## 📚 Documentation

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

---


## Contributing

We welcome contributions to Aivex. To maintain code quality and architectural consistency, please follow the guidelines below.

---

### 1️⃣ Fork & Create Branch

- Fork the repository
- Create a new branch from `main`
- Use descriptive branch names:

feature/project-invite-validation
fix/socket-auth-bug
refactor/ai-service-cleanup


---

### 2️⃣ Code Standards

- Follow the existing folder structure
- Keep controllers thin (move logic to services)
- Use `AppError` for operational errors
- Use async/await (avoid raw promise chains)
- Validate inputs using `express-validator`
- Do not commit `.env` files

---

### 3️⃣ Commit Message Format

Use structured commit messages:

- feat: add project rename cooldown validation
- fix: resolve socket authentication issue
- refactor: improve project service structure


---

### 4️⃣ Pull Request Checklist

Before submitting a PR:

- Code builds without errors
- No debug logs or commented test code
- Routes tested manually
- Clear PR description provided

---

### 5️⃣ Reporting Issues

When reporting bugs, include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs or screenshots

---

Major architectural changes should be discussed in an issue before implementation.


## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
