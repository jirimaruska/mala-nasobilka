import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  DATA_VER,
  createEmpty,
  migrate,
  load,
  openStore,
  exportJson,
  importJson,
} from '../js/storage.js';
import { ALL_KEYS, key, mirror, label, parse, product } from '../js/facts.js';

const NOW = Date.UTC(2026, 9, 20, 16, 0);

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

test('facts: 100 příkladů, pořadí činitelů se rozlišuje', () => {
  assert.equal(ALL_KEYS.length, 100);
  assert.equal(new Set(ALL_KEYS).size, 100);
  assert.ok(ALL_KEYS.includes('7x8') && ALL_KEYS.includes('8x7'));
  assert.equal(mirror('7x8'), '8x7');
  assert.equal(label('7x8'), '7 × 8');
  assert.equal(product('7x8'), 56);
  assert.deepEqual(parse(key(10, 3)), { a: 10, b: 3 });
});

test('klíč localStorage je mala-nasobilka', () => {
  assert.equal(STORAGE_KEY, 'mala-nasobilka');
});

test('createEmpty má verzi a všech 100 příkladů', () => {
  const d = createEmpty(NOW);
  assert.equal(d.ver, DATA_VER);
  assert.equal(Object.keys(d.facts).length, 100);
  assert.equal(d.facts['7x8'].n, 0);
});

test('migrate: nesmysl vrátí prázdná data', () => {
  for (const raw of [null, undefined, 42, 'text', []]) {
    assert.equal(migrate(raw, NOW).ver, DATA_VER);
  }
});

test('migrate: data bez ver jsou verze 1 a nic se neztratí', () => {
  const raw = { name: 'Dítě', facts: { '7x8': { n: 5, ok: 3, lvl: 2 } }, best: 120 };
  const d = migrate(raw, NOW);
  assert.equal(d.ver, 1);
  assert.equal(d.name, 'Dítě');
  assert.equal(d.best, 120);
  assert.equal(d.facts['7x8'].n, 5);
  assert.equal(d.facts['7x8'].ok, 3);
  assert.equal(d.facts['7x8'].lvl, 2);
  assert.deepEqual(d.facts['7x8'].h, []);
  assert.equal(Object.keys(d.facts).length, 100);
});

test('migrate: doplní chybějící příklady a pole, zachová neznámá pole', () => {
  const raw = {
    ver: 1,
    name: 'Dítě',
    extra: { keep: true },
    settings: { sound: false, future: 1 },
    facts: { '3x4': { n: 2, ok: 2, ms: 1500, h: [1500, 1400], futureField: 'x' } },
  };
  const d = migrate(raw, NOW);
  assert.deepEqual(d.extra, { keep: true });
  assert.equal(d.settings.sound, false);
  assert.equal(d.settings.future, 1);
  assert.equal(d.facts['3x4'].futureField, 'x');
  assert.deepEqual(d.facts['3x4'].h, [1500, 1400]);
  assert.equal(d.facts['10x10'].n, 0);
  assert.deepEqual(d.rounds, []);
  assert.deepEqual(d.days, {});
});

test('migrate: nemění vstupní objekt', () => {
  const raw = { ver: 1, facts: {} };
  migrate(raw, NOW);
  assert.deepEqual(raw, { ver: 1, facts: {} });
});

test('migrate: data z novější verze nechá ve vyšší verzi', () => {
  const d = migrate({ ver: DATA_VER + 5, facts: {}, newThing: [1, 2] }, NOW);
  assert.equal(d.ver, DATA_VER + 5);
  assert.deepEqual(d.newThing, [1, 2]);
});

test('load: prázdné úložiště dá nová data, která jde uložit', () => {
  const res = load(memoryStorage(), NOW);
  assert.equal(res.canSave, true);
  assert.equal(res.problem, null);
  assert.equal(res.data.ver, DATA_VER);
});

test('load: rozbitý JSON se nepřepíše', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{rozbité' });
  const store = openStore(storage, NOW);
  assert.equal(store.problem, 'corrupt');
  assert.equal(store.canSave, false);
  assert.equal(store.save(), false);
  assert.equal(storage.map.get(STORAGE_KEY), '{rozbité');
  assert.equal(store.raw, '{rozbité');
});

test('load: nedostupné úložiště nespadne', () => {
  const storage = {
    getItem() {
      throw new Error('nejde');
    },
  };
  const res = load(storage, NOW);
  assert.equal(res.problem, 'unavailable');
  assert.equal(res.canSave, false);
});

test('openStore: uložení a znovunačtení zachová data', () => {
  const storage = memoryStorage();
  const store = openStore(storage, NOW);
  store.data.name = 'Dítě';
  store.data.facts['7x8'].n = 3;
  assert.equal(store.save(), true);
  const again = openStore(storage, NOW + 1000);
  assert.equal(again.data.name, 'Dítě');
  assert.equal(again.data.facts['7x8'].n, 3);
  assert.equal(again.data.createdAt, NOW);
});

test('openStore: replace po rozbitých datech zase ukládá', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: 'xxx' });
  const store = openStore(storage, NOW);
  assert.equal(store.replace(createEmpty(NOW)), true);
  assert.equal(store.problem, null);
  assert.equal(JSON.parse(storage.map.get(STORAGE_KEY)).ver, DATA_VER);
});

test('export a import zálohy', () => {
  const d = createEmpty(NOW);
  d.name = 'Dítě';
  d.facts['6x7'].n = 9;
  const back = importJson(exportJson(d), NOW);
  assert.equal(back.name, 'Dítě');
  assert.equal(back.facts['6x7'].n, 9);
  assert.throws(() => importJson('{"a":1}', NOW));
  assert.throws(() => importJson('nesmysl', NOW));
});
