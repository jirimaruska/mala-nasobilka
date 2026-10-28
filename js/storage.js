// Ukládání do localStorage. Klíč se NIKDY nemění.
// Změna formátu dat: zvýšit DATA_VER a přidat krok do MIGRATIONS (viz CLAUDE.md).

import { ALL_KEYS, isZero } from './facts.js';

export const STORAGE_KEY = 'mala-nasobilka';
export const DATA_VER = 2;

// Kroky migrace: MIGRATIONS[n] převede data verze n na verzi n + 1.
// Krok jen přidává a převádí, nic nemaže.
const MIGRATIONS = {
  // 1 → 2: přibylo násobení nulou (0–10 × 0–10). Doplní prázdné příklady s nulou.
  1(d) {
    const facts = isObject(d.facts) ? { ...d.facts } : {};
    for (const k of ALL_KEYS) if (isZero(k) && !isObject(facts[k])) facts[k] = emptyFact();
    return { ...d, facts, ver: 2 };
  },
};

export function emptyFact() {
  return {
    n: 0, // pokusy
    ok: 0, // správně
    bad: 0, // ťuknutí na špatnou bublinu
    late: 0, // nestihnuto
    ms: null, // klouzavý průměr času správných odpovědí
    best: null, // nejrychlejší správná odpověď
    lvl: 0, // úroveň opakování
    due: 0, // kdy příklad znovu zařadit (ms od 1970)
    last: 0, // kdy naposledy
    h: [], // posledních pár výsledků: číslo > 0 = ms správně, -1 špatně, -2 nestihnuto
    wrong: [], // poslední zvolené špatné odpovědi
  };
}

export function createEmpty(now) {
  const facts = {};
  for (const k of ALL_KEYS) facts[k] = emptyFact();
  return {
    ver: DATA_VER,
    createdAt: now,
    name: '',
    settings: { sound: true },
    facts,
    rounds: [],
    days: {},
    best: 0,
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function num(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFact(raw) {
  const f = isObject(raw) ? raw : {};
  const d = emptyFact();
  return {
    ...f,
    n: num(f.n, d.n),
    ok: num(f.ok, d.ok),
    bad: num(f.bad, d.bad),
    late: num(f.late, d.late),
    ms: numOrNull(f.ms),
    best: numOrNull(f.best),
    lvl: num(f.lvl, d.lvl),
    due: num(f.due, d.due),
    last: num(f.last, d.last),
    h: Array.isArray(f.h) ? f.h.filter((x) => typeof x === 'number') : [],
    wrong: Array.isArray(f.wrong) ? f.wrong.filter((x) => typeof x === 'number') : [],
  };
}

// Doplní chybějící pole aktuální verze. Neznámá pole nechá být.
function normalize(d, now) {
  const facts = isObject(d.facts) ? d.facts : {};
  const outFacts = { ...facts };
  for (const k of ALL_KEYS) outFacts[k] = normalizeFact(facts[k]);
  return {
    ...d,
    createdAt: num(d.createdAt, now),
    name: typeof d.name === 'string' ? d.name : '',
    settings: { sound: true, ...(isObject(d.settings) ? d.settings : {}) },
    facts: outFacts,
    rounds: Array.isArray(d.rounds) ? d.rounds.filter(isObject) : [],
    days: isObject(d.days) ? d.days : {},
    best: num(d.best, 0),
  };
}

// Převede jakákoli načtená data na aktuální verzi. Nic nemaže.
// Data z novější verze appky (ver > DATA_VER) nechá ve své verzi.
export function migrate(raw, now = Date.now()) {
  if (!isObject(raw)) return createEmpty(now);
  let d = JSON.parse(JSON.stringify(raw));
  if (typeof d.ver !== 'number' || !Number.isInteger(d.ver) || d.ver < 1) d.ver = 1;
  while (d.ver < DATA_VER) {
    const step = MIGRATIONS[d.ver];
    if (!step) throw new Error('Chybí migrace z verze ' + d.ver);
    d = step(d);
  }
  return normalize(d, now);
}

// Výsledek: { data, canSave, problem, raw }.
// Když data nejdou přečíst, canSave je false, aby se nepřepsala.
export function load(storage, now = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: createEmpty(now), canSave: false, problem: 'unavailable', raw: null };
  }
  if (raw === null || raw === undefined) {
    return { data: createEmpty(now), canSave: true, problem: null, raw: null };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) throw new Error('Data nejsou objekt');
    return { data: migrate(parsed, now), canSave: true, problem: null, raw };
  } catch {
    return { data: createEmpty(now), canSave: false, problem: 'corrupt', raw };
  }
}

export function save(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Úložiště pro appku: drží data v paměti a ukládá je, jen když to je bezpečné.
export function openStore(storage, now = Date.now()) {
  const loaded = load(storage, now);
  return {
    data: loaded.data,
    canSave: loaded.canSave,
    problem: loaded.problem,
    raw: loaded.raw,
    lastSaveOk: true,
    save() {
      if (!this.canSave) return false;
      this.lastSaveOk = save(storage, this.data);
      return this.lastSaveOk;
    },
    // Úplná výměna dat (import zálohy, začít znovu). Volá se jen po potvrzení rodičem.
    replace(data) {
      this.data = data;
      this.canSave = true;
      this.problem = null;
      this.raw = null;
      return this.save();
    },
  };
}

export function exportJson(data) {
  return JSON.stringify(data, null, 1);
}

// Načte zálohu ze souboru. Vyhodí chybu, když to není záloha této appky.
export function importJson(text, now = Date.now()) {
  const parsed = JSON.parse(text);
  if (!isObject(parsed) || !isObject(parsed.facts)) throw new Error('Tohle není záloha Malé násobilky');
  return migrate(parsed, now);
}
