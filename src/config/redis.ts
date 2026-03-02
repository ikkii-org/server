import {env} from './env';
import { createClient } from 'redis';

export const redisClient = createClient({
    url: env.REDIS_URL,
});

redisClient.on('error', (err: any) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connecting to Redis...'));
redisClient.on('ready', () => console.log('Redis connection is ready'));
redisClient.on('end', () => console.log('Redis connection closed'));

export async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log('Connected to Redis');
    }
}

export async function disconnectRedis() {
    if (redisClient.isOpen) {
        await redisClient.quit();
        console.log('Disconnected from Redis');
    }
}
