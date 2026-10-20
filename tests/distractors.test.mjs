import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeOptions, candidates } from '../js/distractors.js';
import { ALL_KEYS, parse } from '../js/facts.js';
import { seeded } from './helpers.mjs';

test('pro všech 100 příkladů: 4 různá kladná čísla, správné je mezi nimi', () => {
  const rng = seeded(11);
  for (const k of ALL_KEYS) {
    const { a, b } = parse(k);
    for (let i = 0; i < 20; i++) {
      const opts = makeOptions(a, b, null, rng);
      assert.equal(opts.length, 4, k);
      assert.equal(new Set(opts).size, 4, k);
      assert.ok(opts.includes(a * b), k);
      for (const v of opts) assert.ok(Number.isInteger(v) && v > 0 && v <= 110, `${k}: ${v}`);
    }
  }
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
