# @uncloned/uvs

**Uncloned Verification Standard v2** — provably fair game protocol SDK.

Specification: [github.com/constarik/uvs](https://github.com/constarik/uvs)  
Author: [uncloned.work](https://uncloned.work)

## Install

```bash
npm install @uncloned/uvs
```

## Quick Start

### Stateless Game (slot, dice, crash)

```js
const { UvsSession } = require('@uncloned/uvs');

// Server generates seed and commitment
const session = UvsSession.stateless({
  serverSeed: 'deadbeef...', // 64+ hex chars
  clientSeed: 'player_seed_42',
  nonce: 1,
  params: { game: 'dice', sides: 6 }
});

// Use the built-in ChaCha20 RNG
const outcome = session.rng.nextInt(1, 6);

// Record the step
session.recordStep(null, { outcome }, { balance: 900, step: 1 });

// Reveal seed and get audit trail
const trail = session.reveal();
```

### Move Batch (single-player arcade, G=ALL)

```js
const session = UvsSession.moveBatch({
  serverSeed, clientSeed, nonce: 1,
  params: { game: 'erosion', gridSize: 6 }
});

// Player makes moves
session.recordMove({ col: 3 }, { eroded: [0,1,2] }, gameState);
session.recordMove({ col: 5 }, { eroded: [3,4] }, gameState);

const trail = session.reveal();
```

### Move Sync (multiplayer, G=1)

```js
const session = UvsSession.moveSync({
  serverSeed, clientSeed, nonce: 1,
  players: ['alice', 'bob'],
  params: { game: 'soiron' }
});

session.recordTick(
  { alice: { col: 2 }, bob: { col: 5 } },
  { eroded: { alice: [0,1], bob: [3,4] } },
  gameState
);

const trail = session.reveal();
```

### Verification

```js
const { UvsSession } = require('@uncloned/uvs');

// Verify seed commitment
UvsSession.verifySeed(trail.serverSeed, trail.header.serverSeedHash);
// → true

// Full replay verification
const result = UvsSession.replay(trail, (rng, params, step, input) => {
  // Re-run your game engine with the same RNG
  const outcome = myEngine(rng, params, input);
  return { output: outcome, state: computeState(outcome) };
});
// → { valid: true }
```

## API

### ChaCha20

```js
const { ChaCha20 } = require('@uncloned/uvs');
const rng = ChaCha20.fromCombinedSeed(hexSeed);

rng.nextUint32();     // 0..4294967295
rng.nextFloat();      // [0, 1)
rng.nextInt(1, 6);    // 1..6
rng.nextIndex(10);    // 0..9
rng.calls;            // total consumed
```

### Seed Protocol

```js
const { commit, verify, deriveCombinedSeed, createRng, generate } = require('@uncloned/uvs');

const { serverSeed, serverSeedHash } = generate();
const combined = deriveCombinedSeed(serverSeed, clientSeed, nonce);
const rng = createRng(serverSeed, clientSeed, nonce);
const ok = verify(serverSeed, serverSeedHash);
```

### Audit Trail

```js
const { stateHash, toJSONL, fromJSONL } = require('@uncloned/uvs');

const hash = stateHash({ balance: 900, step: 1 });
const jsonl = session.toJSONL();
const { header, steps } = fromJSONL(jsonl);
```

### Version Negotiation

```js
const { negotiate } = require('@uncloned/uvs');

negotiate([1, 2], [2, 3]);
// → { accepted: true, negotiated: 2 }

negotiate([1], [2, 3]);
// → { accepted: false, clientVersions: [1], serverVersions: [2, 3] }
```

## Test Vectors

```bash
npm test
```

Runs all test vectors from the UVS specification.

## License

MIT
