const express = require('express')
require('dotenv').config()

const app = express()
const PORT = process.env.UI_PORT || 3000
const TV_HOST = process.env.TV_HOST || process.env.STATUS_URL || ''
const TIMEOUT_MS = 5000

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
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const r = await fetch(url, {method: 'POST', signal: controller.signal})
    clearTimeout(id)
    if (!r.ok) return res.status(502).json({error: `HTTP ${r.status}`})
    return res.json({ok: true})
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({error: 'timeout'})
    return res.status(500).json({error: err.message})
  }
})

app.listen(PORT, () => console.log(`TV UI listening on http://localhost:${PORT}`))
