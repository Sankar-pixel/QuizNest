// frontend/src/engine/Audio.js
// Fully procedural sound engine — every effect is synthesized at runtime via
// the Web Audio API. No external audio files are loaded.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.droneNodes = null;
    this.unlocked = false;
  }

  /** Must be called from a user gesture (click) to satisfy autoplay policies. */
  unlock() {
    if (this.unlocked) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.unlocked = true;
  }

  _now() {
    return this.ctx.currentTime;
  }

  /** Ascending sine/saw sweep for a correct answer — a satisfying "laser". */
  playCorrect() {
    if (!this.unlocked) return;
    const t0 = this._now();

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(1108, t0 + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + 0.35);

    // Layer a short bright "chime" on top for extra sparkle
    const chime = this.ctx.createOscillator();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(1760, t0 + 0.1);
    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0.0001, t0 + 0.1);
    chimeGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.12);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    chime.connect(chimeGain);
    chimeGain.connect(this.masterGain);
    chime.start(t0 + 0.1);
    chime.stop(t0 + 0.42);
  }

  /** Descending detuned square-wave "digital glitch" for a wrong answer. */
  playIncorrect() {
    if (!this.unlocked) return;
    const t0 = this._now();

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(180, t0);
    osc1.frequency.exponentialRampToValueAtTime(55, t0 + 0.35);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(184, t0); // slight detune for a harsh beat
    osc2.frequency.exponentialRampToValueAtTime(52, t0 + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);

    // Bit-crush-ish stutter using rapid gain gating
    const stutter = this.ctx.createGain();
    stutter.gain.setValueAtTime(1, t0);
    for (let i = 0; i < 6; i++) {
      const step = t0 + i * 0.045;
      stutter.gain.setValueAtTime(i % 2 === 0 ? 1 : 0.2, step);
    }

    osc1.connect(stutter);
    osc2.connect(stutter);
    stutter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + 0.4);
    osc2.stop(t0 + 0.4);
  }

  /** Soft UI click for hovers / menu interactions. */
  playClick() {
    if (!this.unlocked) return;
    const t0 = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  /** Starts a low, evolving ambient drone pad — the city's background hum. */
  startAmbientDrone() {
    if (!this.unlocked || this.droneNodes) return;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55; // low A

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55 * 1.5; // perfect fifth above

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07; // slow amplitude wobble

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;

    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.06;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    lfo.start();

    this.droneNodes = { osc1, osc2, lfo, droneGain, filter };
  }

  stopAmbientDrone() {
    if (!this.droneNodes) return;
    const { osc1, osc2, lfo } = this.droneNodes;
    const t0 = this._now();
    this.droneNodes.droneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    osc1.stop(t0 + 0.65);
    osc2.stop(t0 + 0.65);
    lfo.stop(t0 + 0.65);
    this.droneNodes = null;
  }
}
