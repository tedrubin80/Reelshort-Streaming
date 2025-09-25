const { Pool } = require('pg');

let pool;

const initializeDatabase = async () => {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL || 
                'postgresql://southernshort:jevjoF-girtys-1jecto@localhost:5432/southerns_db',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test the connection
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected successfully');
        client.release();

        return pool;
    } catch (error) {
        console.error('❌ PostgreSQL connection error:', error);
        throw error;
    }
};

const getPool = () => {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return pool;
};

const query = async (text, params) => {
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Executed query:', { text, duration, rows: res.rowCount });
        }
        
        return res;
    } catch (error) {
        console.error('❌ Database query error:', error);
        throw error;
    }
};

const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    initializeDatabase,
    getPool,
    query,
    transaction
};