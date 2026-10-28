// Úvodní obrazovka: jméno, pokrok, tlačítko Hrát.

import { ALL_KEYS } from '../facts.js';
import { mastery } from '../learning.js';
import { dayStreak } from '../progress.js';
import { $, plural } from './dom.js';

export function createHome(app) {
  const form = $('#name-form');
  const input = $('#name-input');
  const main = $('#home-main');
  const soundBtn = $('#home-sound');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 20);
    if (!name) {
      input.focus();
      return;
    }
    app.store.data.name = name;
    app.store.save();
    input.blur();
    render();
  });

  $('#home-play').addEventListener('click', () => {
    app.sound.unlock();
    app.show('game');
  });

  $('#home-parents').addEventListener('click', () => app.show('parents'));

  soundBtn.addEventListener('click', () => {
    const on = !app.sound.isEnabled();
    app.sound.setEnabled(on);
    app.store.data.settings.sound = on;
    app.store.save();
    if (on) {
      app.sound.unlock();
      app.sound.pop();
    }
    renderSound();
  });

  function renderSound() {
    const on = app.sound.isEnabled();
    soundBtn.textContent = on ? '🔊 Zvuk' : '🔇 Bez zvuku';
    soundBtn.setAttribute('aria-pressed', String(on));
  }

  function render() {
    const data = app.store.data;
    const hasName = Boolean(data.name);
    form.hidden = hasName;
    main.hidden = !hasName;
    $('#home-hello').textContent = hasName ? 'Ahoj, ' + data.name + '!' : 'Malá násobilka';
    if (!hasName) return;

    const levels = ALL_KEYS.map((k) => mastery(data.facts[k]));
    const known = levels.filter((m) => m >= 3).length;
    const learning = levels.filter((m) => m === 1 || m === 2).length;
    const total = ALL_KEYS.length;
    $('#home-known').textContent = 'Umíš ' + known + ' ze ' + total + ' příkladů';
    $('#home-meter-known').style.width = (known / total) * 100 + '%';
    $('#home-meter-learning').style.width = (learning / total) * 100 + '%';
    $('#home-learning').textContent = learning ? 'Na cestě: ' + learning + ' ' + plural(learning, 'příklad', 'příklady', 'příkladů') : '';

    const best = $('#home-best');
    best.hidden = !data.best;
    best.textContent = '🏆 Rekord ' + data.best;

    const streak = dayStreak(data, Date.now());
    const streakEl = $('#home-streak');
    streakEl.hidden = streak < 2;
    streakEl.textContent = '🔥 ' + streak + ' ' + plural(streak, 'den', 'dny', 'dní') + ' v řadě';

    $('#home-warning').hidden = app.store.canSave && app.store.lastSaveOk;
    renderSound();
  }

  return { enter: render };
}
