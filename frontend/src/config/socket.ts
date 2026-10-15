import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

/**
 * Socket Service Module
 * Centralized socket.io connection management
 * Handles:
 * - Socket initialization with auth
 * - Event listeners and emitters
 * - Connection cleanup
 */

let socketInstance: Socket | null = null;

/**
 * Initialize socket connection with authentication
 * Disconnects existing connection if switching projects
 * @param {string} projectId - The project ID to join
 * @param {object} options - Additional socket options
 * @returns {object} Socket instance
 */
export const initializeSocket = (
    projectId: string,
    options: Partial<ManagerOptions & SocketOptions> = {},
): Socket => {
    // Disconnect existing socket if it exists (for project switching)
    // Also tear down sockets that are still connecting, otherwise they leak
    if (socketInstance) {
        console.log("Disconnecting previous socket connection");
        socketInstance.disconnect();
        socketInstance = null;
    }

    const instance = io(import.meta.env.VITE_API_URL, {
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

    socketInstance = instance;

    // Optional: Log connection status
    instance.on("connect", () => {
        console.log("Socket connected:", instance.id, "for project:", projectId);
    });

    instance.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
    });

    instance.on("disconnect", () => {
        console.log("Socket disconnected");
    });

    return instance;
};

/**
 * Register event listener on socket
 * @param {string} eventName - Name of event to listen for
 * @param {Function} callback - Function to call when event fires
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const receiveMessage = <T = any>(eventName: string, cb: (data: T) => void) => {
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
export const sendMessage = (eventName: string, data: unknown) => {
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
export const getSocket = (): Socket | null => {
    return socketInstance;
};

/**
 * Remove specific event listener from socket
 * @param {string} eventName - Name of event to stop listening to
 * @param {Function} callback - Optional: specific callback to remove
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const removeMessageListener = (eventName: string, callback?: (...args: any[]) => void) => {
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
