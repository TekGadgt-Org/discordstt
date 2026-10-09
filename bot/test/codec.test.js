const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const OpusScript = require('opusscript');
const { OpusToPcm, PCM_RATE } = require('../lib/audio');

test('Opus fixture decodes to aligned 24 kHz mono PCM', async () => {
  const encoder = new OpusScript(PCM_RATE, 1, OpusScript.Application.AUDIO);
  const input = Buffer.alloc(PCM_RATE / 50 * 2);
  for (let i = 0; i < input.length / 2; i += 1) input.writeInt16LE(Math.round(Math.sin(i / 8) * 1000), i * 2);
  const packet = encoder.encode(input, input.length / 2);
  const decoder = new OpusToPcm();
  const chunks = [];
  decoder.on('data', (chunk) => chunks.push(chunk));
  Readable.from([packet]).pipe(decoder);
  await once(decoder, 'end');
  const pcm = Buffer.concat(chunks);
  assert(pcm.length > 0);
  assert.equal(pcm.length % 2, 0);
  assert.equal(pcm.length / 2, PCM_RATE / 50);
  encoder.delete();
});

function instrumentedCodec({ decode = () => Buffer.alloc(0) } = {}) {
  let deleteCalls = 0;
  return {
    decode,
    delete() { deleteCalls += 1; },
    get deleteCalls() { return deleteCalls; },
  };
}

test('internally created codec is deleted once on normal completion', async () => {
  const decoder = new OpusToPcm();
  const originalDelete = decoder.encoder.delete.bind(decoder.encoder);
  let deleteCalls = 0;
  decoder.encoder.delete = () => { deleteCalls += 1; originalDelete(); };
  decoder.resume();
  decoder.end();
  await once(decoder, 'close');
  assert.equal(deleteCalls, 1);
  decoder.destroy();
  assert.equal(deleteCalls, 1);
});

test('codec is deleted once when decode fails', async () => {
  const codec = instrumentedCodec({ decode: () => { throw new Error('decode failed'); } });
  const decoder = new OpusToPcm({ encoder: codec, ownsEncoder: true });
  const error = once(decoder, 'error');
  decoder.resume();
  decoder.end(Buffer.from([1]));
  assert.equal((await error)[0].message, 'decode failed');
  assert.equal(codec.deleteCalls, 1);
  decoder.destroy();
  assert.equal(codec.deleteCalls, 1);
});

test('explicit repeated destroy deletes an owned codec once', async () => {
  const codec = instrumentedCodec();
  const decoder = new OpusToPcm({ encoder: codec, ownsEncoder: true });
  decoder.resume();
  const close = once(decoder, 'close');
  decoder.destroy();
  decoder.destroy();
  await close;
  assert.equal(codec.deleteCalls, 1);
});

test('injected codec remains caller-owned by default', async () => {
  const codec = instrumentedCodec();
  const decoder = new OpusToPcm({ encoder: codec });
  decoder.resume();
  decoder.end();
  await once(decoder, 'close');
  assert.equal(codec.deleteCalls, 0);
});
