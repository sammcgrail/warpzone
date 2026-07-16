// ─────────────────────────────────────────────────────────────────────────────
//  Room tone — the dread is 90% audio. A fluorescent 120Hz hum (+ its buzz
//  harmonic), a bed of filtered tape hiss, and a detuned sub that sinks as you
//  shrink so the space feels ever more cavernous. All Web-Audio synthesised,
//  zero assets. Must be started inside a user gesture (iOS).
// ─────────────────────────────────────────────────────────────────────────────
export class Audio {
  private ctx: AudioContext | null = null;
  private hum!: OscillatorNode;
  private buzz!: OscillatorNode;
  private sub!: OscillatorNode;
  private master!: GainNode;

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5); // fade in

    // fluorescent hum: 120Hz + a thin 240 buzz through a bandpass
    this.hum = ctx.createOscillator(); this.hum.type = 'sawtooth'; this.hum.frequency.value = 120;
    const hg = ctx.createGain(); hg.gain.value = 0.05;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 380;
    this.hum.connect(hf); hf.connect(hg); hg.connect(this.master); this.hum.start();

    this.buzz = ctx.createOscillator(); this.buzz.type = 'square'; this.buzz.frequency.value = 240;
    const bg = ctx.createGain(); bg.gain.value = 0.012;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 3;
    this.buzz.connect(bf); bf.connect(bg); bg.connect(this.master); this.buzz.start();

    // sub drone (sinks with scale)
    this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = 44;
    const sg = ctx.createGain(); sg.gain.value = 0.14;
    this.sub.connect(sg); sg.connect(this.master); this.sub.start();

    // tape hiss bed
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const dd = buf.getChannelData(0);
    for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * 0.5;
    n.buffer = buf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 5200;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(nf); nf.connect(ng); ng.connect(this.master); n.start();

    ctx.resume();
  }

  /** Deepen the sub as the player shrinks — cavernous looming. */
  setScale(k: number) {
    if (!this.ctx) return;
    const f = 44 * Math.max(0.35, k);   // smaller player → lower drone
    this.sub.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
  }

  /** Warp blip on a teleport. */
  blip() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
  }

  stop() { try { this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}
