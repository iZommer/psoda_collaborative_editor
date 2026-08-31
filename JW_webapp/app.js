// Main Express server for the collaborative editor REST API.

import express from 'express'
import {
    handleCreateDocument,
    handleCreateUser,
    handleGetDocument,
    handleGetDocuments,
    handleSync,
    handleUpdateCursor,
    handleUpdateDocument,
    handleDeleteDocument
} from './resources/editor.js'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.static('public'))

app.post('/app/users', handleCreateUser)
app.get('/app/document', handleGetDocument)
app.put('/app/document', handleUpdateDocument)
app.post('/app/document', handleCreateDocument)
app.get('/app/documents', handleGetDocuments)
app.delete('/app/document', handleDeleteDocument)
app.post('/app/cursor', handleUpdateCursor)
app.get('/app/sync', handleSync)

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
})