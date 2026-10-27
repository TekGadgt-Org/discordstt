const { EndBehaviorType } = require('@discordjs/voice');
const { createOpusStream } = require('./audio');
const { RealtimeTranscriber } = require('./realtime');

class TranscriptionManager {
  constructor({ transcriberFactory = (options) => new RealtimeTranscriber(options), silenceMs = 2000, streamFactory = createOpusStream } = {}) {
    this.transcriberFactory = transcriberFactory;
    this.silenceMs = silenceMs;
    this.streamFactory = streamFactory;
    this.sessions = new Map();
  }

  async start({ guildId, userId, connection, channel, label }) {
    this.stop(guildId);
    const state = { stopped: false, streams: new Set(), sources: new Set(), transcriber: null, listeners: [], receiver: connection.receiver, userId };
    this.sessions.set(guildId, state);
    try {
      const transcriber = state.transcriber = this.transcriberFactory();
      transcriber.on('transcript', (text) => {
        if (text.trim() && !state.stopped && this.sessions.get(guildId) === state) this.send(channel, `**${label}:** ${text.trim()}`);
      });
      transcriber.on('error', (error) => {
        if (!state.stopped) this.fail(state, channel, 'Transcription connection error; transcription stopped.');
      });
      transcriber.on('close', () => this.fail(state, channel, 'Transcription connection closed.'));
      this.watchConnection(state, connection, channel);
      await transcriber.connect();
      if (state.stopped || this.sessions.get(guildId) !== state) return state;
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
    state.sources.add(source);
    const stream = this.streamFactory(source);
    state.streams.add(stream);
    stream.on('data', (pcm) => { if (!state.stopped && state.transcriber) state.transcriber.append(pcm); });
    const finish = async () => {
      state.streams.delete(stream);
      state.sources.delete(source);
      if (!state.stopped && state.transcriber) state.transcriber.commit();
      // @discordjs/voice caches subscriptions by user id. Remove the ended
      // source before subscribing, otherwise the next turn receives a dead stream.
      if (connection.receiver.subscriptions?.get(userId) === source) {
        connection.receiver.subscriptions.delete(userId);
      }
      if (!state.stopped) {
        await new Promise((resolve) => setImmediate(resolve));
        this.subscribe(state, { connection, userId });
      }
    };
    stream.once('end', () => { finish().catch((error) => this.fail(state, null, error.message)); });
    stream.once('error', (error) => { if (!state.stopped) state.transcriber.emit('error', error); });
  }

  stop(guildId) {
    const state = this.sessions.get(guildId);
    if (!state) return;
    state.stopped = true;
    for (const listener of state.listeners) listener();
    state.listeners.length = 0;
    for (const source of state.sources) source.destroy?.();
    if (state.receiver.subscriptions?.get(state.userId)) state.receiver.subscriptions.delete(state.userId);
    for (const stream of state.streams) stream.destroy();
    state.sources.clear();
    state.streams.clear();
    const transcriber = state.transcriber;
    state.transcriber = null;
    transcriber?.removeAllListeners?.();
    transcriber?.close();
    this.sessions.delete(guildId);
  }

  send(channel, content) {
    return Promise.resolve().then(() => channel.send(content)).catch((error) => {
      console.warn(`Unable to send transcription notice: ${error.message || error}`);
    });
  }

  fail(state, channel, message) {
    if (state.stopped) return;
    if (channel) this.send(channel, message);
    for (const [guildId, current] of this.sessions) if (current === state) this.stop(guildId);
  }

  watchConnection(state, connection, channel) {
    const onStateChange = (_oldState, newState) => {
      const status = newState?.status;
      if (status === 'disconnected' || status === 'destroyed') this.fail(state, channel, 'Voice connection lost; transcription stopped.');
    };
    if (typeof connection.on === 'function') {
      connection.on('stateChange', onStateChange);
      state.listeners.push(() => connection.off?.('stateChange', onStateChange));
      for (const event of ['disconnect', 'destroy']) {
        const handler = () => this.fail(state, channel, 'Voice connection lost; transcription stopped.');
        connection.on(event, handler);
        state.listeners.push(() => connection.off?.(event, handler));
      }
    }
  }

  stopAll() { for (const guildId of this.sessions.keys()) this.stop(guildId); }
}

module.exports = { TranscriptionManager };
