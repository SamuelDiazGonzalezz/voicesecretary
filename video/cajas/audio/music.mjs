// Música del documental «La evolución de las cajas de cambio»: tranquila, de documental, en Re menor a 120 BPM.
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
const C = { Cm: [38, [62, 65, 69]], Ab: [34, [62, 65, 70]], Eb: [41, [60, 65, 69]], Bb: [36, [60, 64, 67]], Fm: [43, [62, 67, 70]], G: [45, [61, 64, 69]] };
// (Re menor: Dm – Bb – F – C; en las partes técnicas Dm – Gm – Bb – A. Se conservan los nombres de la plantilla.)
const PROG = ['Cm', 'Cm', 'Ab', 'Ab', 'Eb', 'Eb', 'Bb', 'Bb'];
const TECH = ['Cm', 'Cm', 'Fm', 'Fm', 'Ab', 'Ab', 'G', 'G'];
const ROLE = { ident: 'piano', open: 'piano', hpattern: 'tech', synchro: 'tech', dog: 'tech', seq: 'tech', wrc: 'tech', xtrac: 'piano', rally1: 'piano', outro: 'lift' };
const secAt = (t) => { let s = SECTIONS[0]; for (const x of SECTIONS) if (t + 1e-6 >= x.start) s = x; return s; };
const END = cut(125) + 6;

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
for (const name of ['hpattern', 'dog', 'seq', 'wrc', 'xtrac', 'rally1']) {
  const t0 = SECTIONS.find((x) => x.name === name).start;
  S.reverseCymbal(t0, 1.6, 0.35);
  S.subDrop(t0, 2.2, 0.45);
  S.taiko(t0, 0.35, 46);
}
// Entrada del logotipo y cierre.
S.strings(0.05, 2.6, [50, 57, 62, 65, 69], { vel: 0.9, attack: 0.5, release: 1.6 });
S.piano(0.1, 50, { vel: 0.7, dur: 2.4 }); S.piano(0.1, 62, { vel: 0.5, dur: 2.4 });
S.strings(cut(125), cut(125) + 6, [50, 57, 62, 65, 69, 74], { vel: 1.0, attack: 0.6, release: 3 });
S.piano(cut(125), 38, { vel: 0.7, dur: 5 }); S.piano(cut(125) + 0.1, 65, { vel: 0.5, dur: 5 }); S.piano(cut(125) + 0.2, 69, { vel: 0.5, dur: 5 });

// Transiciones: barridos discretos.
for (const [t, type] of SHOT_TRANS) {
  if (t < 1) continue;
  if (type === 'wipe') S.whoosh(t - 0.3, 0.6, { vel: 0.4 });
  if (type === 'whip' || type === 'whipV') S.whoosh(t - 0.2, 0.42, { f0: 500, f1: 6000, peak: 0.5, vel: 0.35 });
  if (type === 'slices') S.whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.3 });
  if (type === 'cube' || type === 'cubeV') S.whoosh(t - 0.24, 0.48, { from: 0.6, to: -0.6, f0: 300, f1: 4200, peak: 0.55, vel: 0.35 });
  if (type === 'fly') S.whoosh(t - 0.25, 0.5, { f0: 5500, f1: 300, peak: 0.7, vel: 0.4 });
}

// Diseño sonoro de la ingeniería: el golpe metálico de los crabots y del actuador, sincronizado con el dibujo.
for (let k = 0; ; k++) { const tk = cut(47) + 0.95 + k * 2.2; if (tk > cut(48)) break; S.tom(tk, 150, 0.6, 0.1); S.tick(tk, 0.9, 1300); S.tick(tk + 0.01, 0.6, 3100); }
for (let k = 0; ; k++) { const tk = cut(87) + 0.62 + k * 2.8; if (tk > cut(91)) break; S.tom(tk, 120, 0.5, -0.1); S.tick(tk, 0.8, 1500); S.whoosh(tk - 0.12, 0.14, { f0: 600, f1: 2500, peak: 0.6, vel: 0.25 }); }
// Money shift: el régimen que se dispara.
S.riser(V(61) + 2.6, V(62) + 1.2, 0.5); S.impact(V(62) + 1.1, 0.6);
// Botón del canal.
S.tick(V(126) + 0.5, 0.8, 1400); S.tick(V(126) + 0.52, 0.5, 2600);

function snap4(x) { return Math.floor(x / 0.25) * 0.25; }

const r = S.render(path.join(root, 'out', 'music.wav'));
console.log('music ->', r.file, `pico previo ${r.peakIn.toFixed(1)} dBFS`);
