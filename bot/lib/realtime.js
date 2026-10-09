const WebSocket = require('ws');
const { pcmChunkToEvent, PCM_RATE } = require('./audio');

const URL = 'wss://api.openai.com/v1/realtime?intent=transcription';

class RealtimeTranscriber {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-live-transcribe', WebSocketImpl = WebSocket, url = URL } = {}) {
    if (!apiKey) throw new Error('OPENAI_API_KEY is required');
    this.apiKey = apiKey;
    this.model = model;
    this.WebSocketImpl = WebSocketImpl;
    this.url = url;
    this.ws = null;
    this.closed = false;
    this.queue = [];
    this.listeners = new Map();
  }

  on(event, listener) { this.listeners.set(event, listener); return this; }
  emit(event, value) { this.listeners.get(event)?.(value); }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new this.WebSocketImpl(this.url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      const fail = (error) => { this.emit('error', error); reject(error); };
      ws.once('open', () => {
        this.send({ type: 'session.update', session: { type: 'transcription', audio: { input: { format: { type: 'audio/pcm', rate: PCM_RATE }, transcription: { model: this.model }, turn_detection: null } } } });
        for (const message of this.queue.splice(0)) this.send(message);
        resolve();
      });
      ws.on('message', (data) => this.handleMessage(JSON.parse(data.toString())));
      ws.once('error', fail);
      ws.once('close', () => this.emit('close'));
    });
  }

  handleMessage(message) {
    if (message.type === 'conversation.item.input_audio_transcription.delta') this.emit('delta', message.delta || '');
    if (message.type === 'conversation.item.input_audio_transcription.completed') this.emit('transcript', message.transcript || '');
    if (message.type === 'error') this.emit('error', new Error(message.error?.message || 'OpenAI realtime error'));
    this.emit(message.type, message);
  }

  send(message) {
    if (this.ws?.readyState === this.WebSocketImpl.OPEN) this.ws.send(JSON.stringify(message));
    else if (!this.closed) this.queue.push(message);
  }

  append(pcm) { this.send(pcmChunkToEvent(pcm)); }
  commit() { this.send({ type: 'input_audio_buffer.commit' }); }
  close() { this.closed = true; this.queue = []; this.ws?.close(); this.ws = null; }
}

module.exports = { RealtimeTranscriber, URL };
