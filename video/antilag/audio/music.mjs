// Música y diseño sonoro sintetizados desde cero (sin muestras), 120 BPM, La menor. Documental sobre el sistema Anti-lag.
// Determinista: el ruido sale de un PRNG con semilla. Escribe out/music.wav (48 kHz, estéreo, float32).
import fs from 'node:fs';
import path from 'node:path';
import { DURATION, BEAT, SECTIONS, V, cut, CLIP } from '../src/timeline.js';
import { HITS, SHOT_TRANS } from '../src/scenes.js';

const SR = 48000;
const N = Math.round(DURATION * SR);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

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
// Armonía y forma.

const CH = {
  Am: { root: 45, tri: [64, 69, 72] },
  F: { root: 41, tri: [65, 69, 72] },
  C: { root: 36, tri: [64, 67, 72] },
  G: { root: 43, tri: [62, 67, 71] },
  Dm: { root: 38, tri: [62, 65, 69] },
  E: { root: 40, tri: [64, 68, 71] },
};
const STD = ['Am', 'F', 'C', 'G'];
const DARKP = ['Am', 'F', 'Dm', 'E'];
const PROG = {
  ident: ['Am'], cold: ['Am'], intro: ['Am', 'F'], drop1: STD, tension: DARKP, groove: STD, dead: ['Am'], hit: ['F', 'G'],
  brake: DARKP, drop2: STD, mech: ['Am', 'Am', 'F', 'F'], build: ['E'], bam: ['Am'], climax: ['F', 'G', 'Am', 'Am'],
  history: STD, precise: ['Am', 'F', 'C', 'G'], price: ['Dm', 'Am', 'E', 'Am'], outro: ['F', 'G', 'Am', 'Am'], end: ['Am'],
};
const ROLE = {
  ident: 'none', cold: 'drone', intro: 'build', drop1: 'full', tension: 'dark', groove: 'full', dead: 'none', hit: 'heavy',
  brake: 'dark', drop2: 'heavy', mech: 'mech', build: 'build', bam: 'none', climax: 'heavy', history: 'light', precise: 'light',
  price: 'dark', outro: 'full', end: 'none',
};

function sectionAt(t) {
  let s = SECTIONS[0];
  for (const x of SECTIONS) if (t + 1e-9 >= x.start) s = x;
  const i = SECTIONS.indexOf(s);
  const end = SECTIONS[i + 1]?.start ?? DURATION;
  return { ...s, end, local: (t - s.start) / BEAT };
}
function chordAt(t) {
  const s = sectionAt(t);
  const p = PROG[s.name];
  return CH[p[Math.floor(s.local / 4 + 1e-9) % p.length]];
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
// Arreglo.

const ARP = [0, 2, 1, 3, 2, 4, 3, 1];
function arpNote(ch, step) {
  const t = ch.tri;
  const seq = [t[0], t[1], t[2], t[0] + 12, t[1] + 12];
  return seq[ARP[step % ARP.length] % seq.length];
}
// Melodía en La menor para el clímax y el final: [tiempo, duración en tiempos, nota].
const LEAD = [[0, 1, 76], [1, 1, 81], [2, 2, 84], [4, 1, 83], [5, 1, 81], [6, 2, 79], [8, 1, 81], [9, 1, 84], [10, 2, 88], [12, 2, 86], [14, 2, 84]];

const nBeats = Math.round(DURATION / BEAT);
for (let b = 0; b < nBeats; b++) {
  const tb = b * BEAT;
  const s = sectionAt(tb + 1e-6);
  const lb = Math.round(s.local);
  const role = ROLE[s.name];
  const heavy = role === 'heavy';
  for (let k = 0; k < 4; k++) {
    const t = tb + k * BEAT / 4;
    const s16 = lb * 4 + k;
    const ch = chordAt(t + 1e-6);
    if (role === 'drone' && k === 0 && lb % 4 === 0) bassNote(t, BEAT * 3.8, 33, { cutoff: 140, env: 0.5, drive: 1.2, vel: 0.5 });
    if (role === 'full' || role === 'heavy' || role === 'light') {
      hat(t, k === 2 ? 0.7 : 0.38, false, 0.3);
      if (role !== 'light' || k % 2 === 0) bassNote(t, 0.1, ch.root + (k % 2 ? 12 : 0), { cutoff: heavy ? 560 : 400, env: heavy ? 4 : 3, drive: heavy ? 2.8 : 1.5, vel: 0.85 });
      pluck(t, arpNote(ch, s16) + 12, { vel: role === 'light' ? 0.55 : 0.75, pan: k % 2 ? 0.35 : -0.35, bright: heavy ? 1.2 : 0.8 });
    }
    if (role === 'mech') {
      // Acento 3-3-2 sobre semicorcheas: maquinaria, no baile.
      const g = s16 % 8;
      const acc = g === 0 || g === 3 || g === 6;
      hat(t, acc ? 0.75 : 0.28, false, acc ? -0.3 : 0.3);
      if (acc) tick(t, 0.45, 1600);
      bassNote(t, 0.1, ch.root + (acc ? 0 : 12), { cutoff: acc ? 650 : 360, env: 4, drive: 2.2, vel: acc ? 1 : 0.55 });
    }
    if (role === 'dark') {
      if (k % 2 === 0) hat(t, k === 0 ? 0.42 : 0.26, false, -0.25);
      if (k === 0 && lb % 2 === 0) bassNote(t, BEAT * 1.8, ch.root, { cutoff: 230, env: 1.5, drive: 2, vel: 0.9 });
      if (k === 2 && lb % 4 === 1) pluck(t, arpNote(ch, s16), { vel: 0.4, bright: 0.5 });
    }
    if (role === 'build') {
      if (k % 2 === 0) bassNote(t, 0.1, ch.root + 12, { cutoff: 300 + 250 * clamp(s.local / 12, 0, 1) * 4, env: 3, drive: 2, vel: 0.8 });
      hat(t, 0.3 + 0.4 * clamp(s.local / 12, 0, 1), false, 0.3);
    }
    if (s.name === 'end' && k % 2 === 0 && t < DURATION - 3) bassNote(t, 0.1, 33, { cutoff: 200, env: 2, vel: 0.4 });
  }
  if (role === 'light') { kick(tb, 0.8); if (lb % 2 === 1) clap(tb, 0.6); }
  if (role === 'full' || role === 'heavy') {
    kick(tb, 1);
    if (lb % 2 === 1) { clap(tb, 1); if (heavy) snare(tb, 0.8); }
    hat(tb + BEAT / 2, 0.5, true, -0.3);
    if (heavy && lb % 4 === 3) kick(tb + BEAT * 0.75, 0.6);
  }
  if (role === 'mech') { kick(tb, 0.95); if (lb % 2 === 1) clap(tb, 0.75); }
  if (role === 'dark') {
    if (lb % 4 === 0) kick(tb, 1);
    if (lb % 4 === 1) kick(tb + BEAT / 2, 0.7);
    if (lb % 4 === 2) { clap(tb, 0.9); snare(tb, 0.8); }
  }
  if (role === 'build') {
    kick(tb, 0.9);
    tom(tb + BEAT / 2, 80 + lb * 8, 0.8, -0.3);
    tom(tb + BEAT * 0.75, 95 + lb * 8, 0.7, 0.3);
  }
}

// Pads: un acorde mientras dura, con filtro según el papel de la sección.
{
  const changes = [];
  for (let b = 0; b < nBeats; b++) {
    const t = b * BEAT + 1e-6;
    const ch = chordAt(t);
    const s = sectionAt(t);
    if (!changes.length || changes.at(-1).ch !== ch || changes.at(-1).s !== s.name) changes.push({ t: b * BEAT, ch, s: s.name });
  }
  const CUT = { none: 1000, drone: 450, full: 1500, light: 1200, dark: 700, build: 1600, heavy: 1800, mech: 900 };
  const VEL = { none: 0.9, drone: 0.7, full: 0.8, light: 0.75, dark: 0.95, build: 1, heavy: 0.85, mech: 0.6 };
  changes.forEach((c, i) => {
    const end = Math.min(changes[i + 1]?.t ?? DURATION, DURATION - 0.8);
    const role = ROLE[c.s];
    pad(c.t, end, c.ch.tri, { cutoff: CUT[role] * (c.s === 'climax' ? 1.5 : 1), vel: VEL[role] });
    if (c.s === 'price' || c.s === 'climax' || c.s === 'outro') pad(c.t, end, [c.ch.root + 24], { cutoff: CUT[role] * 0.8, vel: 0.8 });
  });
}
for (const st of [SECTIONS.find((x) => x.name === 'climax').start, SECTIONS.find((x) => x.name === 'outro').start]) {
  for (let rep = 0; rep < 2; rep++) for (const [lb, d, m] of LEAD) leadNote(st + (rep * 16 + lb) * BEAT, d * BEAT * 0.92, m, 0.9);
}

// Redobles y subidas hacia los drops.
for (const name of ['drop1', 'drop2', 'climax', 'outro']) {
  const t0 = SECTIONS.find((x) => x.name === name).start;
  for (let i = 0; i < 16; i++) snare(t0 - 1 + i / 16, 0.25 + i * 0.045);
  riser(t0 - 2.4, t0 - 0.05, 1.0);
  reverseCymbal(t0, 1.4);
}
riser(V(57) - 0.2, V(60) - 0.04, 1.2);

// Entrada del logotipo: golpe con acorde largo; el clip entra con su propio sonido.
impact(0.08, 0.8);
pad(0.08, 2.2, [57, 64, 69, 72], { cutoff: 2000, vel: 1.0, attack: 0.01, release: 1.0 });
impact(CLIP.at, 0.7);
// ¡BAM!: el golpe más grande del vídeo, con antilag y un instante de silencio antes.
impact(V(60), 1.3);
antilag(V(60), V(60) + 0.6, { vel: 1.2, density: 12 });
// Cierre: acorde final con el canal.
pad(cut(88), cut(88) + 3, [45, 52, 57, 64, 69, 72], { cutoff: 2200, vel: 1.2, attack: 0.005, release: 2.4 });
kick(cut(88), 1.0);

// Golpes de montaje y transiciones.
for (const h of HITS) if (Math.abs(h - V(60)) > 0.1 && h > 1) impact(h, 0.85);
for (const [t, type] of SHOT_TRANS) {
  if (type === 'wipe') whoosh(t - 0.3, 0.6, { vel: 0.9 });
  if (type === 'whip') whoosh(t - 0.2, 0.42, { f0: 500, f1: 7000, peak: 0.5, vel: 0.8 });
  if (type === 'whipV') whoosh(t - 0.2, 0.42, { from: 0, to: 0, f0: 400, f1: 6000, peak: 0.5, vel: 0.8 });
  if (type === 'slices') whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.7 });
  if (type === 'dissolve') whoosh(t - 0.4, 0.8, { from: -0.2, to: 0.2, f0: 250, f1: 2000, peak: 0.6, vel: 0.35 });
}

// Diseño sonoro de la ingeniería.
// Turbo que se carga al pisar (gráfica del retraso) y que silba con la presión al máximo.
turbo(cut(19) + 1.4, cut(19) + 3.6, { vel: 0.9, dump: false });
turbo(V(24) - 0.4, V(24) + 0.1, { vel: 1.1 });
// La mariposa se cierra: chasquido seco.
tick(V(28) + 1.4, 1, 900); tom(V(28) + 1.4, 120, 0.4, 0);
// La turbina se frena: silbido que cae.
{
  const t0 = V(34) - 0.2, t1 = V(34) + 2.2;
  const i0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const u = n / len;
    ph += lerp(7600, 700, 1 - (1 - u) ** 2) / SR;
    put(B.fx, i0 + n, Math.sin(2 * Math.PI * ph) * 0.06 * (1 - u) * Math.min(1, u * 40), -0.2, 0.25);
  }
}
// La presión cae a cero: descarga de la válvula.
turbo(V(37) - 0.6, V(37) - 0.1, { vel: 0.6 });
// La centralita ordena: pulsos de inyección.
for (let i = 0; i < 24; i++) tick(V(48) + 4.2 + i * 0.125, 0.25, 3200);
// Chispas en el cilindro (un clic por cada encendido del dibujo).
{
  const s0 = cut(53), s1 = cut(55);
  for (let k = 0; ; k++) { const tk = s0 + (350 + 720 * k) / 300; if (tk > s1) break; tick(tk, 0.5, 4200); }
}
// Explosiones continuas: un petardeo por cada destello del colector (cada 0,25 s).
for (let tk = cut(62); tk < cut(64); tk += 0.25) antilag(tk, tk + 0.05, { vel: 0.45, density: 40 });
// Cero lag: el motor sube sin esperar.
engine(cut(66), cut(66) + 1.6, (t) => 5000 + 3500 * (1 - Math.exp(-(t - cut(66)) * 6)), { vel: 0.8 });
// El colector se raja: crujidos metálicos.
for (let i = 0; i < 3; i++) { tick(V(80) + 0.3 + i * 0.35, 0.9, 700 + i * 140); tom(V(80) + 0.3 + i * 0.35, 60, 0.4, 0); }
// Contadores y botón.
const counterTicks = (t0, t1, n, f = 2400) => { for (let i = 0; i < n; i++) tick(t0 + (1 - Math.exp(-i / (n / 3))) * (t1 - t0), 0.4, f + i * 40); };
counterTicks(V(16) + 0.6, V(16) + 1.8, 12);
counterTicks(V(56), V(56) + 1.4, 12);
tick(V(88) + 0.5, 1, 1400); tick(V(88) + 0.52, 0.6, 2600);

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
    const g = 1 - 0.6 * Math.exp(-tau * 14) * Math.min(1, tau * 600 + 0.3);
    pump[i0 + n] = Math.min(pump[i0 + n], g);
  }
}

const verb = freeverb(B.verb.L, B.verb.R);
const dly = pingpong(B.delay.L, B.delay.R);

// ---------------------------------------------------------------------------
// Mezcla y master.

const gains = { drums: dbToGain(-1), bass: dbToGain(-3), music: dbToGain(-2), lead: dbToGain(-4), fx: dbToGain(-3), verb: dbToGain(-6), delay: dbToGain(-10) };
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

const outFile = path.join(root, 'out', 'music.wav');
writeWav(outFile, L, R);
console.log('music ->', outFile, `peak in ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
