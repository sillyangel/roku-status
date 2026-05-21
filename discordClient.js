const WebSocket = require('ws')

class DiscordClient {
  constructor(debug = false) {
    // compatibility: second arg imageUrl and third arg clientId may be provided; handled below
    const imageUrl = arguments[1]
    const clientId = arguments[2]
    this.ws = null
    this.heartbeatInterval = null
    this.heartbeatTimer = null
    this.seq = null
    this.sessionId = null
    this.connected = false
    this.debug = !!debug
    this.imageUrl = imageUrl || ''
    this.clientId = clientId || ''
    this.processedImage = null
    this.startedAt = null // epoch ms when device powered on
  }

  connect(token) {
    // store token for later API calls
    this.token = token

    return new Promise((resolve, reject) => {
      if (!token) return reject(new Error('DISCORD_TOKEN is required'))

      const url = 'wss://gateway.discord.gg/?v=10&encoding=json'
      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        this.connected = true
        console.log('Connected to Discord gateway')
      })

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (this.debug) console.log('GW <-', JSON.stringify(msg))
          this.handleMessage(msg, token)
        } catch (err) {
          console.warn('Failed to parse gateway message', err)
        }
      })

      this.ws.on('close', (code, reason) => {
        console.log('Gateway closed', code, reason && reason.toString())
        this.cleanup()
      })

      this.ws.on('error', (err) => {
        console.error('Gateway error', err)
      })

      // resolve when READY is received (session established)
      const readyHandler = (msg) => {
        if (msg && msg.t === 'READY') {
          resolve()
        }
      }
      // temporary listener
      this._resolveReady = readyHandler
    })
  }

  handleMessage(msg, token) {
    const {op, d, s, t} = msg
    if (s) this.seq = s

    switch (op) {
      case 10: // Hello
        this.startHeartbeat(d.heartbeat_interval)
        this.identify(token)
        break
      case 0: // Dispatch
        if (t === 'READY') {
          this.sessionId = d.session_id
          if (this._resolveReady) this._resolveReady(msg)
        }
        break
      case 1: // Heartbeat request
        this.sendHeartbeat()
        break
      case 11: // Heartbeat ACK
        // ignore
        break
      default:
        break
    }
  }

  startHeartbeat(intervalMs) {
    this.heartbeatInterval = intervalMs
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), intervalMs)
  }

  sendHeartbeat() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const payload = {op: 1, d: this.seq || null}
    this.ws.send(JSON.stringify(payload))
  }

  identify(token) {
    const payload = {
      op: 2,
      d: {
        token,
        intents: 0,
        properties: {os: 'linux', browser: 'roku-discord-status', device: 'roku-discord-status'}
      }
    }
    this.ws.send(JSON.stringify(payload))
  }

  

  async processImageIfNeeded() {
    if (!this.imageUrl || this.processedImage) return
    if (!this.clientId || !this.token) {
      if (this.debug) console.warn('[DISCORD] missing clientId or token, cannot upload image')
      return
    }

    try {
      const body = JSON.stringify({urls: [this.imageUrl]})
      const res = await fetch(`https://discord.com/api/v9/applications/${this.clientId}/external-assets`, {
        method: 'POST',
        headers: {Authorization: this.token, 'Content-Type': 'application/json'},
        body
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data) && data[0] && data[0].external_asset_path) {
        this.processedImage = `mp:${data[0].external_asset_path}`
        if (this.debug) console.log('[DISCORD] uploaded image ->', this.processedImage)
      } else {
        if (this.debug) console.warn('[DISCORD] unexpected response uploading image', JSON.stringify(data))
      }
    } catch (err) {
      if (this.debug) console.error('[DISCORD] failed to upload image', err && err.message)
    }
  }

  async updatePresence({on, app, model}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    if (!on) {
      if (this.debug) console.log('Device is off; skipping presence update')
      return
    }

    // set startedAt when device first powers on; keep across app switches
    if (!this.startedAt) this.startedAt = Date.now()

    await this.processImageIfNeeded()

    const activity = {
      name: model || (app || 'App'),
      type: 0,
      details: app ? `${app}` : '',
      state: 'On',
      // Discord expects timestamps in milliseconds
      timestamps: {start: this.startedAt},
      assets: {
        large_image: this.processedImage || undefined,
        large_text: model || ''
      }
    }

    const presence = {
      op: 3,
      d: {
        since: null,
        activities: [activity],
        status: 'online',
        afk: false
      }
    }
    if (this.debug) console.log('[DISCORD] GW -> presence', JSON.stringify(presence))
    this.ws.send(JSON.stringify(presence))
  }

  clearPresence() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const presence = {op: 3, d: {since: null, activities: [], status: 'online', afk: false}}
    if (this.debug) console.log('[DISCORD] GW -> clear presence', JSON.stringify(presence))
    this.ws.send(JSON.stringify(presence))
    // reset start time because device is off
    this.startedAt = null
  }

  cleanup() {
    this.connected = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
    this.seq = null
    this.sessionId = null
  }
}

module.exports = {DiscordClient}
