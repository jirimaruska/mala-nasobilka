// Herní obrazovka: příklad, 4 bubliny, časování, pauza.

import { parse, product, isZero } from '../facts.js';
import { BUBBLE_MS, planRound, recordAnswer, shuffle } from '../learning.js';
import { makeOptions } from '../distractors.js';
import { createRound, currentKey, isDone, isRetry, answerCurrent } from '../round.js';
import { logAnswer, logRound, roundReport } from '../progress.js';
import { $, $$, el, reducedMotion } from './dom.js';

const COLORS = ['--b1', '--b2', '--b3', '--b4', '--b5', '--b6'];
const PRAISE = ['Správně!', 'Super!', 'Výborně!', 'Paráda!', 'Bezva!'];
const OK_PAUSE = 700; // po správné odpovědi hned dál
const ZERO_PAUSE = 1600; // u nuly chvíli počkat, ať jde přečíst pravidlo
const ZERO_RULE = 'Krát nula je vždycky nula.';
const SHOW_ANSWER = 3000; // jak dlouho ukázat správný výsledek po chybě
const SKIP_AFTER = 700; // ťuknutím jde dál až po chvilce, aby se výsledek stihl přečíst
const COUNT_STEP = 650;

// Bublina se objeví a pak se celou dobu zmenšuje.
const SHRINK = [
  { transform: 'scale(0.6)', opacity: 0, offset: 0 },
  { transform: 'scale(1)', opacity: 1, offset: 0.03 },
  { transform: 'scale(0.3)', opacity: 1, offset: 0.85 },
  { transform: 'scale(0.12)', opacity: 0, offset: 1 },
];

function currentScale(node) {
  try {
    return new DOMMatrixReadOnly(getComputedStyle(node).transform).a || 1;
  } catch {
    return 1;
  }
}

export function createGame(app) {
  const screen = $('#screen-game');
  const problem = $('#problem');
  const qText = $('#q-text');
  const qAnswer = $('#q-answer');
  const msg = $('#game-msg');
  const hint = $('#game-hint');
  const step = $('#game-step');
  const meter = $('#game-meter');
  const score = $('#game-score');
  const overlay = $('#game-overlay');
  const count = $('#game-count');
  const pauseBox = $('#game-pausebox');
  const slots = $$('.slot', screen);
  const bubbles = slots.map((s) => $('.bubble', s));
  const nums = slots.map((s) => $('.num', s));

  let round = null;
  let before = null;
  let prev = null;
  let options = [];
  let anims = [];
  let phase = 'idle'; // countdown | question | feedback | paused | idle
  let resumeTo = null;
  let t0 = 0;
  let spent = 0;
  let raf = 0;
  let timer = 0;
  let skipFrom = 0;

  function clearTimers() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    timer = 0;
    raf = 0;
  }

  function elapsed() {
    return phase === 'question' ? spent + performance.now() - t0 : spent;
  }

  function updateHud() {
    const total = round.queue.length;
    step.textContent = Math.min(round.index + 1, total) + ' / ' + total;
    meter.style.width = (round.index / total) * 100 + '%';
    score.textContent = round.score;
  }

  function resetBoard() {
    for (const anim of anims) anim.cancel();
    anims = [];
    slots.forEach((slot, i) => {
      slot.className = 'slot';
      for (const anim of bubbles[i].getAnimations()) anim.cancel();
      for (const node of $$('.particle, .points', slot)) node.remove();
    });
    msg.textContent = '';
    hint.hidden = true;
    qAnswer.className = 'ans';
    qAnswer.textContent = '?';
  }

  function showPause() {
    overlay.hidden = false;
    count.hidden = true;
    pauseBox.hidden = false;
  }

  function start() {
    const data = app.store.data;
    const now = Date.now();
    const plan = planRound(data.facts, now);
    round = createRound(plan, now);
    before = {};
    for (const k of plan.keys) before[k] = JSON.parse(JSON.stringify(data.facts[k]));
    prev = { round: data.rounds.at(-1) ?? null };
    resetBoard();
    problem.classList.add('blank');
    qText.textContent = '';
    for (const n of nums) n.textContent = '';
    updateHud();
    countdown();
  }

  function countdown() {
    phase = 'countdown';
    overlay.hidden = false;
    pauseBox.hidden = true;
    count.hidden = false;
    let n = 3;
    const next = () => {
      if (n === 0) {
        overlay.hidden = true;
        showQuestion();
        return;
      }
      count.textContent = n;
      count.classList.remove('beat');
      void count.offsetWidth;
      count.classList.add('beat');
      n -= 1;
      timer = setTimeout(next, COUNT_STEP);
    };
    next();
  }

  function showQuestion() {
    clearTimers();
    if (isDone(round)) {
      finish();
      return;
    }
    if (document.hidden) {
      phase = 'paused';
      resumeTo = 'next';
      showPause();
      return;
    }
    resetBoard();
    const key = currentKey(round);
    const { a, b } = parse(key);
    options = makeOptions(a, b, app.store.data.facts[key]);
    const colors = shuffle(COLORS.slice()).slice(0, 4);
    qText.textContent = a + ' × ' + b;
    problem.classList.remove('blank');
    slots.forEach((slot, i) => {
      slot.style.setProperty('--c', 'var(' + colors[i] + ')');
      nums[i].textContent = options[i];
      slot.setAttribute('aria-label', String(options[i]));
    });
    updateHud();
    phase = 'question';
    spent = 0;
    t0 = performance.now();
    anims = bubbles.map((b) => b.animate(SHRINK, { duration: BUBBLE_MS, easing: 'linear', fill: 'forwards' }));
    raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (phase !== 'question') return;
    if (elapsed() >= BUBBLE_MS) {
      resolve('late', null, null);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function onTap(i) {
    if (phase !== 'question') return;
    const ms = Math.round(elapsed());
    const ok = options[i] === product(currentKey(round));
    resolve(ok ? 'ok' : 'bad', i, ms);
  }

  function resolve(result, index, ms) {
    clearTimers();
    phase = 'feedback';
    const key = currentKey(round);
    const correct = product(key);
    const correctIndex = options.indexOf(correct);
    const chosen = index === null ? null : options[index];
    const data = app.store.data;
    const now = Date.now();
    const retry = isRetry(round, key);
    recordAnswer(data.facts[key], { result, ms, chosen: result === 'bad' ? chosen : null, retry }, now);
    logAnswer(data, { result, ms }, now);
    const entry = answerCurrent(round, { result, ms, chosen });
    app.store.save();

    for (const anim of anims) anim.pause();
    score.textContent = round.score;
    meter.style.width = (round.index / round.queue.length) * 100 + '%';
    qAnswer.textContent = correct;

    if (result === 'ok') {
      qAnswer.classList.add('ok');
      popBubble(index);
      showPoints(index, entry.pts);
      slots.forEach((s, i) => i !== index && s.classList.add('fade'));
      if (isZero(key)) {
        msg.textContent = 'Správně! ' + ZERO_RULE;
      } else {
        msg.textContent = round.streak >= 3 ? 'Série ' + round.streak + '!' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
      }
      app.sound.pop();
      timer = setTimeout(showQuestion, isZero(key) ? ZERO_PAUSE : OK_PAUSE);
      return;
    }

    qAnswer.classList.add('reveal');
    if (index !== null) slots[index].classList.add('wrong');
    slots.forEach((s, i) => i !== index && i !== correctIndex && s.classList.add('fade'));
    revealBubble(correctIndex);
    msg.textContent = (result === 'late' ? 'Čas vypršel. ' : 'Vedle. ') + (isZero(key) ? ZERO_RULE : 'Správně je ' + correct + '.');
    hint.hidden = false;
    app.sound.wrong();
    skipFrom = performance.now() + SKIP_AFTER;
    timer = setTimeout(showQuestion, SHOW_ANSWER);
  }

  function popBubble(i) {
    const scale = currentScale(bubbles[i]);
    anims[i].cancel();
    bubbles[i].animate(
      [
        { transform: 'scale(' + scale + ')', opacity: 1 },
        { transform: 'scale(' + scale * 1.45 + ')', opacity: 0 },
      ],
      { duration: 220, easing: 'ease-out', fill: 'forwards' }
    );
    if (!reducedMotion()) burst(slots[i], scale);
  }

  function burst(slot, scale) {
    const radius = slot.clientWidth * 0.5 * scale;
    for (let k = 0; k < 10; k++) {
      const angle = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
      const dist = radius * (0.9 + Math.random() * 0.7);
      const p = el('span', { class: 'particle' });
      slot.append(p);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      p.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(' + x + 'px, ' + y + 'px) scale(0.3)', opacity: 0 },
        ],
        { duration: 450, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' }
      ).onfinish = () => p.remove();
    }
  }

  function showPoints(i, pts) {
    const p = el('span', { class: 'points', text: '+' + pts });
    slots[i].append(p);
    p.animate(
      [
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: 'translate(-50%, -160%)', opacity: 0 },
      ],
      { duration: 750, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => p.remove();
  }

  function revealBubble(i) {
    const scale = currentScale(bubbles[i]);
    anims[i].cancel();
    bubbles[i].animate(
      [
        { transform: 'scale(' + scale + ')', opacity: 1 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 260, easing: 'ease-out', fill: 'forwards' }
    );
    slots[i].classList.add('reveal');
  }

  function pause() {
    if (phase === 'question') {
      spent += performance.now() - t0;
      for (const anim of anims) anim.pause();
      resumeTo = 'question';
    } else if (phase === 'countdown') {
      resumeTo = 'countdown';
    } else if (phase === 'feedback') {
      resumeTo = 'next';
    } else {
      return;
    }
    clearTimers();
    phase = 'paused';
    showPause();
  }

  function resume() {
    if (phase !== 'paused') return;
    overlay.hidden = true;
    app.sound.unlock();
    const to = resumeTo;
    resumeTo = null;
    if (to === 'question') {
      phase = 'question';
      t0 = performance.now();
      for (const anim of anims) anim.play();
      raf = requestAnimationFrame(tick);
    } else if (to === 'countdown') {
      countdown();
    } else {
      showQuestion();
    }
  }

  function stop() {
    clearTimers();
    phase = 'idle';
    resumeTo = null;
    overlay.hidden = true;
    for (const anim of anims) anim.cancel();
    anims = [];
  }

  function finish() {
    stop();
    const data = app.store.data;
    const { record } = logRound(data, round, Date.now());
    app.store.save();
    app.sound.finish();
    app.show('summary', roundReport({ round, before, after: data.facts, prevRound: prev.round, record }));
  }

  slots.forEach((slot, i) => {
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onTap(i);
    });
    // Ovládání klávesnicí (click bez myši a prstu má detail 0).
    slot.addEventListener('click', (e) => e.detail === 0 && onTap(i));
  });

  screen.addEventListener('pointerdown', (e) => {
    if (phase !== 'feedback' || e.target.closest('#game-pause, .overlay')) return;
    if (round.answers.at(-1)?.result === 'ok' || performance.now() < skipFrom) return;
    showQuestion();
  });

  $('#game-pause').addEventListener('click', pause);
  $('#game-resume').addEventListener('click', resume);
  $('#game-quit').addEventListener('click', () => {
    stop();
    app.show('home');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  return {
    enter: start,
    leave: stop,
  };
}
