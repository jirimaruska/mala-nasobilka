// Start appky: service worker a přepínání obrazovek.

const screens = {};
let current = null;
let reloadWhenIdle = false;

export function show(name) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'screen-' + name;
  current = name;
  window.scrollTo(0, 0);
  screens[name]?.enter?.();
  if (reloadWhenIdle && name === 'home') location.reload();
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

registerServiceWorker();
show('home');
