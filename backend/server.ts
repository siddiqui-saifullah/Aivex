import "dotenv/config";
import http from 'http';
import app from './app.js';
import { Server } from "socket.io";
import { allowedOrigins } from "./config/cors.js";
import { socketAuth } from "./middleware/socketAuth.middleware.js";
import { initializeSocketHandlers, type AppServer } from "./socket/socketHandler.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io: AppServer = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    }
});

//socket authentication middleware
io.use(socketAuth);

// Initialize all socket event handlers here
initializeSocketHandlers(io);

server.listen(PORT, () => {
    console.log("Server is running in port : ", PORT);
});
