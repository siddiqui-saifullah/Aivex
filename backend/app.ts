import express, { type Express } from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import runnerRoutes from './routes/runner.routes.js';
import classroomRoutes from './routes/classroom.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import reportRoutes from './routes/report.routes.js';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import corsMiddleware from "./config/cors.js";
import { errorHandler } from "./middleware/error.middleware.js"

connect();

/** Bump when the frontend starts depending on new endpoints/socket events. */
export const API_VERSION = 3;

const app: Express = express();

// Behind Render's proxy: use the client's address (X-Forwarded-For) for
// per-IP rate limits instead of the proxy's
app.set("trust proxy", true);
// Security headers; this is a JSON API, so other sites may still read it
// through CORS (cross-origin resource policy)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
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
app.use('/auth', authRoutes);
app.use('/reports', reportRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes);
app.use('/run', runnerRoutes);
app.use('/classrooms', classroomRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);


export default app;
