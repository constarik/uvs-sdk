/**
 * @uncloned/uvs — Test Vector Verification
 * Verifies all published UVS v1/v2 test vectors against the SDK.
 */

'use strict';

const {
  ChaCha20, sha256, sha512, canonicalJSON,
  commit, deriveCombinedSeed, createRng, verify, sessionId,
  stateHash, UvsSession, negotiate
} = require('../src');

// ── Test inputs (from SPEC Section 15 / test-vectors.js) ──
const serverSeed  = 'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718';
const clientSeed  = 'player_seed_42';
const nonce       = '1';
const minNonce    = 1;

let passed = 0, failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log('  ✓ ' + label);
    passed++;
  } else {
    console.log('  ✗ ' + label);
    console.log('    expected: ' + expected);
    console.log('    actual  : ' + actual);
    failed++;
  }
}

console.log('\n══ @uncloned/uvs v2 — Test Vector Verification ══\n');

// ── 1. serverSeedHash ──
console.log('1. serverSeedHash (SHA-256):');
check('commit().serverSeedHash',
  commit(serverSeed).serverSeedHash,
  '0dc3c92d4a8b8c6cab67eee53e8177f679e5efa47cce6eb741255466f8dfcf3e'
);
check('verify(seed, hash)',
  verify(serverSeed, '0dc3c92d4a8b8c6cab67eee53e8177f679e5efa47cce6eb741255466f8dfcf3e'),
  true
);

// ── 2. sessionId ──
console.log('\n2. sessionId:');
const hash = commit(serverSeed).serverSeedHash;
check('sessionId(hash, clientSeed, minNonce)',
  sessionId(hash, clientSeed, minNonce),
  'b2332394bde343fb52bd8ff036c4558a29b480733c0d8973f2c78bfa8966fc35'
);

// ── 3. combinedSeed ──
console.log('\n3. combinedSeed (SHA-512):');
const combined = deriveCombinedSeed(serverSeed, clientSeed, nonce);
check('deriveCombinedSeed()',
  combined,
  '446a9c96178ffba4ccceaf7fcd9682b477cdbad1ec6d2c2406a68223c807d11113824954467e8df504de08aa61ce27b0901f6f35a5661c759c6c338f0e817a99'
);

const csBuf = Buffer.from(combined, 'hex');
check('key (bytes 0-31)',
  csBuf.slice(0, 32).toString('hex'),
  '446a9c96178ffba4ccceaf7fcd9682b477cdbad1ec6d2c2406a68223c807d111'
);
check('nonce (bytes 32-43)',
  csBuf.slice(32, 44).toString('hex'),
  '13824954467e8df504de08aa'
);

// ── 4. ChaCha20 keystream ──
console.log('\n4. ChaCha20 keystream (counter=0):');
const rng = ChaCha20.fromCombinedSeed(combined);
const expected = [618181213, 145813622, 1951481150, 3878276046, 36465895, 1329852316, 500724006, 987159170];
for (let i = 0; i < 8; i++) {
  const val = rng.nextUint32();
  check('rngCalls[' + i + '] = ' + expected[i] + ' (0x' + expected[i].toString(16) + ')',
    val, expected[i]);
}

// ── 5. Full simulation step ──
console.log('\n5. Full simulation step:');
const rng2 = ChaCha20.fromCombinedSeed(combined);
const outcome = (rng2.nextUint32() % 6) + 1;
check('outcome = (rngCalls[0] % 6) + 1', outcome, 2);

const state = { balance: 900, step: 1 };
check('stateHash({ balance: 900, step: 1 })',
  stateHash(state),
  '5e1fc7e7a541ecb9c8ed55c21950f40d5b7d06f79d8b9e4dcede9636520c3ce6'
);

// ── 6. canonicalJSON ──
console.log('\n6. canonicalJSON:');
check('sorted keys',
  canonicalJSON({ z: 1, a: 2, m: 3 }),
  '{"a":2,"m":3,"z":1}'
);
check('nested sorted',
  canonicalJSON({ b: { z: 1, a: 2 }, a: 1 }),
  '{"a":1,"b":{"a":2,"z":1}}'
);
check('array',
  canonicalJSON([3, 1, 2]),
  '[3,1,2]'
);
check('null',
  canonicalJSON(null),
  'null'
);

// ── 7. createRng convenience ──
console.log('\n7. createRng():');
const rng3 = createRng(serverSeed, clientSeed, nonce);
check('createRng first value matches',
  rng3.nextUint32(), expected[0]);

// ── 8. Version negotiation ──
console.log('\n8. Version negotiation:');
const r1 = negotiate([1, 2, 3], [2, 3, 4]);
check('intersection [2,3] → max=3', r1.negotiated, 3);
check('accepted=true', r1.accepted, true);

const r2 = negotiate([1, 2], [3, 4]);
check('empty intersection → rejected', r2.accepted, false);

// ── 9. Session API ──
console.log('\n9. UvsSession:');
const sess = UvsSession.stateless({
  serverSeed, clientSeed, nonce: minNonce, params: { game: 'dice' }
});
check('session state = PENDING', sess.state, 'PENDING');
check('sessionId matches', sess.sessionId,
  sessionId(hash, clientSeed, minNonce));

sess.recordStep(null, { outcome: 2 }, { balance: 900, step: 1 });
check('session state = ACTIVE', sess.state, 'ACTIVE');
check('1 step recorded', sess.steps.length, 1);

const trail = sess.reveal();
check('session state = REVEALED', sess.state, 'REVEALED');
check('trail.serverSeed matches', trail.serverSeed, serverSeed);
check('trail.header.gameMode = stateless', trail.header.gameMode, 'stateless');

// Verify seed
check('verifySeed()',
  UvsSession.verifySeed(trail.serverSeed, trail.header.serverSeedHash), true);

// ── Summary ──
console.log('\n══ Summary ══');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log(failed === 0 ? '\n  ✓ ALL VECTORS PASS\n' : '\n  ✗ FAILURES DETECTED\n');
process.exit(failed > 0 ? 1 : 0);
