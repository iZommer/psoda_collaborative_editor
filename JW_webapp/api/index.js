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

app.get(['/api', '/api/'], (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

const routePaths = (path) => [path, `/api${path}`]

app.post(routePaths('/app/users'), handleCreateUser)
app.get(routePaths('/app/document'), handleGetDocument)
app.put(routePaths('/app/document'), handleUpdateDocument)
app.post(routePaths('/app/document'), handleCreateDocument)
app.get(routePaths('/app/documents'), handleGetDocuments)
app.delete(routePaths('/app/document'), handleDeleteDocument)
app.post(routePaths('/app/cursor'), handleUpdateCursor)
app.get(routePaths('/app/sync'), handleSync)

export default app
