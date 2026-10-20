// Start appky: data, service worker a přepínání obrazovek.

import { openStore } from './storage.js';
import * as sound from './sound.js';
import { createHome } from './ui/home.js';
import { createGame } from './ui/game.js';
import { createSummary } from './ui/summary.js';
import { createParents } from './ui/parents.js';

const screens = {};
let current = null;
let reloadWhenIdle = false;

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem() {
        throw new Error('localStorage není dostupné');
      },
      setItem() {
        throw new Error('localStorage není dostupné');
      },
    };
  }
}

function show(name, params) {
  if (current && current !== name) screens[current]?.leave?.();
  if (reloadWhenIdle && name === 'home') {
    location.reload();
    return;
  }
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'screen-' + name;
  current = name;
  window.scrollTo(0, 0);
  screens[name]?.enter?.(params);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Nová verze appky. Obnovit jen na úvodní obrazovce, nikdy uprostřed kola.
    if (!hadController) return;
    reloadWhenIdle = true;
    if (current === 'home') location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const store = openStore(getStorage());
sound.setEnabled(store.data.settings.sound !== false);
navigator.storage?.persist?.().catch(() => {});

const app = { store, sound, show };
screens.home = createHome(app);
screens.game = createGame(app);
screens.summary = createSummary(app);
screens.parents = createParents(app);

registerServiceWorker();
show('home');
