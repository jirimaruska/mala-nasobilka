// Učení: sledování každého příkladu, spaced repetition a výběr příkladů do kola.
// Všechny konstanty učení jsou tady.

import { ALL_KEYS, MUL_KEYS, DIV_KEYS, OPS, family, isDiv, isZero, mulOf } from './facts.js';

export const BUBBLE_MS = 7000; // jak dlouho bubliny vydrží
export const FAST_MS = 3000; // do téhle doby je odpověď rychlá (příklad jde zpaměti)
export const SLOW_MS = 5000; // od téhle doby je odpověď pomalá
export const ROUND_LEN = 20; // příkladů v kole
export const HISTORY_LEN = 10; // kolik posledních výsledků si pamatovat
export const WRONG_LEN = 3; // kolik posledních špatných odpovědí si pamatovat

const MINUTE = 60 * 1000;
// „Den“ má 20 hodin, aby příklad naplánovaný na zítra byl na řadě i o něco dřív než za 24 h.
const DAY = 20 * 60 * MINUTE;
// Odstup dalšího opakování podle úrovně příkladu.
export const INTERVALS = [0, 10 * MINUTE, DAY, 2 * DAY, 4 * DAY, 8 * DAY, 16 * DAY, 32 * DAY];
export const MAX_LVL = INTERVALS.length - 1;

const EMA = 0.3; // váha nové odpovědi v průměrném čase
const SURE_SLOTS = 2; // pár jistých příkladů pro radost
const MIN_NEW = 3; // pár nových příkladů v každém kole, dokud nějaké zbývají
const MIN_NEW_DIV = 1; // v dělicí polovině kola jedno nové, ať nevytlačí dělení, která nejdou
// Krát nula je jedno pravidlo, ne 21 věcí k zapamatování: v kole nanejvýš 2 příklady s nulou.
// Opakování po chybě v kole se do limitu nepočítá.
export const ZERO_PER_ROUND = 2;
// Dělení přichází za násobením: nové 56 : 8 až když 7 × 8 aspoň „učí se“ (mastery 2).
export const DIV_UNLOCK = 2;
// Při procvičování obojího je zhruba polovina kola dělení (když už nějaké dělení jde).
export const DIV_SHARE = 0.5;

export const MASTERY_LABELS = ['Ještě nehráno', 'Zatím nejde', 'Učí se', 'Umí', 'Umí jistě'];

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function pushLimited(list, value, limit) {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
}

export function shuffle(list, rng = Math.random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Zapíše odpověď do statistik příkladu a naplánuje další opakování.
// result: 'ok' | 'bad' (špatná bublina) | 'late' (nestihnuto)
// retry: příklad se opakuje v tomtéž kole po chybě, správná odpověď pak nezvyšuje úroveň.
export function recordAnswer(fact, { result, ms = null, chosen = null, retry = false }, now, rng = Math.random) {
  const wasNew = fact.n === 0;
  const early = !wasNew && fact.due > now;
  fact.n += 1;
  fact.last = now;

  if (result !== 'ok') {
    if (result === 'late') fact.late += 1;
    else fact.bad += 1;
    pushLimited(fact.h, result === 'late' ? -2 : -1, HISTORY_LEN);
    fact.lvl = Math.max(0, fact.lvl - 2);
    fact.due = now;
    if (typeof chosen === 'number') {
      fact.wrong = [chosen, ...fact.wrong.filter((v) => v !== chosen)].slice(0, WRONG_LEN);
    }
    return;
  }

  fact.ok += 1;
  fact.ms = fact.ms === null ? Math.round(ms) : Math.round(fact.ms * (1 - EMA) + ms * EMA);
  fact.best = fact.best === null ? Math.round(ms) : Math.min(fact.best, Math.round(ms));
  pushLimited(fact.h, Math.max(1, Math.round(ms)), HISTORY_LEN);

  if (retry) {
    fact.due = now + INTERVALS[1];
    return;
  }

  let lvl = fact.lvl;
  if (ms <= FAST_MS) {
    // Rychle a správně: delší odstup. Nový příklad, který jde hned, přeskočí první krok.
    // Před termínem se úroveň nezvyšuje (opakování navíc nesmí nafouknout odstupy).
    if (wasNew) lvl = 2;
    else if (!early) lvl += 1;
  } else if (ms <= SLOW_MS) {
    lvl = Math.max(1, lvl);
  } else {
    lvl = Math.max(1, lvl - 1);
  }
  fact.lvl = clamp(lvl, 0, MAX_LVL);
  const next = now + Math.round(INTERVALS[fact.lvl] * (0.9 + 0.2 * rng()));
  fact.due = early && ms <= FAST_MS ? Math.max(fact.due, next) : next;
}

// 0 nehráno, 1 nejde, 2 učí se, 3 umí, 4 umí jistě
export function mastery(fact) {
  if (!fact || fact.n === 0) return 0;
  if (fact.lvl <= 0) return 1;
  if (fact.lvl <= 2) return 2;
  if (fact.lvl <= 4) return 3;
  return 4;
}

export function isKnown(fact) {
  return mastery(fact) >= 3;
}

// Podíl správných z posledních pokusů, nebo null.
export function recentAccuracy(fact) {
  if (!fact || fact.h.length === 0) return null;
  return fact.h.filter((x) => x > 0).length / fact.h.length;
}

// 0 = jde to snadno, 1 = hodně těžké. Chyby váží víc než pomalost.
export function difficulty(fact) {
  if (!fact || fact.n === 0) return 0;
  const recent = fact.h;
  const errRate = recent.length ? recent.filter((x) => x < 0).length / recent.length : 0;
  const slow = fact.ms === null ? 1 : clamp((fact.ms - FAST_MS) / (BUBBLE_MS - FAST_MS), 0, 1);
  return 0.65 * errRate + 0.35 * slow;
}

function interval(fact) {
  return Math.max(INTERVALS[fact.lvl] ?? 0, INTERVALS[1]);
}

// Seřadí příklady tak, aby stejný příklad ani nikdo z jeho rodiny (7 × 8, 8 × 7, 56 : 8,
// 56 : 7) nebyli těsně za sebou. Jinak by šel výsledek opsat z předchozí otázky.
export function arrange(keys, rng = Math.random) {
  const pool = shuffle(keys.slice(), rng);
  const out = [];
  // Konflikt, když je příklad ze stejné rodiny do 2 pozic před nebo za místem vložení.
  const fitsAt = (k, pos) => {
    const fam = family(k);
    return out.slice(Math.max(0, pos - 2), pos + 2).every((x) => !fam.includes(x));
  };
  while (pool.length) {
    const i = pool.findIndex((k) => fitsAt(k, out.length));
    if (i >= 0) {
      out.push(pool.splice(i, 1)[0]);
      continue;
    }
    // Zbyly jen konfliktní: vložit dřív, kde nevadí. Vložení jiné dvojice nesblíží.
    const k = pool.shift();
    let pos = out.length;
    for (let p = 0; p < out.length; p++) {
      if (fitsAt(k, p)) {
        pos = p;
        break;
      }
    }
    out.splice(pos, 0, k);
  }
  return out;
}

// Vybere příklady do kola.
// Pořadí důležitosti: splatné (co nejde nejdřív), nové, pár jistých, nejbližší k termínu.
// Příkladů s nulou je nanejvýš ZERO_PER_ROUND.
// ops: 'both' (násobení i dělení), 'mul' (jen násobení), 'div' (jen dělení).
// Při 'both' je zhruba DIV_SHARE kola dělení a zbytek násobení. Nové dělení je jen za
// násobením, které už aspoň trochu jde; když takových dělení není dost, doplní se násobením.
// Při 'div' se dělení neomezuje, rodič ho chce procvičovat.
// Vrací { keys, kinds }, kinds[key] je 'due' | 'new' | 'sure' | 'soon'.
export function planRound(facts, now, rng = Math.random, { len = ROUND_LEN, ops = 'both' } = {}) {
  const mode = OPS.includes(ops) ? ops : 'both';
  const pool = mode === 'mul' ? MUL_KEYS : mode === 'div' ? DIV_KEYS : ALL_KEYS;
  const both = mode === 'both';
  const unlocked = (k) => !both || !isDiv(k) || mastery(facts[mulOf(k)]) >= DIV_UNLOCK;
  const entries = shuffle(pool.slice(), rng)
    .map((k) => ({ k, f: facts[k] }))
    .filter((e) => e.f.n > 0 || unlocked(e.k));
  const due = entries
    .filter((e) => e.f.n > 0 && e.f.due <= now)
    .sort(
      (x, y) =>
        x.f.lvl - y.f.lvl ||
        difficulty(y.f) - difficulty(x.f) ||
        (now - y.f.due) / interval(y.f) - (now - x.f.due) / interval(x.f)
    );
  const fresh = entries.filter((e) => e.f.n === 0);
  const waiting = entries.filter((e) => e.f.n > 0 && e.f.due > now);
  const sure = waiting.filter((e) => e.f.lvl >= 3);
  const soon = waiting
    .slice()
    .sort((x, y) => (x.f.due - now) / interval(x.f) - (y.f.due - now) / interval(y.f));

  const picked = new Map();
  let zeros = 0;
  const any = () => true;
  const size = (only) => [...picked.keys()].filter(only).length;
  // Přidá z list nanejvýš count příkladů, pro které platí only, dokud jich v kole není cap.
  const take = (list, kind, count, only = any, cap = len) => {
    for (const e of list) {
      if (count <= 0 || picked.size >= len || size(only) >= cap) break;
      if (picked.has(e.k) || !only(e.k)) continue;
      if (isZero(e.k)) {
        if (zeros >= ZERO_PER_ROUND) continue;
        zeros += 1;
      }
      picked.set(e.k, kind);
      count -= 1;
    }
  };
  // Doplní příklady, pro které platí only, až jich je v kole cap.
  const fill = (only, cap, minNew = MIN_NEW) => {
    const room = () => cap - size(only);
    const mine = (list) => list.filter((e) => only(e.k));
    const freshMine = mine(fresh);
    const sureCount = Math.min(SURE_SLOTS, mine(sure).length);
    const newCount = Math.min(minNew, freshMine.filter((e) => !isZero(e.k)).length);
    take(due, 'due', room() - sureCount - newCount, only, cap);
    // Nové násobení má přednost, dělení na něm stojí. Zbytek nových se míchá.
    take(freshMine.filter((e) => !isDiv(e.k)), 'new', newCount, only, cap);
    take(freshMine, 'new', room() - sureCount, only, cap);
    take(sure, 'sure', sureCount, only, cap);
    take(soon, 'soon', room(), only, cap);
    // Dorovnat, kdyby rezervovaná místa nešla zaplnit (např. jisté příklady jsou samé nuly).
    take(due, 'due', room(), only, cap);
    take(fresh, 'new', room(), only, cap);
  };

  // Nuly napřed: nejslabší splatná a k ní jedna nová, ať se postupně objeví všechny.
  // Když nová nula není, dostane místo další nula, která nejde.
  const zero = (e) => isZero(e.k);
  take(due.filter(zero), 'due', 1);
  take(fresh.filter(zero), 'new', 1);
  take(due.filter(zero), 'due', ZERO_PER_ROUND);
  if (both) {
    const available = entries.filter((e) => isDiv(e.k)).length;
    fill(isDiv, Math.min(Math.round(len * DIV_SHARE), available), MIN_NEW_DIV);
    fill((k) => !isDiv(k), len - size(isDiv));
  }
  // Zbytek kola (a pojistka, kdyby některá část nešla zaplnit).
  fill(any, len);

  return { keys: arrange([...picked.keys()], rng), kinds: Object.fromEntries(picked) };
}
