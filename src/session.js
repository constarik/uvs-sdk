/**
 * UVS Session — Sections 4, 5, 9
 * High-level session management for game integration.
 *
 * Usage (Stateless):
 *   const s = UvsSession.stateless({ serverSeed, clientSeed, nonce, params });
 *   const rng = s.rng;
 *   // ... run game with rng ...
 *   s.recordStep(input, output, state);
 *   const trail = s.reveal();
 *
 * Usage (Move Batch, G=ALL):
 *   const s = UvsSession.moveBatch({ serverSeed, clientSeed, nonce, params });
 *   s.recordMove({ col: 3 }, output, state);
 *   s.recordMove({ col: 5 }, output, state);
 *   const trail = s.reveal();
 *
 * Usage (Move Sync, G=1):
 *   const s = UvsSession.moveSync({ serverSeed, clientSeed, nonce, players, params });
 *   s.recordTick({ player1: {x:3}, player2: {x:5} }, output, state);
 *   const trail = s.reveal();
 */

'use strict';

const { commit, deriveCombinedSeed, verify, sessionId } = require('./seed');
const { ChaCha20 } = require('./chacha20');
const { createHeader, createStep, stateHash, toJSONL } = require('./audit');

const STATES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  MOVE: 'MOVE',
  REVEALED: 'REVEALED',
  HALTED: 'HALTED'
};

class UvsSession {
  constructor(opts) {
    this._serverSeed = opts.serverSeed;
    this._clientSeed = opts.clientSeed;
    this._nonce = opts.nonce;
    this._gameMode = opts.gameMode;
    this._granularity = opts.granularity || (opts.gameMode === 'stateless' ? null : 'ALL');
    this._inputSeeded = opts.inputSeeded || false;
    this._params = opts.params || {};
    this._players = opts.players || [];
    this._moveOrdering = opts.moveOrdering || 'playerId';
    this._timeout = opts.timeout || 0;
    this._protected = opts.protected || null;
    this._uvsVersion = opts.uvsVersion || 2;

    // Derived values
    const c = commit(this._serverSeed);
    this._serverSeedHash = c.serverSeedHash;
    this._combinedSeed = deriveCombinedSeed(this._serverSeed, this._clientSeed, this._nonce);
    this._sessionId = sessionId(this._serverSeedHash, this._clientSeed, this._nonce);

    // RNG
    this._rng = ChaCha20.fromCombinedSeed(this._combinedSeed);

    // State
    this._state = STATES.PENDING;
    this._stepNum = 0;
    this._steps = [];
    this._rngSnapshot = [];

    // Header
    this._header = createHeader({
      uvsVersion: this._uvsVersion,
      sessionId: this._sessionId,
      gameMode: this._gameMode,
      granularity: this._granularity,
      inputSeeded: this._inputSeeded,
      serverSeedHash: this._serverSeedHash,
      clientSeed: this._clientSeed,
      minNonce: this._nonce,
      params: this._params,
      players: this._players.length > 0 ? this._players : undefined,
      moveOrdering: this._gameMode === 'move' ? this._moveOrdering : undefined,
      timeout: this._timeout > 0 ? this._timeout : undefined,
      protected: this._protected
    });
  }

  // --- Factory methods ---

  static stateless(opts) {
    return new UvsSession({ ...opts, gameMode: 'stateless' });
  }

  static moveBatch(opts) {
    return new UvsSession({ ...opts, gameMode: 'move', granularity: 'ALL' });
  }

  static moveSync(opts) {
    return new UvsSession({ ...opts, gameMode: 'move', granularity: 1 });
  }

  // --- Accessors ---

  get rng() { return this._rng; }
  get state() { return this._state; }
  get sessionId() { return this._sessionId; }
  get serverSeedHash() { return this._serverSeedHash; }
  get combinedSeed() { return this._combinedSeed; }
  get header() { return this._header; }
  get steps() { return this._steps; }

  // --- Recording ---

  /**
   * Record a step (stateless or generic).
   * @param {object|null} input
   * @param {object} output
   * @param {object} gameState — current game state for stateHash
   * @param {number[]} [rngCalls] — RNG values used this step
   */
  recordStep(input, output, gameState, rngCalls) {
    if (this._state === STATES.REVEALED || this._state === STATES.HALTED)
      throw new Error('Session is ' + this._state);
    this._state = STATES.ACTIVE;
    const step = createStep(this._stepNum++, input, output, gameState, rngCalls);
    this._steps.push(step);
    return step;
  }

  /** Alias for Move mode — records a player Move. */
  recordMove(move, output, gameState, rngCalls) {
    return this.recordStep(move, output, gameState, rngCalls);
  }

  /** Alias for Move Sync — records a tick with all player Moves. */
  recordTick(moves, output, gameState, rngCalls) {
    return this.recordStep(moves, output, gameState, rngCalls);
  }

  // --- Reveal & Verify ---

  /**
   * Reveal the serverSeed, close the session, return audit trail.
   * @returns {{ header: object, steps: object[], serverSeed: string }}
   */
  reveal() {
    this._state = STATES.REVEALED;
    return {
      header: this._header,
      steps: this._steps,
      serverSeed: this._serverSeed
    };
  }

  /**
   * Export audit trail as JSONL string.
   * @returns {string}
   */
  toJSONL() {
    return toJSONL(this._header, this._steps);
  }

  /**
   * Halt the session (fatal error).
   * @param {string} errorCode — e.g. 'ERR_HASH_MISMATCH'
   */
  halt(errorCode) {
    this._state = STATES.HALTED;
    this._steps.push({ error: errorCode, timestamp: new Date().toISOString() });
  }

  // --- Static verification ---

  /**
   * Verify a revealed session's seed commitment.
   * @param {string} serverSeed
   * @param {string} serverSeedHash
   * @returns {boolean}
   */
  static verifySeed(serverSeed, serverSeedHash) {
    return verify(serverSeed, serverSeedHash);
  }

  /**
   * Replay a session from audit trail and verify all stateHashes.
   * @param {object} trail — { header, steps, serverSeed }
   * @param {function} engine — (rng, params, step, input) => { output, state }
   * @returns {{ valid: boolean, failedStep?: number, expected?: string, actual?: string }}
   */
  static replay(trail, engine) {
    // Verify seed commitment
    if (!verify(trail.serverSeed, trail.header.serverSeedHash)) {
      return { valid: false, error: 'ERR_HASH_MISMATCH' };
    }

    // Reconstruct RNG
    const combined = deriveCombinedSeed(
      trail.serverSeed, trail.header.clientSeed, trail.header.minNonce
    );
    const rng = ChaCha20.fromCombinedSeed(combined);

    // Replay each step
    for (let i = 0; i < trail.steps.length; i++) {
      const step = trail.steps[i];
      if (step.error) continue; // skip error records
      const result = engine(rng, trail.header.params, step.step, step.input);
      const recomputedHash = stateHash(result.state);
      if (recomputedHash !== step.stateHash) {
        return {
          valid: false,
          failedStep: step.step,
          expected: step.stateHash,
          actual: recomputedHash
        };
      }
    }

    return { valid: true };
  }
}

module.exports = { UvsSession, STATES };
