import cors, { type CorsOptions } from "cors";

export const allowedOrigins: string[] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://www.aivex.in",
    "https://aivex.in"
];


const corsOptions: CorsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        // Other sites get no CORS headers, so browsers block them (no 500 error)
        callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 204
};


export default cors(corsOptions);
