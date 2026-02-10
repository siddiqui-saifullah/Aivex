import "dotenv/config";
import http from 'http';
import app from './app.js';
import { Server } from "socket.io";
import { socketAuth } from "./middleware/socketAuth.middleware.js";
import { initializeSocketHandlers } from "./socket/socketHandler.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

//socket authentication middleware
io.use(socketAuth);

// Initialize all socket event handlers here
initializeSocketHandlers(io);

server.listen(PORT, () => {
    console.log("Server is running in port : ", PORT);
});

