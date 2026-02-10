import jwt from 'jsonwebtoken';
import redisClient from '../services/redis.service.js';



export const authUser = async (req, res, next) => {
    // console.log(req)
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).send({ errors: 'Unauthorized User' });
        }

        const isBlackListed = await redisClient.get(token);

        if (isBlackListed) {
            res.cookie('token', '');
            return res.status(401).send({ error: 'Unauthorized User' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { _id: decoded.userId };
        next();

    } catch (error) {
        console.log(error)
        return res.status(401).send({ errors: 'Unauthorized User' });
    }

}