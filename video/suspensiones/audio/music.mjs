// Música del documental «La evolución de las suspensiones»: tranquila, de documental, en Do menor a 120 BPM.
// Piano en arpegios lentos, cuerdas y campanas FM muy suaves en las partes técnicas. En cada cambio de época,
// un leve crecimiento (cuerdas más abiertas, un taiko lejano y una caída de subgrave); nada de rupturas.
// Sintetizado desde cero con la biblioteca de la serie (video/musica/synth.mjs). Determinista.
import path from 'node:path';
import { createStudio } from '../../musica/synth.mjs';
import { DURATION, SECTIONS, V, cut } from '../src/timeline.js';
import { SHOT_TRANS } from '../src/scenes.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = createStudio(DURATION, { pump: 0, room: 0.9 });
const BAR = 2;

// Do menor, un acorde cada dos compases: Cm – Ab – Eb – Bb.
const C = { Cm: [36, [60, 63, 67]], Ab: [32, [60, 63, 68]], Eb: [39, [58, 63, 67]], Bb: [34, [58, 62, 65]], Fm: [41, [60, 65, 68]], G: [43, [59, 62, 67]] };
const PROG = ['Cm', 'Cm', 'Ab', 'Ab', 'Eb', 'Eb', 'Bb', 'Bb'];
const TECH = ['Cm', 'Cm', 'Fm', 'Fm', 'Ab', 'Ab', 'G', 'G'];
const ROLE = { ident: 'piano', open: 'piano', era70: 'piano', eraB: 'tech', eraA: 'tech', wrc: 'tech', magic: 'tech', rally1: 'piano', finale: 'lift', outro: 'piano' };
const secAt = (t) => { let s = SECTIONS[0]; for (const x of SECTIONS) if (t + 1e-6 >= x.start) s = x; return s; };
const END = cut(127) + 4;

for (let bar = 0; bar * BAR < END; bar++) {
  const tb = bar * BAR;
  const s = secAt(tb + 1e-3);
  const role = ROLE[s.name];
  const prog = role === 'tech' ? TECH : PROG;
  const [r, tri] = C[prog[bar % prog.length]];
  // Piano: bajo en la primera parte y un arpegio de corcheas lentas (negras) muy suave.
  S.piano(tb, r + 12, { vel: 0.55, dur: 1.9, pan: -0.1 });
  const arp = [tri[0], tri[1], tri[2], tri[1]];
  for (let k = 0; k < 4; k++) S.piano(tb + k * 0.5, arp[k] + (role === 'lift' ? 12 : 0), { vel: k === 0 ? 0.42 : 0.3, dur: 0.9, pan: 0.15 });
  // Cuerdas de fondo, cada dos compases.
  if (bar % 2 === 0) S.strings(tb, tb + 2 * BAR, [...tri, r + 12], { vel: role === 'lift' ? 1.0 : 0.62, attack: 1.6, cutoff: role === 'lift' ? 2200 : 1400, release: 1.6 });
  // Partes técnicas: campanas FM en un patrón 3-3-2, como un mecanismo de precisión, y un tic muy bajo.
  if (role === 'tech') {
    const seq = [tri[2] + 12, tri[1] + 12, tri[0] + 12];
    [0, 0.75, 1.5].forEach((o, i) => S.bell(tb + o, seq[i], { vel: 0.22, dur: 1.3, pan: (i - 1) * 0.35, index: 2 }));
    for (let k = 0; k < 8; k++) S.tick(tb + k * 0.25, k % 4 === 0 ? 0.12 : 0.05, k % 4 === 0 ? 2600 : 4000);
  }
}

// Cambios de época: crecimiento suave, sin golpes.
for (const name of ['era70', 'eraB', 'eraA', 'wrc', 'magic', 'rally1']) {
  const t0 = SECTIONS.find((x) => x.name === name).start;
  S.reverseCymbal(t0, 1.6, 0.35);
  S.subDrop(t0, 2.2, 0.45);
  S.taiko(t0, 0.35, 46);
}
// Entrada del logotipo y cierre.
S.strings(0.05, 2.6, [48, 55, 60, 63, 67], { vel: 0.9, attack: 0.5, release: 1.6 });
S.piano(0.1, 48, { vel: 0.7, dur: 2.4 }); S.piano(0.1, 60, { vel: 0.5, dur: 2.4 });
S.strings(cut(127), cut(127) + 4, [48, 55, 60, 63, 67, 72], { vel: 1.0, attack: 0.6, release: 3 });
S.piano(cut(127), 36, { vel: 0.7, dur: 4 }); S.piano(cut(127) + 0.1, 63, { vel: 0.5, dur: 4 }); S.piano(cut(127) + 0.2, 67, { vel: 0.5, dur: 4 });

// Transiciones: barridos discretos.
for (const [t, type] of SHOT_TRANS) {
  if (t < 1) continue;
  if (type === 'wipe') S.whoosh(t - 0.3, 0.6, { vel: 0.4 });
  if (type === 'whip' || type === 'whipV') S.whoosh(t - 0.2, 0.42, { f0: 500, f1: 6000, peak: 0.5, vel: 0.35 });
  if (type === 'slices') S.whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.3 });
  if (type === 'cube' || type === 'cubeV') S.whoosh(t - 0.24, 0.48, { from: 0.6, to: -0.6, f0: 300, f1: 4200, peak: 0.55, vel: 0.35 });
  if (type === 'fly') S.whoosh(t - 0.25, 0.5, { f0: 5500, f1: 300, peak: 0.7, vel: 0.4 });
}

// Diseño sonoro de la ingeniería.
// El taco de goma: golpes secos cada vez que el amortiguador hace tope (ciclo de 2,4 s del dibujo).
for (let k = 0; ; k++) { const tk = cut(95) + 0.5 + 0.72 + k * 2.4; if (tk > cut(99)) break; S.tom(tk, 70, 0.55, 0); S.tick(tk, 0.5, 900); }
// Los topes hidráulicos: un siseo progresivo en lugar del golpe.
for (let k = 0; ; k++) { const tk = cut(102) + 0.3 + 1.0 + k * 3; if (tk > cut(105)) break; S.whoosh(tk - 0.1, 0.5, { from: 0, to: 0, f0: 1800, f1: 600, peak: 0.3, vel: 0.25 }); }
// El salto de 50 m: despegue y aterrizaje en la parábola.
S.whoosh(snap4(V(7) + 4.6) + 1.2, 2.4, { from: -0.6, to: 0.6, f0: 300, f1: 1400, peak: 0.5, vel: 0.35 });
S.tom(snap4(V(7) + 4.6) + 3.6, 60, 0.5, 0.3);
// Botones del canal.
S.tick(V(128) + 0.4, 0.8, 1400); S.tick(V(129) + 0.6, 0.8, 1400); S.tick(V(129) + 0.62, 0.5, 2600);

function snap4(x) { return Math.floor(x / 0.25) * 0.25; }

const r = S.render(path.join(root, 'out', 'music.wav'));
console.log('music ->', r.file, `pico previo ${r.peakIn.toFixed(1)} dBFS`);
