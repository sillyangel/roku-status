# Roku -> Discord Status Bridge (Node.js)

Simple Node.js app that polls a status endpoint and updates a Discord presence using a user token.

Quick start

1. Copy `.env.example` to `.env` and set `DISCORD_TOKEN` and optionally `STATUS_URL`.
2. Install dependencies and run:

```bash
npm install
npm start
```

Environment

- `DISCORD_TOKEN` — your Discord user token (see note below).
- `STATUS_URL` — optional HTTP endpoint that returns JSON `{ "on": true, "app": "AppName" }`.
- `POLL_MS` — polling interval in milliseconds (default 5000).

Notes

- Using a user token may violate Discord's Terms of Service. Prefer using a Bot token and the official APIs where possible.
- If you don't provide `STATUS_URL`, the app will use a small local mock that toggles state for testing.
