import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..', 'dist', 'pwa')
const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 9100)
// Legacy Laravel API origin — all traffic now goes through Nest (/nest-api).
// /api is kept as a fallback pointing to Nest so nothing 502s.
const apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:3001'
const nestApiOrigin = process.env.NEST_API_ORIGIN || 'http://127.0.0.1:3001'

const certFile = process.env.TLS_CERT_FILE
const keyFile = process.env.TLS_KEY_FILE

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

async function serveFile(res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname
  const target = path.normalize(path.join(root, normalized))

  if (!target.startsWith(root)) {
    send(res, 403, 'Forbidden')
    return
  }

  let filePath = target

  try {
    const stat = await fsp.stat(filePath)
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      await fsp.stat(filePath)
    }
  } catch {
    filePath = path.join(root, 'index.html')
    await fsp.stat(filePath)
  }

  const ext = path.extname(filePath)
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' || ext === '.json' || pathname === '/sw.js'
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  }

  res.writeHead(200, headers)
  fs.createReadStream(filePath).pipe(res)
}

function proxyToOrigin(req, res, origin, errorLabel = 'Upstream API') {
  const upstream = new URL(req.url, origin)
  const transport = upstream.protocol === 'https:' ? https : http

  const proxyReq = transport.request(upstream, {
    method: req.method,
    headers: {
      ...req.headers,
      host: upstream.host,
      'x-forwarded-host': req.headers.host || upstream.host,
      'x-forwarded-proto': certFile && keyFile ? 'https' : 'http',
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (error) => {
    send(res, 502, `${errorLabel} error: ${error.message}`)
  })

  req.pipe(proxyReq)
}

function proxyApi(req, res) {
  proxyToOrigin(req, res, apiOrigin, 'Upstream API')
}

function proxyNestApi(req, res) {
  const originalUrl = req.url || ''
  req.url = originalUrl.replace(/^\/nest-api/, '/api') || '/api'
  proxyToOrigin(req, res, nestApiOrigin, 'Upstream Nest API')
}

function proxyNestStorage(req, res) {
  proxyToOrigin(req, res, nestApiOrigin, 'Upstream Nest Storage')
}

const requestHandler = async (req, res) => {
  try {
    if (!req.url) {
      send(res, 400, 'Bad Request')
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (url.pathname.startsWith('/nest-api')) {
      proxyNestApi(req, res)
      return
    }

    if (url.pathname.startsWith('/storage')) {
      proxyNestStorage(req, res)
      return
    }

    if (url.pathname.startsWith('/api')) {
      proxyApi(req, res)
      return
    }

    await serveFile(res, url.pathname)
  } catch (error) {
    send(res, 500, `Server error: ${error.message}`)
  }
}

const server = certFile && keyFile
  ? https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, requestHandler)
  : http.createServer(requestHandler)

server.listen(port, host, () => {
  console.log(`${certFile && keyFile ? 'HTTPS' : 'HTTP'} PWA prod server listening on ${certFile && keyFile ? 'https' : 'http'}://${host}:${port}`)
  console.log(`Serving static files from ${root}`)
  console.log(`Proxying /api to ${apiOrigin}`)
  console.log(`Proxying /nest-api to ${nestApiOrigin}`)
})
