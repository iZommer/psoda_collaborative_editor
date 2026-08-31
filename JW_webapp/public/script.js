document.addEventListener("DOMContentLoaded", async function () {

// THEME SWITCHING FUNCTIONS
    const themeToggle = document.getElementById('themeToggle')

    // Applies the given theme ('light' or 'dark') to the whole page by setting a
    // data attribute on <html>, updates the toggle button icon, and remembers the
    // choice in localStorage so it persists across page reloads.
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme)
        if (themeToggle) themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙'
        localStorage.setItem('theme', theme)
    }

    // On load, use the previously saved theme if there is one, otherwise default to 'light'.
    const savedTheme = localStorage.getItem('theme') || 'light'
    applyTheme(savedTheme)

    // Clicking the toggle button flips between light and dark themes.
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme')
            applyTheme(current === 'dark' ? 'light' : 'dark')
        })
    }

    // Variable Declaration 
    // References to the main sections/elements of the page (login, editor, home screen, etc.)
    const loginSection = document.getElementById('loginSection')
    const editorSection = document.getElementById('editorSection')
    const nameInput = document.getElementById('nameInput')
    const joinBtn = document.getElementById('joinBtn')
    const saveBtn = document.getElementById('save_btn')
    const activeUsers = document.getElementById('activeUsers')
    const documentTitleEl = document.getElementById('documentTitle')
    const newDocBtnHome = document.getElementById('newDocBtnHome')
    const homeSection = document.getElementById('homeSection')
    const documentListEl = document.getElementById('documentList')
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : '/api'
    const apiUrl = (path) => `${API_BASE}${path}`

    // Quill editor instance and state used to track the current document/user/session.
    let quill
    let currentVersion       // version number of the document currently loaded, used for conflict detection on save
    let currentUserId
    let currentUserName
    let currentDocumentId = null
    let saveTimer = null     // debounce timer: delays autosave until typing pauses
    let syncTimer = null     // interval timer: polls the server for updates while editing
    let isSaving = false     // guards against overlapping save requests
    let saveQueued = false   // set when a save is requested while one is already in flight
    let isLoadingRemoteChange = false // true while applying a remote update, to avoid re-triggering save/cursor logic
    let cursorModule         // reference to the Quill "cursors" module, used to render other users' cursors
    const remoteCursorIds = new Set() // tracks which remote users currently have a visible cursor in the editor

    // Link to Psoda logo 
    const logoLink = document.getElementById('logoLink')

    // resets home screen, back to document default page 
    // Stops any in-progress editor polling/saving, clears remote cursors, hides the
    // editor/login views, shows the home (document list) view, and refreshes the list.
    async function goHome() {
        // stop the polling that only makes sense while editing
        clearInterval(syncTimer)
        clearTimeout(saveTimer)

        // reset cursor tracking so switching back into a doc later starts clean
        if (cursorModule) {
            remoteCursorIds.forEach(id => cursorModule.removeCursor(id))
        }
        remoteCursorIds.clear()

        editorSection.classList.add('hidden')
        loginSection.classList.add('hidden')
        homeSection.classList.remove('hidden')

        await loadDocumentList()
    }
    // When clicking psoda logo go back to home screen
    if (logoLink) {
        logoLink.addEventListener('click', function (e) {
            e.preventDefault()
            goHome()
        })
    }

    // Register the optional quill-cursors plugin (used to show other users' live
    // cursor positions). If it isn't loaded, the app still works, just without that visual.
    if (window.QuillCursors) {
        Quill.register('modules/cursors', window.QuillCursors)
    } else {
        console.warn('quill-cursors did not load, so visual cursors will not show')
    }

    // Pre-fill the name field from a previous session, if the browser has one saved.
    const savedUserName = localStorage.getItem('userName')

    if (savedUserName) {
        nameInput.value = savedUserName
    }

    // Save button, forces save rather than waiting for automatic updates 
    // Cancels any pending autosave timer and saves immediately.
    saveBtn.addEventListener('click', function () {
        clearTimeout(saveTimer)
        saveDocument()
    })


    // Creates a new document when new doc button is pressed. Sends POST to server
    if (newDocBtnHome) {
        newDocBtnHome.addEventListener('click', async function () {
            // Ask the user for a title (browser prompt); cancel if they close the dialog.
            const title = prompt('New document title', 'Untitled Document')
            if (title === null) return

            try {
                // Create the new document record on the server.
                const res = await fetch(apiUrl('/app/document'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: String(title) })
                })

                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const doc = await res.json()
                currentDocumentId = doc.id
                await loadDocumentList()

                if (currentUserId) {
                    // Already logged in: jump straight into editing the new document.
                    await loadDocument(currentDocumentId)
                    documentTitleEl.focus()
                    await showEditor()
                } else {
                    // move to login so the user can join before editing
                    homeSection.classList.add('hidden')
                    loginSection.classList.remove('hidden')
                    nameInput.focus()
                }
            } catch (err) {
                console.error('Failed creating document', err)
                alert('Could not create document')
            }
        })
    }

    // Loads a document when clicked on 
    // Fetches a document (by id, or the current one if none given) from the server
    // and applies its content/version into the editor via setDocumentContent.
    async function loadDocument(documentId = null) {
        try {
            if (!documentId) documentId = currentDocumentId
            const url = documentId ? `${apiUrl('/app/document')}?documentId=${encodeURIComponent(documentId)}` : apiUrl('/app/document')
            const response = await fetch(url)

            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const documentData = await response.json()
            currentDocumentId = documentData.id
            setDocumentContent(documentData)
        } catch (error) {
            console.error('Error loading document:', error)
            alert('Could not load document')
        }
    }

    // gets all documents in the db to load document cards 
    // Fetches the list of all documents (for the home screen) and renders them as cards.
    async function loadDocumentList() {
        try {
            const res = await fetch(apiUrl('/app/documents'))
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const docs = await res.json()
            renderDocumentList(docs)
        } catch (err) {
            console.error('Failed loading document list', err)
        }
    }

    // This function creates the document cards on the homescreen, each card is clickable.
    // Builds one card per document with: a title button (opens the doc), a "last
    // updated" timestamp, and a delete button. Clicking anywhere on the card (except
    // delete) opens the document.
    function renderDocumentList(docs) {
        documentListEl.innerHTML = ''
        if (!docs || docs.length === 0) {
            documentListEl.textContent = 'No documents yet'
            return
        }

        docs.forEach(d => {
            const card = document.createElement('div')
            card.className = 'doc-item'

            const titleBtn = document.createElement('button')
            titleBtn.type = 'button'
            titleBtn.className = 'doc-open'
            titleBtn.textContent = `${d.title || 'Untitled'}`

            const meta = document.createElement('div')
            meta.className = 'doc-meta'
            meta.textContent = `Updated ${new Date(d.updated_at).toLocaleString()}`

            const deleteBtn = document.createElement('button')
            deleteBtn.type = 'button'
            deleteBtn.className = 'doc-delete secondary'
            deleteBtn.textContent = 'Delete'
            deleteBtn.addEventListener('click', async function (e) {
                e.stopPropagation()
                // popup message to user 
                if (!confirm(`Delete "${d.title || 'Untitled'}"? This cannot be undone.`)) return

                try {
                    // Ask the server to delete this document.
                    const res = await fetch(`${apiUrl('/app/document')}?documentId=${encodeURIComponent(d.id)}`, { method: 'DELETE' })
                    if (res.status === 404) {
                        alert('Document not found')
                        await loadDocumentList()
                        return
                    }
                    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)

                    // if currently viewing this document, clear and show home
                    if (currentDocumentId === d.id) {
                        currentDocumentId = null
                        if (quill) quill.setText('\n', 'silent')
                        editorSection.classList.add('hidden')
                        homeSection.classList.remove('hidden')
                    }

                    await loadDocumentList()
                } catch (err) {
                    console.error('Failed deleting document', err)
                    alert('Could not delete document')
                }
            })

            // shared open logic so both card and title button open the document
            // If the user hasn't entered a name yet, remember which document was
            // picked and send them to the login screen first; otherwise load and
            // show the editor straight away.
            async function openDocument() {
                
                if (!currentUserId) {
                    currentDocumentId = d.id
                    homeSection.classList.add('hidden')
                    loginSection.classList.remove('hidden')
                    nameInput.focus()
                    return
                }

                await loadDocument(d.id)
                await showEditor()
            }

            titleBtn.addEventListener('click', function (e) { e.stopPropagation(); openDocument() })
            card.addEventListener('click', openDocument)

            card.appendChild(titleBtn)
            card.appendChild(meta)
            card.appendChild(deleteBtn)
            documentListEl.appendChild(card)
        })
    }

    
    // Applies a document's data (title, version, content) to the UI/editor.
    // Used both for the initial load and whenever a newer version arrives from sync.
    // Carefully preserves the user's current cursor selection (clamped to the new
    // content length) so their cursor doesn't jump around when remote edits come in.
    function setDocumentContent(documentData) {
        currentVersion = documentData.version

        // update title
        if (documentTitleEl) {
            documentTitleEl.textContent = documentData.title || 'Untitled Document'
        }

        if (!documentData.content || !quill) return

        const currentSelection = quill.getSelection()
        // Suppress the text-change/selection-change handlers while we programmatically
        // set content below, so this doesn't get treated as a local edit (which would
        // otherwise trigger an autosave or cursor update).
        isLoadingRemoteChange = true

        try {
            // Content is stored as a Quill "delta" (JSON); parse and apply it directly.
            const delta = JSON.parse(documentData.content)
            quill.setContents(delta, 'silent')
        } catch (error) {
            // Fallback for non-JSON/plain text content.
            quill.setText(documentData.content, 'silent')
        }

        if (currentSelection) {
            // Clamp the previous selection to fit within the newly loaded content,
            // in case the content is now shorter than before.
            const editorLength = quill.getLength()
            const selectionIndex = Math.min(currentSelection.index, editorLength - 1)
            const selectionLength = Math.min(currentSelection.length, editorLength - selectionIndex - 1)

            quill.setSelection(selectionIndex, Math.max(selectionLength, 0), 'silent')
        }

        isLoadingRemoteChange = false
    }

    // Sends the current editor content to the server to be saved.
    // Uses currentVersion as an optimistic-concurrency check: if the server's version
    // has moved on since we last loaded, it responds with a 409 conflict and the
    // latest document instead of overwriting someone else's newer changes.
    // Also guards against overlapping save calls (isSaving/saveQueued) so that a
    // save triggered while another is still in flight runs again afterwards instead
    // of firing concurrently.
    async function saveDocument() {
        if (!currentUserId || !currentDocumentId) return

        if (isSaving) {
            saveQueued = true
            return
        }

        isSaving = true
        const content = JSON.stringify(quill.getContents())

        try {
            const res = await fetch(apiUrl('/app/document'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: currentDocumentId,
                    userId: currentUserId,
                    content: content,
                    baseVersion: currentVersion
                })
            })

            const data = await res.json()

            if (res.status === 200) {
                // server returns fresh document
                currentVersion = data.version
                if (data.title && documentTitleEl) documentTitleEl.textContent = data.title
                console.log('Saved, new version:', currentVersion)
            } else if (res.status === 409) {
                // Someone else saved first — take the server's version instead of overwriting it.
                console.warn('Conflict: document changed on server', data.document)
                handleConflict(data.document)
            } else {
                console.error('Save error:', res.status, data.error)
            }
        } catch (err) {
            console.error('Save request failed:', err)
        } finally {
            isSaving = false

            // If another save was requested while this one was running, run it now.
            if (saveQueued) {
                saveQueued = false
                saveDocument()
            }
        }
    }

    // Saves an edited document title back to the server (also sends current content
    // and baseVersion, since the title-save endpoint is the same PUT /app/document route).
    // Triggered on blur or pressing Enter in the title field.
    async function saveTitle() {
        if (!currentUserId || !currentDocumentId || !quill) return
        const newTitle = documentTitleEl.textContent.trim()
        const content = JSON.stringify(quill.getContents())

        try {
            const res = await fetch(apiUrl('/app/document'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: currentDocumentId,
                    userId: currentUserId,
                    content: content,
                    baseVersion: currentVersion,
                    title: newTitle
                })
            })

            if (!res.ok) {
                if (res.status === 409) {
                    const data = await res.json()
                    handleConflict(data.document)
                } else {
                    console.error('Title save failed', res.status)
                }
                return
            }

            const data = await res.json()
            // server returns full updated document
            currentVersion = data.version
            documentTitleEl.textContent = data.title || newTitle
            await loadDocumentList()
        } catch (err) {
            console.error('Failed saving title', err)
        }
    }

    // Called when a save attempt conflicts with a newer version on the server.
    // Simply reloads the editor with the server's current copy instead of losing it.
    function handleConflict(serverDocument) {
        setDocumentContent(serverDocument)
    }

    // Sends this user's current cursor/selection position to the server so other
    // connected users can see where they are in the document.
    async function saveCursor(range) {
        if (!currentUserId) return

        const cursorStart = range ? range.index : 0
        const cursorEnd = range ? range.index + range.length : 0

        try {
            const body = {
                userId: currentUserId,
                documentId: currentDocumentId,
                cursorStart: cursorStart,
                cursorEnd: cursorEnd
            }

            const response = await fetch(apiUrl('/app/cursor'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!response.ok) throw new Error(`HTTP ${response.status}`)
        } catch (error) {
            console.error('Error saving cursor:', error)
        }
    }

    // Renders the "who's currently active" list from the latest cursor/user data
    // returned by the sync endpoint. Highlights the current user with "(you)".
    function showActiveUsers(cursors) {
        activeUsers.innerHTML = ''

        if (cursors.length === 0) {
            activeUsers.textContent = 'No active users yet'
            return
        }

        cursors.forEach(function (cursor) {
            const userDiv = document.createElement('div')
            userDiv.className = 'active-user'

            // set the dot colour to match this user's cursor colour
            userDiv.style.setProperty('--user-color', getCursorColor(cursor.user_id))

            if (cursor.user_id === currentUserId) {
                userDiv.classList.add('is-you')
                userDiv.textContent = cursor.name + ' (you)'
            } else {
                userDiv.textContent = cursor.name
            }

            activeUsers.appendChild(userDiv)
        })
    }

    // Picks a consistent display colour for a given user id from a fixed palette,
    // so the same user always shows the same colour for their cursor/active-user dot.
    function getCursorColor(userId) {
        const colors = ['#E87817', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#0891B2', '#DB2777']
        return colors[userId % colors.length]
    }

    // Draws (or updates/removes) other users' live cursors inside the Quill editor,
    // using the quill-cursors module. Skips the current user's own cursor. Cursor
    // positions are clamped to the current document length to avoid errors if the
    // document has since gotten shorter. Any cursor not present in this update is removed.
    function showRemoteCursors(cursors) {
        if (!cursorModule) return

        const seenCursorIds = new Set()
        const editorLength = quill.getLength()

        cursors.forEach(function (cursor) {
            if (cursor.user_id === currentUserId) return

            const cursorId = String(cursor.user_id)
            const cursorStart = Math.min(cursor.cursor_start, editorLength - 1)
            const cursorEnd = Math.min(cursor.cursor_end, editorLength - 1)
            const cursorLength = Math.max(cursorEnd - cursorStart, 0)

            seenCursorIds.add(cursorId)

            if (!remoteCursorIds.has(cursorId)) {
                cursorModule.createCursor(cursorId, cursor.name, getCursorColor(cursor.user_id))
                remoteCursorIds.add(cursorId)
            }

            cursorModule.moveCursor(cursorId, {
                index: cursorStart,
                length: cursorLength
            })

            cursorModule.toggleFlag(cursorId, true)
        })

        // Remove cursors for any users who were shown before but are no longer present.
        remoteCursorIds.forEach(function (cursorId) {
            if (!seenCursorIds.has(cursorId)) {
                cursorModule.removeCursor(cursorId)
                remoteCursorIds.delete(cursorId)
            }
        })
    }

    // Polls the server for the latest document + cursor state (this is the
    // short-polling "sync" mechanism — see /app/sync). Updates the active users
    // list, redraws remote cursors, and — if the server has a newer version and we
    // aren't in the middle of saving — refreshes the editor content.
    async function syncState() {
        try {
            const url = currentDocumentId ? `${apiUrl('/app/sync')}?documentId=${encodeURIComponent(currentDocumentId)}` : apiUrl('/app/sync')
            const response = await fetch(url)

            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const data = await response.json()
            showActiveUsers(data.cursors)
            showRemoteCursors(data.cursors)

            if (data.document && data.document.version !== currentVersion && !isSaving && !saveQueued) {
                setDocumentContent(data.document)
            }
        } catch (error) {
            console.error('Error syncing document:', error)
        }
    }

    // Switches the UI into the document editor view. Sets up the Quill instance
    // (only once, the first time this runs) with its cursors module and toolbar,
    // wires up autosave-on-type and cursor-broadcast-on-selection-change, loads the
    // current document, and starts the periodic sync polling.
    async function showEditor() {
        // hide home and login, show editor
        homeSection.classList.add('hidden')
        loginSection.classList.add('hidden')
        editorSection.classList.remove('hidden')

        if (!quill) {
            quill = new Quill('#documentEditor', {
                theme: 'snow',
                modules: {
                    cursors: window.QuillCursors ? {
                        transformOnTextChange: true,
                        hideDelayMs: 1500,   // flag disappears 1.5s after cursor stops moving
                        hideSpeedMs: 200     // fade-out duration
                    } : false,
                    toolbar: true
                }
            })

            cursorModule = window.QuillCursors ? quill.getModule('cursors') : null

            // On every local text change: broadcast the new cursor position and
            // debounce an autosave (waits 500ms after the last keystroke before saving).
            // Skipped while a remote update is being applied (isLoadingRemoteChange),
            // so incoming changes don't get mistaken for local edits.
            quill.on('text-change', function () {
                if (isLoadingRemoteChange) return

                saveCursor(quill.getSelection())
                clearTimeout(saveTimer)
                saveTimer = setTimeout(saveDocument, 500)
            })

            // Broadcast cursor position on selection changes caused by the user
            // (e.g. clicking or using arrow keys), not on programmatic changes.
            quill.on('selection-change', function (range, oldRange, source) {
                if (source === 'user') {
                    saveCursor(range)
                }
            })
        }

        await loadDocument()
        await saveCursor(quill.getSelection())
        await syncState()

        // Start polling the sync endpoint every second while the editor is open.
        clearInterval(syncTimer)
        syncTimer = setInterval(syncState, 1000)
    }

    // Handles the "Join" button on the login screen: registers/looks up the user by
    // name, stores their id/name locally for future visits, then either opens the
    // document that was pre-selected (e.g. from the home screen) or shows the home
    // document picker if none was chosen yet.
    joinBtn.addEventListener('click', async function () {
        const name = nameInput.value.trim()

        if (!name) {
            alert('Please enter your name')
            return
        }

        try {
            const response = await fetch(apiUrl('/app/users'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            })

            if (!response.ok) {
                let details = {}
                try {
                    details = await response.json()
                } catch (err) {
                    details = { error: await response.text().catch(() => '') }
                }

                throw new Error(`HTTP ${response.status}: ${details.error || 'Request failed'} (${details.code || 'NO_CODE'})`)
            }

            const user = await response.json()
            currentUserId = Number(user.id)
            currentUserName = user.name

            localStorage.setItem('userId', user.id)
            localStorage.setItem('userName', user.name)

            // After providing name: if a document was pre-selected, open it; else show the home picker
            if (currentDocumentId) {
                await loadDocument(currentDocumentId)
                await showEditor()
            } else {
                await loadDocumentList()
                homeSection.classList.remove('hidden')
                loginSection.classList.add('hidden')
                editorSection.classList.add('hidden')
            }
        } catch (error) {
            console.error('Error creating user:', error)
            alert('Could not join the editor')
        }
    })

    // initial load: always require name before showing documents
    // Pre-fills the name field if we have one from a previous visit, but always
    // shows the login screen first rather than skipping straight to the documents —
    // per the requirement that users must supply their name before editing.
    try {
        const storedName = localStorage.getItem('userName')
        // prefill name if previously stored, but always require explicit entry
        if (storedName) {
            nameInput.value = storedName
        }

        // show login screen first per requirements
        homeSection.classList.add('hidden')
        loginSection.classList.remove('hidden')
        editorSection.classList.add('hidden')
        nameInput.focus()
    } catch (err) {
        console.error('Failed initial load', err)
    }

    // save title when edited (blur or Enter)
    // Persists the document title when the user clicks away from the title field,
    // or when they press Enter (which blurs the field, triggering the same save).
    if (documentTitleEl) {
        documentTitleEl.addEventListener('blur', saveTitle)
        documentTitleEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault()
                documentTitleEl.blur()
            }
        })
    }
})
