// Stav jednoho kola: fronta příkladů, opakování po chybě, body a série. Bez DOM.

import { BUBBLE_MS } from './learning.js';

const RETRY_GAP_MIN = 3; // po chybě se příklad vrátí za 3 až 5 příkladů
const RETRY_GAP_MAX = 5;
// Když se příklad po chybě opakuje, vypadne jiný, aby kolo mělo pořád stejně příkladů.
// Nejdřív vypadne ten nejméně důležitý.
const DROP_ORDER = ['soon', 'sure', 'new', 'due'];

export function createRound(plan, now = Date.now()) {
  return {
    queue: plan.keys.slice(),
    kinds: { ...plan.kinds },
    index: 0,
    answers: [],
    retries: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
    startedAt: now,
  };
}

export function currentKey(round) {
  return round.queue[round.index] ?? null;
}

export function isDone(round) {
  return round.index >= round.queue.length;
}

// Příklad už v tomhle kole byl (teď se opakuje po chybě).
export function isRetry(round, key) {
  return round.answers.some((a) => a.key === key);
}

// Body za správnou odpověď: 10 až 30 podle rychlosti, od série 3 bonus 5.
export function points(ms, streak) {
  const left = Math.max(0, 1 - ms / BUBBLE_MS);
  return 10 + Math.round(20 * left) + (streak >= 3 ? 5 : 0);
}

function scheduleRetry(round, key, rng) {
  const rest = round.queue.length - round.index - 1;
  if (rest < 2) return; // hned další příklad by to jen opsal z hlavy
  let dropAt = -1;
  for (const kind of DROP_ORDER) {
    for (let i = round.queue.length - 1; i > round.index; i--) {
      const k = round.queue[i];
      if (round.kinds[k] === kind && !round.retries.includes(k)) {
        dropAt = i;
        break;
      }
    }
    if (dropAt >= 0) break;
  }
  if (dropAt < 0) return;
  round.queue.splice(dropAt, 1);
  const gap = RETRY_GAP_MIN + Math.floor(rng() * (RETRY_GAP_MAX - RETRY_GAP_MIN + 1));
  round.queue.splice(Math.min(round.index + gap, round.queue.length), 0, key);
  round.retries.push(key);
}

// Zapíše odpověď na aktuální příklad a posune kolo dál. Vrací záznam odpovědi.
export function answerCurrent(round, { result, ms = null, chosen = null }, rng = Math.random) {
  const key = currentKey(round);
  const retry = isRetry(round, key);
  let pts = 0;
  if (result === 'ok') {
    round.streak += 1;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    pts = points(ms, round.streak);
    round.score += pts;
  } else {
    round.streak = 0;
    if (!retry) scheduleRetry(round, key, rng);
  }
  const entry = { key, result, ms, chosen, pts, retry };
  round.answers.push(entry);
  round.index += 1;
  return entry;
}
