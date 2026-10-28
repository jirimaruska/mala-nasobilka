import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOptions, candidates } from '../js/distractors.js';
import { seeded } from './helpers.mjs';

test('pro 0–10 × 0–10: 4 různá celá čísla od 0, správné je mezi nimi', () => {
  const rng = seeded(11);
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      const k = a + ' × ' + b;
      for (let i = 0; i < 20; i++) {
        const opts = makeOptions(a, b, null, rng);
        assert.equal(opts.length, 4, k);
        assert.equal(new Set(opts).size, 4, k);
        assert.ok(opts.includes(a * b), k);
        for (const v of opts) assert.ok(Number.isInteger(v) && v >= 0 && v <= 110, `${k}: ${v}`);
      }
    }
  }
});

test('nula jako špatná možnost jen u × 1', () => {
  const rng = seeded(12);
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      for (let i = 0; i < 20; i++) {
        if (makeOptions(a, b, null, rng).includes(0)) assert.ok(a === 1 || b === 1, a + ' × ' + b);
      }
    }
  }
  assert.ok(candidates(1, 6).has(0));
  assert.ok(candidates(6, 1).has(0));
});

test('krát nula: typické omyly jsou záměna s × 1 a připsaná nula', () => {
  const c = candidates(7, 0);
  assert.ok(c.has(7) && c.has(70), [...c.keys()].join(','));
  assert.ok(!c.has(0));
  assert.deepEqual([...candidates(0, 0).keys()].sort((x, y) => x - y), [1, 2, 10]);
  const rng = seeded(13);
  let withSeven = 0;
  for (let i = 0; i < 100; i++) if (makeOptions(0, 7, null, rng).includes(7)) withSeven++;
  assert.ok(withSeven > 80, `7 bylo jen ${withSeven}×`);
});

test('dřívější omyl 0 se u × 1 může vrátit', () => {
  assert.ok(candidates(1, 8, { wrong: [0] }).has(0));
});

test('špatné možnosti jsou typické omyly', () => {
  const c = candidates(7, 8);
  for (const v of [63, 49, 64, 48, 66, 46, 65, 54]) assert.ok(c.has(v), `7 × 8: chybí ${v}`);
  assert.ok(!c.has(56));
});

test('vždy aspoň jeden sousední násobek', () => {
  const rng = seeded(5);
  for (let i = 0; i < 200; i++) {
    const opts = makeOptions(7, 8, null, rng);
    assert.ok(opts.some((v) => [63, 49, 64, 48].includes(v)), opts.join(','));
  }
});

test('dřívější omyl dítěte se objevuje často', () => {
  const rng = seeded(9);
  const fact = { wrong: [42] };
  let seen = 0;
  for (let i = 0; i < 200; i++) if (makeOptions(7, 8, fact, rng).includes(42)) seen++;
  assert.ok(seen > 80, `42 bylo jen ${seen}×`);
});

test('správná odpověď je na různých místech', () => {
  const rng = seeded(3);
  const positions = new Set();
  for (let i = 0; i < 50; i++) positions.add(makeOptions(6, 7, null, rng).indexOf(42));
  assert.equal(positions.size, 4);
});
