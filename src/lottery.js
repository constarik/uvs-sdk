/**
 * UVS uvLottery — verifiable draws (seeded permutation). Standard: uvLs.md (v3).
 *
 * A draw is ONE operation: a seeded random permutation of the participants,
 * with a published prize pool dealt onto that order.
 *
 *   combinedSeed = SHA-256( serverSeed + ":" + drandRandomness )
 *   score(id)    = SHA-256( combinedSeed + ":" + id )
 *   order        = participants sorted by score DESC   (ties: id ASC)
 *   allocation   = order[i] receives prizes[i]         (null beyond the pool)
 *
 * Pure; depends only on ./hash. Reproduces verifiers/test-vectors.json byte-for-byte.
 */

'use strict';

const { sha256 } = require('./hash');

/** combinedSeed = SHA-256(serverSeed : drandRandomness). */
function combinedSeed(serverSeed, drandRandomness) {
  return sha256(serverSeed + ':' + drandRandomness);
}

/** score(id) = SHA-256(combinedSeed : id). */
function score(combined, id) {
  return sha256(combined + ':' + id);
}

/** uvLs §3.1: participant ids MUST be unique — a duplicate breaks the total order. Reject. */
function requireUnique(participants) {
  if (new Set(participants).size !== participants.length)
    throw new Error('INVALID: duplicate participant ids — record rejected (uvLs §3.1)');
}

// deterministic total order: highest score first, ties broken by id ascending
function _cmp(a, b) {
  if (a.score > b.score) return -1;
  if (a.score < b.score) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Full permutation: [{ id, score }], highest score first (ties: id asc). */
function permute(participants, combined) {
  requireUnique(participants);
  return participants.map(id => ({ id, score: score(combined, id) })).sort(_cmp);
}

/** Full allocation: order[i] receives prizes[i] (null beyond the pool). */
function allocate(participants, combined, prizes) {
  return permute(participants, combined).map((p, i) => ({
    rank: i + 1,
    id: p.id,
    prize: i < prizes.length ? prizes[i] : null,
    score: p.score
  }));
}

/** Single lookup — O(M) hashing, no sort (a participant checks only their own id). */
function lookup(participants, combined, id, prizes) {
  requireUnique(participants);
  const me = score(combined, id);
  let higher = 0, present = false;
  for (const a of participants) {
    if (a === id) { present = true; continue; }
    const s = score(combined, a);
    if (s > me || (s === me && a < id)) higher++;
  }
  const rank = higher + 1;
  return {
    id, present, rank,
    prize: present && rank <= prizes.length ? prizes[rank - 1] : null,
    score: me
  };
}

/** Build the prize pool: `prizes[]` | `prizePool[{tier,key,count}]` | `{ winners, prizeLabel }`. */
function poolOf(rules) {
  rules = rules || {};
  if (Array.isArray(rules.prizes)) return rules.prizes.slice();
  if (Array.isArray(rules.prizePool)) {
    const out = [];
    for (const e of rules.prizePool) {
      const label = e.key || e.tier || 'WIN';
      for (let i = 0; i < (e.count || 0); i++) out.push(label);
    }
    return out;
  }
  const n = rules.winners || rules.N || 0;
  return Array.from({ length: n }, () => rules.prizeLabel || 'WIN');
}

/**
 * Verify a draw record by recomputing it from scratch.
 * @param {{ serverSeed:string, drand:{randomness:string}, participants:string[] }} record
 *   plus a pool source (`prizes` | `prizePool` | `winners`+`prizeLabel`) at the top level or in `record.rules`.
 * @returns {{ combinedSeed:string, prizes:string[], result:Array }}
 */
function verifyDraw(record) {
  const cs = combinedSeed(record.serverSeed, record.drand.randomness);
  const prizes = poolOf(record.rules || record);
  const result = allocate(record.participants, cs, prizes);
  return { combinedSeed: cs, prizes, result };
}

module.exports = { combinedSeed, score, requireUnique, permute, allocate, lookup, poolOf, verifyDraw };
