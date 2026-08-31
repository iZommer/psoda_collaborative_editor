import express from 'express'
import path from 'node:path'
import {
    handleCreateDocument,
    handleCreateUser,
    handleGetDocument,
    handleGetDocuments,
    handleSync,
    handleUpdateCursor,
    handleUpdateDocument,
    handleDeleteDocument
} from '../resources/editor.js'

const app = express()

app.use(express.json())
app.use(express.static(path.join(process.cwd(), 'public')))

app.get(['/api', '/api/'], (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

app.post('/api/app/users', handleCreateUser)
app.get('/api/app/document', handleGetDocument)
app.put('/api/app/document', handleUpdateDocument)
app.post('/api/app/document', handleCreateDocument)
app.get('/api/app/documents', handleGetDocuments)
app.delete('/api/app/document', handleDeleteDocument)
app.post('/api/app/cursor', handleUpdateCursor)
app.get('/api/app/sync', handleSync)

export default app
