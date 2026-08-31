// This file is the connection to the db
// it defines and exports all database functions

import path from 'node:path'
import pg from 'pg'
import dotenv from 'dotenv'

const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'resources', '.env')
]

for (const envPath of envCandidates) {
    dotenv.config({ path: envPath })
    if (process.env.DATABASE_URL) break
}

if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Add it to Vercel env vars or place a .env file in the project root or resources/.env')
}

const { Pool } = pg

const DB_SCHEMA = process.env.DB_SCHEMA || 'psoda'

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(DB_SCHEMA)) {
    throw new Error('DB_SCHEMA must be a valid PostgreSQL identifier')
}

const tables = {
    cursors: `${DB_SCHEMA}.cursors`,
    documentChanges: `${DB_SCHEMA}.document_changes`,
    documents: `${DB_SCHEMA}.documents`,
    users: `${DB_SCHEMA}.users`
}

// Connect to db
// DATABASE_URL should be your Neon connection string, e.g.
// postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/psoda?sslmode=require
// The Neon import in psoda_final.sql creates tables in the "psoda" schema.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${DB_SCHEMA},public`,
    enableChannelBinding: true,
    ssl: { rejectUnauthorized: false }
})

//if document table is empty, default first doc
const DEFAULT_DOCUMENT_ID = 1

// retrieves document by id
async function getDocument(documentId = DEFAULT_DOCUMENT_ID) {
    const { rows } = await pool.query(`
        SELECT id, title, content, version, updated_at
        FROM ${tables.documents}
        WHERE id = $1`, [documentId])

    return rows[0]
}

// retrieves all documents for the document picker page
async function getDocuments() {
    const { rows } = await pool.query(`
        SELECT id, title, version, created_at, updated_at
        FROM ${tables.documents}
        ORDER BY updated_at DESC, id DESC
    `)

    return rows
}

// creates a new document in the db
async function createDocument(title) {
    const safeTitle = title && title.trim() ? title.trim() : 'Untitled Document'
    const emptyDocument = JSON.stringify({ ops: [{ insert: '\n' }] })

    const { rows } = await pool.query(`
        INSERT INTO ${tables.documents} (title, content)
        VALUES ($1, $2)
        RETURNING id
    `, [safeTitle, emptyDocument])

    return getDocument(rows[0].id)
}

// used for post request to update changes to the document
async function updateDocument(documentId, userId, content, baseVersion, title = null) {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { rows: documents } = await client.query(`
            SELECT id, version
            FROM ${tables.documents}
            WHERE id = $1
            FOR UPDATE
        `, [documentId])

        const document = documents[0]

        if (!document) {
            await client.query('ROLLBACK')
            return { status: 'not_found' }
        }

        if (document.version !== baseVersion) {
            const { rows: latestDocuments } = await client.query(`
                SELECT id, title, content, version, updated_at
                FROM ${tables.documents}
                WHERE id = $1
            `, [documentId])

            await client.query('ROLLBACK')
            return {
                status: 'conflict',
                document: latestDocuments[0]
            }
        }

        const newVersion = document.version + 1

        if (title !== null && typeof title === 'string') {
            await client.query(`
                UPDATE ${tables.documents}
                SET content = $1, version = $2, title = $3
                WHERE id = $4
            `, [content, newVersion, title, documentId])
        } else {
            await client.query(`
                UPDATE ${tables.documents}
                SET content = $1, version = $2
                WHERE id = $3
            `, [content, newVersion, documentId])
        }

        await client.query(`
            INSERT INTO ${tables.documentChanges} (document_id, user_id, base_version, new_version, content)
            VALUES ($1, $2, $3, $4, $5)
        `, [documentId, userId, baseVersion, newVersion, content])

        await client.query('COMMIT')

        return {
            status: 'updated',
            document: {
                id: documentId,
                content,
                version: newVersion
            }
        }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

// add new user to db, or reuse the existing row for the same name
async function createUser(name) {
    const { rows: existingUsers } = await pool.query(`
        SELECT id, name
        FROM ${tables.users}
        WHERE name = $1
        LIMIT 1
    `, [name])

    if (existingUsers.length > 0) {
        return existingUsers[0]
    }

    const { rows } = await pool.query(`
        INSERT INTO ${tables.users} (name)
        VALUES ($1)
        RETURNING id
    `, [name])

    return {
        id: rows[0].id,
        name
    }
}

//stores where a users cursor was last
async function updateUserLastSeen(userId) {
    await pool.query(`
        UPDATE ${tables.users}
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [userId])
}

// updates the users cursor postion if it moves
// NOTE: this assumes a UNIQUE constraint on (user_id, document_id) in the cursors table,
// same as the old ON DUPLICATE KEY UPDATE relied on a unique key in MySQL.
async function updateCursorChange(userId, documentId, cursorStart, cursorEnd) {
    await pool.query(`
        INSERT INTO ${tables.cursors} (user_id, document_id, cursor_start, cursor_end)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, document_id) DO UPDATE
        SET cursor_start = EXCLUDED.cursor_start,
            cursor_end = EXCLUDED.cursor_end,
            updated_at = CURRENT_TIMESTAMP
    `, [userId, documentId, cursorStart, cursorEnd])

    await updateUserLastSeen(userId)
}

// gets all current users on the doc
async function getActiveCursors(documentId = DEFAULT_DOCUMENT_ID) {
    const { rows } = await pool.query(`
        SELECT
            users_table.id AS user_id,
            users_table.name,
            cursors_table.cursor_start,
            cursors_table.cursor_end,
            cursors_table.updated_at
        FROM ${tables.cursors} AS cursors_table
        JOIN ${tables.users} AS users_table ON users_table.id = cursors_table.user_id
        WHERE cursors_table.document_id = $1
          AND cursors_table.updated_at > NOW() - INTERVAL '30 seconds'
        ORDER BY users_table.name
    `, [documentId])

    return rows
}

//gets current doc with changes, and the current user cursors
async function getSyncState(documentId = DEFAULT_DOCUMENT_ID) {
    const [document, cursors] = await Promise.all([
        getDocument(documentId),
        getActiveCursors(documentId)
    ])

    return {
        document,
        cursors
    }
}

// deletes a document and cascades (cursors/document_changes are FK ON DELETE CASCADE)
async function deleteDocument(documentId) {
    const { rowCount } = await pool.query(`
        DELETE FROM ${tables.documents}
        WHERE id = $1
    `, [documentId])

    return rowCount > 0
}

export {
    DEFAULT_DOCUMENT_ID,
    createDocument,
    createUser,
    getDocument,
    getDocuments,
    getSyncState,
    updateDocument,
    updateCursorChange,
    deleteDocument
}
