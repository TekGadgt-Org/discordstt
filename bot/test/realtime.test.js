const test = require('node:test');
const assert = require('node:assert/strict');
const { pcmChunkToEvent, MAX_CHUNK_BYTES, PCM_RATE } = require('../lib/audio');
const { RealtimeTranscriber } = require('../lib/realtime');

test('PCM chunks are bounded and base64 encoded', () => {
  const pcm = Buffer.alloc(MAX_CHUNK_BYTES);
  const event = pcmChunkToEvent(pcm);
  assert.equal(event.type, 'input_audio_buffer.append');
  assert.deepEqual(Buffer.from(event.audio, 'base64'), pcm);
  assert.equal(PCM_RATE, 24000);
});

test('realtime transcriber sends transcription session and emits completed text', async () => {
  class FakeWS {
    static OPEN = 1;
    constructor() { this.readyState = 0; this.handlers = {}; setImmediate(() => { this.readyState = 1; this.handlers.open?.(); }); }
    once(event, fn) { this.handlers[event] = fn; }
    on(event, fn) { this.handlers[event] = fn; }
    send(message) { this.sent = [...(this.sent || []), JSON.parse(message)]; }
    close() { this.handlers.close?.(); }
  }
  const client = new RealtimeTranscriber({ apiKey: 'test', WebSocketImpl: FakeWS });
  const transcript = new Promise((resolve) => client.on('transcript', resolve));
  await client.connect();
  client.handleMessage({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'hello' });
  assert.equal(await transcript, 'hello');
  assert.equal(client.ws.sent[0].session.type, 'transcription');
  assert.equal(client.ws.sent[0].session.audio.input.format.rate, 24000);
  client.close();
});

test('missing key fails before opening socket', () => {
  assert.throws(() => new RealtimeTranscriber({ apiKey: '' }), /OPENAI_API_KEY/);
});
