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

// 4 různé možnosti v náhodném pořadí, jedna je správná. Všechny jsou celá čísla od 0.
export function makeOptions(a, b, fact = null, rng = Math.random) {
  const c = a * b;
  const weights = candidates(a, b, fact);
  const chosen = [];
  const take = (v) => {
    chosen.push(v);
    weights.delete(v);
  };

  // Poslední vlastní omyl většinou ukázat znovu.
  const lastWrong = fact?.wrong?.[0];
  if (weights.has(lastWrong) && rng() < 0.75) take(lastWrong);
  // Aspoň jeden sousední násobek, ten je nejtypičtější.
  const neighbors = new Map([...weights].filter(([v]) => [c + a, c - a, c + b, c - b].includes(v)));
  if (neighbors.size) take(pickWeighted(neighbors, rng));
  while (chosen.length < 3 && weights.size) take(pickWeighted(weights, rng));

  // Záloha pro jistotu (nemělo by být potřeba).
  for (let d = 1; chosen.length < 3; d++) {
    for (const v of [c + d, c - d]) {
      if (chosen.length < 3 && v > 0 && v !== c && !chosen.includes(v)) chosen.push(v);
    }
  }
  return shuffle([c, ...chosen], rng);
}
