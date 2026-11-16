// WebAudio-only sound: every effect is synthesised (oscillator / filtered noise), so
// the game ships no audio files and makes no network request. One shared noise buffer,
// created once; no allocations in the hot path beyond tiny oscillator nodes.
export function createAudio() {
  let ctx = null; let master = null; let noiseBuf = null; let muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    shot(kind) {
      if (kind === 'dmr') { noise(0.22, 0.9, 900); tone(140, 0.16, 'square', 0.25, 50); }
      else if (kind === 'smg') { noise(0.09, 0.55, 1800); tone(220, 0.06, 'square', 0.12, 90); }
      else if (kind === 'pistol') { noise(0.12, 0.6, 1400); tone(180, 0.08, 'square', 0.15, 70); }
      else { noise(0.14, 0.75, 1100); tone(160, 0.1, 'square', 0.2, 60); } // rifle
    },
    enemyShot() { noise(0.12, 0.35, 900); },
    reload() { tone(500, 0.07, 'square', 0.1); setTimeout(() => tone(700, 0.07, 'square', 0.1), 140); },
    dry() { tone(900, 0.04, 'square', 0.12); },
    hit() { tone(1200, 0.05, 'sine', 0.25); },
    kill() { tone(880, 0.08, 'sine', 0.25); setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 80); },
    hurt() { noise(0.15, 0.5, 400); tone(110, 0.15, 'sawtooth', 0.2, 60); },
    explosion() { noise(0.9, 1.0, 300); tone(70, 0.8, 'sine', 0.5, 30); },
    beep(final) { tone(final ? 1400 : 950, final ? 0.25 : 0.09, 'sine', 0.22); },
    plant() { tone(600, 0.1, 'sine', 0.2); setTimeout(() => tone(900, 0.1, 'sine', 0.2), 120); },
    roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.22), i * 130)); },
    roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sine', 0.2), i * 140)); },
    buy() { tone(1000, 0.06, 'sine', 0.18); },
    step() { noise(0.04, 0.08, 500); },
  };
}
