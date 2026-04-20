/**
 * UVS Audit Trail — Section 11
 * Session header and step records.
 */

'use strict';

const { sha256 } = require('./hash');
const { canonicalJSON } = require('./canonical');

/**
 * Compute stateHash from game state object.
 * stateHash = SHA-256(canonicalJSON(state))
 * @param {object} state
 * @returns {string}
 */
function stateHash(state) {
  return sha256(canonicalJSON(state));
}

/**
 * Create a UVS session header (Audit Trail entry #0).
 * @param {object} opts
 * @returns {object}
 */
function createHeader(opts) {
  const header = {
    type: 'uvs-header',
    uvsVersion: opts.uvsVersion || 2,
    sessionId: opts.sessionId,
    gameMode: opts.gameMode || 'stateless',
    serverSeedHash: opts.serverSeedHash,
    clientSeed: opts.clientSeed,
    minNonce: opts.minNonce,
    params: opts.params || {},
    timestamp: opts.timestamp || new Date().toISOString()
  };

  // Move mode fields
  if (header.gameMode === 'move') {
    header.granularity = opts.granularity || 'ALL';
    header.inputSeeded = opts.inputSeeded || false;
    if (opts.moveOrdering) header.moveOrdering = opts.moveOrdering;
    if (opts.players) header.players = opts.players;
    if (opts.timeout) header.timeout = opts.timeout;
  }

  // Protected layer
  if (opts.protected) {
    header.protected = opts.protected;
  }

  if (opts.extensions) header.extensions = opts.extensions;

  return header;
}

/**
 * Create an Audit Trail step record.
 * @param {number} step — step number (uint64)
 * @param {object|null} input — player Move or null
 * @param {object} output — step result
 * @param {object} state — current game state (for hash computation)
 * @param {number[]} rngCalls — RNG values consumed this step
 * @returns {object}
 */
function createStep(step, input, output, state, rngCalls) {
  return {
    step,
    input: input || null,
    output,
    stateHash: stateHash(state),
    rngCalls: rngCalls || []
  };
}

/**
 * Verify a step record against recomputed state.
 * @param {object} stepRecord
 * @param {object} recomputedState
 * @returns {boolean}
 */
function verifyStep(stepRecord, recomputedState) {
  return stepRecord.stateHash === stateHash(recomputedState);
}

/**
 * Serialize audit trail to JSONL (one JSON object per line).
 * @param {object} header
 * @param {object[]} steps
 * @returns {string}
 */
function toJSONL(header, steps) {
  return [JSON.stringify(header), ...steps.map(s => JSON.stringify(s))].join('\n');
}

/**
 * Parse JSONL audit trail.
 * @param {string} jsonl
 * @returns {{ header: object, steps: object[] }}
 */
function fromJSONL(jsonl) {
  const lines = jsonl.trim().split('\n').map(l => JSON.parse(l));
  return { header: lines[0], steps: lines.slice(1) };
}

module.exports = {
  stateHash, createHeader, createStep, verifyStep, toJSONL, fromJSONL
};
