const DEFAULT_TIMEOUT = 5000

class StatusClient {
  constructor(url, timeoutMs = DEFAULT_TIMEOUT, debug = false) {
    this.url = url
    this._last = null
    this.timeoutMs = timeoutMs
    this.debug = !!debug
  }

  async fetchStatus() {
    if (!this.url) return this._mockStatus()

    // Normalize input: allow bare IP, host, host:port, or full URL
    const base = this._normalizeBase(this.url)

    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), this.timeoutMs)

      // Query device-info for power-mode
      const devRes = await fetch(`${base}/query/device-info`, {signal: controller.signal, cache: 'no-store'})
      const devText = await devRes.text()
      if (this.debug) console.log('Fetch', `${base}/query/device-info`, '->', devRes.status, devText)

      // Query active app (may 404)
      let appText = ''
      try {
        const appRes = await fetch(`${base}/query/active-app`, {signal: controller.signal, cache: 'no-store'})
        appText = await appRes.text()
        if (this.debug) console.log('Fetch', `${base}/query/active-app`, '->', appRes.status, appText)
      } catch (e) {
        if (this.debug) console.warn('Failed to fetch active-app:', e && e.message)
      }

      clearTimeout(id)

      // parse power-mode
      const pm = this._extractTag(devText, 'power-mode')
      const on = !!pm && /(poweron|headless)/i.test(pm)
      if (this.debug) console.log('[ROKU] parsed power-mode ->', JSON.stringify(pm), 'on=', on)

      // parse model name
      const model = this._extractTag(devText, 'model-name') || this._extractTag(devText, 'model') || ''
      if (this.debug && model) console.log('[ROKU] parsed model ->', JSON.stringify(model))

      // parse app name from active-app XML
      let app = ''
      if (appText) {
        const name = this._extractTag(appText, 'name')
        if (name) app = name.trim()
        else {
          const appMatch = appText.match(/<app[^>]*>([^<]+)<\/app>/i)
          if (appMatch) app = appMatch[1].trim()
        }
      }

      const out = {on, app, model}
      this._last = out
      return out
    } catch (err) {
      if (err.name === 'AbortError') console.warn('Failed to fetch status: request timed out')
      else console.warn('Failed to fetch status:', err.message)
      if (this.debug) console.error('Fetch error for', this.url, err)
      return this._last || {on: false, app: ''}
    }
  }

  // fallback mock toggler for local testing when no URL provided
  _mockStatus() {
    if (!this._last) {
      this._last = {on: true, app: 'SampleApp'}
      return this._last
    }
    // toggle
    this._last = {on: !this._last.on, app: this._last.on ? '' : 'SampleApp'}
    return this._last
  }
}

// helper methods
StatusClient.prototype._normalizeBase = function (raw) {
  let s = raw.trim()
  if (/^https?:\/\//i.test(s)) {
    return s.replace(/\/$/, '')
  }
  // bare IP or host with optional port
  if (/^[\d.]+(:\d+)?$/.test(s) || /^[^:\/]+:\d+$/.test(s) || /^[^:\/]+$/.test(s)) {
    // if port specified, keep it; otherwise default to 8060
    if (!s.includes(':')) s = `${s}:8060`
    return `http://${s}`
  }
  // otherwise attempt to use as-is with http
  return `http://${s}`
}

StatusClient.prototype._extractTag = function (xml, tag) {
  // try regex first
  const re = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i')
  const m = xml.match(re)
  if (m && m[1]) return m[1].trim()

  // fallback: find opening tag and closing tag using indexOf (more robust against weird spacing)
  const open = xml.toLowerCase().indexOf(`<${tag}`)
  if (open === -1) return ''
  const gt = xml.indexOf('>', open)
  if (gt === -1) return ''
  const closeTag = `</${tag}>`
  const close = xml.toLowerCase().indexOf(closeTag, gt)
  if (close === -1) return ''
  const content = xml.substring(gt + 1, close)
  return content.trim()
}

module.exports = {StatusClient}
