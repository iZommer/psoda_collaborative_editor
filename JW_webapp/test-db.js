import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg
const DB_SCHEMA = process.env.DB_SCHEMA || 'psoda'

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB_SCHEMA)) {
    throw new Error('DB_SCHEMA must be a valid PostgreSQL identifier')
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${DB_SCHEMA},public`,
    enableChannelBinding: true,
    ssl: { rejectUnauthorized: false }
})

async function testConnection() {
    try {
        const { rows } = await pool.query('SELECT NOW()')
        console.log('✅ Connected to Neon! Server time:', rows[0].now)

        const { rows: tables } = await pool.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema IN ($1, 'public')
            ORDER BY table_schema, table_name
        `, [DB_SCHEMA])
        console.log('Tables found:', tables.map(t => `${t.table_schema}.${t.table_name}`))
    } catch (error) {
        console.error('❌ Connection failed:', error.message)
    } finally {
        await pool.end()
    }
}

testConnection()
