/**
 * UVS Hash utilities — SHA-256, SHA-512
 * Node.js implementation using crypto module.
 */

'use strict';

const crypto = require('crypto');

/** SHA-256 hex digest */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** SHA-512 hex digest */
function sha512(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
}

/** Generate cryptographically secure random hex string */
function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Generate server seed (32 bytes = 64 hex chars) */
function generateServerSeed() {
  return randomHex(32);
}

module.exports = { sha256, sha512, randomHex, generateServerSeed };
