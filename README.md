# discordstt

A Discord voice bot that streams received voice audio to OpenAI's dedicated realtime transcription API and posts completed utterances to the invoking text channel.

Requirements: Node.js 22.12.0 or newer, a Discord bot with Guilds and Guild Voice States intents, and an OpenAI API key with access to `gpt-live-transcribe`.

Setup

1. `cd bot && npm ci`
2. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `OPENAI_API_KEY` (optionally `OPENAI_TRANSCRIPTION_MODEL`) in the environment. The model defaults to `gpt-live-transcribe`.
3. Register commands with `node deploy-commands.js`. Deployment defaults to the guild in `DISCORD_GUILD_ID`; set `DISCORD_COMMAND_SCOPE=global` explicitly for global deployment.
4. Run `npm start`.

The realtime connection is `wss://api.openai.com/v1/realtime?intent=transcription`. Discord Opus packets are decoded directly to mono 24 kHz PCM and sent as bounded base64 chunks; no recordings are written to disk. Each Discord `AfterSilence` segment is committed, and the ended receiver subscription is removed before the next segment is subscribed. OpenAI server/semantic VAD is intentionally not enabled because the dedicated transcription session contract does not support it.

Commands: `/join`, `/leave`, `/ping`, `/server`, `/transcribe`, and `/user`. `/transcribe` is safe to re-enter; it replaces the existing guild session. `/leave` destroys the voice connection and closes the WebSocket/subscriptions. If OpenAI closes or the Discord voice connection is disconnected/destroyed, the manager stops the session and sends a sanitized notice when the destination channel is still writable. A failed channel send is handled without retries or unhandled promise rejections.

Command deletion is deliberately scoped: set `DISCORD_COMMAND_SCOPE=guild` (the default) or `global`, and use `DISCORD_COMMAND_DRY_RUN=1` to inspect the action without changing Discord. The script never deletes both scopes in one invocation.

Testing

`npm test` runs credential-free mocked WebSocket/audio and manager lifecycle tests. `npm run lint` runs Node syntax checks. A live Discord/OpenAI smoke test requires credentials and a real voice channel and is not part of automated tests: join a voice channel, run `/transcribe`, speak two utterances separated by silence, verify two messages, then run `/leave`; also verify that an OpenAI close or voice disconnect produces the stopped notice and no further transcription.

Dependency audit

The baseline `npm audit --omit=dev` reported 8 findings (7 high, 1 critical). Compatible lockfile updates remediate the `brace-expansion`, `minimatch`, and semver findings; the current audit reports 5 remaining findings (4 high, 1 critical), all `tar` with no fix available. They are transitively required by `@discordjs/node-pre-gyp` for `@discordjs/opus` (which is used to decode Discord voice packets); they are install-time archive extraction code, not the bot's request/runtime path. Build in a restricted environment, use trusted lockfiles/artifacts, and keep the bot process/container unprivileged. Re-run the audit after dependency releases provide a compatible fix.
