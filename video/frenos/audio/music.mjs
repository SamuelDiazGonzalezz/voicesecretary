// Música del documental «La evolución de los frenos»: tranquila, de documental, en Mi menor a 120 BPM.
// Distinta de la de las cajas: pads cálidos, un pulso de cuerdas pulsadas (pluck) en negras muy bajo y piano disperso
// (una nota de melodía cada compás). En las partes técnicas, el pulso pasa a corcheas y entra una campana grave;
// en cada época, un leve crecimiento (cuerdas abiertas y un taiko lejano). Sintetizado desde cero. Determinista.
import path from 'node:path';
import { createStudio } from '../../musica/synth.mjs';
import { DURATION, SECTIONS, V, cut } from '../src/timeline.js';
import { SHOT_TRANS } from '../src/scenes.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = createStudio(DURATION, { pump: 0, room: 0.92 });
const BAR = 2;

// Mi menor: Em – Cmaj7 – G – D (narración) y Em – Am – C – B (partes técnicas). [bajo, acorde]
const C = { Em: [40, [59, 64, 67, 71]], C: [36, [59, 64, 67, 72]], G: [43, [59, 62, 67, 74]], D: [38, [57, 62, 66, 69]], Am: [45, [60, 64, 69, 72]], B: [47, [59, 63, 66, 71]] };
const PROG = ['Em', 'Em', 'C', 'C', 'G', 'G', 'D', 'D'];
const TECH = ['Em', 'Em', 'Am', 'Am', 'C', 'C', 'B', 'B'];
// Melodía de piano: una nota por compás, por grados del acorde.
const MEL = [71, 67, 72, 71, 74, 71, 69, 66];
const ROLE = { ident: 'calm', open: 'calm', drum: 'tech', disc: 'tech', groupb: 'tech', surface: 'calm', carbon: 'tech', water: 'tech', hand: 'tech', rally1: 'calm', outro: 'lift' };
const secAt = (t) => { let s = SECTIONS[0]; for (const x of SECTIONS) if (t + 1e-6 >= x.start) s = x; return s; };
const END = cut(190) + 9;

for (let bar = 0; bar * BAR < END; bar++) {
  const tb = bar * BAR;
  const s = secAt(tb + 1e-3);
  const role = ROLE[s.name];
  const prog = role === 'tech' ? TECH : PROG;
  const [r, tri] = C[prog[bar % prog.length]];
  // Pad cálido cada dos compases y bajo largo.
  if (bar % 2 === 0) {
    S.pad(tb, tb + 2 * BAR, tri.slice(0, 3), { cutoff: role === 'lift' ? 1800 : 1100, vel: 0.5, attack: 1.4, release: 1.4 });
    S.bassNote(tb, 2 * BAR - 0.1, r, { cutoff: 260, env: 0.6, drive: 1.0, vel: 0.45 });
  }
  // Pulso de cuerdas pulsadas: negras en la narración, corcheas en las partes técnicas.
  const step = role === 'tech' ? 0.25 : 0.5;
  for (let k = 0; k * step < BAR - 1e-6; k++) S.pluck(tb + k * step, tri[k % tri.length] - 12 + (k % 4 === 3 ? 12 : 0), { vel: role === 'tech' ? 0.22 : 0.18, pan: k % 2 ? 0.3 : -0.3, bright: 0.5 });
  // Piano: una nota de melodía por compás (y una segunda, más suave, a mitad en las partes de cierre).
  S.piano(tb + 0.02, MEL[bar % MEL.length] + (role === 'lift' ? 0 : -12), { vel: 0.4, dur: 2.2, pan: 0.1 });
  if (role !== 'tech' && bar % 2 === 1) S.piano(tb + 1.0, MEL[(bar + 3) % MEL.length] - 12, { vel: 0.26, dur: 1.6, pan: -0.15 });
  // Partes técnicas: campana grave al inicio de cada dos compases.
  if (role === 'tech' && bar % 2 === 0) S.bell(tb, tri[0], { vel: 0.18, dur: 3, pan: 0.2, ratio: 2, index: 1.5 });
  // Cuerdas solo en los finales de capítulo y en el cierre.
  if (role === 'lift' && bar % 2 === 0) S.strings(tb, tb + 2 * BAR, [...tri.slice(0, 3), r + 12], { vel: 0.8, attack: 1.4, cutoff: 2000, release: 2 });
}

// Cambios de época: crecimiento suave, sin golpes.
for (const name of ['drum', 'disc', 'groupb', 'surface', 'carbon', 'water', 'hand', 'rally1']) {
  const t0 = SECTIONS.find((x) => x.name === name).start;
  S.reverseCymbal(t0, 1.6, 0.3);
  S.subDrop(t0, 2.2, 0.4);
  S.taiko(t0, 0.32, 44);
  S.strings(t0, t0 + 4, [52, 59, 64, 67], { vel: 0.5, attack: 0.8, cutoff: 1600, release: 2 });
}
// Entrada del logotipo y cierre.
S.strings(0.05, 2.6, [52, 59, 64, 67, 71], { vel: 0.85, attack: 0.5, release: 1.6 });
S.piano(0.1, 40, { vel: 0.7, dur: 2.4 }); S.piano(0.1, 64, { vel: 0.5, dur: 2.4 });
S.strings(cut(190), cut(190) + 9, [52, 59, 64, 67, 71, 76], { vel: 1.0, attack: 0.8, release: 3 });
S.piano(cut(190), 40, { vel: 0.7, dur: 6 }); S.piano(cut(190) + 0.1, 67, { vel: 0.5, dur: 6 }); S.piano(cut(190) + 0.2, 71, { vel: 0.5, dur: 6 });

// Transiciones: barridos discretos.
for (const [t, type] of SHOT_TRANS) {
  if (t < 1) continue;
  if (type === 'wipe') S.whoosh(t - 0.3, 0.6, { vel: 0.38 });
  if (type === 'whip' || type === 'whipV') S.whoosh(t - 0.2, 0.42, { f0: 500, f1: 6000, peak: 0.5, vel: 0.32 });
  if (type === 'slices') S.whoosh(t - 0.22, 0.5, { from: 0.6, to: -0.6, vel: 0.28 });
  if (type === 'cube' || type === 'cubeV') S.whoosh(t - 0.24, 0.48, { from: 0.6, to: -0.6, f0: 300, f1: 4200, peak: 0.55, vel: 0.32 });
}

// Diseño sonoro de la ingeniería, sincronizado con los dibujos.
S.riser(V(7) + 1.4, V(7) + 3.3, 0.35);                          // la velocidad se convierte en calor
S.impact(V(55) + 1.0, 0.35); S.tick(V(55) + 1.0, 0.7, 1800);     // el disco macizo se raja
S.tom(V(119) + 1.0, 110, 0.6); S.impact(V(119) + 1.0, 0.4);      // «PROHIBIDOS»
S.whoosh(V(143) + 0.2, 0.4, { f0: 900, f1: 3000, vel: 0.3 }); S.tick(V(143) + 0.6, 0.8, 1500); // tirón del freno de mano
S.tom(V(154) + 1.6, 130, 0.5); S.tick(V(154) + 1.6, 0.6, 2200);  // el diferencial se desacopla
S.tom(V(159) + 0.8, 120, 0.6); S.tick(V(159) + 0.8, 0.7, 1600);  // y vuelve a cerrarse de golpe
S.tick(V(191) + 0.4, 0.8, 1400); S.tick(V(191) + 0.42, 0.5, 2600); // botón del canal

const r = S.render(path.join(root, 'out', 'music.wav'));
console.log('music ->', r.file, `pico previo ${r.peakIn.toFixed(1)} dBFS`);
