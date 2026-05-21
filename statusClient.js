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

    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(this.url, {signal: controller.signal, cache: 'no-store'})
      clearTimeout(id)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (this.debug) console.log('Fetch', this.url, '->', res.status, JSON.stringify(data))
      // expect { on: boolean, app: string }
      const out = {on: !!data.on, app: data.app || ''}
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

module.exports = {StatusClient}
