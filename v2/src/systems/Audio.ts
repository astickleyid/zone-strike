/** Tiny synth SFX via WebAudio — no asset downloads. Resumes on first gesture. */
class AudioFX {
  private ctx?: AudioContext;
  private ready = false;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const resume = () => { this.ctx?.resume().then(() => { this.ready = true; }); };
      addEventListener('pointerdown', resume, { once: false });
      addEventListener('touchstart', resume, { once: false });
      addEventListener('keydown', resume, { once: false });
    } catch { /* no audio */ }
  }

  private noise(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur);
  }

  private tone(freq: number, dur: number, gain = 0.2, type: OscillatorType = 'square', slideTo?: number) {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(ctx.destination); osc.start(t); osc.stop(t + dur);
  }

  shoot() { this.noise(0.09, 1800, 0.22); this.tone(220, 0.06, 0.12, 'sawtooth', 90); }
  enemyShoot() { this.noise(0.10, 900, 0.10); }
  hit() { this.tone(1200, 0.05, 0.18, 'square', 1600); }
  hurt() { this.noise(0.18, 400, 0.25); this.tone(110, 0.18, 0.12, 'sawtooth', 60); }
  capture() { this.tone(440, 0.18, 0.2, 'triangle', 880); }
  kill() { this.tone(660, 0.12, 0.2, 'square', 990); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.2, 'triangle'), i * 130)); }
  lose() { [440, 349, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 0.2, 'sawtooth'), i * 160)); }
}

export const sfx = new AudioFX();
