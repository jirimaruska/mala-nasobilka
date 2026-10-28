// Pro rodiče: pojistka, tabulka 0–10 pro násobení i dělení, nejtěžší příklady, statistiky
// a nastavení.

import { MIN, MAX, key, divKey, label, answer, mirror, mulOf, family, isDiv } from '../facts.js';
import { FAST_MS, SLOW_MS, MASTERY_LABELS, mastery, recentAccuracy } from '../learning.js';
import { parentStats, dayKey } from '../progress.js';
import { createEmpty, exportJson, importJson, DATA_VER } from '../storage.js';
import { APP_VERSION } from '../version.js';
import { $, $$, el, plural, seconds, percent } from './dom.js';

const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

// Tabulka pro násobení a pro dělení. Dělení je na stejném místě jako násobení, ze kterého
// vychází, takže jde přepínat a porovnávat.
const OPS_VIEW = {
  mul: {
    corner: '×',
    note: 'Řádek je první číslo, sloupec druhé. 7\u00a0×\u00a08 a 8\u00a0×\u00a07 jsou dva různé příklady, každý má svoji buňku. Řádek a sloupec 0 je násobení nulou.',
    dot: 'jde jen jedním směrem',
  },
  div: {
    corner: ':',
    note: 'Dělení je na stejném místě jako násobení, ze kterého vychází: v řádku 7 a sloupci 8 je 56\u00a0:\u00a08\u00a0=\u00a07. Řádek je výsledek, sloupec dělitel. Sloupec 0 je přeškrtnutý, nulou se nedělí.',
    dot: 'dělení zaostává za násobením',
  },
};

// Barvy buněk: r2 a r1 potřebují trénink, b1 a b2 jdou. Prázdná buňka = nehráno.
const MODES = {
  mastery: {
    title: 'Jistota',
    note: 'Podle toho, jak rychle a spolehlivě příklad jde a jestli vydržel i po pár dnech.',
    legend: [
      ['r2', 'Zatím nejde'],
      ['r1', 'Učí se'],
      ['b1', 'Umí'],
      ['b2', 'Umí jistě'],
    ],
    cell(f) {
      const m = mastery(f);
      return m === 0 ? null : { bin: ['r2', 'r1', 'b1', 'b2'][m - 1], text: '' };
    },
  },
  accuracy: {
    title: 'Úspěšnost',
    note: 'Procento správných odpovědí z posledních 10 pokusů.',
    legend: [
      ['r2', 'pod 50 %'],
      ['r1', '50–74 %'],
      ['b1', '75–89 %'],
      ['b2', '90 % a víc'],
    ],
    cell(f) {
      const acc = recentAccuracy(f);
      if (acc === null) return null;
      const bin = acc < 0.5 ? 'r2' : acc < 0.75 ? 'r1' : acc < 0.9 ? 'b1' : 'b2';
      return { bin, text: String(Math.round(acc * 100)) };
    },
  },
  speed: {
    title: 'Rychlost',
    note: 'Průměrný čas správné odpovědi v sekundách. Do 3 s jde příklad zpaměti.',
    legend: [
      ['r2', 'nad 5 s'],
      ['r1', '4–5 s'],
      ['b1', '3–4 s'],
      ['b2', 'do 3 s'],
    ],
    cell(f) {
      if (f.n === 0) return null;
      if (f.ms === null) return { bin: 'r2', text: '–' };
      const bin = f.ms > SLOW_MS ? 'r2' : f.ms > 4000 ? 'r1' : f.ms > FAST_MS ? 'b1' : 'b2';
      return { bin, text: (f.ms / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) };
    },
  },
};

function duration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  return h + ' h ' + (min % 60) + ' min';
}

function dateLabel(ts, now) {
  if (!ts) return '–';
  const k = dayKey(ts);
  if (k === dayKey(now)) return 'dnes';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (k === dayKey(y.getTime())) return 'včera';
  const d = new Date(ts);
  return d.getDate() + '. ' + (d.getMonth() + 1) + '.';
}

function nextReview(f, now) {
  if (f.n === 0) return 'až přijde na řadu';
  const diff = f.due - now;
  if (diff <= 0) return 'v příštím kole';
  const min = Math.round(diff / 60000);
  if (min < 60) return 'za ' + min + ' min';
  const h = Math.round(diff / 3600000);
  if (h < 24) return 'za ' + h + ' h';
  const days = Math.round(diff / 86400000);
  return 'za ' + days + ' ' + plural(days, 'den', 'dny', 'dní');
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function shareOrDownload(name, text) {
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Záloha Malé násobilky' });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  download(name, text);
}

export function createParents(app) {
  const gate = $('#gate');
  const gateInput = $('#gate-input');
  const body = $('#parents-body');
  const detail = $('#p-detail');
  let gateAnswer = 0;
  let mode = 'mastery';
  let op = 'mul';
  let selected = null; // vybrané místo v tabulce jako násobení, např. "7x8"
  let selectedDay = null;

  function newGate() {
    const a = 12 + Math.floor(Math.random() * 8);
    const b = 3 + Math.floor(Math.random() * 7);
    gateAnswer = a * b;
    $('#gate-q').textContent = 'Kolik je ' + a + '\u00a0×\u00a0' + b + '?';
    gateInput.value = '';
  }

  gate.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Number(gateInput.value) === gateAnswer) {
      gateInput.blur();
      gate.hidden = true;
      body.hidden = false;
      render();
    } else {
      $('#gate-err').hidden = false;
      newGate();
    }
  });

  $('#parents-back').addEventListener('click', () => app.show('home'));

  for (const btn of $$('#p-modes button')) {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      renderGrid();
    });
  }

  for (const btn of $$('#p-ops button')) {
    btn.addEventListener('click', () => {
      op = btn.dataset.op;
      renderGrid();
    });
  }

  // Tabulka: řádek = první činitel (u dělení výsledek), sloupec = druhý (u dělení dělitel).
  const grid = $('#p-grid');
  grid.style.setProperty('--cols', String(MAX - MIN + 2));
  const corner = el('span', { class: 'gh corner', text: '×' });
  grid.append(corner);
  for (let b = MIN; b <= MAX; b++) grid.append(el('span', { class: 'gh', text: b }));
  for (let a = MIN; a <= MAX; a++) {
    grid.append(el('span', { class: 'gh', text: a }));
    for (let b = MIN; b <= MAX; b++) {
      grid.append(el('button', { class: 'cell', type: 'button', 'data-a': a, 'data-b': b, onclick: () => select(key(a, b)) }));
    }
  }

  // Příklad v buňce podle zobrazené operace. U dělení nulou žádný není.
  function cellKey(a, b) {
    if (op === 'mul') return key(a, b);
    return b === 0 ? null : divKey(a * b, b);
  }

  function select(k) {
    selected = selected === k ? null : k;
    renderGrid();
  }

  function renderGrid() {
    const facts = app.store.data.facts;
    const m = MODES[mode];
    const view = OPS_VIEW[op];
    for (const btn of $$('#p-ops button')) btn.setAttribute('aria-pressed', String(btn.dataset.op === op));
    for (const btn of $$('#p-modes button')) btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    $('#p-grid-note').textContent = view.note;
    $('#p-mode-note').textContent = m.note;
    corner.textContent = view.corner;
    for (const cell of $$('.cell', grid)) {
      const pos = key(Number(cell.dataset.a), Number(cell.dataset.b));
      const k = cellKey(Number(cell.dataset.a), Number(cell.dataset.b));
      cell.disabled = !k;
      if (!k) {
        cell.className = 'cell na';
        cell.textContent = '';
        cell.setAttribute('aria-label', 'Nulou se nedělí');
        continue;
      }
      const f = facts[k];
      const c = m.cell(f);
      cell.className = 'cell' + (c ? ' ' + c.bin : ' empty') + (pos === selected ? ' selected' : '');
      cell.textContent = c?.text ?? '';
      // Tečka: u násobení jde jen jeden směr, u dělení zaostává za svým násobením.
      const other = facts[op === 'mul' ? mirror(k) : mulOf(k)];
      const gap = mastery(other) - mastery(f);
      const dot = f.n > 0 && other.n > 0 && (op === 'mul' ? Math.abs(gap) >= 2 : gap >= 2);
      cell.classList.toggle('lopsided', dot);
      cell.setAttribute('aria-label', label(k) + ': ' + MASTERY_LABELS[mastery(f)]);
    }
    $('#p-legend').replaceChildren(
      ...m.legend.map(([bin, text]) => el('span', { class: 'lg' }, [el('i', { class: 'sw ' + bin }), text])),
      el('span', { class: 'lg' }, [el('i', { class: 'sw empty' }), 'nehráno']),
      el('span', { class: 'lg' }, [el('i', { class: 'sw dot' }), view.dot])
    );
    renderDetail();
  }

  function factCard(k) {
    const f = app.store.data.facts[k];
    const now = Date.now();
    const rows = [];
    if (f.n === 0) {
      rows.push(['Stav', 'Ještě nehráno']);
    } else {
      rows.push(['Stav', MASTERY_LABELS[mastery(f)]]);
      rows.push(['Pokusy', f.n + ' (správně ' + percent(f.ok / f.n) + ')']);
      rows.push(['Posledních 10', percent(recentAccuracy(f))]);
      rows.push(['Průměrný čas', seconds(f.ms) + (f.best ? ', nejlépe ' + seconds(f.best) : '')]);
      rows.push(['Chyby', f.bad + '× vedle, ' + f.late + '× nestihnuto']);
      if (f.wrong.length) rows.push(['Spletlo se s', f.wrong.join(', ')]);
    }
    rows.push(['Další opakování', nextReview(f, now)]);
    return el('div', { class: 'dcard' }, [
      el('strong', { class: 'deq', text: label(k) + ' = ' + answer(k) }),
      el(
        'dl',
        {},
        rows.flatMap(([t, v]) => [el('dt', { text: t }), el('dd', { text: v })])
      ),
    ]);
  }

  // Celá rodina: 7 × 8, 8 × 7, 56 : 8, 56 : 7.
  function renderDetail() {
    detail.hidden = !selected;
    if (!selected) return;
    detail.replaceChildren(...family(selected).map(factCard));
  }

  function tile(value, caption, sub) {
    return el('div', { class: 'tile' }, [
      el('strong', { text: value }),
      el('span', { text: caption }),
      sub ? el('small', { text: sub }) : null,
    ]);
  }

  function renderStats(s, now) {
    $('#p-tiles').replaceChildren(
      tile(s.mul.known + ' / ' + s.mul.total, 'násobení umí', s.mul.sure ? s.mul.sure + ' jistě' : null),
      tile(s.div.known + ' / ' + s.div.total, 'dělení umí', s.div.sure ? s.div.sure + ' jistě' : null),
      tile(percent(s.accuracy), 'správně', s.weekAccuracy !== null ? '7 dní: ' + percent(s.weekAccuracy) : null),
      tile(seconds(s.avgMs), 'průměrný čas'),
      tile(String(s.rounds), plural(s.rounds, 'kolo', 'kola', 'kol'), s.best ? 'rekord ' + s.best : null),
      tile(String(s.daysPlayed), plural(s.daysPlayed, 'den hraní', 'dny hraní', 'dní hraní'), s.streak > 1 ? 'v řadě ' + s.streak : null),
      tile(duration(s.time), 'čas hraní'),
      tile(dateLabel(s.lastPlayed, now), 'naposledy')
    );
  }

  function factRow(k, extra) {
    return el('li', {}, [
      el('button', { type: 'button', class: 'linkish', text: label(k) + ' = ' + answer(k), onclick: () => showInGrid(k) }),
      el('span', { class: 'muted', text: extra }),
    ]);
  }

  function showInGrid(k) {
    op = isDiv(k) ? 'div' : 'mul';
    selected = mulOf(k);
    renderGrid();
    $('#p-grid-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderLists(s) {
    const facts = app.store.data.facts;
    const hardest = $('#p-hardest');
    hardest.replaceChildren(
      ...s.hardest.map(({ key: k }) => {
        const f = facts[k];
        return factRow(k, percent(recentAccuracy(f)) + ' správně, ' + seconds(f.ms));
      })
    );
    $('#p-hardest-empty').hidden = s.hardest.length > 0;

    const oneWay = $('#p-oneway');
    oneWay.replaceChildren(
      ...s.oneWay.slice(0, 8).map(({ good, weak }) =>
        el('li', {}, [
          el('button', { type: 'button', class: 'linkish', text: label(weak), onclick: () => showInGrid(weak) }),
          el('span', {
            class: 'muted',
            text: MASTERY_LABELS[mastery(facts[weak])].toLowerCase() + ', ale ' + label(good) + ' ' + MASTERY_LABELS[mastery(facts[good])].toLowerCase(),
          }),
        ])
      )
    );
    $('#p-oneway-empty').hidden = s.oneWay.length > 0;

    $('#p-divlag').replaceChildren(
      ...s.divLag.slice(0, 8).map(({ div, mul }) =>
        el('li', {}, [
          el('button', { type: 'button', class: 'linkish', text: label(div), onclick: () => showInGrid(div) }),
          el('span', {
            class: 'muted',
            text: MASTERY_LABELS[mastery(facts[div])].toLowerCase() + ', ale ' + label(mul) + ' ' + MASTERY_LABELS[mastery(facts[mul])].toLowerCase(),
          }),
        ])
      )
    );
    $('#p-divlag-empty').hidden = s.divLag.length > 0;
  }

  function renderChart(s) {
    const days = s.last14;
    const max = Math.max(...days.map((d) => d.n));
    const chart = $('#p-chart');
    const note = $('#p-chart-note');
    if (max === 0) {
      chart.replaceChildren(el('p', { class: 'muted', text: 'Za posledních 14 dní se nehrálo.' }));
      note.textContent = '';
      return;
    }
    const W = 340;
    const H = 150;
    const top = 20;
    const bottom = 24;
    const slot = W / days.length;
    const bw = slot - 4;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'bars');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Počet odpovědí za posledních 14 dní');
    const mk = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text !== undefined) n.textContent = text;
      svg.append(n);
      return n;
    };
    mk('line', { x1: 0, x2: W, y1: H - bottom + 0.5, y2: H - bottom + 0.5, class: 'axis' });
    const maxIndex = days.findIndex((d) => d.n === max);
    days.forEach((d, i) => {
      const x = i * slot + 2;
      const h = d.n ? Math.max(4, ((H - top - bottom) * d.n) / max) : 0;
      const y = H - bottom - h;
      const isSel = selectedDay === d.key;
      if (h) {
        mk('path', {
          d: `M${x},${H - bottom} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - bottom} Z`,
          class: 'bar' + (isSel ? ' sel' : ''),
        });
      }
      const isToday = i === days.length - 1;
      if (d.n && (i === maxIndex || isToday || isSel)) mk('text', { x: x + bw / 2, y: y - 6, class: 'val' }, d.n);
      mk('text', { x: x + bw / 2, y: H - 8, class: 'tick' + (isToday ? ' today' : '') }, new Date(d.t).getDate());
      const hit = mk('rect', { x: i * slot, y: 0, width: slot, height: H, class: 'hit' });
      hit.addEventListener('click', () => {
        selectedDay = selectedDay === d.key ? null : d.key;
        renderChart(s);
      });
    });
    chart.replaceChildren(svg);
    const sel = days.find((d) => d.key === selectedDay);
    if (sel) {
      const date = new Date(sel.t);
      note.textContent =
        DAY_NAMES[date.getDay()] + ' ' + date.getDate() + '. ' + (date.getMonth() + 1) + '.: ' +
        (sel.n
          ? sel.n + ' ' + plural(sel.n, 'odpověď', 'odpovědi', 'odpovědí') + ', správně ' + percent(sel.ok / sel.n) +
            ', ' + sel.rounds + ' ' + plural(sel.rounds, 'kolo', 'kola', 'kol') + ', ' + duration(sel.time)
          : 'nehrálo se');
    } else {
      note.textContent = 'Ťukněte na den pro podrobnosti.';
    }
  }

  function renderSettings() {
    const data = app.store.data;
    $('#p-name').value = data.name;
    const on = app.sound.isEnabled();
    $('#p-sound').textContent = on ? 'Zvuk je zapnutý' : 'Zvuk je vypnutý';
    $('#p-sound').setAttribute('aria-pressed', String(on));
    for (const btn of $$('#p-practice button')) btn.setAttribute('aria-pressed', String(btn.dataset.ops === data.settings.ops));
    // Verze appky se mění s každým vydáním, formát dat jen když se mění uložená data.
    $('#p-version').textContent =
      'Verze appky: ' + APP_VERSION.replace(/^v/, '') + ' · Formát dat: ' + data.ver + (data.ver > DATA_VER ? ' (novější než appka)' : '');
    const problem = app.store.problem;
    $('#p-problem').hidden = !problem;
    $('#p-problem-text').textContent =
      problem === 'corrupt'
        ? 'Uložená data nejdou přečíst. Appka je nepřepíše a teď nic neukládá. Stáhněte si je, pak můžete začít znovu.'
        : 'Úložiště prohlížeče není dostupné. Hra teď nic neukládá.';
    $('#p-problem-download').hidden = problem !== 'corrupt';
    $('#p-problem-reset').hidden = problem !== 'corrupt';
  }

  function render() {
    const now = Date.now();
    const s = parentStats(app.store.data, now);
    renderStats(s, now);
    renderGrid();
    renderLists(s);
    renderChart(s);
    renderSettings();
  }

  function status(text) {
    $('#p-status').textContent = text;
  }

  $('#p-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#p-name').value.trim().slice(0, 20);
    app.store.data.name = name;
    app.store.save();
    $('#p-name').blur();
    status(name ? 'Jméno uloženo.' : 'Jméno smazáno. Appka se na něj zeptá na úvodu.');
  });

  $('#p-sound').addEventListener('click', () => {
    const on = !app.sound.isEnabled();
    app.sound.setEnabled(on);
    app.store.data.settings.sound = on;
    app.store.save();
    renderSettings();
  });

  for (const btn of $$('#p-practice button')) {
    btn.addEventListener('click', () => {
      app.store.data.settings.ops = btn.dataset.ops;
      app.store.save();
      renderSettings();
      status('Uloženo. Platí od dalšího kola.');
    });
  }

  $('#p-export').addEventListener('click', () => {
    shareOrDownload('mala-nasobilka-zaloha-' + dayKey(Date.now()) + '.json', exportJson(app.store.data));
  });

  $('#p-import').addEventListener('click', () => $('#p-file').click());
  $('#p-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = importJson(await file.text());
      if (!confirm('Nahrát zálohu? Současná data v tomhle telefonu se nahradí.')) return;
      app.store.replace(data);
      app.sound.setEnabled(data.settings.sound !== false);
      render();
      status('Záloha nahrána.');
    } catch {
      status('Tenhle soubor nejde nahrát. Je to záloha Malé násobilky?');
    }
  });

  $('#p-reset').addEventListener('click', () => {
    if (!confirm('Opravdu smazat všechna data? Zmizí pokrok i statistiky.')) return;
    if (!confirm('Naposledy: smazat všechno? Tohle nejde vrátit. Zálohu si můžete stáhnout předtím.')) return;
    app.store.replace(createEmpty(Date.now()));
    app.sound.setEnabled(true);
    selected = null;
    render();
    status('Data smazána.');
  });

  $('#p-problem-download').addEventListener('click', () => {
    download('mala-nasobilka-poskozena-data.txt', app.store.raw ?? '');
  });
  $('#p-problem-reset').addEventListener('click', () => {
    if (!confirm('Začít znovu? Poškozená data se přepíšou. Stáhli jste si je?')) return;
    app.store.replace(createEmpty(Date.now()));
    render();
  });

  return {
    enter() {
      newGate();
      $('#gate-err').hidden = true;
      status('');
      gate.hidden = false;
      body.hidden = true;
      selected = null;
      selectedDay = null;
    },
  };
}
