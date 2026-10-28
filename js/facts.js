// Příklady malé násobilky.
// Násobení 0–10 × 0–10 (121 příkladů), klíč "7x8". Pořadí činitelů se rozlišuje:
// 7 × 8 a 8 × 7 jsou dva příklady, stejně jako 7 × 0 a 0 × 7.
// Dělení z malé násobilky (110 příkladů), klíč "56:8" = dělenec : dělitel.
// Dělitel je 1–10 (nulou se nedělí), výsledek 0–10. 56 : 8 a 56 : 7 jsou dva příklady.

export const MIN = 0;
export const MAX = 10;

// Co se procvičuje: násobení i dělení, jen násobení, jen dělení.
export const OPS = ['both', 'mul', 'div'];

export function key(a, b) {
  return a + 'x' + b;
}

export function divKey(c, b) {
  return c + ':' + b;
}

export function isDiv(k) {
  return k.includes(':');
}

// { op, a, b }: u násobení oba činitele, u dělení dělenec a dělitel.
export function parse(k) {
  const div = isDiv(k);
  const [a, b] = k.split(div ? ':' : 'x').map(Number);
  return { op: div ? 'div' : 'mul', a, b };
}

// Otočené násobení: 7 × 8 → 8 × 7.
export function mirror(k) {
  const { a, b } = parse(k);
  return key(b, a);
}

// Výsledek: 7 × 8 → 56, 56 : 8 → 7.
export function answer(k) {
  const { op, a, b } = parse(k);
  return op === 'div' ? a / b : a * b;
}

// Násobení, ze kterého dělení vychází: 56 : 8 → 7 × 8.
export function mulOf(k) {
  if (!isDiv(k)) return k;
  const { a, b } = parse(k);
  return key(a / b, b);
}

// Dělení, které z násobení vychází: 7 × 8 → 56 : 8. U × 0 žádné není.
export function divOf(k) {
  const { a, b } = parse(mulOf(k));
  return b === 0 ? null : divKey(a * b, b);
}

// Celá rodina příkladů: 7 × 8, 8 × 7, 56 : 8, 56 : 7 (bez neplatných a bez opakování).
export function family(k) {
  const m = mulOf(k);
  const turned = mirror(m);
  return [...new Set([m, turned, divOf(m), divOf(turned)].filter(Boolean))];
}

// Příklad s nulou: 7 × 0, 0 × 7, 0 × 0, 0 : 7.
export function isZero(k) {
  const { op, a, b } = parse(k);
  return op === 'div' ? a === 0 : a === 0 || b === 0;
}

// Nezlomitelné mezery, aby se „7 × 8“ nerozdělilo na dva řádky.
export function label(k) {
  const { op, a, b } = parse(k);
  return a + ' ' + (op === 'div' ? ':' : '×') + ' ' + b;
}

export const MUL_KEYS = [];
for (let a = MIN; a <= MAX; a++) {
  for (let b = MIN; b <= MAX; b++) MUL_KEYS.push(key(a, b));
}

export const DIV_KEYS = [];
for (let b = 1; b <= MAX; b++) {
  for (let a = MIN; a <= MAX; a++) DIV_KEYS.push(divKey(a * b, b));
}

export const ALL_KEYS = [...MUL_KEYS, ...DIV_KEYS];
