// 121 příkladů malé násobilky 0–10 × 0–10. Pořadí činitelů se rozlišuje:
// 7 × 8 a 8 × 7 jsou dva příklady, stejně jako 7 × 0 a 0 × 7.

export const MIN = 0;
export const MAX = 10;

export function key(a, b) {
  return a + 'x' + b;
}

export function parse(k) {
  const [a, b] = k.split('x').map(Number);
  return { a, b };
}

export function mirror(k) {
  const { a, b } = parse(k);
  return key(b, a);
}

export function product(k) {
  const { a, b } = parse(k);
  return a * b;
}

// Příklad s nulou (7 × 0, 0 × 7, 0 × 0).
export function isZero(k) {
  const { a, b } = parse(k);
  return a === 0 || b === 0;
}

// Nezlomitelné mezery, aby se „7 × 8“ nerozdělilo na dva řádky.
export function label(k) {
  const { a, b } = parse(k);
  return a + '\u00a0×\u00a0' + b;
}

export const ALL_KEYS = [];
for (let a = MIN; a <= MAX; a++) {
  for (let b = MIN; b <= MAX; b++) ALL_KEYS.push(key(a, b));
}
