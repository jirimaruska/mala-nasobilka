# Malá násobilka

Statická PWA na procvičování malé násobilky (1–10 × 1–10) pro děti kolem 10 let.
Běží na iPhonu přidaná na plochu, hostovaná na Vercelu bez build kroku.
Data jsou jen v localStorage zařízení, žádný server.

## Pravidla projektu

### 1. Data dítěte nesmí zmizet
- Klíč v localStorage je `mala-nasobilka` a **nikdy se nemění**.
- Formát dat má verzi v poli `ver`. Aktuální verze je `DATA_VER` v `js/storage.js`.
- Každá změna formátu dat:
  1. zvýšit `DATA_VER`,
  2. přidat krok do `MIGRATIONS` (volá ho `migrate()`), který převede verzi N na N+1,
  3. přidat test se vzorkem dat ve staré verzi (`tests/storage.test.mjs`).
- Migrace jen přidává a převádí, nic nemaže. Neznámá pole se zachovají.
- Data, která nejdou přečíst (rozbitý JSON), se nikdy nepřepíšou.
- Nikdy se nezapíše nižší `ver`, než jaká byla načtena.
- Import zálohy jde vždy přes `migrate()`.

### 2. Verze cache v `sw.js`
- Každá změna, která má jít do vydání, **zvýší `CACHE_VERSION` v `sw.js`**.
  Jinak iPhone dál ukazuje starou verzi z cache.
- Každý nový soubor appky přidat do seznamu `ASSETS` v `sw.js`
  (hlídá to `tests/sw.test.mjs`).

### 3. Větve a pull requesty
- Každá změna ve vlastní větvi a pull requestu proti `main`.
- Do `main` se nikdy nepushuje přímo.
- Vercel ke každé větvi vytvoří náhled. Náhled má jinou doménu, takže má vlastní
  (prázdný) localStorage. Data z produkce tam nejsou a náhled je nemůže poškodit.

### 4. Texty pro děti
- Česky, jednoduše, krátké věty.
- Bez em-dash (—). Místo něj čárka, tečka nebo dvojtečka.
- Oslovovat bez rodu: „Hotovo!“, „Super práce!“, ne „Zvládl jsi“.
  Ze jména rod nepoznáme.
- Jméno dítěte se zadává v appce. V kódu ani v testech žádné skutečné jméno.

### 5. Technika
- Bez build kroku, bez závislostí, bez package.json. Čisté ES moduly.
- Žádné externí fonty, CDN ani požadavky mimo vlastní doménu. Vše musí jít offline.
- iPhone: dotykové plochy aspoň 48 px, `env(safe-area-inset-*)`, světlý i tmavý režim,
  input s písmem aspoň 16 px (jinak iOS zoomuje).
- Konstanty učení (časy, intervaly) jsou jen v `js/learning.js`.
- Čistá logika (`js/storage.js`, `js/facts.js`, `js/learning.js`, `js/distractors.js`,
  `js/round.js`, `js/progress.js`) nesahá na DOM a dostává `now` a `rng` parametrem.

## Struktura
```
index.html              jediná stránka, obrazovky jako <section>
manifest.webmanifest    manifest PWA
sw.js                   service worker: CACHE_VERSION, ASSETS, cache-first
vercel.json             hlavičky pro Vercel
css/app.css             vzhled, světlý a tmavý režim, bubliny
js/main.js              start, service worker, přepínání obrazovek
js/storage.js           načtení, uložení, migrate(), export a import
js/facts.js             100 příkladů jako klíče "7x8" (7 × 8 a 8 × 7 jsou různé)
js/learning.js          spaced repetition, výběr příkladů do kola
js/distractors.js       špatné možnosti podle typických omylů
js/round.js             stav jednoho kola (20 příkladů)
js/progress.js          shrnutí kola a statistiky pro rodiče
js/sound.js             zvuky přes Web Audio
js/ui/*.js              obrazovky: home, game, summary, parents
icons/                  ikony (PNG generuje tools/make-icons.mjs)
tests/                  testy logiky (node:test)
```

## Příkazy
- Testy: `node --test`
- Lokálně: `npx serve .` (nebo `python3 -m http.server`) a otevřít http://localhost:3000
- Ikony po změně `icons/icon.svg`: `node tools/make-icons.mjs` (potřebuje Playwright)
