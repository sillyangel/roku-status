require('dotenv').config()
const {StatusClient} = require('./statusClient')
const {DiscordClient} = require('./discordClient')

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const STATUS_URL = process.env.STATUS_URL || ''
const POLL_MS = parseInt(process.env.POLL_MS || '5000', 10)

if (!DISCORD_TOKEN) {
  console.error('Please set DISCORD_TOKEN in .env or environment')
  process.exit(1)
}

const statusClient = new StatusClient(STATUS_URL)
const discord = new DiscordClient()

;(async () => {
  try {
    await discord.connect(DISCORD_TOKEN)
  } catch (err) {
    console.error('Failed to connect to Discord gateway:', err)
    process.exit(1)
  }

  let lastState = null

  const poll = async () => {
    const s = await statusClient.fetchStatus()
    const newState = `${s.on ? 'on' : 'off'}:${s.app || ''}`
    if (newState !== lastState) {
      console.log('Status changed ->', s)
      await discord.updatePresence(s)
      lastState = newState
    }
  }

  // initial
  await poll()
  setInterval(poll, POLL_MS)
})()
