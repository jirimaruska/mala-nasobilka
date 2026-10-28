import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordAnswer,
  mastery,
  difficulty,
  planRound,
  arrange,
  recentAccuracy,
  INTERVALS,
  HISTORY_LEN,
  ROUND_LEN,
  FAST_MS,
  SLOW_MS,
  MAX_LVL,
  ZERO_PER_ROUND,
  DIV_UNLOCK,
  NEW_DIV_PER_ROUND,
} from '../js/learning.js';
import { emptyFact } from '../js/storage.js';
import { ALL_KEYS, MUL_KEYS, DIV_KEYS, mirror, isZero, isDiv, mulOf, family } from '../js/facts.js';
import { NOW, MINUTE, HOUR, seeded, freshData } from './helpers.mjs';

const mid = () => 0.5; // bez rozptylu: odstup přesně podle INTERVALS

test('nový příklad, rychle a správně: přeskočí první krok', () => {
  const f = emptyFact();
  recordAnswer(f, { result: 'ok', ms: 1800 }, NOW, mid);
  assert.equal(f.n, 1);
  assert.equal(f.ok, 1);
  assert.equal(f.lvl, 2);
  assert.equal(f.due, NOW + INTERVALS[2]);
  assert.equal(f.ms, 1800);
  assert.equal(f.best, 1800);
  assert.deepEqual(f.h, [1800]);
});

test('nový příklad, pomalu: úroveň 1 a brzy znovu', () => {
  const f = emptyFact();
  recordAnswer(f, { result: 'ok', ms: SLOW_MS + 1000 }, NOW, mid);
  assert.equal(f.lvl, 1);
  assert.equal(f.due, NOW + INTERVALS[1]);
});

test('splatný příklad rychle: úroveň roste a odstup se prodlužuje', () => {
  const f = { ...emptyFact(), n: 3, ok: 3, lvl: 3, due: NOW - 1, ms: 2500, h: [2500] };
  recordAnswer(f, { result: 'ok', ms: 2000 }, NOW, mid);
  assert.equal(f.lvl, 4);
  assert.equal(f.due, NOW + INTERVALS[4]);
  assert.ok(INTERVALS[4] > INTERVALS[3]);
});

test('úroveň nepřeroste maximum', () => {
  const f = { ...emptyFact(), n: 9, ok: 9, lvl: MAX_LVL, due: NOW - 1 };
  recordAnswer(f, { result: 'ok', ms: 1000 }, NOW, mid);
  assert.equal(f.lvl, MAX_LVL);
});

test('před termínem se úroveň nezvyšuje a termín se neposune dřív', () => {
  const due = NOW + 3 * 24 * HOUR;
  const f = { ...emptyFact(), n: 4, ok: 4, lvl: 4, due };
  recordAnswer(f, { result: 'ok', ms: 1500 }, NOW, mid);
  assert.equal(f.lvl, 4);
  assert.ok(f.due >= due);
});

test('správně, ale ne rychle: úroveň drží', () => {
  const f = { ...emptyFact(), n: 2, ok: 2, lvl: 3, due: NOW - 1 };
  recordAnswer(f, { result: 'ok', ms: FAST_MS + 500 }, NOW, mid);
  assert.equal(f.lvl, 3);
});

test('správně, ale pomalu: úroveň klesne o jednu', () => {
  const f = { ...emptyFact(), n: 2, ok: 2, lvl: 3, due: NOW - 1 };
  recordAnswer(f, { result: 'ok', ms: SLOW_MS + 500 }, NOW, mid);
  assert.equal(f.lvl, 2);
});

test('špatně: úroveň klesne o dvě, příklad je hned na řadě, zapamatuje se omyl', () => {
  const f = { ...emptyFact(), n: 5, ok: 5, lvl: 5, due: NOW + 10 * HOUR };
  recordAnswer(f, { result: 'bad', ms: 2000, chosen: 54 }, NOW, mid);
  assert.equal(f.lvl, 3);
  assert.equal(f.due, NOW);
  assert.equal(f.bad, 1);
  assert.deepEqual(f.h, [-1]);
  assert.deepEqual(f.wrong, [54]);
  recordAnswer(f, { result: 'bad', chosen: 63 }, NOW, mid);
  recordAnswer(f, { result: 'bad', chosen: 54 }, NOW, mid);
  assert.deepEqual(f.wrong, [54, 63]);
  assert.equal(f.lvl, 0);
});

test('nestihnuto: počítá se zvlášť', () => {
  const f = emptyFact();
  recordAnswer(f, { result: 'late' }, NOW, mid);
  assert.equal(f.late, 1);
  assert.equal(f.bad, 0);
  assert.deepEqual(f.h, [-2]);
  assert.equal(f.ms, null);
});

test('opakování po chybě v kole nezvyšuje úroveň', () => {
  const f = emptyFact();
  recordAnswer(f, { result: 'bad', chosen: 10 }, NOW, mid);
  recordAnswer(f, { result: 'ok', ms: 1200, retry: true }, NOW + MINUTE, mid);
  assert.equal(f.lvl, 0);
  assert.equal(f.due, NOW + MINUTE + INTERVALS[1]);
  assert.equal(f.ok, 1);
});

test('historie má omezenou délku', () => {
  const f = emptyFact();
  for (let i = 0; i < HISTORY_LEN + 5; i++) recordAnswer(f, { result: 'ok', ms: 1000 + i }, NOW, mid);
  assert.equal(f.h.length, HISTORY_LEN);
  assert.equal(f.h.at(-1), 1000 + HISTORY_LEN + 4);
});

test('mastery podle úrovně', () => {
  assert.equal(mastery(emptyFact()), 0);
  assert.equal(mastery({ ...emptyFact(), n: 1, lvl: 0 }), 1);
  assert.equal(mastery({ ...emptyFact(), n: 1, lvl: 2 }), 2);
  assert.equal(mastery({ ...emptyFact(), n: 1, lvl: 3 }), 3);
  assert.equal(mastery({ ...emptyFact(), n: 1, lvl: 6 }), 4);
});

test('difficulty: chyby a pomalost zvyšují obtížnost', () => {
  const easy = { ...emptyFact(), n: 4, ms: 1500, h: [1500, 1400, 1600, 1500] };
  const slow = { ...emptyFact(), n: 4, ms: 6000, h: [6000, 6000, 6000, 6000] };
  const wrong = { ...emptyFact(), n: 4, ms: 4000, h: [-1, 4000, -2, -1] };
  assert.equal(difficulty(easy), 0);
  assert.ok(difficulty(slow) > difficulty(easy));
  assert.ok(difficulty(wrong) > difficulty(slow));
  assert.equal(recentAccuracy(wrong), 0.25);
});

const NON_ZERO = ALL_KEYS.filter((k) => !isZero(k));
const ZERO = ALL_KEYS.filter(isZero);

function checkPlan(plan) {
  assert.equal(plan.keys.length, ROUND_LEN);
  assert.equal(new Set(plan.keys).size, ROUND_LEN);
  for (const k of plan.keys) assert.ok(ALL_KEYS.includes(k));
  assert.deepEqual(Object.keys(plan.kinds).sort(), plan.keys.slice().sort());
  assert.ok(plan.keys.filter(isZero).length <= ZERO_PER_ROUND, 'moc příkladů s nulou: ' + plan.keys.join(' '));
}

test('první kolo: 20 různých nových příkladů, nanejvýš 2 s nulou', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const plan = planRound(freshData().facts, NOW, seeded(seed));
    checkPlan(plan);
    assert.ok(Object.values(plan.kinds).every((k) => k === 'new'));
  }
});

test('nula u dítěte, které už hrálo: přijdou právě 2 nové s nulou, ne celé kolo', () => {
  const d = freshData();
  NON_ZERO.forEach((k, i) => Object.assign(d.facts[k], { n: 4, ok: 4, lvl: 4, due: NOW + (i + 1) * HOUR }));
  const plan = planRound(d.facts, NOW, seeded(6));
  checkPlan(plan);
  assert.equal(plan.keys.filter(isZero).length, ZERO_PER_ROUND);
});

test('nula, která nejde, přijde, a k ní jedna nová nula, ať se objeví všechny', () => {
  const d = freshData();
  const weakZero = ['7x0', '0x7', '0x0'];
  for (const k of weakZero) Object.assign(d.facts[k], { n: 2, bad: 2, lvl: 0, due: NOW - HOUR, h: [-1, -1] });
  for (let seed = 1; seed <= 10; seed++) {
    const plan = planRound(d.facts, NOW, seeded(seed));
    checkPlan(plan);
    const zeros = plan.keys.filter(isZero);
    assert.equal(zeros.length, ZERO_PER_ROUND);
    assert.equal(zeros.filter((k) => weakZero.includes(k)).length, 1, zeros.join(' '));
    assert.equal(zeros.filter((k) => d.facts[k].n === 0).length, 1, zeros.join(' '));
  }
});

test('když nové nuly došly, obě místa dostanou nuly, které nejdou', () => {
  const d = freshData();
  for (const k of ZERO) Object.assign(d.facts[k], { n: 3, ok: 3, lvl: 4, due: NOW + 48 * HOUR });
  for (const k of ['7x0', '0x7']) Object.assign(d.facts[k], { n: 2, bad: 2, lvl: 0, due: NOW - HOUR, h: [-1, -1] });
  const plan = planRound(d.facts, NOW, seeded(8));
  checkPlan(plan);
  assert.deepEqual(plan.keys.filter(isZero).sort(), ['0x7', '7x0']);
});

test('co nejde, je v kole vždy, nové se pořád přidávají', () => {
  const d = freshData();
  const weak = ['7x8', '8x7', '6x9', '9x6', '7x6'];
  for (const k of weak) Object.assign(d.facts[k], { n: 3, bad: 3, lvl: 0, due: NOW - MINUTE, h: [-1, -1, -1] });
  const plan = planRound(d.facts, NOW, seeded(2));
  checkPlan(plan);
  for (const k of weak) assert.equal(plan.kinds[k], 'due');
  assert.equal(Object.values(plan.kinds).filter((k) => k === 'new').length, ROUND_LEN - weak.length);
});

test('hodně splatných: přednost mají ty nejslabší, ale 3 nové a 2 jisté zůstanou', () => {
  const d = freshData();
  const keys = NON_ZERO.slice(0, 60);
  keys.forEach((k, i) => {
    Object.assign(d.facts[k], { n: 2, ok: 1, lvl: i < 10 ? 0 : 2, due: NOW - HOUR });
  });
  for (const k of NON_ZERO.slice(60, 80)) Object.assign(d.facts[k], { n: 5, ok: 5, lvl: 4, due: NOW + 48 * HOUR });
  for (const k of [...NON_ZERO.slice(80), ...ZERO]) Object.assign(d.facts[k], { n: 5, ok: 5, lvl: 2, due: NOW + 48 * HOUR });
  // Nových zbývá jen pár: ať je jasné, že 3 nové se do kola vždy dostanou.
  for (const k of NON_ZERO.slice(80, 83)) Object.assign(d.facts[k], { n: 0, ok: 0, lvl: 0, due: 0 });
  const plan = planRound(d.facts, NOW, seeded(3));
  checkPlan(plan);
  for (const k of keys.slice(0, 10)) assert.equal(plan.kinds[k], 'due');
  const count = (kind) => Object.values(plan.kinds).filter((k) => k === kind).length;
  assert.equal(count('new'), 3);
  assert.equal(count('sure'), 2);
  assert.equal(count('due'), 15);
});

test('všechno umí a nic není splatné: kolo je pořád plné', () => {
  const d = freshData();
  ALL_KEYS.forEach((k, i) => Object.assign(d.facts[k], { n: 6, ok: 6, lvl: 5, due: NOW + (i + 1) * HOUR }));
  const plan = planRound(d.facts, NOW, seeded(4));
  checkPlan(plan);
});

test('7 × 8 a 8 × 7 nejsou blíž než ob dva příklady', () => {
  const pairs = [];
  for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) pairs.push([a + 'x' + b, b + 'x' + a]);
  for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed);
    const keys = pairs.slice(seed % 30, (seed % 30) + 10).flat();
    const out = arrange(keys, rng);
    assert.equal(out.length, keys.length);
    for (let i = 1; i < out.length; i++) {
      const near = out.slice(Math.max(0, i - 2), i);
      assert.ok(!near.includes(mirror(out[i])), `seed ${seed}: ${out.join(' ')}`);
    }
  }
});

// Dítě, které má násobení rozehrané: odpovídající násobení „učí se“ nebo „umí“.
function knowsMultiplication(d, level = 3) {
  MUL_KEYS.forEach((k, i) => Object.assign(d.facts[k], { n: 3, ok: 3, lvl: level, due: NOW + (i + 1) * HOUR }));
}

test('dělení: nové jen za násobením, které aspoň trochu jde', () => {
  const d = freshData();
  for (let seed = 1; seed <= 10; seed++) {
    const plan = planRound(d.facts, NOW, seeded(seed));
    assert.equal(plan.keys.filter(isDiv).length, 0, 'na začátku žádné dělení');
  }
  Object.assign(d.facts['7x8'], { n: 2, ok: 2, lvl: DIV_UNLOCK, due: NOW + HOUR });
  let seen = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const plan = planRound(d.facts, NOW, seeded(seed));
    checkPlan(plan);
    const divs = plan.keys.filter(isDiv);
    for (const k of divs) assert.equal(mulOf(k), '7x8', k);
    seen += divs.length;
  }
  assert.ok(seen > 0, '56 : 8 se má objevit');
});

test('dělení: nových v kole nanejvýš NEW_DIV_PER_ROUND, už hraná dělení podle potřeby', () => {
  const d = freshData();
  knowsMultiplication(d);
  for (let seed = 1; seed <= 20; seed++) {
    const plan = planRound(d.facts, NOW, seeded(seed));
    checkPlan(plan);
    const newDivs = plan.keys.filter((k) => isDiv(k) && d.facts[k].n === 0);
    assert.ok(newDivs.length > 0 && newDivs.length <= NEW_DIV_PER_ROUND, String(newDivs.length));
  }
  const weakDiv = ['56:8', '56:7', '63:9', '42:6', '48:8', '54:9', '72:8', '81:9'];
  for (const k of weakDiv) Object.assign(d.facts[k], { n: 3, bad: 3, lvl: 0, due: NOW - HOUR, h: [-1, -1, -1] });
  const plan = planRound(d.facts, NOW, seeded(3));
  checkPlan(plan);
  for (const k of weakDiv) assert.equal(plan.kinds[k], 'due', k);
});

test('procvičovat jen násobení nebo jen dělení', () => {
  const d = freshData();
  knowsMultiplication(d, 1);
  for (let seed = 1; seed <= 10; seed++) {
    const mul = planRound(d.facts, NOW, seeded(seed), { ops: 'mul' });
    checkPlan(mul);
    assert.ok(mul.keys.every((k) => !isDiv(k)));
    // Jen dělení: bez omezení, i když násobení ještě nejde.
    const div = planRound(freshData().facts, NOW, seeded(seed), { ops: 'div' });
    checkPlan(div);
    assert.ok(div.keys.every(isDiv));
  }
  const unknown = planRound(d.facts, NOW, seeded(1), { ops: 'nesmysl' });
  checkPlan(unknown);
});

test('nula u dělení se počítá do limitu nul', () => {
  const d = freshData();
  knowsMultiplication(d);
  for (const k of ['0:3', '0:7', '0:9']) Object.assign(d.facts[k], { n: 2, bad: 2, lvl: 0, due: NOW - HOUR, h: [-1, -1] });
  for (const k of ['7x0', '0x4']) Object.assign(d.facts[k], { n: 2, bad: 2, lvl: 0, due: NOW - HOUR, h: [-1, -1] });
  for (let seed = 1; seed <= 10; seed++) checkPlan(planRound(d.facts, NOW, seeded(seed)));
  const div = planRound(d.facts, NOW, seeded(4), { ops: 'div' });
  checkPlan(div);
});

test('příklady ze stejné rodiny nejsou blíž než ob dva', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed);
    const keys = ['7x8', '8x7', '56:8', '56:7', '6x9', '9x6', '54:9', '54:6', '3x4', '4x3', '12:4', '12:3', '2x5', '5x2', '10:5', '10:2', '9x9', '81:9', '1x7', '7:1'];
    const out = arrange(keys, rng);
    assert.equal(out.length, keys.length);
    for (let i = 1; i < out.length; i++) {
      const fam = family(out[i]);
      const near = out.slice(Math.max(0, i - 2), i);
      assert.ok(!near.some((x) => fam.includes(x)), `seed ${seed}: ${out.join(' ')}`);
    }
  }
});
