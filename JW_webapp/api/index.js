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

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

app.post('/app/users', handleCreateUser)
app.get('/app/document', handleGetDocument)
app.put('/app/document', handleUpdateDocument)
app.post('/app/document', handleCreateDocument)
app.get('/app/documents', handleGetDocuments)
app.delete('/app/document', handleDeleteDocument)
app.post('/app/cursor', handleUpdateCursor)
app.get('/app/sync', handleSync)

export default app
