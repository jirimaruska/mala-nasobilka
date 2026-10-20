import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundReport } from '../js/progress.js';
import { createRound, answerCurrent } from '../js/round.js';
import { recordAnswer } from '../js/learning.js';
import { emptyFact } from '../js/storage.js';
import { NOW, seeded } from './helpers.mjs';

function fact(props) {
  return { ...emptyFact(), ...props };
}

test('shrnutí kola: co se zlepšilo a co procvičit', () => {
  const facts = {
    '7x8': fact({ n: 2, ok: 1, bad: 1, lvl: 0, due: NOW - 1, ms: 4000, h: [4000, -1] }),
    '6x7': fact({ n: 3, ok: 3, lvl: 1, due: NOW - 1, ms: 4500, h: [4500, 4500, 4500] }),
    '3x4': fact({ n: 3, ok: 3, lvl: 2, due: NOW - 1, ms: 2000, h: [2000, 2000, 2000] }),
    '9x6': fact({ n: 1, ok: 1, lvl: 2, due: NOW - 1, ms: 2000, h: [2000] }),
    '8x7': fact({ n: 1, ok: 1, lvl: 1, due: NOW - 1, ms: 5500, h: [5500] }),
    '2x2': fact({ n: 5, ok: 5, lvl: 5, due: NOW - 1, ms: 900, h: [900] }),
  };
  // 9 × 6 je skoro na konci, takže se v kole neopakuje a pořadí odpovědí sedí.
  const keys = ['7x8', '6x7', '3x4', '2x2', '9x6', '8x7'];
  const before = JSON.parse(JSON.stringify(facts));
  const round = createRound({ keys, kinds: Object.fromEntries(keys.map((k) => [k, 'due'])) }, NOW);
  const plan = { '7x8': ['ok', 2000], '6x7': ['ok', 2000], '3x4': ['ok', 1500], '9x6': ['bad', 1500], '8x7': ['ok', 6200], '2x2': ['ok', 1000] };
  const rng = seeded(1);
  for (const k of keys) {
    const [result, ms] = plan[k];
    recordAnswer(facts[k], { result, ms, chosen: result === 'bad' ? 45 : null }, NOW, rng);
    answerCurrent(round, { result, ms }, rng);
  }
  const report = roundReport({ round, before, after: facts, prevRound: { score: 10, ok: 2 }, record: true });

  assert.deepEqual(
    report.improved.map((x) => [x.key, x.why]),
    [
      ['7x8', 'fixed'],
      ['3x4', 'learned'],
      ['6x7', 'faster'],
    ]
  );
  assert.deepEqual(
    report.practice.map((x) => [x.key, x.why]),
    [
      ['9x6', 'missed'],
      ['8x7', 'slow'],
    ]
  );
  assert.equal(report.ok, 5);
  assert.equal(report.n, 6);
  assert.equal(report.record, true);
  assert.deepEqual(report.prev, { score: 10, ok: 2 });
});
