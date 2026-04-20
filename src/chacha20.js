/**
 * ChaCha20 PRNG — RFC 8439
 * UVS canonical pseudorandom number generator.
 *
 * Usage:
 *   const rng = new ChaCha20(keyBuf, nonceBuf);
 *   const val = rng.nextUint32();         // 0..4294967295
 *   const flt = rng.nextFloat();          // [0, 1)
 *   const die = rng.nextInt(1, 6);        // 1..6
 *   const idx = rng.nextIndex(reelLength); // 0..reelLength-1
 */

'use strict';

const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]; // "expand 32-byte k"

function rotl(v, n) { return ((v << n) | (v >>> (32 - n))) >>> 0; }

function quarterRound(s, a, b, c, d) {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

function chacha20Block(key, nonce, counter) {
  const k = new Uint32Array(8);
  const n = new Uint32Array(3);
  for (let i = 0; i < 8; i++) k[i] = key.readUInt32LE(i * 4);
  for (let i = 0; i < 3; i++) n[i] = nonce.readUInt32LE(i * 4);

  const s = new Uint32Array(16);
  s[0] = SIGMA[0]; s[1] = SIGMA[1]; s[2] = SIGMA[2]; s[3] = SIGMA[3];
  s[4] = k[0]; s[5] = k[1]; s[6] = k[2]; s[7] = k[3];
  s[8] = k[4]; s[9] = k[5]; s[10] = k[6]; s[11] = k[7];
  s[12] = counter >>> 0; s[13] = n[0]; s[14] = n[1]; s[15] = n[2];

  const w = new Uint32Array(s);
  for (let i = 0; i < 10; i++) {
    quarterRound(w, 0, 4, 8, 12); quarterRound(w, 1, 5, 9, 13);
    quarterRound(w, 2, 6, 10, 14); quarterRound(w, 3, 7, 11, 15);
    quarterRound(w, 0, 5, 10, 15); quarterRound(w, 1, 6, 11, 12);
    quarterRound(w, 2, 7, 8, 13); quarterRound(w, 3, 4, 9, 14);
  }

  const out = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) out.writeUInt32LE((w[i] + s[i]) >>> 0, i * 4);
  return out;
}

class ChaCha20 {
  /**
   * @param {Buffer} key   — 32 bytes (first 32 bytes of combinedSeed)
   * @param {Buffer} nonce — 12 bytes (bytes 32-43 of combinedSeed)
   */
  constructor(key, nonce) {
    if (key.length !== 32) throw new Error('ChaCha20: key must be 32 bytes');
    if (nonce.length !== 12) throw new Error('ChaCha20: nonce must be 12 bytes');
    this._key = key;
    this._nonce = nonce;
    this._counter = 0;
    this._buf = [];
    this._totalCalls = 0;
  }

  /** Generate next 32-bit unsigned integer */
  nextUint32() {
    if (this._buf.length === 0) {
      const block = chacha20Block(this._key, this._nonce, this._counter++);
      for (let i = 0; i < 64; i += 4) this._buf.push(block.readUInt32LE(i));
    }
    this._totalCalls++;
    return this._buf.shift();
  }

  /** Float in [0, 1) */
  nextFloat() { return this.nextUint32() / 0x100000000; }

  /** Integer in [min, max] inclusive */
  nextInt(min, max) { return min + (this.nextUint32() % (max - min + 1)); }

  /** Index in [0, length) */
  nextIndex(length) { return this.nextUint32() % length; }

  /** How many uint32 values have been consumed */
  get calls() { return this._totalCalls; }

  /** Reset to initial state */
  reset() {
    this._counter = 0;
    this._buf = [];
    this._totalCalls = 0;
  }

  /** Create from hex combinedSeed (128 hex chars = 64 bytes) */
  static fromCombinedSeed(hexSeed) {
    const buf = Buffer.from(hexSeed, 'hex');
    if (buf.length < 44) throw new Error('combinedSeed must be at least 44 bytes (88 hex chars)');
    return new ChaCha20(buf.slice(0, 32), buf.slice(32, 44));
  }
}

module.exports = { ChaCha20, chacha20Block };
