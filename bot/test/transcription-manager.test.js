const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { TranscriptionManager } = require('../lib/transcription-manager');

class FakeTranscriber extends EventEmitter {
  constructor() { super(); this.appends = []; this.commits = 0; this.closed = false; }
  async connect() {}
  append(chunk) { this.appends.push(chunk.toString()); }
  commit() { this.commits += 1; }
  close() { this.closed = true; }
}

function fixture() {
  const sources = [];
  const receiver = {
    subscriptions: new Map(),
    subscribe(userId) {
      const source = new PassThrough();
      this.subscriptions.set(userId, source);
      sources.push(source);
      return source;
    },
  };
  const connection = new EventEmitter();
  connection.receiver = receiver;
  const sent = [];
  const channel = { send: async (message) => { sent.push(message); } };
  return { connection, sources, channel, sent };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('manager replaces ended receiver subscriptions and commits two turns', async () => {
  const transcriber = new FakeTranscriber();
  const manager = new TranscriptionManager({ transcriberFactory: () => transcriber, streamFactory: (source) => source });
  const f = fixture();
  await manager.start({ guildId: 'guild', userId: 'user', connection: f.connection, channel: f.channel, label: 'speaker' });
  f.sources[0].write(Buffer.from('one')); f.sources[0].end();
  await tick();
  await tick();
  assert.equal(f.sources.length, 2);
  assert.notEqual(f.sources[0], f.sources[1]);
  f.sources[1].write(Buffer.from('two')); f.sources[1].end();
  await tick();
  await tick();
  assert.deepEqual(transcriber.appends, ['one', 'two']);
  assert.equal(transcriber.commits, 2);
  assert.equal(f.connection.receiver.subscriptions.size, 1);
  manager.stop('guild');
});

test('provider close and voice disconnect stop the session and clean listeners', async () => {
  const transcriber = new FakeTranscriber();
  const manager = new TranscriptionManager({ transcriberFactory: () => transcriber, streamFactory: (source) => source });
  const f = fixture();
  await manager.start({ guildId: 'guild', userId: 'user', connection: f.connection, channel: f.channel, label: 'speaker' });
  transcriber.emit('close');
  assert.equal(manager.sessions.size, 0);
  assert.equal(transcriber.closed, true);
  assert.equal(f.connection.listenerCount('stateChange'), 0);

  const second = new FakeTranscriber();
  const connection = fixture();
  const manager2 = new TranscriptionManager({ transcriberFactory: () => second, streamFactory: (source) => source });
  await manager2.start({ guildId: 'guild', userId: 'user', connection: connection.connection, channel: connection.channel, label: 'speaker' });
  connection.connection.emit('stateChange', {}, { status: 'disconnected' });
  assert.equal(manager2.sessions.size, 0);
  second.emit('transcript', 'late');
  await tick();
  assert.equal(connection.sent.length, 1);
});

test('send rejection is contained and stop is idempotent', async () => {
  const transcriber = new FakeTranscriber();
  const manager = new TranscriptionManager({ transcriberFactory: () => transcriber, streamFactory: (source) => source });
  const f = fixture();
  f.channel.send = async () => { throw new Error('deleted'); };
  await manager.start({ guildId: 'guild', userId: 'user', connection: f.connection, channel: f.channel, label: 'speaker' });
  transcriber.emit('transcript', 'hello');
  await tick();
  manager.stop('guild'); manager.stop('guild');
  assert.equal(transcriber.closed, true);
});
