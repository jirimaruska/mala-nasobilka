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

test('statistiky pro rodiče', async () => {
  const { parentStats, dayKey } = await import('../js/progress.js');
  const { createEmpty } = await import('../js/storage.js');
  const data = createEmpty(NOW);
  Object.assign(data.facts['7x8'], { n: 6, ok: 6, lvl: 5, ms: 1500, h: [1500], last: NOW });
  Object.assign(data.facts['8x7'], { n: 5, ok: 1, bad: 4, lvl: 0, ms: 5000, h: [-1, -1, 5000, -1, -1] });
  Object.assign(data.facts['6x9'], { n: 4, ok: 4, lvl: 3, ms: 2000, h: [2000] });
  Object.assign(data.facts['9x6'], { n: 3, ok: 3, lvl: 2, ms: 2500, h: [2500] });
  data.days[dayKey(NOW)] = { n: 10, ok: 8, ms: 16000, rounds: 1, time: 90000 };
  data.days[dayKey(NOW - 3 * 86400000)] = { n: 10, ok: 6, ms: 12000, rounds: 1, time: 60000 };
  data.days[dayKey(NOW - 30 * 86400000)] = { n: 20, ok: 10, ms: 30000, rounds: 1, time: 100000 };
  data.best = 400;

  const s = parentStats(data, NOW);
  assert.equal(s.known, 2);
  assert.equal(s.sure, 1);
  assert.equal(s.seen, 4);
  assert.equal(s.answers, 40);
  assert.equal(s.accuracy, 24 / 40);
  assert.equal(s.weekAccuracy, 14 / 20);
  assert.equal(s.avgMs, 58000 / 24);
  assert.equal(s.rounds, 3);
  assert.equal(s.daysPlayed, 3);
  assert.equal(s.streak, 1);
  assert.equal(s.lastPlayed, NOW);
  assert.equal(s.hardest[0].key, '8x7');
  assert.deepEqual(s.oneWay.map((x) => [x.good, x.weak]), [['7x8', '8x7']]);
  assert.equal(s.last14.length, 14);
  assert.equal(s.last14.at(-1).key, dayKey(NOW));
  assert.equal(s.last14.at(-1).n, 10);
});

test('statistiky pro rodiče: nula ve dvojicích „jen jedním směrem“ a v počtech', async () => {
  const { parentStats } = await import('../js/progress.js');
  const { createEmpty } = await import('../js/storage.js');
  const data = createEmpty(NOW);
  Object.assign(data.facts['0x7'], { n: 5, ok: 5, lvl: 5, ms: 1200, h: [1200] });
  Object.assign(data.facts['7x0'], { n: 3, ok: 0, bad: 3, lvl: 0, h: [-1, -1, -1], wrong: [7] });
  const s = parentStats(data, NOW);
  assert.deepEqual(s.oneWay.map((x) => [x.good, x.weak]), [['0x7', '7x0']]);
  assert.equal(s.hardest[0].key, '7x0');
  assert.equal(s.seen, 2);
  assert.equal(s.sure, 1);
});

test('statistiky pro rodiče: násobení a dělení zvlášť, dělení zaostává', async () => {
  const { parentStats } = await import('../js/progress.js');
  const { createEmpty } = await import('../js/storage.js');
  const data = createEmpty(NOW);
  Object.assign(data.facts['7x8'], { n: 6, ok: 6, lvl: 5, ms: 1500, h: [1500] });
  Object.assign(data.facts['56:8'], { n: 4, ok: 1, bad: 3, lvl: 0, ms: 4800, h: [-1, -1, 4800, -1] });
  Object.assign(data.facts['56:7'], { n: 2, ok: 2, lvl: 3, ms: 2100, h: [2100, 2000] });
  Object.assign(data.facts['3x4'], { n: 3, ok: 3, lvl: 3, ms: 1800, h: [1800] });
  Object.assign(data.facts['12:4'], { n: 2, ok: 2, lvl: 2, ms: 2500, h: [2500] });
  const s = parentStats(data, NOW);
  assert.deepEqual(s.mul, { total: 121, known: 2, sure: 1, seen: 2 });
  assert.deepEqual(s.div, { total: 110, known: 1, sure: 0, seen: 3 });
  assert.deepEqual(s.divLag.map((x) => [x.div, x.mul]), [['56:8', '7x8']]);
  assert.deepEqual(s.oneWay, [], 'dělení do dvojic násobení nepatří');
  assert.equal(s.hardest[0].key, '56:8');
});
