const WebSocket = require('ws')

class DiscordClient {
  constructor() {
    this.ws = null
    this.heartbeatInterval = null
    this.heartbeatTimer = null
    this.seq = null
    this.sessionId = null
    this.connected = false
  }

  connect(token) {
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

  async updatePresence({on, app}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const activity = on
      ? {name: `${app || 'App'}`, type: 0, details: `${app} is active`, state: 'On'}
      : {name: 'Idle', type: 0, details: 'Device is off', state: 'Off'}

    const presence = {
      op: 3,
      d: {
        since: null,
        activities: [activity],
        status: on ? 'online' : 'idle',
        afk: false
      }
    }
    this.ws.send(JSON.stringify(presence))
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
