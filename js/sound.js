// Zvuky generované přes Web Audio, žádné soubory.
// iOS pustí zvuk až po ťuknutí, proto se unlock() volá při stisku tlačítka Hrát.

let ctx = null;
let enabled = true;

export function setEnabled(value) {
  enabled = Boolean(value);
}

export function isEnabled() {
  return enabled;
}

export function unlock() {
  try {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
    }
    if (ctx.state !== 'running') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    ctx = null;
  }
}

function ready() {
  if (!enabled || !ctx) return false;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return true;
}

function tone({ freq, to = freq, type = 'sine', start = 0, dur = 0.15, vol = 0.2 }) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function burst(dur = 0.06, vol = 0.15) {
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  gain.gain.value = vol;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

export function pop() {
  if (!ready()) return;
  tone({ freq: 500, to: 1300, dur: 0.09, vol: 0.22 });
  burst();
}

export function wrong() {
  if (!ready()) return;
  tone({ freq: 330, to: 220, type: 'triangle', dur: 0.3, vol: 0.16 });
}

export function finish() {
  if (!ready()) return;
  [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, type: 'triangle', start: i * 0.11, dur: 0.25, vol: 0.16 }));
}
