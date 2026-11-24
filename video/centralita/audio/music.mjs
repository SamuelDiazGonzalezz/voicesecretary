// Música del documental «Las centralitas en el rally»: tranquila, de documental, en Si menor a 100 BPM.
// Distinta de las anteriores (cajas: piano en arpegios y campanas 3-3-2; frenos: pulso de cuerdas pulsadas en Mi menor):
// aquí el motivo es un «latido de datos», un arpegio de campana FM muy suave en semicorcheas que recorre el acorde
// como un procesador que calcula, sobre pads cálidos, un bajo que late en el 1 y en el «y» del 3, y acordes de piano
// espaciados. En las partes técnicas el arpegio se hace más denso; en cada capítulo, un crecimiento de cuerdas.
// Sintetizado desde cero y determinista.
import path from 'node:path';
import { createStudio } from '../../musica/synth.mjs';
import { DURATION, SECTIONS, V, cut } from '../src/timeline.js';
import { SHOT_TRANS } from '../src/scenes.js';
import { rng } from '../src/lib.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = createStudio(DURATION, { pump: 0, room: 0.9 });
const BEAT = 0.6, BAR = 4 * BEAT;
const at = (i, d = 0) => V(i) + d;

// [bajo, acorde]
const C = { Bm: [35, [59, 62, 66, 71]], G: [31, [59, 62, 67, 71]], D: [38, [57, 62, 66, 69]], A: [33, [57, 61, 64, 69]], Em: [40, [59, 64, 67, 71]], Fs: [42, [58, 61, 66, 70]] };
const PROG = ['Bm', 'G', 'D', 'A'];
const TECH = ['Bm', 'Em', 'G', 'Fs'];
const ROLE = { ident: 'calm', open: 'calm', carb: 'calm', groupa: 'tech', wrc: 'tech', rally1: 'tech', maps: 'tech', fuel: 'calm', outro: 'lift' };
const secAt = (t) => { let s = SECTIONS[0]; for (const x of SECTIONS) if (t + 1e-6 >= x.start) s = x; return s; };
const END = cut(115) + 14;
// Orden del arpegio de datos (índices del acorde, una octava arriba en los dos últimos).
const ARP = [0, 2, 1, 3, 2, 0, 3, 1];

for (let bar = 0; bar * BAR < END; bar++) {
  const tb = bar * BAR;
  const role = ROLE[secAt(tb + 1e-3).name];
  const prog = role === 'tech' ? TECH : PROG;
  const [r, ch] = C[prog[bar % prog.length]];
  // Pad y bajo.
  S.pad(tb, tb + BAR, ch.slice(0, 3), { cutoff: role === 'lift' ? 1700 : role === 'tech' ? 1250 : 950, vel: 0.5, attack: 1.2, release: 1.2 });
  S.bassNote(tb, BEAT * 1.6, r, { cutoff: 230, env: 0.5, drive: 1.0, vel: 0.5 });
  S.bassNote(tb + BEAT * 2.5, BEAT * 1.2, r, { cutoff: 230, env: 0.5, drive: 1.0, vel: 0.32 });
  // Latido de datos: semicorcheas en las partes técnicas, corcheas en la narración.
  const step = role === 'tech' ? BEAT / 4 : BEAT / 2;
  for (let k = 0; k * step < BAR - 1e-6; k++) {
    const n = ch[ARP[k % ARP.length]] + (k % 8 >= 6 ? 12 : 0);
    S.bell(tb + k * step, n, { vel: role === 'tech' ? 0.085 : 0.07, dur: 0.6, pan: k % 2 ? 0.35 : -0.35, ratio: 2, index: 1.1 });
  }
  // Piano: acorde espaciado cada dos compases y una nota de melodía en el tercer tiempo.
  if (bar % 2 === 0) for (const [j, m] of ch.slice(0, 3).entries()) S.piano(tb + 0.03 * j, m - 12, { vel: 0.26, dur: 3.2, pan: -0.1 + j * 0.1 });
  S.piano(tb + BEAT * 2, ch[3] + (role === 'lift' ? 12 : 0), { vel: 0.3, dur: 2.0, pan: 0.15 });
  // Cuerdas en el cierre.
  if (role === 'lift') S.strings(tb, tb + BAR, [...ch.slice(0, 3), r + 12], { vel: 0.75, attack: 1.2, cutoff: 1900, release: 2 });
}

// Cambios de capítulo: crecimiento suave, sin golpes.
for (const name of ['carb', 'groupa', 'wrc', 'rally1', 'maps', 'fuel']) {
  const t0 = SECTIONS.find((x) => x.name === name).start;
  S.reverseCymbal(t0, 1.6, 0.28);
  S.subDrop(t0, 2.2, 0.38);
  S.taiko(t0, 0.3, 46);
  S.strings(t0, t0 + 4, [47, 54, 59, 62], { vel: 0.5, attack: 0.8, cutoff: 1500, release: 2 });
}
// Entrada del logotipo y cierre.
S.strings(0.05, 2.6, [47, 54, 59, 62, 66], { vel: 0.85, attack: 0.5, release: 1.6 });
S.piano(0.1, 35, { vel: 0.7, dur: 2.4 }); S.piano(0.12, 62, { vel: 0.45, dur: 2.4 }); S.piano(0.14, 66, { vel: 0.4, dur: 2.4 });
S.strings(cut(115), cut(115) + 14, [47, 54, 59, 62, 66, 71], { vel: 0.95, attack: 1.0, release: 3 });
S.piano(cut(115), 35, { vel: 0.7, dur: 6 }); S.piano(cut(115) + 0.1, 62, { vel: 0.5, dur: 6 }); S.piano(cut(115) + 0.2, 66, { vel: 0.5, dur: 6 });

// Transiciones: barridos discretos.
for (const [t, type] of SHOT_TRANS) {
  if (t < 1) continue;
  if (type === 'wipe') S.whoosh(t - 0.3, 0.6, { vel: 0.36 });
  if (type === 'whip' || type === 'whipV') S.whoosh(t - 0.2, 0.42, { f0: 500, f1: 6000, peak: 0.5, vel: 0.3 });
  if (type === 'slices') S.whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.26 });
  if (type === 'cube' || type === 'cubeV') S.whoosh(t - 0.24, 0.48, { from: 0.6, to: -0.6, f0: 300, f1: 4200, peak: 0.55, vel: 0.3 });
}

// Diseño sonoro sincronizado con los dibujos.
S.tick(at(5, 2.8), 0.6, 2400);                                  // «1.000 veces por segundo»
S.riser(at(13, 1.0), at(13, 3.4), 0.3);                          // se abre la carcasa
S.tick(at(32, 2.0), 0.7, 1500);                                  // la ROM nueva encaja en el zócalo
for (let i = 0; i < 24; i++) S.tick(at(32, 3.6) + i * (3.2 / 24), 0.18, 5200); // soldadura, pin a pin
// Anti-lag: cada detonación dibujada suena como un golpe sordo (mismos instantes, misma semilla).
{
  const R = rng(17); let tt = at(47, 3.6);
  while (tt < cut(48)) { S.tom(tt, 70, 0.32, 0.25); S.impact(tt, 0.12); tt += 0.35 + R() * 0.55; }
  const R2 = rng(23); let t2 = cut(48) + 0.4;
  while (t2 < cut(48) + 9 && t2 < cut(49)) { S.tom(t2, 64, 0.22, -0.2); t2 += 0.4 + R2() * 0.6; }
}
S.tom(at(62, 5.3), 120, 0.5); S.tick(at(62, 5.3), 0.6, 1800);    // el embrague multidisco se cierra
S.tom(at(101, 6.2), 100, 0.5); S.tick(at(101, 6.25), 0.7, 1500); // se cierra el candado
S.tick(at(116, 0.4), 0.8, 1400); S.tick(at(116, 0.42), 0.5, 2600); // botón del canal

const r = S.render(path.join(root, 'out', 'music.wav'));
console.log('music ->', r.file, `pico previo ${r.peakIn.toFixed(1)} dBFS`);
