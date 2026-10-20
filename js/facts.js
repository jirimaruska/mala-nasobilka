// 100 příkladů malé násobilky. Pořadí činitelů se rozlišuje: 7 × 8 a 8 × 7 jsou dva příklady.

export const MIN = 1;
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

// Nezlomitelné mezery, aby se „7 × 8“ nerozdělilo na dva řádky.
export function label(k) {
  const { a, b } = parse(k);
  return a + '\u00a0×\u00a0' + b;
}

export const ALL_KEYS = [];
for (let a = MIN; a <= MAX; a++) {
  for (let b = MIN; b <= MAX; b++) ALL_KEYS.push(key(a, b));
}
