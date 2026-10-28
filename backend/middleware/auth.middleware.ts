import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import redisClient from '../services/redis.service.js';
import { touchUser } from '../services/activity.service.js';
import { isSuspended } from '../services/report.service.js';



export const authUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token: string | undefined = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).send({ errors: 'Unauthorized User' });
        }

        const isBlackListed = await redisClient.get(token);

        if (isBlackListed) {
            res.cookie('token', '');
            return res.status(401).send({ error: 'Unauthorized User' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        if (await isSuspended(decoded.userId)) {
            return res.status(403).send({ message: 'Your account has been suspended', code: 'ACCOUNT_SUSPENDED' });
        }
        req.user = { _id: decoded.userId };
        touchUser(decoded.userId);
        next();

    } catch (error) {
        console.log(error)
        return res.status(401).send({ errors: 'Unauthorized User' });
    }

}
