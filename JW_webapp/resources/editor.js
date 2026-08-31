import {
    DEFAULT_DOCUMENT_ID,
    createDocument,
    createUser,
    getDocument,
    getDocuments,
    getSyncState,
    updateDocument,
    updateCursorChange,
    deleteDocument
} from '../db.js'

function serverError(res, message, error) {
    console.error(error)
    res.status(500).json({
        error: message,
        code: error.code || error.name || 'UNKNOWN'
    })
}

// Resolves which document a request is targeting.
// Looks for documentId on the query string (GET/DELETE) or the request body (POST/PUT).
// Falls back to DEFAULT_DOCUMENT_ID if it's missing or not a valid positive integer,
// so older/simpler requests without an explicit documentId still work.
function getDocumentId(req) {
    const documentId = Number(req.query.documentId || req.body?.documentId || DEFAULT_DOCUMENT_ID)

    if (!Number.isInteger(documentId) || documentId < 1) {
        return DEFAULT_DOCUMENT_ID
    }

    return documentId
}

// POST /app/users
// Creates a new user record from the name supplied on login. Rejects empty/missing
// names with a 400. Returns the created user (including its id) so the client can
// store it for future requests.
async function handleCreateUser(req, res) {
    try {
        const name = req.body.name ? req.body.name.trim() : ''

        if (!name) {
            return res.status(400).json({ error: 'Name is required' })
        }

        const user = await createUser(name)
        res.status(201).json(user)
    } catch (error) {
        serverError(res, 'Failed to create user', error)
    }
}

// GET /app/documents
// Returns every document in the database, used to populate the home screen's list of cards.
async function handleGetDocuments(req, res) {
    try {
        const documents = await getDocuments()
        res.json(documents)
    } catch (error) {
        serverError(res, 'Failed to get documents', error)
    }
}

// POST /app/document
// Creates a new, empty document with the given title (trimmed; blank if not provided).
async function handleCreateDocument(req, res) {
    try {
        const title = req.body.title ? req.body.title.trim() : ''
        const document = await createDocument(title)

        res.status(201).json(document)
    } catch (error) {
        serverError(res, 'Failed to create document', error)
    }
}

// GET /app/document
// Fetches a single document (by documentId, or the default document if none given).
// Responds with 404 if that document doesn't exist.
async function handleGetDocument(req, res) {
    try {
        const document = await getDocument(getDocumentId(req))

        if (!document) {
            return res.status(404).json({ error: 'Document not found' })
        }

        res.json(document)
    } catch (error) {
        serverError(res, 'Failed to get document', error)
    }
}

// PUT /app/document
// Saves new content (and optionally a new title) for a document.
// Requires userId, content, and baseVersion (the version the client last saw) —
// baseVersion is used for optimistic concurrency control: if the document has moved
// on to a newer version since the client last loaded it, updateDocument reports a
// conflict instead of overwriting someone else's newer edit.
// Responses:
//   404 - document doesn't exist
//   409 - conflict: baseVersion is stale; the current server copy is returned so the
//         client can reload it
//   200 - success: the freshly saved document is returned
async function handleUpdateDocument(req, res) {
    try {
        const { userId, content, baseVersion, title } = req.body
        const documentId = getDocumentId(req)

        if (!userId || typeof content !== 'string' || baseVersion === undefined || baseVersion === null) {
            return res.status(400).json({
                error: 'userId, content and baseVersion are required'
            })
        }

        const result = await updateDocument(
            documentId,
            Number(userId),
            content,
            Number(baseVersion),
            typeof title === 'string' ? title : null
        )

        if (result.status === 'not_found') {
            return res.status(404).json({ error: 'Document not found' })
        }

        if (result.status === 'conflict') {
            return res.status(409).json({
                error: 'Document has changed',
                document: result.document
            })
        }

        // return the full, up-to-date document
        const updated = await getDocument(documentId)
        res.json(updated)
    } catch (error) {
        serverError(res, 'Failed to update document', error)
    }
}

// POST /app/cursor
// Records where a given user's cursor/selection currently is within a document, so
// other clients polling /app/sync can display it. Responds 204 (no content) on success.
async function handleUpdateCursor(req, res) {
    try {
        const { userId, cursorStart, cursorEnd } = req.body
        const documentId = getDocumentId(req)

        if (!userId || cursorStart === undefined || cursorEnd === undefined) {
            return res.status(400).json({
                error: 'userId, cursorStart and cursorEnd are required'
            })
        }

        await updateCursorChange(
            Number(userId),
            documentId,
            Number(cursorStart),
            Number(cursorEnd)
        )

        res.status(204).send()
    } catch (error) {
        serverError(res, 'Failed to update cursor', error)
    }
}

// GET /app/sync
// The polling endpoint clients call on an interval (e.g. every second) to stay in
// sync. Returns the current document state together with the active users' cursor
// positions in one response, so the front end doesn't need separate requests.
// Responds 404 if the target document doesn't exist.
async function handleSync(req, res) {
    try {
        const syncState = await getSyncState(getDocumentId(req))

        if (!syncState.document) {
            return res.status(404).json({ error: 'Document not found' })
        }

        res.json(syncState)
    } catch (error) {
        serverError(res, 'Failed to sync document', error)
    }
}

// DELETE /app/document
// Deletes a document by id. Responds 404 if it doesn't exist, otherwise 204 on
// successful deletion.
async function handleDeleteDocument(req, res) {
    try {
        const documentId = getDocumentId(req)
        const deleted = await deleteDocument(documentId)

        if (!deleted) {
            return res.status(404).json({ error: 'Document not found' })
        }

        res.status(204).send()
    } catch (error) {
        serverError(res, 'Failed to delete document', error)
    }
}

export {
    handleCreateDocument,
    handleCreateUser,
    handleGetDocument,
    handleGetDocuments,
    handleSync,
    handleUpdateCursor,
    handleUpdateDocument,
    handleDeleteDocument
}
