let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(frequency: number, duration: number, startTime: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playUpSignal() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  beep(523, 0.15, t, 'sine', 0.25);
  beep(659, 0.15, t + 0.12, 'sine', 0.25);
  beep(784, 0.3, t + 0.24, 'sine', 0.3);
}

export function playDownSignal() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  beep(440, 0.15, t, 'sine', 0.25);
  beep(349, 0.15, t + 0.12, 'sine', 0.25);
  beep(262, 0.3, t + 0.24, 'sine', 0.3);
}

export function playWin() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  beep(659, 0.1, t, 'triangle', 0.2);
  beep(880, 0.2, t + 0.08, 'triangle', 0.2);
}

export function playLoss() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  beep(220, 0.3, t, 'sawtooth', 0.15);
  beep(165, 0.4, t + 0.1, 'sawtooth', 0.15);
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') void ctx.resume();
}
