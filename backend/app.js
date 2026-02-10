import express from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import cookieParser from 'cookie-parser';
import corsMiddleware from "./config/cors.js";
import { errorHandler } from "./middleware/error.middleware.js"

connect();

const app = express();

app.use(corsMiddleware);
app.options("*", corsMiddleware);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes);

app.use(errorHandler);


export default app;