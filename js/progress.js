// Záznam odehraných kol a dní. Shrnutí kola a statistiky pro rodiče.

import { ALL_KEYS, MUL_KEYS, DIV_KEYS, parse, key, mulOf } from './facts.js';
import { SLOW_MS, mastery, difficulty } from './learning.js';

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

// Statistiky pro rodiče.
export function parentStats(data, now) {
  const levels = ALL_KEYS.map((k) => mastery(data.facts[k]));
  const playedDays = Object.entries(data.days).filter(([, d]) => d?.n > 0);
  const sum = (list, field) => list.reduce((s, [, d]) => s + (Number(d[field]) || 0), 0);

  const weekKeys = new Set();
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const k = dayKey(date.getTime());
    if (i < 7) weekKeys.add(k);
    const d = data.days[k] ?? {};
    last14.push({ key: k, t: date.getTime(), n: d.n || 0, ok: d.ok || 0, rounds: d.rounds || 0, time: d.time || 0 });
  }
  const week = playedDays.filter(([k]) => weekKeys.has(k));

  const answers = sum(playedDays, 'n');
  const ok = sum(playedDays, 'ok');
  const weekN = sum(week, 'n');

  const hardest = ALL_KEYS.filter((k) => data.facts[k].n >= 2)
    .map((k) => ({ key: k, score: difficulty(data.facts[k]) }))
    .filter((x) => x.score >= 0.2)
    .sort((x, y) => y.score - x.score)
    .slice(0, 8);

  // Dvojice, kde jeden směr jde a druhý ne (např. 7 × 8 umí, 8 × 7 ne).
  const oneWay = [];
  for (const k of MUL_KEYS) {
    const { a, b } = parse(k);
    if (a >= b) continue;
    const other = key(b, a);
    const fa = data.facts[k];
    const fb = data.facts[other];
    if (fa.n === 0 || fb.n === 0) continue;
    const diff = mastery(fa) - mastery(fb);
    if (Math.abs(diff) >= 2) oneWay.push(diff > 0 ? { good: k, weak: other, diff } : { good: other, weak: k, diff: -diff });
  }
  oneWay.sort((x, y) => y.diff - x.diff);

  // Dělení zaostává za násobením, ze kterého vychází (7 × 8 umí, 56 : 8 ne).
  const divLag = DIV_KEYS.filter((k) => data.facts[k].n > 0 && data.facts[mulOf(k)].n > 0)
    .map((k) => ({ div: k, mul: mulOf(k), diff: mastery(data.facts[mulOf(k)]) - mastery(data.facts[k]) }))
    .filter((x) => x.diff >= 2)
    .sort((x, y) => y.diff - x.diff);

  const count = (keys) => {
    const lv = keys.map((k) => mastery(data.facts[k]));
    return {
      total: keys.length,
      known: lv.filter((m) => m >= 3).length,
      sure: lv.filter((m) => m === 4).length,
      seen: lv.filter((m) => m > 0).length,
    };
  };

  return {
    mul: count(MUL_KEYS),
    div: count(DIV_KEYS),
    known: levels.filter((m) => m >= 3).length,
    sure: levels.filter((m) => m === 4).length,
    seen: levels.filter((m) => m > 0).length,
    answers,
    accuracy: answers ? ok / answers : null,
    avgMs: ok ? sum(playedDays, 'ms') / ok : null,
    weekAccuracy: weekN ? sum(week, 'ok') / weekN : null,
    rounds: sum(playedDays, 'rounds'),
    time: sum(playedDays, 'time'),
    daysPlayed: playedDays.length,
    streak: dayStreak(data, now),
    best: data.best,
    lastPlayed: Math.max(0, ...ALL_KEYS.map((k) => data.facts[k].last)),
    hardest,
    oneWay,
    divLag,
    last14,
  };
}
