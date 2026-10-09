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
});
