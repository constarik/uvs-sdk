/**
 * UVS Seed Protocol — Sections 3.3–3.4, 10.1–10.3
 * Seed commitment, derivation, and verification.
 */

'use strict';

const { sha256, sha512, generateServerSeed } = require('./hash');
const { ChaCha20 } = require('./chacha20');

/**
 * Create a seed commitment.
 * @param {string} serverSeed — hex-encoded server seed (min 32 bytes)
 * @returns {{ serverSeed: string, serverSeedHash: string }}
 */
function commit(serverSeed) {
  if (!serverSeed || serverSeed.length < 64)
    throw new Error('serverSeed must be at least 32 bytes (64 hex chars)');
  return {
    serverSeed,
    serverSeedHash: sha256(serverSeed)
  };
}

/**
 * Derive combinedSeed from server seed, client seed, and nonce.
 * combinedSeed = SHA-512(serverSeed + ":" + clientSeed + ":" + nonce)
 * @param {string} serverSeed — hex string
 * @param {string} clientSeed — UTF-8 string
 * @param {string|number} nonce — uint64
 * @returns {string} — 128 hex chars (64 bytes)
 */
function deriveCombinedSeed(serverSeed, clientSeed, nonce) {
  return sha512(serverSeed + ':' + clientSeed + ':' + nonce);
}

/**
 * Create a ChaCha20 PRNG from seeds.
 * @param {string} serverSeed
 * @param {string} clientSeed
 * @param {string|number} nonce
 * @returns {ChaCha20}
 */
function createRng(serverSeed, clientSeed, nonce) {
  const combined = deriveCombinedSeed(serverSeed, clientSeed, nonce);
  return ChaCha20.fromCombinedSeed(combined);
}

/**
 * Verify that serverSeed matches a previously published hash.
 * @param {string} serverSeed
 * @param {string} serverSeedHash
 * @returns {boolean}
 */
function verify(serverSeed, serverSeedHash) {
  return sha256(serverSeed) === serverSeedHash;
}

/**
 * Generate a new server seed and its commitment.
 * @returns {{ serverSeed: string, serverSeedHash: string }}
 */
function generate() {
  const seed = generateServerSeed();
  return commit(seed);
}

/**
 * Compute sessionId = SHA-256(serverSeedHash + ":" + clientSeed + ":" + minNonce)
 * @param {string} serverSeedHash
 * @param {string} clientSeed
 * @param {number} minNonce
 * @returns {string}
 */
function sessionId(serverSeedHash, clientSeed, minNonce) {
  return sha256(serverSeedHash + ':' + clientSeed + ':' + minNonce);
}

module.exports = {
  commit, deriveCombinedSeed, createRng, verify, generate, sessionId
};
