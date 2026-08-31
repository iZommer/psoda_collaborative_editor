// This file is the connection to the db 
// it defines and exports all database functions 

import mysql from 'mysql2'
import dotenv from 'dotenv'

dotenv.config()

// Connect to db
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise()

//if document table is empty, default first doc
const DEFAULT_DOCUMENT_ID = 1

// retrieves document by id 
async function getDocument(documentId = DEFAULT_DOCUMENT_ID) {
    const [rows] = await pool.query(`
        SELECT id, title, content, version, updated_at
        FROM documents
        WHERE id = ?`, [documentId])

    return rows[0]
}

// retrieves all documents for the document picker page
async function getDocuments() {
    const [rows] = await pool.query(`
        SELECT id, title, version, created_at, updated_at
        FROM documents
        ORDER BY updated_at DESC, id DESC
    `)

    return rows
}

// creates a new document in the db
async function createDocument(title) {
    const safeTitle = title && title.trim() ? title.trim() : 'Untitled Document'
    const emptyDocument = JSON.stringify({ ops: [{ insert: '\n' }] })

    const [result] = await pool.query(`
        INSERT INTO documents (title, content)
        VALUES (?, ?)
    `, [safeTitle, emptyDocument])

    return getDocument(result.insertId)
}

// used for post request to update changes to the document
async function updateDocument(documentId, userId, content, baseVersion, title = null) {
    const connection = await pool.getConnection()

    try {
        await connection.beginTransaction()

        const [documents] = await connection.query(`
            SELECT id, version
            FROM documents
            WHERE id = ?
            FOR UPDATE
        `, [documentId])

        const document = documents[0]

        if (!document) {
            await connection.rollback()
            return { status: 'not_found' }
        }

        if (document.version !== baseVersion) {
            const [latestDocuments] = await connection.query(`
                SELECT id, title, content, version, updated_at
                FROM documents
                WHERE id = ?
            `, [documentId])

            await connection.rollback()
            return {
                status: 'conflict',
                document: latestDocuments[0]
            }
        }

        const newVersion = document.version + 1

        if (title !== null && typeof title === 'string') {
            await connection.query(`
                UPDATE documents
                SET content = ?, version = ?, title = ?
                WHERE id = ?
            `, [content, newVersion, title, documentId])
        } else {
            await connection.query(`
                UPDATE documents
                SET content = ?, version = ?
                WHERE id = ?
            `, [content, newVersion, documentId])
        }

        await connection.query(`
            INSERT INTO document_changes (document_id, user_id, base_version, new_version, content)
            VALUES (?, ?, ?, ?, ?)
        `, [documentId, userId, baseVersion, newVersion, content])

        await connection.commit()

        return {
            status: 'updated',
            document: {
                id: documentId,
                content,
                version: newVersion
            }
        }
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

// add new user to db, or reuse the existing row for the same name
async function createUser(name) {
    const [existingUsers] = await pool.query(`
        SELECT id, name
        FROM users
        WHERE name = ?
        LIMIT 1
    `, [name])

    if (existingUsers.length > 0) {
        return existingUsers[0]
    }

    const [result] = await pool.query(`
        INSERT INTO users (name)
        VALUES (?)
    `, [name])

    return {
        id: result.insertId,
        name
    }
}

//stores where a users cursor was last
async function updateUserLastSeen(userId) {
    await pool.query(`
        UPDATE users
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [userId])
}

// updates the users cursor postion if it moves
async function updateCursorChange(userId, documentId, cursorStart, cursorEnd) {
    await pool.query(`
        INSERT INTO cursors (user_id, document_id, cursor_start, cursor_end)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cursor_start = VALUES(cursor_start),
            cursor_end = VALUES(cursor_end),
            updated_at = CURRENT_TIMESTAMP
    `, [userId, documentId, cursorStart, cursorEnd])

    await updateUserLastSeen(userId)
}

// gets all current users on the doc 
async function getActiveCursors(documentId = DEFAULT_DOCUMENT_ID) {
    const [rows] = await pool.query(`
        SELECT
            users.id AS user_id,
            users.name,
            cursors.cursor_start,
            cursors.cursor_end,
            cursors.updated_at
        FROM cursors
        JOIN users ON users.id = cursors.user_id
        WHERE cursors.document_id = ?
          AND cursors.updated_at > DATE_SUB(NOW(), INTERVAL 30 SECOND)
        ORDER BY users.name
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
    const [result] = await pool.query(`
        DELETE FROM documents
        WHERE id = ?
    `, [documentId])

    return result.affectedRows > 0
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
