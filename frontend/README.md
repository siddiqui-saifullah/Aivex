# Aivex Frontend

A modern React application built with Vite for the Aivex project, featuring project management, real-time collaboration, and AI integration.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Real-time Communication**: Socket.io
- **Code Quality**: ESLint

## Project Structure

```
src/
├── components/      # Reusable UI components
├── screens/         # Page components
├── context/         # React Context providers
├── hooks/           # Custom React hooks
├── services/        # API service layer
├── utils/           # Utility functions
├── config/          # Configuration files
├── constants/       # Application constants
├── layouts/         # Layout components
└── routes/          # Route definitions
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file in the root directory with the required environment variables for API endpoints and socket configuration.

## Key Features

- User authentication and authorization
- Project creation and management
- Real-time project chat
- Dynamic WebContainer integration
- Dark/Light theme support
- Responsive design

## Contributing

[Contribution guidelines here]

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
