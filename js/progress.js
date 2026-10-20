// Záznam odehraných kol a dní. Shrnutí kola a statistiky pro rodiče.

import { SLOW_MS, mastery } from './learning.js';

export const MAX_ROUNDS = 200;
export const MAX_DAYS = 730;

function pad(n) {
  return String(n).padStart(2, '0');
}

// Den podle místního času, např. "2026-10-20".
export function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function ensureDay(data, now) {
  const k = dayKey(now);
  const day = (data.days[k] ??= {});
  for (const field of ['n', 'ok', 'ms', 'rounds', 'time']) {
    if (typeof day[field] !== 'number' || !Number.isFinite(day[field])) day[field] = 0;
  }
  return day;
}

function trimDays(data) {
  const keys = Object.keys(data.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete data.days[k];
}

export function logAnswer(data, { result, ms }, now) {
  const day = ensureDay(data, now);
  day.n += 1;
  if (result === 'ok') {
    day.ok += 1;
    day.ms += Math.round(ms);
  }
}

// Zapíše dokončené kolo. Vrací { entry, record }.
export function logRound(data, round, now) {
  const day = ensureDay(data, now);
  const okAnswers = round.answers.filter((a) => a.result === 'ok');
  const time = Math.max(0, now - round.startedAt);
  day.rounds += 1;
  day.time += time;
  const entry = {
    t: now,
    score: round.score,
    ok: okAnswers.length,
    n: round.answers.length,
    ms: okAnswers.length ? Math.round(okAnswers.reduce((s, a) => s + a.ms, 0) / okAnswers.length) : null,
    streak: round.bestStreak,
    time,
  };
  data.rounds.push(entry);
  if (data.rounds.length > MAX_ROUNDS) data.rounds.splice(0, data.rounds.length - MAX_ROUNDS);
  const record = round.score > data.best;
  if (record) data.best = round.score;
  trimDays(data);
  return { entry, record };
}

// Kolik dní v řadě až do dneška (nebo do včerejška, když se dnes ještě nehrálo).
export function dayStreak(data, now) {
  const played = new Set(Object.keys(data.days).filter((k) => data.days[k]?.n > 0));
  const d = new Date(now);
  if (!played.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (played.has(dayKey(d.getTime()))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Shrnutí kola pro dítě: co se zlepšilo a co ještě procvičit.
// before: stav hraných příkladů před kolem, after: data.facts po kole.
export function roundReport({ round, before, after, prevRound = null, record = false }) {
  const answers = round.answers;
  const okAnswers = answers.filter((a) => a.result === 'ok');
  const firsts = new Map();
  for (const a of answers) if (!firsts.has(a.key)) firsts.set(a.key, a);

  const improved = [];
  const practice = [];
  for (const [key, first] of firsts) {
    const b = before[key];
    const f = after[key];
    if (answers.some((a) => a.key === key && a.result !== 'ok')) {
      practice.push({ key, why: 'missed' });
    } else if (first.ms > SLOW_MS) {
      practice.push({ key, why: 'slow', ms: first.ms });
    } else if (b && b.h.length && b.h.at(-1) < 0) {
      improved.push({ key, why: 'fixed' });
    } else if (b && b.ms !== null && first.ms <= b.ms * 0.75 && b.ms - first.ms >= 700) {
      improved.push({ key, why: 'faster', from: b.ms, to: first.ms });
    } else if (b && mastery(b) < 3 && mastery(f) >= 3) {
      improved.push({ key, why: 'learned' });
    }
  }
  const order = { fixed: 0, learned: 1, faster: 2 };
  improved.sort((x, y) => order[x.why] - order[y.why]);
  practice.sort((x, y) => (x.why === y.why ? (y.ms ?? 0) - (x.ms ?? 0) : x.why === 'missed' ? -1 : 1));

  return {
    score: round.score,
    ok: okAnswers.length,
    n: answers.length,
    avgMs: okAnswers.length ? Math.round(okAnswers.reduce((s, a) => s + a.ms, 0) / okAnswers.length) : null,
    bestStreak: round.bestStreak,
    record,
    prev: prevRound ? { score: prevRound.score, ok: prevRound.ok } : null,
    improved,
    practice,
  };
}
