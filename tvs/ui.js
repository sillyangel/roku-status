const express = require('express')
require('dotenv').config()

const app = express()
const PORT = process.env.UI_PORT || 3000
const TV_HOST = process.env.TV_HOST || process.env.STATUS_URL || ''
const TIMEOUT_MS = 5000
const TRUST_PROXY = (process.env.TRUST_PROXY || 'false').toLowerCase() === 'true'
const LOG_PATH = process.env.TV_UI_LOG || `${__dirname}/requests.log`

if (TRUST_PROXY) app.set('trust proxy', true)

const fs = require('fs')
const path = require('path')
// ensure log directory exists
try {
  const dir = path.dirname(LOG_PATH)
  fs.mkdirSync(dir, {recursive: true})
} catch (e) {}

app.use(express.static('tvs/public'))
app.use(express.json())

function normalizeBase(raw) {
  if (!raw) return ''
  let s = raw.trim()
  if (/^https?:\/\//i.test(s)) return s.replace(/\/$/, '')
  if (!s.includes(':')) s = `${s}:8060`
  return `http://${s}`
}

app.post('/roku/off', async (req, res) => {
  const base = normalizeBase(TV_HOST)
  if (!base) return res.status(400).json({error: 'TV_HOST or STATUS_URL not set'})
  const url = `${base}/keypress/Power`

  // determine caller IP (respecting X-Forwarded-For when trust proxy enabled)
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.ip

  const logEntry = (obj) => {
    const line = JSON.stringify(Object.assign({ts: new Date().toISOString(), ip, url}, obj)) + '\n'
    fs.appendFile(LOG_PATH, line, () => {})
  }

  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const r = await fetch(url, {method: 'POST', signal: controller.signal})
    clearTimeout(id)
    if (!r.ok) {
      logEntry({action: 'power-off', ok: false, status: r.status})
      return res.status(502).json({error: `HTTP ${r.status}`, ip})
    }
    logEntry({action: 'power-off', ok: true})
    return res.json({ok: true, ip})
  } catch (err) {
    if (err.name === 'AbortError') {
      logEntry({action: 'power-off', ok: false, error: 'timeout'})
      return res.status(504).json({error: 'timeout', ip})
    }
    logEntry({action: 'power-off', ok: false, error: err.message})
    return res.status(500).json({error: err.message, ip})
  }
})

app.listen(PORT, () => console.log(`TV UI listening on http://localhost:${PORT}`))
