import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'

const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'resources', '.env')
]

for (const envPath of envCandidates) {
    dotenv.config({ path: envPath })
    if (process.env.DATABASE_URL) break
}

const { Pool } = pg
const DB_SCHEMA = process.env.DB_SCHEMA || 'public'

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB_SCHEMA)) {
    throw new Error('DB_SCHEMA must be a valid PostgreSQL identifier')
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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

        const { rows: usersCount } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${DB_SCHEMA}.users`)
        console.log(`${DB_SCHEMA}.users rows:`, usersCount[0].count)

        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { rows: insertedUsers } = await client.query(
                `INSERT INTO ${DB_SCHEMA}.users (name) VALUES ($1) RETURNING id, name`,
                ['connection_test_user']
            )
            console.log('Rollback insert test passed:', insertedUsers[0])
            await client.query('ROLLBACK')
        } finally {
            client.release()
        }
    } catch (error) {
        console.error('❌ Connection failed')
        console.error('Name:', error.name || 'unknown')
        console.error('Code:', error.code || 'none')
        console.error('Message:', error.message || '(empty)')

        if (error.cause) {
            console.error('Cause:', error.cause.message || error.cause)
        }

        if (Array.isArray(error.errors)) {
            console.error('Nested errors:', error.errors.map(err => ({
                name: err.name,
                code: err.code,
                message: err.message
            })))
        }
    } finally {
        await pool.end()
    }
}

testConnection()
