import { Redis } from "ioredis";

const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
    password: process.env.REDIS_PASSWORD,
    // Encrypt the connection (and the password) when the provider supports it
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
});

redisClient.on('connect', () => {
    console.log('Redis Connected');
})

redisClient.on('error', (err) => {
    console.error('Redis error:', err.message);
})


export default redisClient;
