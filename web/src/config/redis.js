const redis = require('redis');

let client;

const initializeRedis = async () => {
    try {
        client = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    console.error('❌ Redis server connection refused');
                    return new Error('Redis server connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    console.error('❌ Redis retry time exhausted');
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    console.error('❌ Redis max retry attempts reached');
                    return undefined;
                }
                // Reconnect after
                return Math.min(options.attempt * 100, 3000);
            }
        });

        client.on('error', (err) => {
            console.error('❌ Redis client error:', err);
        });

        client.on('connect', () => {
            console.log('🔄 Redis client connecting...');
        });

        client.on('ready', () => {
            console.log('✅ Redis client ready');
        });

        client.on('end', () => {
            console.log('🔚 Redis client connection ended');
        });

        await client.connect();
        
        // Test the connection
        await client.ping();
        console.log('✅ Redis connected successfully');

        return client;
    } catch (error) {
        console.error('❌ Redis connection error:', error);
        throw error;
    }
};

const getClient = () => {
    if (!client) {
        throw new Error('Redis not initialized. Call initializeRedis() first.');
    }
    return client;
};

// Helper functions for common Redis operations
const cache = {
    get: async (key) => {
        try {
            const value = await client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('❌ Redis GET error:', error);
            return null;
        }
    },

    set: async (key, value, ttl = 3600) => {
        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await client.setEx(key, ttl, serialized);
            } else {
                await client.set(key, serialized);
            }
            return true;
        } catch (error) {
            console.error('❌ Redis SET error:', error);
            return false;
        }
    },

    del: async (key) => {
        try {
            return await client.del(key);
        } catch (error) {
            console.error('❌ Redis DEL error:', error);
            return false;
        }
    },

    exists: async (key) => {
        try {
            return await client.exists(key);
        } catch (error) {
            console.error('❌ Redis EXISTS error:', error);
            return false;
        }
    },

    // Increment operations for counters
    incr: async (key) => {
        try {
            return await client.incr(key);
        } catch (error) {
            console.error('❌ Redis INCR error:', error);
            return 0;
        }
    },

    // Set with expiration (raw value, not JSON)
    setEx: async (key, ttl, value) => {
        try {
            return await client.setEx(key, ttl, String(value));
        } catch (error) {
            console.error('❌ Redis SETEX error:', error);
            return false;
        }
    },

    // Expire key
    expire: async (key, ttl) => {
        try {
            return await client.expire(key, ttl);
        } catch (error) {
            console.error('❌ Redis EXPIRE error:', error);
            return false;
        }
    },

    // Hash operations
    hget: async (key, field) => {
        try {
            return await client.hGet(key, field);
        } catch (error) {
            console.error('❌ Redis HGET error:', error);
            return null;
        }
    },

    hset: async (key, field, value) => {
        try {
            return await client.hSet(key, field, value);
        } catch (error) {
            console.error('❌ Redis HSET error:', error);
            return false;
        }
    },

    // List operations for queues
    lpush: async (key, value) => {
        try {
            return await client.lPush(key, JSON.stringify(value));
        } catch (error) {
            console.error('❌ Redis LPUSH error:', error);
            return 0;
        }
    },

    rpop: async (key) => {
        try {
            const value = await client.rPop(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('❌ Redis RPOP error:', error);
            return null;
        }
    },

    llen: async (key) => {
        try {
            return await client.lLen(key);
        } catch (error) {
            console.error('❌ Redis LLEN error:', error);
            return 0;
        }
    },

    // Set operations for unique collections
    sadd: async (key, member) => {
        try {
            return await client.sAdd(key, member);
        } catch (error) {
            console.error('❌ Redis SADD error:', error);
            return false;
        }
    },

    srem: async (key, member) => {
        try {
            return await client.sRem(key, member);
        } catch (error) {
            console.error('❌ Redis SREM error:', error);
            return false;
        }
    },

    smembers: async (key) => {
        try {
            return await client.sMembers(key);
        } catch (error) {
            console.error('❌ Redis SMEMBERS error:', error);
            return [];
        }
    }
};

module.exports = {
    initializeRedis,
    getClient,
    cache
};