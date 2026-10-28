// Shrnutí po kole: body, co se zlepšilo a co ještě potrénovat.

import { label, answer } from '../facts.js';
import { $, el, plural, seconds } from './dom.js';

const MAX_ITEMS = 5;

const WHY = {
  fixed: () => 'Minule to nešlo, teď ano.',
  learned: () => 'Teď už to umíš.',
  faster: (x) => 'Rychleji: ' + seconds(x.from) + ' → ' + seconds(x.to),
  missed: () => 'Tohle ještě nešlo.',
  slow: (x) => 'Šlo to pomalu (' + seconds(x.ms) + ').',
};

function headline(report) {
  if (report.record) return ['🏆', 'Nový rekord!'];
  if (report.ok >= report.n - 1) return ['🎉', 'Skvělá práce!'];
  if (report.ok >= report.n * 0.6) return ['👍', 'Hotovo!'];
  return ['💪', 'Hotovo! Trénink pomáhá.'];
}

function compare(report) {
  if (!report.prev) return '';
  const more = report.score - report.prev.score;
  if (more > 0) return 'O ' + more + ' ' + plural(more, 'bod', 'body', 'bodů') + ' víc než minule!';
  const okMore = report.ok - report.prev.ok;
  if (okMore > 0) return 'Správně o ' + okMore + ' víc než minule!';
  return '';
}

function fillList(list, items) {
  list.replaceChildren(
    ...items.slice(0, MAX_ITEMS).map((x) =>
      el('li', {}, [
        el('span', { class: 'fact-eq', text: label(x.key) + ' = ' + answer(x.key) }),
        el('span', { class: 'fact-why', text: WHY[x.why](x) }),
      ])
    )
  );
  if (items.length > MAX_ITEMS) {
    const rest = items.length - MAX_ITEMS;
    list.append(el('li', { class: 'more', text: 'a ' + plural(rest, 'další', 'další', 'dalších') + ' ' + rest }));
  }
}

export function createSummary(app) {
  $('#sum-again').addEventListener('click', () => {
    app.sound.unlock();
    app.show('game');
  });
  $('#sum-home').addEventListener('click', () => app.show('home'));

  function render(report) {
    if (!report) {
      app.show('home');
      return;
    }
    const [emoji, title] = headline(report);
    $('#sum-emoji').textContent = emoji;
    $('#sum-title').textContent = title;
    $('#sum-score').textContent = report.score;
    $('#sum-points').textContent = plural(report.score, 'bod', 'body', 'bodů');
    const cmp = compare(report);
    $('#sum-compare').hidden = !cmp;
    $('#sum-compare').textContent = cmp;

    $('#sum-ok').textContent = report.ok + ' z ' + report.n;
    $('#sum-avg').textContent = seconds(report.avgMs);
    $('#sum-streak').textContent = report.bestStreak;

    $('#sum-improved-box').hidden = report.improved.length === 0;
    fillList($('#sum-improved'), report.improved);
    $('#sum-practice-box').hidden = report.practice.length === 0;
    fillList($('#sum-practice'), report.practice);
    $('#sum-smooth').hidden = report.practice.length > 0;
  }

  return { enter: render };
}
