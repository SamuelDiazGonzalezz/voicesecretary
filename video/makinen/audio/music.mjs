// Música del documental de Tommi Mäkinen: el estilo 01 del catálogo (cuerdas, metales y taikos, Re menor, 120 BPM)
// en versión tranquila. Solo rompe en cuatro momentos: «Cuatro mundiales consecutivos», «Cuatro campeonatos del
// mundo consecutivos», «tricampeón» y «voluntad de hierro». Sintetizado desde cero con la biblioteca de la serie.
// Determinista. Escribe out/music.wav (48 kHz, estéreo, float32).
import path from 'node:path';
import { createStudio } from '../../musica/synth.mjs';
import { DURATION, SECTIONS, BREAKS, V, cut } from '../src/timeline.js';
import { HITS, SHOT_TRANS } from '../src/scenes.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = createStudio(DURATION, { pump: 0, room: 0.88 });
const BAR = 2; // un compás de 4 tiempos a 120 BPM

// Armonía: Re menor; en calma un acorde cada dos compases, en las rupturas uno por compás.
const C = { Dm: [38, [62, 65, 69]], Bb: [34, [62, 65, 70]], F: [41, [60, 65, 69]], C: [36, [60, 64, 67]], Gm: [43, [62, 67, 70]], A: [45, [61, 64, 69]] };
const SLOW = ['Dm', 'Dm', 'Bb', 'Bb', 'F', 'F', 'C', 'C'];
const TENSE = ['Dm', 'Dm', 'Gm', 'Gm', 'Bb', 'Bb', 'A', 'A'];
const FAST = ['Dm', 'Bb', 'F', 'C'];
const ROLE = {
  ident: 'calm', open: 'calm', rise1: 'build', break1: 'full', title: 'swell', calm1: 'calm', lift: 'pulse', calm2: 'calm', tech: 'pulse',
  rise2: 'build', break2: 'full', calm3: 'calm', tense: 'tense', break3: 'full', tech2: 'pulse', calm4: 'calm', rise3: 'pulse', break4: 'full', outro: 'calm',
};
const secAt = (t) => { let s = SECTIONS[0]; for (const x of SECTIONS) if (t + 1e-6 >= x.start) s = x; const i = SECTIONS.indexOf(s); return { ...s, end: SECTIONS[i + 1]?.start ?? DURATION }; };
const chordAt = (t) => {
  const s = secAt(t), role = ROLE[s.name];
  const bar = Math.floor(t / BAR + 1e-6);
  const prog = role === 'full' ? FAST : role === 'tense' ? TENSE : SLOW;
  return prog[bar % prog.length];
};

// Cuerdas: un tramo por acorde (y por sección), con ataque lento en la calma y rápido en las rupturas.
{
  const END = cut(110) + 0.5;
  let t0 = 0, cur = null;
  const flush = (t1) => {
    if (!cur || t1 - t0 < 0.2) return;
    const [r, tri] = C[cur.ch];
    const role = cur.role;
    const lift = role === 'full' ? 12 : 0;
    const vel = { calm: 1.15, swell: 1.25, pulse: 0.85, build: 0.85, full: 1.15, tense: 0.8 }[role];
    S.strings(t0, t1, [...tri.map((m) => m + lift), r + 12], { vel, attack: role === 'full' ? 0.25 : 1.4, cutoff: role === 'full' ? 2800 : role === 'tense' ? 1300 : 1700, release: 1.4 });
  };
  for (let t = 0; t < END; t += 0.5) {
    const s = secAt(t);
    const key = { ch: chordAt(t), role: ROLE[s.name], sec: s.name };
    if (!cur || key.ch !== cur.ch || key.sec !== cur.sec) { flush(t); t0 = t; cur = key; }
  }
  flush(END);
}

// Ritmo por compás según el papel de la sección.
for (let bar = 0; bar * BAR < cut(110); bar++) {
  const tb = bar * BAR;
  const s = secAt(tb + 1e-3);
  const role = ROLE[s.name];
  const [r] = C[chordAt(tb + 1e-3)];
  const ramp = Math.min(1, Math.max(0, (tb - s.start) / Math.max(2, s.end - s.start)));
  if (role === 'pulse') {
    // Ostinato grave en negras, muy suave, y un taiko lejano al principio de cada compás.
    for (let k = 0; k < 4; k++) S.bassNote(tb + k * 0.5, 0.3, r + (k === 3 ? 7 : 0), { cutoff: 380, env: 0.8, drive: 1.1, vel: 0.4 });
    S.taiko(tb, 0.35 + (s.name === 'rise3' ? 0.45 * ramp : 0), 50);
  }
  if (role === 'tense') {
    // Corcheas obsesivas con la segunda menor, como en el estilo de tensión, pero con cuerdas.
    const OST = [0, 0, 1, 0, 0, 0, 1, 3];
    for (let k = 0; k < 8; k++) S.bassNote(tb + k * 0.25, 0.18, r + OST[k], { cutoff: 420, env: 1.2, drive: 1.3, vel: 0.5 });
    if (bar % 2 === 0) S.taiko(tb, 0.5, 46);
    S.tick(tb, 0.25, 1200); S.tick(tb + 1, 0.2, 1500);
  }
  if (role === 'build') {
    for (let k = 0; k < 8; k++) S.bassNote(tb + k * 0.25, 0.14, r, { cutoff: 360 + 600 * ramp, env: 1.5, drive: 1.4, vel: 0.45 + 0.35 * ramp });
    S.taiko(tb, 0.6 + 0.4 * ramp, 52); S.taiko(tb + 1, 0.5 + 0.4 * ramp, 58, 0.2);
    if (ramp > 0.5) { S.taiko(tb + 1.5, 0.6, 64, -0.2); S.taiko(tb + 1.75, 0.7, 68, 0.2); }
  }
  if (role === 'full') {
    // El estilo 01 a pleno: ostinato en corcheas, taikos a medio tiempo y metales.
    for (let k = 0; k < 8; k++) S.bassNote(tb + k * 0.25, 0.18, r + (k % 4 === 3 ? 7 : 0), { cutoff: 560, env: 1.2, drive: 1.3, vel: k % 2 ? 0.6 : 0.9 });
    S.taiko(tb, 1); S.taiko(tb + 0.75, 0.55, 62, -0.3); S.taiko(tb + 1, 0.85, 52, 0.3); S.taiko(tb + 1.5, 0.6, 70, -0.2); S.taiko(tb + 1.75, 0.7, 66, 0.2);
  }
}

// Las cuatro rupturas: golpe, plato y tema de metales.
const MEL = [[0, 2, 69], [2, 2, 74], [4, 3, 77], [7, 1, 76], [8, 2, 74], [10, 2, 70], [12, 4, 72]];
for (const [name, t0] of Object.entries(BREAKS)) {
  S.riser(t0 - 2.4, t0 - 0.05, 0.7);
  S.reverseCymbal(t0, 1.3, 0.8);
  S.crash(t0, 1);
  S.impact(t0, 1.1);
  const len = secAt(t0 + 0.01).end - t0;
  for (const [b, d, m] of MEL) if (b * 0.5 < len - 0.3) S.brass(t0 + b * 0.5, Math.min(d * 0.5, len - b * 0.5) * 0.95, [m - 12, m], { vel: 1.0, swell: 0.08 });
}
// El título del documental: acorde de metales suave.
S.brass(V(13) + 0.3, 2.6, [50, 57, 62, 65], { vel: 0.7, swell: 0.4, bright: 0.7 });
S.impact(V(24) + 0.7, 0.7); // «1994»
// Entrada del logotipo.
S.impact(0.08, 0.7);
S.strings(0.05, 2.5, [50, 57, 62, 65], { vel: 0.9, attack: 0.6, release: 1.5 });
// Cierre: acorde final con el canal.
S.brass(cut(110), 3.5, [50, 57, 62, 65, 69], { vel: 0.9, swell: 0.3 });
S.strings(cut(110), cut(110) + 4, [62, 65, 69, 74, 50], { vel: 1.0, attack: 0.5, release: 3 });
S.taiko(cut(110), 0.9, 46);

// Transiciones.
for (const [t, type] of SHOT_TRANS) {
  if (t < 1) continue;
  if (type === 'wipe') S.whoosh(t - 0.3, 0.6, { vel: 0.6 });
  if (type === 'whip' || type === 'whipV') S.whoosh(t - 0.2, 0.42, { f0: 500, f1: 6500, peak: 0.5, vel: 0.5 });
  if (type === 'slices') S.whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.4 });
  if (type === 'cube' || type === 'cubeV') { S.whoosh(t - 0.24, 0.48, { from: 0.6, to: -0.6, f0: 300, f1: 4500, peak: 0.55, vel: 0.55 }); S.tom(t, 66, 0.3, 0); }
  if (type === 'fly') S.whoosh(t - 0.25, 0.5, { f0: 6000, f1: 300, peak: 0.7, vel: 0.6 });
  if (type === 'dissolve') S.whoosh(t - 0.4, 0.8, { from: -0.2, to: 0.2, f0: 250, f1: 1800, peak: 0.6, vel: 0.2 });
}
for (const h of HITS) if (!Object.values(BREAKS).includes(h) && Math.abs(h - V(24) - 0.7) > 0.05) S.impact(h, 0.6);

// Diseño sonoro.
// La rueda que se arranca (Gran Bretaña, 1998).
S.tick(V(65) + 1.6, 0.9, 700); S.tom(V(65) + 1.6, 90, 0.6, -0.3); S.whoosh(V(65) + 1.6, 0.6, { from: 0, to: -0.8, f0: 2000, f1: 400, vel: 0.4 });
// El motor del Corolla que revienta a 300 m.
S.impact(V(68) + 0.2, 0.7); S.antilag(V(68) + 0.2, V(68) + 0.5, { vel: 0.5, density: 20 });
// El teléfono del hotel: timbre de dos tonos.
for (let k = 0; k < 2; k++) for (let i = 0; i < 22; i++) S.bell(V(71) + 0.5 + k * 1.4 + i * 0.045, i % 2 ? 91 : 88, { vel: 0.18, dur: 0.25, index: 1.2, pan: 0.3 });
// Contador de las 24 victorias.
for (let i = 0; i < 24; i++) S.tick(V(97) + 0.2 + (1 - Math.exp(-i / 8)) * 1.4, 0.25, 2200 + i * 30);
// Botones del canal.
S.tick(V(111) + 0.9, 0.8, 1400); S.tick(V(111) + 1.9, 1, 1400); S.tick(V(111) + 1.92, 0.6, 2600);

const r = S.render(path.join(root, 'out', 'music.wav'));
console.log('music ->', r.file, `pico previo ${r.peakIn.toFixed(1)} dBFS`);
