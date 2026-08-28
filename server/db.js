const { Pool } = require('pg');
require('dotenv').config();

// Retrieve database URL from environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("WARNING: DATABASE_URL is not set. Database operations will fail unless set.");
}

const pool = new Pool({
    connectionString: connectionString,
    // Add SSL support for cloud databases (like Neon, Supabase, Render)
    ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false
});

/**
 * Helper function to run queries with the pool.
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // console.log('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (err) {
        console.error('Database query error:', err, 'Query:', text);
        throw err;
    }
}

/**
 * Initialize the database tables if they do not exist.
 */
async function initDb() {
    console.log("Initializing database tables...");
    
    // Create users table
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create short_urls table
    await query(`
        CREATE TABLE IF NOT EXISTS short_urls (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            short_code VARCHAR(4) UNIQUE NOT NULL,
            original_url TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            clicks INTEGER DEFAULT 0 NOT NULL
        );
    `);

    // Create indexes for fast lookup and relational integrity
    await query(`
        CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code);
    `);
    
    await query(`
        CREATE INDEX IF NOT EXISTS idx_short_urls_user_id ON short_urls(user_id);
    `);

    console.log("Database tables initialized successfully.");
}

module.exports = {
    pool,
    query,
    initDb
};
