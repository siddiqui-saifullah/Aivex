import express, { type Express } from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import cookieParser from 'cookie-parser';
import corsMiddleware from "./config/cors.js";
import { errorHandler } from "./middleware/error.middleware.js"

connect();

const app: Express = express();

app.use(corsMiddleware);
app.use(morgan('dev'));
// Project file trees are sent as JSON, so allow more than the 100kb default
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "System Awaken Successfully"
    })
});
app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes);

app.use(errorHandler);


export default app;
