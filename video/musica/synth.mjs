// Sintetizador de la serie EVO HERITAGE como biblioteca: instrumentos, efectos y máster, sin muestras.
// createStudio(duración) devuelve los instrumentos ligados a sus buses y render(archivo) escribe el WAV.
// Determinista: todo el ruido sale de un PRNG con semilla.
import fs from 'node:fs';
import path from 'node:path';

export function createStudio(DURATION, opts = {}) {
  const SR = 48000;
  const N = Math.round(DURATION * SR);
  const BEAT = opts.beat ?? 0.5;
  const pumpDepth = opts.pump ?? 0.6;
  // ---------------------------------------------------------------------------
  // Utilidades DSP.

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dbToGain = (db) => 10 ** (db / 20);

  function bus() {
    return { L: new Float32Array(N), R: new Float32Array(N) };
  }
  const B = {
    drums: bus(), bass: bus(), music: bus(), lead: bus(), fx: bus(),
    verb: bus(), delay: bus(),
  };

  // Escribe una muestra mono en un bus con panorama de potencia constante y envíos.
  function put(b, i, x, pan = 0, send = 0, dsend = 0) {
    if (i < 0 || i >= N) return;
    const a = (pan + 1) * Math.PI / 4;
    const l = Math.cos(a) * x, r = Math.sin(a) * x;
    b.L[i] += l; b.R[i] += r;
    if (send) { B.verb.L[i] += l * send; B.verb.R[i] += r * send; }
    if (dsend) { B.delay.L[i] += l * dsend; B.delay.R[i] += r * dsend; }
  }

  function polyblep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }

  // Filtro de variable de estado (TPT). mode: 'lp' | 'bp' | 'hp'.
  class SVF {
    constructor() { this.ic1 = 0; this.ic2 = 0; this.set(1000, 0.707); }
    set(fc, q) {
      const g = Math.tan(Math.PI * clamp(fc, 10, SR * 0.45) / SR);
      this.k = 1 / q;
      this.a1 = 1 / (1 + g * (g + this.k));
      this.a2 = g * this.a1;
      this.a3 = g * this.a2;
    }
    run(x, mode = 'lp') {
      const v3 = x - this.ic2;
      const v1 = this.a1 * this.ic1 + this.a2 * v3;
      const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
      this.ic1 = 2 * v1 - this.ic1;
      this.ic2 = 2 * v2 - this.ic2;
      if (mode === 'lp') return v2;
      if (mode === 'bp') return v1;
      return x - this.k * v1 - v2;
    }
  }

  // ---------------------------------------------------------------------------
  // Instrumentos.

  const kickTimes = [];

  function kick(t, vel = 1) {
    kickTimes.push(t);
    const i0 = Math.round(t * SR), len = Math.round(0.5 * SR);
    const r = rng(i0);
    let ph = 0;
    const hp = new SVF(); hp.set(3000, 0.7);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      const f = 44 + 120 * Math.exp(-tau * 30);
      ph += f / SR;
      const body = Math.sin(2 * Math.PI * ph) * Math.exp(-tau * 6.5) * Math.min(1, tau * 2000);
      const click = hp.run(r() * 2 - 1, 'hp') * Math.exp(-tau * 260) * 0.35;
      put(B.drums, i0 + n, Math.tanh((body + click) * 1.6) * 0.9 * vel);
    }
  }

  function clap(t, vel = 1, pan = 0) {
    const i0 = Math.round(t * SR), len = Math.round(0.45 * SR);
    const r = rng(i0 + 11);
    const bp = new SVF(); bp.set(1350, 1.4);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      let env = Math.exp(-tau * 16) * 0.5;
      for (const o of [0, 0.011, 0.023]) if (tau >= o) env += Math.exp(-(tau - o) * 190);
      put(B.drums, i0 + n, bp.run(r() * 2 - 1, 'bp') * env * 0.9 * vel, pan, 0.22);
    }
  }

  function snare(t, vel = 1) {
    const i0 = Math.round(t * SR), len = Math.round(0.3 * SR);
    const r = rng(i0 + 23);
    const hp = new SVF(); hp.set(1600, 0.7);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      ph += (180 + 60 * Math.exp(-tau * 40)) / SR;
      const tone = Math.sin(2 * Math.PI * ph) * Math.exp(-tau * 22) * 0.55;
      const nz = hp.run(r() * 2 - 1, 'hp') * Math.exp(-tau * 15);
      put(B.drums, i0 + n, (tone + nz) * 0.55 * vel, 0, 0.15);
    }
  }

  function hat(t, vel = 1, open = false, pan = 0.25) {
    const i0 = Math.round(t * SR), len = Math.round((open ? 0.5 : 0.08) * SR);
    const r = rng(i0 + 37);
    const hp = new SVF(); hp.set(7600, 0.9);
    const bp = new SVF(); bp.set(10500, 1.2);
    const dec = open ? 8 : 70;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      const x = hp.run(r() * 2 - 1, 'hp');
      put(B.drums, i0 + n, (x * 0.6 + bp.run(x, 'bp') * 0.8) * Math.exp(-tau * dec) * 0.28 * vel, pan, 0.05);
    }
  }

  function tom(t, freq, vel = 1, pan = 0) {
    const i0 = Math.round(t * SR), len = Math.round(0.5 * SR);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      ph += freq * (1 + 0.7 * Math.exp(-tau * 18)) / SR;
      put(B.drums, i0 + n, Math.tanh(Math.sin(2 * Math.PI * ph) * 1.4) * Math.exp(-tau * 8) * 0.6 * vel, pan, 0.2);
    }
  }

  function bassNote(t, dur, midi, { cutoff = 420, env = 3, drive = 1.4, vel = 1 } = {}) {
    const i0 = Math.round(t * SR), len = Math.round((dur + 0.04) * SR);
    const f = mtof(midi);
    const lp = new SVF();
    let p1 = 0, p2 = 0.37, ps = 0;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      if (n % 16 === 0) lp.set(cutoff * (1 + env * Math.exp(-tau * 16)), 0.9);
      const f1 = f * 1.004, f2 = f * 0.996;
      p1 = (p1 + f1 / SR) % 1; p2 = (p2 + f2 / SR) % 1; ps = (ps + f / 2 / SR) % 1;
      const x = (2 * p1 - 1 - polyblep(p1, f1 / SR)) * 0.5 + (2 * p2 - 1 - polyblep(p2, f2 / SR)) * 0.5;
      const amp = Math.min(1, tau / 0.003) * (tau > dur ? Math.exp(-(tau - dur) * 120) : 1);
      const y = Math.tanh(lp.run(x) * drive) * 0.55 + Math.sin(2 * Math.PI * ps) * 0.35;
      put(B.bass, i0 + n, y * amp * vel);
    }
  }

  function pluck(t, midi, { vel = 1, pan = 0, bright = 1 } = {}) {
    const i0 = Math.round(t * SR), len = Math.round(0.32 * SR);
    const f = mtof(midi);
    const lp = new SVF();
    let p = 0, q = 0.5;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      if (n % 16 === 0) lp.set(700 + 4200 * bright * Math.exp(-tau * 22), 1.1);
      p = (p + f / SR) % 1; q = (q + f * 1.006 / SR) % 1;
      const saw = 2 * p - 1 - polyblep(p, f / SR);
      const sq = (q < 0.5 ? 1 : -1);
      const y = lp.run(saw * 0.7 + sq * 0.25) * Math.exp(-tau * 11) * Math.min(1, tau / 0.002);
      put(B.music, i0 + n, y * 0.32 * vel, pan, 0.18, 0.3);
    }
  }

  function pad(t0, t1, notes, { cutoff = 1400, vel = 1, attack = 0.35, release = 0.7 } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0 + release) * SR);
    notes.forEach((m, k) => {
      const voices = [-0.11, 0, 0.11].map((d, j) => ({ f: mtof(m + d), p: (k * 0.31 + j * 0.17) % 1, pan: (j - 1) * 0.7 }));
      const lp = new SVF();
      for (let n = 0; n < len; n++) {
        const tau = n / SR;
        if (n % 32 === 0) lp.set(cutoff * (1 + 0.15 * Math.sin(tau * 1.3 + k)), 0.6);
        const env = Math.min(1, tau / attack) * (t0 + tau > t1 ? Math.exp(-(t0 + tau - t1) / release * 4) : 1);
        for (const v of voices) {
          v.p = (v.p + v.f / SR) % 1;
          const x = 2 * v.p - 1 - polyblep(v.p, v.f / SR);
          put(B.music, i0 + n, lp.run(x) * env * 0.055 * vel / voices.length * 3, v.pan, 0.35);
        }
      }
    });
  }

  function leadNote(t, dur, midi, vel = 1) {
    const i0 = Math.round(t * SR), len = Math.round((dur + 0.35) * SR);
    const f = mtof(midi);
    const lp = new SVF();
    let p1 = 0, p2 = 0.5;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      if (n % 16 === 0) lp.set(1800 + 2200 * Math.exp(-tau * 6), 0.8);
      const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * tau) * Math.min(1, tau * 3);
      p1 = (p1 + f * vib / SR) % 1; p2 = (p2 + f * vib * 1.005 / SR) % 1;
      const x = (2 * p1 - 1 - polyblep(p1, f / SR)) + (2 * p2 - 1 - polyblep(p2, f / SR));
      const env = Math.min(1, tau / 0.012) * (tau > dur ? Math.exp(-(tau - dur) * 14) : 1);
      put(B.lead, i0 + n, lp.run(x) * env * 0.13 * vel, 0, 0.3, 0.22);
    }
  }

  // --- Diseño sonoro ---------------------------------------------------------

  function impact(t, size = 1) {
    const i0 = Math.round(t * SR), len = Math.round(2.2 * SR);
    const r = rng(i0 + 101);
    const lp = new SVF(); lp.set(900, 0.7);
    const hp = new SVF(); hp.set(4200, 0.7);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      ph += (30 + 45 * Math.exp(-tau * 5)) / SR;
      const sub = Math.sin(2 * Math.PI * ph) * Math.exp(-tau * 2.2) * Math.min(1, tau * 800);
      const nz = r() * 2 - 1;
      const thump = lp.run(nz) * Math.exp(-tau * 9) * 1.4;
      const crack = hp.run(nz, 'hp') * Math.exp(-tau * 30) * 0.5;
      put(B.fx, i0 + n, Math.tanh((sub * 0.9 + thump + crack) * 1.2) * 0.75 * size, 0, 0.45);
    }
  }

  function whoosh(t0, dur, { from = -0.8, to = 0.8, peak = 0.55, vel = 1, f0 = 350, f1 = 5000 } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round(dur * SR);
    const r = rng(i0 + 202);
    const bp = new SVF();
    for (let n = 0; n < len; n++) {
      const u = n / len;
      if (n % 16 === 0) {
        const k = u < peak ? u / peak : 1 - (u - peak) / (1 - peak);
        bp.set(f0 * (f1 / f0) ** k, 0.9);
      }
      const env = u < peak ? (u / peak) ** 2 : Math.exp(-((u - peak) / (1 - peak)) * 4);
      put(B.fx, i0 + n, bp.run(r() * 2 - 1, 'bp') * env * 0.9 * vel, from + (to - from) * u, 0.3);
    }
  }

  function riser(t0, t1, vel = 1) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
    const r = rng(i0 + 303);
    const hp = new SVF();
    let p = 0;
    for (let n = 0; n < len; n++) {
      const u = n / len;
      if (n % 16 === 0) hp.set(400 * 20 ** u, 1.2);
      const f = mtof(50) * 2 ** (u * 2);
      p = (p + f / SR) % 1;
      const saw = (2 * p - 1) * 0.25;
      const x = hp.run((r() * 2 - 1) + saw, 'hp') * u ** 2.2 * 0.5 * vel;
      put(B.fx, i0 + n, x, Math.sin(u * 9) * 0.3, 0.35);
    }
  }

  function reverseCymbal(t1, dur = 1.2, vel = 1) {
    const i1 = Math.round(t1 * SR), len = Math.round(dur * SR);
    const r = rng(i1 + 404);
    const hp = new SVF(); hp.set(5200, 0.8);
    for (let n = 0; n < len; n++) {
      const u = n / len;
      put(B.fx, i1 - len + n, hp.run(r() * 2 - 1, 'hp') * u ** 3 * 0.45 * vel, 0, 0.2);
    }
  }

  function tick(t, vel = 1, freq = 3200) {
    const i0 = Math.round(t * SR), len = Math.round(0.02 * SR);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      put(B.fx, i0 + n, Math.sin(2 * Math.PI * freq * tau) * Math.exp(-tau * 420) * 0.35 * vel, 0.2);
    }
  }

  // Motor de 5 cilindros en línea: cinco explosiones cada dos vueltas (orden 2,5) con una
  // pequeña diferencia entre cilindros, que da el gorgoteo característico del cinco.
  function engine5(t0, t1, rpmAt, { vel = 1, pan = 0.1 } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
    const r = rng(i0 + 505);
    const f1 = new SVF(), f2 = new SVF(), f3 = new SVF();
    f1.set(140, 3); f2.set(440, 4); f3.set(1250, 5);
    const amp = [1.0, 0.86, 1.08, 0.92, 0.97];
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = t0 + n / SR;
      const u = n / len;
      const rpm = rpmAt(t);
      ph += (rpm / 120) * 5 / SR; // explosiones por segundo
      const k = ph % 1;
      const cyl = Math.floor(ph) % 5;
      const pulse = Math.exp(-k * 8) * amp[cyl] - 0.2;
      const x = pulse + (r() * 2 - 1) * 0.18 * Math.exp(-k * 4);
      const y = f1.run(x, 'bp') * 1.3 + f2.run(x, 'bp') * 0.8 + f3.run(x, 'bp') * 0.35;
      const env = Math.min(1, u * 10) * Math.min(1, (1 - u) * 5);
      put(B.fx, i0 + n, Math.tanh(y * 2.4) * 0.4 * env * vel, pan, 0.18);
    }
  }

  // Silbido del turbo: sube con la presión; termina con la descarga de la válvula.
  function turbo(t0, t1, { vel = 1, f0 = 2500, f1 = 8200, dump = true } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const u = n / len;
      const f = f0 * (f1 / f0) ** (u ** 0.7);
      ph += f / SR;
      const env = u ** 1.5 * Math.min(1, (1 - u) * 30);
      put(B.fx, i0 + n, Math.sin(2 * Math.PI * ph) * 0.06 * env * vel, -0.2, 0.25);
    }
    if (dump) {
      const j0 = i0 + len, dl = Math.round(0.5 * SR);
      const r = rng(j0 + 9);
      const hp = new SVF(); hp.set(2500, 0.8);
      for (let n = 0; n < dl; n++) {
        const tau = n / SR;
        put(B.fx, j0 + n, hp.run(r() * 2 - 1, 'hp') * Math.exp(-tau * 7) * Math.min(1, tau * 300) * 0.35 * vel, 0.25, 0.2);
      }
    }
  }

  // Petardeos del antilag: explosiones cortas en el escape, espaciadas con semilla.
  function antilag(t0, t1, { vel = 1, density = 7 } = {}) {
    const r = rng(Math.round(t0 * 1000) + 77);
    let t = t0;
    while (t < t1) {
      const i0 = Math.round(t * SR), len = Math.round(0.09 * SR);
      const bp = new SVF(); bp.set(280 + r() * 500, 1.1);
      const v = (0.55 + r() * 0.45) * vel;
      for (let n = 0; n < len; n++) {
        const tau = n / SR;
        const x = bp.run(r() * 2 - 1, 'bp') * Math.exp(-tau * 55) * Math.min(1, tau * 4000);
        put(B.fx, i0 + n, Math.tanh(x * 4) * 0.55 * v, (r() - 0.5) * 0.6, 0.25);
      }
      t += (0.4 + r()) / density;
    }
  }

  // Motor de 4 cilindros: tren de explosiones a rpm/30 Hz filtrado por resonancias de escape.
  function engine(t0, t1, rpmAt, { vel = 1, whine = 0 } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
    const r = rng(i0 + 505);
    const f1 = new SVF(), f2 = new SVF(), f3 = new SVF();
    f1.set(170, 3); f2.set(520, 4); f3.set(1500, 5);
    let ph = 0, pw = 0;
    for (let n = 0; n < len; n++) {
      const t = t0 + n / SR;
      const u = n / len;
      const rpm = rpmAt(t);
      const fire = rpm / 30;
      ph += fire / SR;
      const k = ph % 1;
      // Pulso asimétrico con variación por cilindro.
      const cyl = Math.floor(ph) % 4;
      const pulse = Math.exp(-k * 9) * (1 + 0.12 * (cyl - 1.5)) - 0.18;
      const x = pulse + (r() * 2 - 1) * 0.15 * Math.exp(-k * 5);
      const y = f1.run(x, 'bp') * 1.2 + f2.run(x, 'bp') * 0.8 + f3.run(x, 'bp') * 0.4;
      pw += (rpm / 60) * 7.5 / SR;
      const w = Math.sin(2 * Math.PI * pw) * 0.12 * whine;
      const env = Math.min(1, u * 12) * Math.min(1, (1 - u) * 6);
      put(B.fx, i0 + n, Math.tanh(y * 2.2) * 0.38 * env * vel + w * env * vel, 0.1, 0.2);
    }
  }
  // ---------------------------------------------------------------------------
  // Instrumentos de la biblioteca de estilos.

  // Sección de cuerdas: cinco sierras desafinadas por nota, vibrato que entra tarde y ataque lento.
  function strings(t0, t1, notes, { vel = 1, attack = 0.9, release = 1.2, cutoff = 2400, pan = 0.6 } = {}) {
    const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0 + release) * SR);
    notes.forEach((m, k) => {
      const det = [-0.16, -0.07, 0, 0.08, 0.17];
      const vs = det.map((d, j) => ({ f: mtof(m + d), p: (k * 0.23 + j * 0.41) % 1, pan: (j / 2 - 1) * pan, vr: 5.1 + j * 0.37 }));
      const lp = new SVF(), lp2 = new SVF();
      lp.set(cutoff, 0.5); lp2.set(cutoff * 1.4, 0.5);
      for (let n = 0; n < len; n++) {
        const tau = n / SR;
        const env = (1 - Math.exp(-tau / (attack / 3))) * (t0 + tau > t1 ? Math.exp(-(t0 + tau - t1) / release * 4) : 1);
        const vib = 1 + 0.0035 * Math.sin(2 * Math.PI * 5.4 * tau + k) * Math.min(1, Math.max(0, tau - 0.35) * 2);
        let l = 0, r = 0;
        for (const v of vs) {
          v.p = (v.p + v.f * vib / SR) % 1;
          const x = 2 * v.p - 1 - polyblep(v.p, v.f / SR);
          const a = (v.pan + 1) * Math.PI / 4;
          l += x * Math.cos(a); r += x * Math.sin(a);
        }
        const g = env * 0.032 * vel;
        const yl = lp2.run(lp.run(l)) * g, yr = lp2.run(lp.run(r)) * g;
        if (i0 + n < N) { B.music.L[i0 + n] += yl; B.music.R[i0 + n] += yr; B.verb.L[i0 + n] += yl * 0.5; B.verb.R[i0 + n] += yr * 0.5; }
      }
    });
  }

  // Metales: sierras con filtro que se abre al soplar y algo de saturación.
  function brass(t, dur, notes, { vel = 1, swell = 0.18, bright = 1 } = {}) {
    const i0 = Math.round(t * SR), len = Math.round((dur + 0.3) * SR);
    notes.forEach((m, k) => {
      const f = mtof(m);
      const lp = new SVF();
      let p1 = k * 0.3, p2 = 0.5, p3 = 0.1;
      for (let n = 0; n < len; n++) {
        const tau = n / SR;
        if (n % 16 === 0) lp.set((350 + 2600 * bright * (1 - Math.exp(-tau / swell))) * (tau > dur ? Math.exp(-(tau - dur) * 6) : 1), 0.8);
        p1 = (p1 + f * 1.003 / SR) % 1; p2 = (p2 + f * 0.997 / SR) % 1; p3 = (p3 + f * 2.001 / SR) % 1;
        const x = (2 * p1 - 1 - polyblep(p1, f / SR)) + (2 * p2 - 1 - polyblep(p2, f / SR)) + 0.3 * (2 * p3 - 1 - polyblep(p3, 2 * f / SR));
        const env = Math.min(1, tau / (swell * 0.6)) * (tau > dur ? Math.exp(-(tau - dur) * 12) : 1);
        put(B.lead, i0 + n, Math.tanh(lp.run(x) * 1.3) * env * 0.075 * vel, (k - (notes.length - 1) / 2) * 0.25, 0.4);
      }
    });
  }

  // Piano: parciales ligeramente inarmónicos que decaen a distinta velocidad y un golpe de macillo.
  function piano(t, midi, { vel = 1, dur = 2.5, pan = 0 } = {}) {
    const i0 = Math.round(t * SR), len = Math.round(Math.min(dur + 1.8, 7) * SR);
    const f = mtof(midi);
    const Bk = 0.00035;
    const parts = Array.from({ length: 10 }, (_, j) => {
      const k = j + 1;
      return { f: f * k * Math.sqrt(1 + Bk * k * k), a: (1 / k ** 1.15) * (k === 1 ? 1 : 0.6 + 0.4 * vel), d: 0.45 + 0.32 * k * (f / 260) ** 0.5, p: (j * 0.137) % 1 };
    }).filter((p) => p.f < SR * 0.45);
    const r = rng(i0 + 909);
    const bp = new SVF(); bp.set(2600, 1.5);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      let y = 0;
      for (const p of parts) y += Math.sin(2 * Math.PI * p.f * tau + p.p) * p.a * Math.exp(-tau * p.d);
      const off = tau > dur ? Math.exp(-(tau - dur) * 7) : 1;
      const hammer = bp.run(r() * 2 - 1, 'bp') * Math.exp(-tau * 300) * 0.4;
      put(B.music, i0 + n, (y * 0.11 * Math.min(1, tau * 3000) * off + hammer * 0.1) * vel, pan, 0.32);
    }
  }

  // Guitarra distorsionada: quinta y octava, saturación fuerte y filtro de pantalla; dos tomas abiertas.
  function guitar(t, dur, root, { vel = 1, mute = false } = {}) {
    const i0 = Math.round(t * SR), len = Math.round((dur + (mute ? 0.05 : 0.25)) * SR);
    for (const [side, dt] of [[-0.65, 0.004], [0.65, -0.005]]) {
      const notes = [root, root + 7, root + 12].map((m) => mtof(m) * (1 + dt));
      const ph = notes.map((_, j) => (j * 0.31 + (side > 0 ? 0.5 : 0)) % 1);
      const hp = new SVF(), cab = new SVF(), pk = new SVF();
      hp.set(110, 0.7); cab.set(mute ? 1800 : 3300, 0.8); pk.set(1700, 1.2);
      for (let n = 0; n < len; n++) {
        const tau = n / SR;
        let x = 0;
        notes.forEach((fq, j) => { ph[j] = (ph[j] + fq / SR) % 1; x += 2 * ph[j] - 1 - polyblep(ph[j], fq / SR); });
        const env = Math.min(1, tau / 0.003) * (mute ? Math.exp(-tau * 16) : (tau > dur ? Math.exp(-(tau - dur) * 18) : 1));
        const d = Math.tanh(hp.run(x, 'hp') * 7);
        const y = cab.run(d) + pk.run(d, 'bp') * 0.35;
        put(B.music, i0 + n, y * env * 0.11 * vel, side, 0.08);
      }
    }
  }

  // Campana FM: portadora con moduladora a 3,5× cuyo índice decae.
  function bell(t, midi, { vel = 1, dur = 2.4, pan = 0, ratio = 3.5, index = 3 } = {}) {
    const i0 = Math.round(t * SR), len = Math.round(dur * SR);
    const f = mtof(midi);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      const I = index * Math.exp(-tau * 4);
      const y = Math.sin(2 * Math.PI * f * tau + I * Math.sin(2 * Math.PI * f * ratio * tau)) * Math.exp(-tau * 1.7) * Math.min(1, tau * 2000);
      put(B.lead, i0 + n, y * 0.12 * vel, pan, 0.4, 0.3);
    }
  }

  // Taiko: parche grave con caída de tono y golpe de piel.
  function taiko(t, vel = 1, freq = 52, pan = 0) {
    const i0 = Math.round(t * SR), len = Math.round(1.4 * SR);
    const r = rng(i0 + 77);
    const lp = new SVF(); lp.set(700, 0.7);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      ph += freq * (1 + 0.9 * Math.exp(-tau * 22)) / SR;
      const body = Math.sin(2 * Math.PI * ph) * Math.exp(-tau * 4.2);
      const skin = lp.run(r() * 2 - 1) * Math.exp(-tau * 28) * 1.2;
      put(B.drums, i0 + n, Math.tanh((body + skin) * 1.8) * 0.75 * vel, pan, 0.4);
    }
  }

  // Plato de choque: ruido brillante con cola larga.
  function crash(t, vel = 1, pan = 0.2) {
    const i0 = Math.round(t * SR), len = Math.round(2.6 * SR);
    const r = rng(i0 + 55);
    const hp = new SVF(); hp.set(4200, 0.7);
    const bp = new SVF(); bp.set(7800, 0.9);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      const x = hp.run(r() * 2 - 1, 'hp');
      put(B.drums, i0 + n, (x * 0.5 + bp.run(x, 'bp') * 0.7) * Math.exp(-tau * 1.6) * Math.min(1, tau * 900) * 0.32 * vel, pan, 0.25);
    }
  }

  // Caja de los 80: la caja de siempre con una cola de reverb enorme cortada en seco (puerta).
  function snare80(t, vel = 1) {
    snare(t, vel * 0.9);
    const i0 = Math.round(t * SR), len = Math.round(0.34 * SR);
    const r = rng(i0 + 66);
    const bp = new SVF(); bp.set(1900, 0.6);
    for (let n = 0; n < len; n++) {
      const tau = n / SR;
      const gate = tau < 0.26 ? 1 : Math.exp(-(tau - 0.26) * 60);
      put(B.drums, i0 + n, bp.run(r() * 2 - 1, 'bp') * gate * Math.exp(-tau * 3) * 0.38 * vel, 0, 0.6);
    }
  }

  // Caída de subgrave: barrido sinusoidal de 90 a 32 Hz.
  function subDrop(t, dur = 1.6, vel = 1) {
    const i0 = Math.round(t * SR), len = Math.round(dur * SR);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const u = n / len;
      ph += (32 + 58 * (1 - u) ** 2) / SR;
      put(B.fx, i0 + n, Math.sin(2 * Math.PI * ph) * (1 - u) ** 1.5 * Math.min(1, n / 200) * 0.6 * vel);
    }
  }


  function render(file) {
    // ---------------------------------------------------------------------------
    // Efectos de envío: reverb tipo Freeverb y delay ping-pong a 3/16.

    function freeverb(inL, inR, { room = 0.84, damp = 0.35, wet = 1 } = {}) {
      const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
      const aps = [556, 441, 341, 225];
      const scale = SR / 44100;
      const outL = new Float32Array(N), outR = new Float32Array(N);
      for (const [inp, out, spread] of [[inL, outL, 0], [inR, outR, 23]]) {
        const cs = combs.map((c) => ({ buf: new Float32Array(Math.round((c + spread) * scale)), i: 0, f: 0 }));
        const as = aps.map((a) => ({ buf: new Float32Array(Math.round((a + spread) * scale)), i: 0 }));
        for (let n = 0; n < N; n++) {
          const x = inp[n] * 0.015;
          let y = 0;
          for (const c of cs) {
            const o = c.buf[c.i];
            c.f = o * (1 - damp) + c.f * damp;
            c.buf[c.i] = x + c.f * room;
            c.i = (c.i + 1) % c.buf.length;
            y += o;
          }
          for (const a of as) {
            const o = a.buf[a.i];
            const v = -y + o;
            a.buf[a.i] = y + o * 0.5;
            a.i = (a.i + 1) % a.buf.length;
            y = v;
          }
          out[n] = y * wet;
        }
      }
      return { L: outL, R: outR };
    }

    function pingpong(inL, inR, time = BEAT * 0.75, fb = 0.38) {
      const d = Math.round(time * SR);
      const L = new Float32Array(N), R = new Float32Array(N);
      const lp = [new SVF(), new SVF()];
      lp[0].set(3500, 0.7); lp[1].set(3500, 0.7);
      for (let n = 0; n < N; n++) {
        const pl = n >= d ? L[n - d] : 0, pr = n >= d ? R[n - d] : 0;
        L[n] = lp[0].run((inL[n] + inR[n]) * 0.5 + pr * fb);
        R[n] = lp[1].run(pl * fb);
      }
      return { L, R };
    }

    // Bombeo de sidechain desde el bombo para bajo, pads y arpegio.
    const pump = new Float32Array(N).fill(1);
    kickTimes.sort((a, b) => a - b);
    for (const kt of kickTimes) {
      const i0 = Math.round(kt * SR), len = Math.round(0.3 * SR);
      for (let n = 0; n < len && i0 + n < N; n++) {
        const tau = n / SR;
        const g = 1 - pumpDepth * Math.exp(-tau * 14) * Math.min(1, tau * 600 + 0.3);
        pump[i0 + n] = Math.min(pump[i0 + n], g);
      }
    }

    const verb = freeverb(B.verb.L, B.verb.R, { room: opts.room ?? 0.84 });
    const dly = pingpong(B.delay.L, B.delay.R);

    // ---------------------------------------------------------------------------
    // Mezcla y master.

    const gains = Object.assign({ drums: dbToGain(-1), bass: dbToGain(-3), music: dbToGain(-2), lead: dbToGain(-4), fx: dbToGain(-3), verb: dbToGain(-6), delay: dbToGain(-10) }, opts.gains ?? {});
    const L = new Float32Array(N), R = new Float32Array(N);
    const hpL = new SVF(), hpR = new SVF();
    hpL.set(28, 0.7); hpR.set(28, 0.7);
    for (let n = 0; n < N; n++) {
      const p = pump[n];
      let l = B.drums.L[n] * gains.drums + B.bass.L[n] * gains.bass * p + B.music.L[n] * gains.music * p + B.lead.L[n] * gains.lead * (0.6 + 0.4 * p)
        + B.fx.L[n] * gains.fx + verb.L[n] * gains.verb + dly.L[n] * gains.delay;
      let r = B.drums.R[n] * gains.drums + B.bass.R[n] * gains.bass * p + B.music.R[n] * gains.music * p + B.lead.R[n] * gains.lead * (0.6 + 0.4 * p)
        + B.fx.R[n] * gains.fx + verb.R[n] * gains.verb + dly.R[n] * gains.delay;
      L[n] = hpL.run(l, 'hp');
      R[n] = hpR.run(r, 'hp');
    }

    // Limitador con anticipación de 5 ms y techo a -1 dBFS.
    function limit(L, R, ceiling = dbToGain(-1)) {
      const look = Math.round(0.005 * SR);
      const rel = Math.exp(-1 / (0.12 * SR));
      const need = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const pk = Math.max(Math.abs(L[n]), Math.abs(R[n]));
        need[n] = pk > ceiling ? ceiling / pk : 1;
      }
      // Mínimo en la ventana de anticipación (simple, N·look es asumible aquí).
      const target = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        let m = 1;
        for (let k = 0; k <= look && n + k < N; k++) m = Math.min(m, need[n + k]);
        target[n] = m;
      }
      let g = 1;
      for (let n = 0; n < N; n++) {
        g = target[n] < g ? target[n] : target[n] + (g - target[n]) * rel;
        L[n] *= g; R[n] *= g;
      }
    }

    // Normaliza antes del limitador para que trabaje unos 4 dB en los picos.
    let peak = 0;
    for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
    const pre = dbToGain(3) / peak;
    for (let n = 0; n < N; n++) { L[n] *= pre; R[n] *= pre; }
    limit(L, R);
    // Fundido final.
    for (let n = Math.round((DURATION - 0.9) * SR); n < N; n++) {
      const u = (n / SR - (DURATION - 0.9)) / 0.9;
      const g = Math.cos(Math.min(1, u) * Math.PI / 2);
      L[n] *= g; R[n] *= g;
    }

    function writeWav(file, L, R) {
      const data = Buffer.alloc(N * 8);
      for (let n = 0; n < N; n++) { data.writeFloatLE(L[n], n * 8); data.writeFloatLE(R[n], n * 8 + 4); }
      const h = Buffer.alloc(44);
      h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
      h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
      h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
      h.write('data', 36); h.writeUInt32LE(data.length, 40);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.concat([h, data]));
    }

    writeWav(file, L, R);
    return { file, peakIn: 20 * Math.log10(peak) };
  }

  return {
    SR, N, B, BEAT, rng, mtof, clamp, lerp, put, polyblep, SVF, kickTimes,
    kick, clap, snare, hat, tom, bassNote, pluck, pad, leadNote, impact, whoosh, riser, reverseCymbal, tick, turbo, antilag, engine, engine5,
    strings, brass, piano, guitar, bell, taiko, crash, snare80, subDrop,
    render,
  };
}
