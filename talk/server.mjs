/**
 * Your server's part of an SSC+ Talk integration, and no more. No dependencies.
 *
 * - POST /api/sessions creates a Talk session with your tenant API key and gives
 *   the page only the session token. The key never leaves this server.
 * - GET /api/sessions/:id reads the result from SSC+, which the page asks for
 *   once the component has shown it. SSC+ sends no callbacks: your server fetches.
 *
 * It also serves the two pages: the Web Component at /, React at /react/.
 *
 * In your own service, keep the session id on your side, tied to the patient's
 * own session, rather than handing it to the page as this example does.
 */

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tenantKey = process.env.SSC_TENANT_KEY
const apiUrl = process.env.SSC_API_URL ?? 'https://api.dev.ssc-plus.com'
const voiceUrl = process.env.SSC_VOICE_URL ?? 'wss://api.dev.ssc-plus.com'
const port = Number(process.env.PORT ?? 8080)
// The page's origin. The session token works only from it.
const origin = process.env.ORIGIN ?? `http://localhost:${port}`

if (!tenantKey) {
  console.error('SSC_TENANT_KEY is not set: copy .env.example to .env and fill it in.')
  process.exit(1)
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function createSession(response) {
  const created = await fetch(`${apiUrl}/v1/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tenantKey}`,
      'Idempotency-Key': randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: 'voice_web',
      origin,
      customer_reference: 'ssc-plus-examples',
    }),
  })
  if (!created.ok) {
    console.error('creating the session failed:', created.status, await created.text())
    return send(response, 502, { error: 'session_not_created' })
  }
  const session = await created.json()
  send(response, 200, { session: session.id, token: session.session_token.token, voiceUrl })
}

async function readResult(response, id) {
  const read = await fetch(`${apiUrl}/v1/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${tenantKey}` },
  })
  if (!read.ok) return send(response, 502, { error: 'session_not_read' })
  const session = await read.json()
  // Your systems would take the whole result, summary for the professional
  // included. The page only shows that the server has it.
  send(response, 200, {
    status: session.status,
    triage_code: session.result?.triage_code ?? null,
    urgency: session.result?.urgency ?? null,
  })
}

async function servePage(response, path) {
  const file =
    path === '/' || path === '/index.html'
      ? join(here, 'web-component', 'index.html')
      : path.startsWith('/react')
        ? join(here, 'react', 'dist', normalize(path.slice('/react'.length) || '/').replace(/^\/$/, '/index.html'))
        : null
  if (!file || !file.startsWith(here)) return send(response, 404, { error: 'not_found' })
  try {
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    response.end(content)
  } catch {
    send(response, 404, { error: path.startsWith('/react') ? 'run npm run build first' : 'not_found' })
  }
}

createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', origin).pathname
  try {
    if (path === '/api/sessions' && request.method === 'POST') return await createSession(response)
    const reading = path.match(/^\/api\/sessions\/([\w-]+)$/)
    if (reading && request.method === 'GET') return await readResult(response, reading[1])
    if (request.method === 'GET') return await servePage(response, path)
    send(response, 405, { error: 'method_not_allowed' })
  } catch (error) {
    console.error(error)
    if (!response.headersSent) send(response, 500, { error: 'failed' })
  }
}).listen(port, () => {
  console.log(`Talk example on ${origin}: the Web Component at /, React at /react/`)
})
