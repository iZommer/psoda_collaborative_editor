// Main Express server for the collaborative editor REST API.

import express from 'express'
import {
    handleCreateDocument,
    handleCreateUser,
    handleDatabaseHealth,
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

const routePaths = (path) => [path, `/api${path}`]

app.post(routePaths('/app/users'), handleCreateUser)
app.get(routePaths('/app/health/db'), handleDatabaseHealth)
app.get(routePaths('/app/document'), handleGetDocument)
app.put(routePaths('/app/document'), handleUpdateDocument)
app.post(routePaths('/app/document'), handleCreateDocument)
app.get(routePaths('/app/documents'), handleGetDocuments)
app.delete(routePaths('/app/document'), handleDeleteDocument)
app.post(routePaths('/app/cursor'), handleUpdateCursor)
app.get(routePaths('/app/sync'), handleSync)

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`)
    })
}

export default app
