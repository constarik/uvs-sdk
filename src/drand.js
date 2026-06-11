/**
 * UVS drand helpers — League of Entropy public randomness beacon (quicknet).
 *
 * Round/time math + randomness derivation, used by uvLottery as its mandatory
 * randomness source (uvLs.md §4). Network fetch is optional and uses the global
 * `fetch` (Node 18+) if present, so this module stays dependency-free.
 */

'use strict';

const { sha256 } = require('./hash');

const QUICKNET = {
  beacon: 'quicknet',
  period: 3,
  genesis: 1692803367,
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971'
};

/** drand round live at a unix time (round 1 is at genesis). */
function roundAt(unixSec, info = QUICKNET) {
  return Math.floor((unixSec - info.genesis) / info.period) + 1;
}

/** Publication time (unix) of a round. */
function timeOfRound(round, info = QUICKNET) {
  return info.genesis + (round - 1) * info.period;
}

/** A round that has NOT been published yet at `unixNow` — the anti-grinding pattern. */
function futureRound(unixNow, aheadSeconds = 9, info = QUICKNET) {
  const ahead = Math.max(1, Math.ceil(aheadSeconds / info.period));
  const round = roundAt(unixNow, info) + ahead;
  return { round, time: timeOfRound(round, info) };
}

/**
 * §5.4.1 derived-R rule: the round bound to a draw is the FIRST round strictly AFTER the proven
 * timestamp `genTime`. Then `genTime < timeOfRound(R)` holds by construction and R is not the
 * operator's choice (nothing to grind). With two TSAs, pass the LATEST token's genTime (max).
 * @returns {{ round:number, time:number }}
 */
function roundAfter(genTime, info = QUICKNET) {
  const round = roundAt(genTime, info) + 1;
  return { round, time: timeOfRound(round, info) };
}

/** Verify a derived-R record's ordering: R == roundAt(genTime)+1 AND genTime < timeOfRound(R). */
function checkAnchorRound(genTime, round, info = QUICKNET) {
  const expectedRound = roundAt(genTime, info) + 1;
  const roundTime = timeOfRound(round, info);
  return { ok: round === expectedRound && genTime < roundTime, expectedRound, roundTime, genBeforeRound: genTime < roundTime };
}

/** randomness = SHA-256(signature bytes). drand also returns `randomness` directly. */
function randomnessOf(signatureHex) {
  return sha256(Buffer.from(signatureHex, 'hex'));
}

/**
 * Fetch a round from the public beacon. `opts.fetch` defaults to the global
 * `fetch` (Node 18+); pass your own to avoid the dependency on global fetch.
 * @returns {Promise<{ round:number, signature:string, randomness:string, time:number }>}
 */
async function fetchRound(round, opts = {}) {
  const info = opts.info || QUICKNET;
  const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('drand.fetchRound: no fetch available; pass opts.fetch');
  const base = opts.base || ('https://api.drand.sh/' + info.chainHash + '/public/');
  const j = await (await f(base + round)).json();
  return {
    round: j.round,
    signature: j.signature,
    randomness: j.randomness || randomnessOf(j.signature),
    time: timeOfRound(j.round, info)
  };
}

module.exports = { QUICKNET, roundAt, timeOfRound, futureRound, roundAfter, checkAnchorRound, randomnessOf, fetchRound };
