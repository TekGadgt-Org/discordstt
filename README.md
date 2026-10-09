# discordstt

A Discord voice bot that streams received voice audio to OpenAI's dedicated realtime transcription API and posts completed utterances to the invoking text channel.

Requirements: Node.js 22.12.0 or newer, a Discord bot with Guilds and Guild Voice States intents, and an OpenAI API key with access to `gpt-live-transcribe`.

Setup

1. `cd bot && npm install`
2. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `OPENAI_API_KEY` (optionally `OPENAI_TRANSCRIPTION_MODEL`) in the environment. The model defaults to `gpt-live-transcribe`.
3. Register the slash commands with `node deploy-commands.js` using those environment variables.
4. Run `npm start`.

The realtime connection is `wss://api.openai.com/v1/realtime?intent=transcription`. Discord Opus packets are decoded directly to mono 24 kHz PCM and sent as bounded base64 chunks; no recordings are written to disk. The transcription session uses client-side silence boundaries: each Discord `AfterSilence` segment is committed, then the receiver subscription is replaced. OpenAI server/semantic VAD is intentionally not enabled because the dedicated transcription session contract does not support it.

Commands: `/join`, `/transcribe`, and `/leave`. `/transcribe` is safe to re-enter; it replaces the existing guild session. `/leave` destroys the voice connection and closes the WebSocket/subscription.

Testing

`npm test` runs credential-free mocked WebSocket/audio tests. `npm run lint` runs Node syntax checks. A live Discord/OpenAI smoke test requires credentials and a real voice channel and is not part of automated tests.
