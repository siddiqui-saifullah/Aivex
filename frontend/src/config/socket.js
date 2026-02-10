import socket from "socket.io-client";

/**
 * Socket Service Module
 * Centralized socket.io connection management
 * Handles:
 * - Socket initialization with auth
 * - Event listeners and emitters
 * - Connection cleanup
 */

let socketInstance = null;

/**
 * Initialize socket connection with authentication
 * Disconnects existing connection if switching projects
 * @param {string} projectId - The project ID to join
 * @param {object} options - Additional socket options
 * @returns {object} Socket instance
 */
export const initializeSocket = (projectId, options = {}) => {
    // Disconnect existing socket if it exists (for project switching)
    if (socketInstance?.connected) {
        console.log("Disconnecting previous socket connection");
        socketInstance.disconnect();
        socketInstance = null;
    }

    socketInstance = socket(import.meta.env.VITE_API_URL, {
        auth: {
            token: localStorage.getItem('token'),
        },
        query: {
            projectId
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        ...options
    });

    // Optional: Log connection status
    socketInstance.on("connect", () => {
        console.log("Socket connected:", socketInstance.id, "for project:", projectId);
    });

    socketInstance.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
    });

    socketInstance.on("disconnect", () => {
        console.log("Socket disconnected");
    });

    return socketInstance;
};

/**
 * Register event listener on socket
 * @param {string} eventName - Name of event to listen for
 * @param {Function} callback - Function to call when event fires
 */
export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) {
        console.warn("Socket not initialized. Call initializeSocket first.");
        return;
    }
    socketInstance.on(eventName, cb);
};

/**
 * Emit event to socket with data
 * @param {string} eventName - Name of event to emit
 * @param {object} data - Data to send with event
 */
export const sendMessage = (eventName, data) => {
    if (!socketInstance) {
        console.warn("Socket not initialized. Call initializeSocket first.");
        return;
    }
    socketInstance.emit(eventName, data);
};

/**
 * Get current socket instance
 * @returns {object|null} Current socket instance or null
 */
export const getSocket = () => {
    return socketInstance;
};

/**
 * Remove specific event listener from socket
 * @param {string} eventName - Name of event to stop listening to
 * @param {Function} callback - Optional: specific callback to remove
 */
export const removeMessageListener = (eventName, callback) => {
    if (!socketInstance) return;
    if (callback) {
        socketInstance.off(eventName, callback);
    } else {
        socketInstance.off(eventName);
    }
};

/**
 * Disconnect socket and cleanup
 */
export const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
};
