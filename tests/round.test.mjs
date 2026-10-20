import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, currentKey, isDone, isRetry, answerCurrent, points } from '../js/round.js';
import { logAnswer, logRound, dayKey, dayStreak } from '../js/progress.js';
import { planRound, ROUND_LEN, BUBBLE_MS } from '../js/learning.js';
import { NOW, seeded, freshData } from './helpers.mjs';

function newRound(seed = 1) {
  return createRound(planRound(freshData().facts, NOW, seeded(seed)), NOW);
}

test('body: rychleji je víc, série přidá bonus', () => {
  assert.equal(points(0, 1), 30);
  assert.equal(points(BUBBLE_MS, 1), 10);
  assert.ok(points(1000, 1) > points(4000, 1));
  assert.equal(points(1000, 3), points(1000, 1) + 5);
});

test('kolo bez chyb: 20 odpovědí, série a body', () => {
  const r = newRound();
  while (!isDone(r)) answerCurrent(r, { result: 'ok', ms: 2000 });
  assert.equal(r.answers.length, ROUND_LEN);
  assert.equal(r.bestStreak, ROUND_LEN);
  assert.ok(r.score > 0);
});

test('po chybě se příklad vrátí o 3 až 5 dál a kolo má pořád 20', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = seeded(seed);
    const r = newRound(seed);
    answerCurrent(r, { result: 'ok', ms: 1500 });
    const key = currentKey(r);
    answerCurrent(r, { result: 'bad', ms: 1500, chosen: 1 }, rng);
    assert.equal(r.queue.length, ROUND_LEN);
    const pos = r.queue.indexOf(key, r.index);
    assert.ok(pos >= r.index + 2 && pos <= r.index + 4, `seed ${seed}: pozice ${pos}, index ${r.index}`);
    assert.equal(r.streak, 0);
    while (currentKey(r) !== key) answerCurrent(r, { result: 'ok', ms: 1500 });
    assert.ok(isRetry(r, key));
    const entry = answerCurrent(r, { result: 'bad' }, rng);
    assert.equal(entry.retry, true);
    assert.equal(r.queue.filter((k) => k === key).length, 2, 'podruhé se už neopakuje');
  }
});

test('chyba na konci kola se už neopakuje', () => {
  const r = newRound();
  while (r.index < ROUND_LEN - 2) answerCurrent(r, { result: 'ok', ms: 1500 });
  answerCurrent(r, { result: 'late' });
  assert.equal(r.queue.length, ROUND_LEN);
  answerCurrent(r, { result: 'ok', ms: 1500 });
  assert.ok(isDone(r));
});

test('záznam dne a kola, rekord', () => {
  const data = freshData();
  const r = newRound();
  while (!isDone(r)) {
    const result = r.index % 5 === 0 ? 'bad' : 'ok';
    logAnswer(data, { result, ms: 2000 }, NOW);
    answerCurrent(r, { result, ms: 2000, chosen: 3 });
  }
  const { entry, record } = logRound(data, r, NOW + 60000);
  const day = data.days[dayKey(NOW)];
  assert.equal(day.n, ROUND_LEN);
  assert.equal(day.rounds, 1);
  assert.equal(day.time, 60000);
  assert.equal(entry.n, ROUND_LEN);
  assert.equal(entry.ok, day.ok);
  assert.equal(entry.ms, 2000);
  assert.equal(record, true);
  assert.equal(data.best, r.score);
  assert.equal(logRound(data, createRound({ keys: [], kinds: {} }, NOW), NOW).record, false);
});

test('série dní', () => {
  const data = freshData();
  const DAY = 24 * 3600 * 1000;
  assert.equal(dayStreak(data, NOW), 0);
  for (const d of [0, 1, 2, 4]) data.days[dayKey(NOW - d * DAY)] = { n: 5 };
  assert.equal(dayStreak(data, NOW), 3);
  delete data.days[dayKey(NOW)];
  assert.equal(dayStreak(data, NOW), 2, 'když se dnes ještě nehrálo, počítá se do včerejška');
});
