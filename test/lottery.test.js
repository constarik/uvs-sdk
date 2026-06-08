/**
 * @constarik/uvs-sdk — uvLottery test vectors.
 * Reproduces verifiers/test-vectors.json (uvLs.md) byte-for-byte.
 */

'use strict';

const { lottery, drand } = require('../src');

// ── canonical draw vector (verifiers/test-vectors.json) ──
const record = {
  serverSeed: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f70811223344556',
  drand: { round: 29286636, randomness: 'e8d0543d60b639cf02775d16d8bc66f281b7bcbdf59706f29a1684889f8b9548' },
  participants: Array.from({ length: 20 }, (_, i) => 'TICKET-' + String(i + 1).padStart(4, '0')),
  winners: 5,
  prizeLabel: 'SEAT'
};
const EXPECT_COMBINED = '32ca5bd0df3efe8ce416e9a9a4a9f797422eed24b1d0f6b455d915364caeced8';
const EXPECT_WINNERS = ['TICKET-0002', 'TICKET-0012', 'TICKET-0001', 'TICKET-0005', 'TICKET-0006'];

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('  ✓ ' + label); passed++; }
  else { console.log('  ✗ ' + label + '\n    expected: ' + e + '\n    actual  : ' + a); failed++; }
}

console.log('\n══ @constarik/uvs-sdk v3 — uvLottery Test Vector ══\n');

// 1. combinedSeed
const combined = lottery.combinedSeed(record.serverSeed, record.drand.randomness);
check('combinedSeed = SHA-256(serverSeed:randomness)', combined, EXPECT_COMBINED);

// 2. full allocation → winners
const prizes = lottery.poolOf(record);
const result = lottery.allocate(record.participants, combined, prizes);
check('top-5 winners match vector', result.slice(0, 5).map(r => r.id), EXPECT_WINNERS);
check('all 5 prizes are SEAT', result.slice(0, 5).map(r => r.prize), Array(5).fill('SEAT'));
check('rank 6+ has no prize', result[5].prize, null);

// 3. verifyDraw convenience
const v = lottery.verifyDraw(record);
check('verifyDraw reproduces combinedSeed', v.combinedSeed, EXPECT_COMBINED);
check('verifyDraw reproduces winners', v.result.slice(0, 5).map(r => r.id), EXPECT_WINNERS);

// 4. single lookup == full allocation
const lk = lottery.lookup(record.participants, combined, 'TICKET-0002', prizes);
check('lookup TICKET-0002 → rank 1, SEAT', [lk.rank, lk.prize], [1, 'SEAT']);
const lkLose = lottery.lookup(record.participants, combined, 'TICKET-0007', prizes);
check('lookup TICKET-0007 → no prize', lkLose.prize, null);

// 5. drand round/time math
check('roundAt(genesis) = 1', drand.roundAt(drand.QUICKNET.genesis), 1);
check('timeOfRound(1) = genesis', drand.timeOfRound(1), drand.QUICKNET.genesis);
check('futureRound is ahead of now', drand.futureRound(Math.floor(Date.now() / 1000), 9).round > drand.roundAt(Math.floor(Date.now() / 1000)), true);

console.log('\n══ Summary ══');
console.log('  Passed: ' + passed + '   Failed: ' + failed);
console.log(failed === 0 ? '\n  ✓ ALL uvLottery VECTORS PASS\n' : '\n  ✗ FAILURES\n');
process.exit(failed > 0 ? 1 : 0);
