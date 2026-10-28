// Špatné možnosti do bublin. Ne náhodná čísla, ale typické omyly.

import { MAX } from './facts.js';
import { shuffle } from './learning.js';

const LIMIT = 110; // vyšší čísla by byla moc snadno poznat jako špatná

// Součiny z tabulky, aby šlo najít „vedlejší“ výsledky (7 × 8 → 54, 63).
const PRODUCTS = [...new Set(Array.from({ length: MAX * MAX }, (_, i) => (Math.floor(i / MAX) + 1) * ((i % MAX) + 1)))];

// Kandidáti na omyly s váhou. Vyšší váha = častější omyl.
export function candidates(a, b, fact = null) {
  const c = a * b;
  const weights = new Map();
  // Nula jako špatná možnost jen tam, kde dává smysl (allowZero).
  const add = (v, w, allowZero = false) => {
    if (!Number.isInteger(v) || v < 0 || (v === 0 && !allowZero) || v === c || v > LIMIT) return;
    weights.set(v, Math.max(weights.get(v) ?? 0, w));
  };

  if (c === 0) {
    // Násobení nulou: záměna s × 1 (7 × 0 = 7) a připsaná nula (7 × 0 = 70).
    const x = a || b;
    add(x, 8);
    add(10 * x, 5);
    add(x + 1, 3);
    add(1, 3);
    add(10, 2);
    add(2, 1);
  } else {
    // Sousední násobky: (a ± 1) × b a a × (b ± 1).
    for (const v of [c + a, c - a, c + b, c - b]) add(v, 6);
    // Spletení o deset.
    add(c + 10, 4);
    add(c - 10, 4);
    // Prohozené číslice: 56 a 65. Ne když je výsledek moc daleko (81 a 18).
    if (c >= 10) {
      const swapped = Number(String(c).split('').reverse().join(''));
      if (swapped >= 10 && Math.abs(swapped - c) <= 30) add(swapped, 3);
    }
    // Sečtení místo vynásobení: 3 × 4 = 7. U velkých výsledků by to bylo moc snadné.
    if (c <= 30) add(a + b, 2);
    // Blízké součiny z tabulky: 7 × 8 → 54. U malých výsledků jen ty nejbližší.
    const near = Math.min(8, Math.max(2, Math.round(c * 0.15)));
    for (const p of PRODUCTS) if (Math.abs(p - c) <= near) add(p, 2);
    // Ob jeden násobek vedle.
    for (const v of [c + 2 * a, c - 2 * a, c + 2 * b, c - 2 * b]) add(v, 1);
    // Záměna × 1 s × 0: 7 × 1 = 0.
    if (a === 1 || b === 1) add(0, 3, true);
  }
  // Co dítě u tohoto příkladu už jednou spletlo. Rozlišit správné od vlastního omylu pomáhá.
  if (fact && Array.isArray(fact.wrong)) fact.wrong.forEach((v, i) => add(v, 9 - i, true));

  return weights;
}

function pickWeighted(weights, rng) {
  let total = 0;
  for (const w of weights.values()) total += w;
  let r = rng() * total;
  for (const [v, w] of weights) {
    r -= w;
    if (r < 0) return v;
  }
  return [...weights.keys()].at(-1);
}

// Vybere 3 špatné možnosti a zamíchá je se správnou.
// neighbors: nejtypičtější omyly, aspoň jeden z nich se ukáže vždy.
function choose(correct, weights, neighbors, fact, rng, min) {
  const chosen = [];
  const take = (v) => {
    chosen.push(v);
    weights.delete(v);
  };

  // Poslední vlastní omyl většinou ukázat znovu.
  const lastWrong = fact?.wrong?.[0];
  if (weights.has(lastWrong) && rng() < 0.75) take(lastWrong);
  const near = new Map([...weights].filter(([v]) => neighbors.includes(v)));
  if (near.size) take(pickWeighted(near, rng));
  while (chosen.length < 3 && weights.size) take(pickWeighted(weights, rng));

  // Záloha pro jistotu (nemělo by být potřeba).
  for (let d = 1; chosen.length < 3; d++) {
    for (const v of [correct + d, correct - d]) {
      if (chosen.length < 3 && v >= min && v !== correct && !chosen.includes(v)) chosen.push(v);
    }
  }
  return shuffle([correct, ...chosen], rng);
}

// 4 různé možnosti v náhodném pořadí, jedna je správná. Všechny jsou celá čísla od 0.
export function makeOptions(a, b, fact = null, rng = Math.random) {
  const c = a * b;
  return choose(c, candidates(a, b, fact), [c + a, c - a, c + b, c - b], fact, rng, 1);
}

const DIV_LIMIT = 12; // výsledek dělení je 0 až 10, vyšší možnosti by byly hned poznat

// Omyly u dělení c : b = a (dělitel b je 1 až 10).
export function divCandidates(c, b, fact = null) {
  const a = c / b;
  const weights = new Map();
  const add = (v, w, allowZero = false) => {
    if (!Number.isInteger(v) || v < 0 || (v === 0 && !allowZero) || v === a || v > DIV_LIMIT) return;
    weights.set(v, Math.max(weights.get(v) ?? 0, w));
  };

  if (c === 0) {
    // 0 : 5: záměna s dělitelem (5) nebo s 5 : 5 (1).
    add(b, 8);
    add(1, 5);
    add(b + 1, 2);
    add(2, 1);
    add(10, 1);
  } else {
    // Sousední výsledek: 56 : 8 = 6 nebo 8. U 7 : 7 = 1 je sousedem i 0.
    add(a - 1, 6, true);
    add(a + 1, 6);
    // Dělitel místo výsledku: 56 : 8 = 8. U 7 : 1 = 7 záměna s 1.
    add(b, 5);
    // Ob jeden vedle.
    add(a - 2, 2);
    add(a + 2, 2);
  }
  // Co dítě u tohoto příkladu už jednou spletlo.
  if (fact && Array.isArray(fact.wrong)) fact.wrong.forEach((v, i) => add(v, 9 - i, true));

  return weights;
}

// 4 různé možnosti pro dělení c : b, jedna je správná.
export function makeDivOptions(c, b, fact = null, rng = Math.random) {
  const a = c / b;
  return choose(a, divCandidates(c, b, fact), [a - 1, a + 1], fact, rng, 0);
}
