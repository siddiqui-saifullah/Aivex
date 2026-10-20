import "dotenv/config";
import http from 'http';
import app from './app.js';
import { Server } from "socket.io";
import { allowedOrigins } from "./config/cors.js";
import { socketAuth } from "./middleware/socketAuth.middleware.js";
import { initializeSocketHandlers, type AppServer } from "./socket/socketHandler.js";
import { setIo } from "./socket/io.js";
import { initNotificationSocket } from "./socket/notifications.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io: AppServer = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
    // Live-editing sync sends whole project snapshots to newcomers
    maxHttpBufferSize: 5e6,
});

//socket authentication middleware
io.use(socketAuth);

// Initialize all socket event handlers here
initializeSocketHandlers(io);
setIo(io);
// Typed for project rooms; the notifications namespace has its own events
initNotificationSocket(io as unknown as Server);

server.listen(PORT, () => {
    console.log("Server is running in port : ", PORT);
});
