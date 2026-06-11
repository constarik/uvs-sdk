/**
 * @constarik/uvs-sdk — Uncloned Verification Standard v3
 *
 * One primitive, two branches:
 *   uvGame    — interactive games (ChaCha20 keystream, commit-reveal, sessions).
 *   uvLottery — verifiable draws (seeded permutation + drand).
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
const lottery = require('./lottery');
const drand = require('./drand');

module.exports = {
  // ── Core / shared ──
  sha256, sha512, randomHex, generateServerSeed,
  canonicalJSON,
  negotiate,

  // ── uvGame (interactive games) ──
  ChaCha20,
  commit, deriveCombinedSeed, createRng, verify, generate, sessionId,
  UvsSession, STATES,
  stateHash, createHeader, createStep, verifyStep, toJSONL, fromJSONL,

  // ── uvLottery (verifiable draws) ──
  // grouped to avoid name collisions (e.g. lottery.combinedSeed vs deriveCombinedSeed)
  lottery,   // { combinedSeed, score, permute, allocate, lookup, poolOf, verifyDraw }
  drand,     // { QUICKNET, roundAt, timeOfRound, futureRound, roundAfter, checkAnchorRound, randomnessOf, fetchRound }

  // ── Protocol version ──
  UVS_VERSION: 3
};
