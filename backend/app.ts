import express, { type Express } from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import runnerRoutes from './routes/runner.routes.js';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import corsMiddleware from "./config/cors.js";
import { errorHandler } from "./middleware/error.middleware.js"

connect();

/** Bump when the frontend starts depending on new endpoints/socket events. */
export const API_VERSION = 2;

const app: Express = express();

app.use(corsMiddleware);
// gzip JSON responses (project files, chat history)
app.use(compression());
app.use(morgan('dev'));
// Project file trees are sent as JSON, so allow more than the 100kb default
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "System Awaken Successfully",
        // Lets the frontend detect an outdated backend deployment
        apiVersion: API_VERSION,
    })
});
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes);
app.use('/run', runnerRoutes);

app.use(errorHandler);


export default app;
