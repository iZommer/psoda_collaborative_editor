import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
})

async function testConnection() {
    try {
        const { rows } = await pool.query('SELECT NOW()')
        console.log('✅ Connected to Neon! Server time:', rows[0].now)

        const { rows: tables } = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `)
        console.log('Tables found:', tables.map(t => t.table_name))
    } catch (error) {
        console.error('❌ Connection failed:', error.message)
    } finally {
        await pool.end()
    }
}

testConnection()