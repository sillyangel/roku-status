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
 - `DEBUG` — logging mode: `both` to show Roku+Discord logs, `roku` to show Roku logs only, `discord` to show Discord logs only. `true` or `1` enables both.
 - `DISCORD_CLIENT_ID` — (optional) your Discord Application Client ID. Required to upload external images so they can be used as presence assets. If unset, the app will attempt to use the raw image URL but Discord may not display it.
 - `IMAGE_URL` — (optional) URL of the image to use as the presence large image. Defaults to a GitHub avatar.

Notes

- Using a user token may violate Discord's Terms of Service. Prefer using a Bot token and the official APIs where possible.
- If you don't provide `STATUS_URL`, the app will use a small local mock that toggles state for testing.
