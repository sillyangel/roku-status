require('dotenv').config()
const {StatusClient} = require('./statusClient')
const {DiscordClient} = require('./discordClient')

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const STATUS_URL = process.env.STATUS_URL || ''
const POLL_MS = parseInt(process.env.POLL_MS || '5000', 10)
const DEBUG_RAW = (process.env.DEBUG || '').toString().toLowerCase()
const debugRoku = DEBUG_RAW === 'both' || DEBUG_RAW === 'roku' || DEBUG_RAW === '1' || DEBUG_RAW === 'true'
const debugDiscord = DEBUG_RAW === 'both' || DEBUG_RAW === 'discord' || DEBUG_RAW === '1' || DEBUG_RAW === 'true'
const IMAGE_URL = process.env.IMAGE_URL || 'https://avatars.githubusercontent.com/u/50461810'

if (!DISCORD_TOKEN) {
  console.error('Please set DISCORD_TOKEN in .env or environment')
  process.exit(1)
}

const statusClient = new StatusClient(STATUS_URL, 5000, debugRoku)
const discord = new DiscordClient(debugDiscord, IMAGE_URL)

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
    if (s.on) {
      const newState = `on:${s.app || ''}`
      if (newState !== lastState) {
        console.log('Status changed ->', s)
        await discord.updatePresence(s)
        lastState = newState
      }
    } else {
      if (lastState !== 'off') {
        console.log('Device is off; clearing presence')
        discord.clearPresence()
        lastState = 'off'
      }
    }
  }

  // initial
  await poll()
  setInterval(poll, POLL_MS)
})()
