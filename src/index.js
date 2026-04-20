/**
 * @uncloned/uvs — Uncloned Verification Standard v2
 * Provably fair game protocol SDK.
 *
 * https://github.com/constarik/uvs
 * https://uncloned.work
 */

'use strict';

const { ChaCha20 } = require('./chacha20');
const { sha256, sha512, randomHex, generateServerSeed } = require('./hash');
const { canonicalJSON } = require('./canonical');
const { commit, deriveCombinedSeed, createRng, verify, generate, sessionId } = require('./seed');
const { UvsSession, STATES } = require('./session');
const { stateHash, createHeader, createStep, verifyStep, toJSONL, fromJSONL } = require('./audit');
const { negotiate } = require('./version');

module.exports = {
  // Core PRNG
  ChaCha20,

  // Hashing
  sha256, sha512, randomHex, generateServerSeed,

  // Canonical JSON
  canonicalJSON,

  // Seed protocol
  commit, deriveCombinedSeed, createRng, verify, generate, sessionId,

  // Session management
  UvsSession, STATES,

  // Audit trail
  stateHash, createHeader, createStep, verifyStep, toJSONL, fromJSONL,

  // Version negotiation
  negotiate,

  // Protocol version
  UVS_VERSION: 2
};
