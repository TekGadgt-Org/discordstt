const { Transform } = require('node:stream');
const OpusScript = require('opusscript');

const PCM_RATE = 24000;
const MAX_CHUNK_BYTES = 4096;

class OpusToPcm extends Transform {
  constructor(options = {}) {
    super(options);
    this.encoder = options.encoder || new OpusScript(PCM_RATE, 1, OpusScript.Application.AUDIO);
    // A supplied codec belongs to its caller unless ownership is explicitly transferred.
    this.ownsEncoder = options.ownsEncoder === true || !options.encoder;
    this.encoderDeleted = false;
  }

  _transform(packet, encoding, callback) {
    try {
      const pcm = this.encoder.decode(packet, 960);
      for (let offset = 0; offset < pcm.length; offset += MAX_CHUNK_BYTES) {
        this.push(pcm.subarray(offset, offset + MAX_CHUNK_BYTES));
      }
      callback();
    } catch (error) { callback(error); }
  }

  _destroy(error, callback) {
    if (this.ownsEncoder && !this.encoderDeleted) {
      this.encoderDeleted = true;
      try {
        this.encoder.delete();
      } catch {
        // Codec cleanup must not replace the stream's original error.
      }
    }
    callback(error);
  }
}

function pcmChunkToEvent(chunk) {
  return { type: 'input_audio_buffer.append', audio: chunk.toString('base64') };
}

module.exports = { OpusToPcm, pcmChunkToEvent, PCM_RATE, MAX_CHUNK_BYTES };
