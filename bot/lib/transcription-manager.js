const { EndBehaviorType } = require('@discordjs/voice');
const { OpusToPcm } = require('./audio');
const { RealtimeTranscriber } = require('./realtime');

class TranscriptionManager {
  constructor({ transcriberFactory = (options) => new RealtimeTranscriber(options), silenceMs = 2000 } = {}) {
    this.transcriberFactory = transcriberFactory;
    this.silenceMs = silenceMs;
    this.sessions = new Map();
  }

  async start({ guildId, userId, connection, channel, label }) {
    this.stop(guildId);
    const state = { stopped: false, streams: new Set(), transcriber: null };
    this.sessions.set(guildId, state);
    try {
      const transcriber = state.transcriber = this.transcriberFactory();
      transcriber.on('transcript', (text) => { if (text.trim() && !state.stopped) channel.send(`**${label}:** ${text.trim()}`); });
      transcriber.on('error', (error) => Promise.resolve(channel.send(`Transcription error: ${error.message}`)).catch(() => {}));
      await transcriber.connect();
      this.subscribe(state, { connection, userId });
    } catch (error) {
      this.stop(guildId);
      throw error;
    }
    return state;
  }

  subscribe(state, { connection, userId }) {
    if (state.stopped) return;
    const source = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: this.silenceMs } });
    const stream = source.pipe(new OpusToPcm());
    state.streams.add(stream);
    stream.on('data', (pcm) => state.transcriber.append(pcm));
    const finish = () => {
      state.streams.delete(stream);
      state.transcriber.commit();
      if (!state.stopped) this.subscribe(state, { connection, userId });
    };
    stream.once('end', finish);
    stream.once('error', (error) => { if (!state.stopped) state.transcriber.emit('error', error); });
  }

  stop(guildId) {
    const state = this.sessions.get(guildId);
    if (!state) return;
    state.stopped = true;
    for (const stream of state.streams) stream.destroy();
    state.streams.clear();
    state.transcriber?.close();
    this.sessions.delete(guildId);
  }

  stopAll() { for (const guildId of this.sessions.keys()) this.stop(guildId); }
}

module.exports = { TranscriptionManager };
