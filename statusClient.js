const fetch = require('node-fetch')

class StatusClient {
  constructor(url) {
    this.url = url
    this._last = null
  }

  async fetchStatus() {
    if (!this.url) return this._mockStatus()

    try {
      const res = await fetch(this.url, {cache: 'no-store', timeout: 5000})
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // expect { on: boolean, app: string }
      const out = {on: !!data.on, app: data.app || ''}
      this._last = out
      return out
    } catch (err) {
      console.warn('Failed to fetch status:', err.message)
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
