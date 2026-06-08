# @constarik/uvs-sdk

**Uncloned Verification Standard v3** — provably fair by mathematics, not by trust.

One primitive, two branches, in one small dependency-free library:

- **uvLottery** — verifiable draws (lotteries, gacha, raffles, allocations): one seeded permutation anyone can recompute, sealed by a public **drand** round.
- **uvGame** — interactive games: ChaCha20 keystream, commit-reveal, sessions, audit trail.

Standard: [github.com/constarik/uvs](https://github.com/constarik/uvs) · Site: [uncloned.work](https://uncloned.work)

## Install

Published to GitHub Packages. Add the scope registry once, then install:

```bash
echo "@constarik:registry=https://npm.pkg.github.com" >> .npmrc
npm install @constarik/uvs-sdk
```

## uvLottery — verify a draw

A draw is one operation: `combinedSeed = SHA-256(serverSeed : drandRandomness)`, then
each entry's `score = SHA-256(combinedSeed : id)`, sorted high→low, with the published
pool dealt onto that order.

```js
const { lottery } = require('@constarik/uvs-sdk');

const record = {
  serverSeed: 'a1b2c3…',                       // committed before the draw, revealed after
  drand: { round: 29286636, randomness: 'e8d0…' }, // a public drand round (re-fetchable)
  participants: ['TICKET-0001', 'TICKET-0002', /* … */],
  winners: 5, prizeLabel: 'SEAT'               // or an explicit prizes: [...] pool
};

const { combinedSeed, result } = lottery.verifyDraw(record);
// result: [{ rank, id, prize, score }, …] — same on any machine, in any language.

// or check just one entry, no sort:
lottery.lookup(record.participants, combinedSeed, 'TICKET-0002', lottery.poolOf(record));
// → { id, present, rank, prize, score }
```

This reproduces [`verifiers/test-vectors.json`](https://github.com/constarik/uvs/tree/master/verifiers) byte-for-byte (combined `32ca5bd0…`, winners `TICKET-0002, 0012, 0001, 0005, 0006`).

## drand (the randomness source)

```js
const { drand } = require('@constarik/uvs-sdk');

const now = Math.floor(Date.now() / 1000);
const fr  = drand.futureRound(now, 9);          // a round that hasn't happened yet (anti-grind)
const r   = await drand.fetchRound(fr.round);   // { round, signature, randomness, time }
// commit the round before it publishes; derive the seed from r.randomness after.
```

`drand.QUICKNET` carries the beacon parameters (chainHash, period 3 s, genesis). Fetch
is optional — pass `{ fetch }` or rely on global `fetch` (Node 18+).

## uvGame — commit-reveal + deterministic RNG

```js
const { commit, deriveCombinedSeed, ChaCha20, UvsSession } = require('@constarik/uvs-sdk');

const { serverSeedHash } = commit(serverSeed);                  // publish before play
const combined = deriveCombinedSeed(serverSeed, clientSeed, nonce); // SHA-512
const rng = ChaCha20.fromCombinedSeed(combined);               // RFC 8439 keystream
```

`UvsSession`, `stateHash`, `canonicalJSON`, and `negotiate` (version negotiation) round out the game side.

## Modules

| Import | What |
|---|---|
| `@constarik/uvs-sdk/lottery` | uvLottery draw: `combinedSeed · score · permute · allocate · lookup · poolOf · verifyDraw` |
| `@constarik/uvs-sdk/drand` | beacon helpers: `QUICKNET · roundAt · timeOfRound · futureRound · randomnessOf · fetchRound` |
| `@constarik/uvs-sdk/hash` | `sha256 · sha512 · randomHex · generateServerSeed` |
| `@constarik/uvs-sdk/canonical` | `canonicalJSON` |
| `@constarik/uvs-sdk/seed` | commit-reveal + combined-seed derivation |
| `@constarik/uvs-sdk/session` | `UvsSession` lifecycle |
| `@constarik/uvs-sdk/audit` | audit-trail records |
| `@constarik/uvs-sdk/chacha20` | ChaCha20 (RFC 8439) |
| `@constarik/uvs-sdk/version` | integer-set version negotiation |

## Conformance

```bash
npm test          # v2 game vectors + uvLottery draw vector — all green
```

Any implementation, in any language, that reproduces these vectors is UVS-conformant.

## Scope

This package is the **protocol primitives library**. The composable server host
(Express routes, registrar/storage/anchor modules, game plugins) and the live
reference implementations (PADDLA, Run-a-draw, Registrar) live in the main repo:
[github.com/constarik/uvs](https://github.com/constarik/uvs).

The protocol is the product; this SDK is one of potentially many implementations.

## License

MIT.
