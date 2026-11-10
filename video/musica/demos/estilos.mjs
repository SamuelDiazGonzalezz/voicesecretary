// Catálogo de estilos musicales para los documentales de EVO HERITAGE.
// Seis demos de 40 s (20 compases a 120 BPM), compuestas y sintetizadas desde cero, sin muestras.
// Cada una tiene intro (4 compases), desarrollo (8), clímax (6) y cierre (2).
// Uso: node demos/estilos.mjs [número]   → escribe out/NN-nombre.wav
import path from 'node:path';
import { createStudio } from '../synth.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LEN = 42.5; // 40 s de música y la cola del último acorde
const bt = (bar, beat = 0) => (bar * 4 + beat) * 0.5;

const STYLES = [];
const style = (id, name, desc, opts, fn) => STYLES.push({ id, name, desc, opts, fn });

// ---------------------------------------------------------------------------
// 1. Épico orquestal: cuerdas, metales y taikos. Re menor.
style('01', 'epico-orquestal', 'Cuerdas, metales y taikos. Para leyendas, victorias y grandes historias.', { pump: 0, room: 0.88 }, (S) => {
  const C = {
    Dm: [38, [62, 65, 69]], Bb: [34, [62, 65, 70]], F: [41, [60, 65, 69]], C: [36, [60, 64, 67]], Gm: [43, [62, 67, 70]], A: [45, [61, 64, 69]],
  };
  const prog = ['Dm', 'Dm', 'Bb', 'Bb', 'F', 'F', 'C', 'C', 'Dm', 'Dm', 'Bb', 'Bb', 'Dm', 'Dm', 'Bb', 'C', 'Dm', 'A', 'Dm', 'Dm'];
  for (let b = 0; b < 20; b += 2) {
    const [r, tri] = C[prog[b]], [r2, tri2] = C[prog[b + 1]];
    const lift = b >= 12 ? 12 : 0;
    if (prog[b] === prog[b + 1]) S.strings(bt(b), bt(b + 2), [...tri.map((m) => m + lift), r + 12], { vel: b >= 12 ? 1.2 : 0.9, attack: b < 4 ? 2.4 : 0.6 });
    else { S.strings(bt(b), bt(b + 1), [...tri.map((m) => m + lift), r + 12], { vel: 1.2, attack: 0.4 }); S.strings(bt(b + 1), bt(b + 2), [...tri2.map((m) => m + lift), r2 + 12], { vel: 1.2, attack: 0.4 }); }
  }
  S.subDrop(0, 2.5, 0.8);
  for (let b = 0; b < 4; b++) S.taiko(bt(b), 0.5 + b * 0.12);
  // Desarrollo: ostinato grave de corcheas, taikos a medio tiempo y metales al cambiar de acorde.
  for (let b = 4; b < 18; b++) {
    const [r] = C[prog[b]];
    for (let k = 0; k < 8; k++) S.bassNote(bt(b, k / 2), 0.18, r + (k % 4 === 3 ? 7 : 0), { cutoff: 520, env: 1.2, drive: 1.3, vel: k % 2 ? 0.55 : 0.85 });
    S.taiko(bt(b, 0), 1); S.taiko(bt(b, 1.5), 0.55, 62, -0.3); S.taiko(bt(b, 2), 0.8, 52, 0.3);
    if (b >= 12) { S.taiko(bt(b, 3), 0.6, 70, -0.2); S.taiko(bt(b, 3.5), 0.7, 66, 0.2); }
    if (b % 2 === 0 && b < 12) S.brass(bt(b), 1.2, C[prog[b]][1].map((m) => m - 12), { vel: 0.8 });
  }
  // Clímax: tema heroico en los metales.
  const MEL = [[12, 0, 2, 69], [12, 2, 2, 74], [13, 0, 3, 77], [13, 3, 1, 76], [14, 0, 2, 74], [14, 2, 2, 70], [15, 0, 4, 72], [16, 0, 2, 74], [16, 2, 2, 77], [17, 0, 2, 81], [17, 2, 2, 79]];
  for (const [b, k, d, m] of MEL) S.brass(bt(b, k), d * 0.5 * 0.95, [m - 12, m], { vel: 1.1, swell: 0.08 });
  S.crash(bt(12)); S.crash(bt(16), 0.7);
  S.riser(bt(10), bt(12) - 0.05, 0.7); S.reverseCymbal(bt(12), 1.4);
  S.riser(bt(16), bt(18) - 0.05, 0.8);
  // Cierre.
  S.impact(bt(18), 1.1); S.taiko(bt(18), 1.2, 46); S.crash(bt(18), 0.9);
  S.brass(bt(18), 3.2, [50, 57, 62, 65], { vel: 1, swell: 0.1 });
  S.strings(bt(18), bt(20), [62, 65, 69, 74, 50], { vel: 1.1, attack: 0.1, release: 2.0 });
});

// ---------------------------------------------------------------------------
// 2. Retro años 80: sintetizadores analógicos, caja con puerta y bajo en octavas. Mi menor.
style('02', 'retro-80s', 'Sintetizadores de los 80, caja con eco y bajo en octavas. Para la era del Grupo B.', { pump: 0.5, room: 0.86 }, (S) => {
  const C = { Em: [40, [64, 67, 71]], C: [36, [64, 67, 72]], G: [43, [62, 67, 71]], D: [38, [62, 66, 69]] };
  const prog = ['Em', 'C', 'G', 'D'];
  const chord = (b) => C[prog[b % 4]];
  for (let b = 0; b < 20; b++) {
    const [r, tri] = chord(b);
    S.pad(bt(b), bt(b + 1), tri, { cutoff: b < 4 ? 700 + b * 250 : 1700, vel: 0.9, attack: 0.2 });
    const arp = [tri[0], tri[1], tri[2], tri[0] + 12];
    if (b < 18) for (let k = 0; k < 16; k++) S.pluck(bt(b, k / 4), arp[k % 4] + 12, { vel: b < 4 ? 0.25 + b * 0.1 : 0.5, pan: k % 2 ? 0.4 : -0.4, bright: b < 4 ? 0.4 + b * 0.15 : 0.9 });
    if (b >= 4 && b < 18) {
      for (let k = 0; k < 8; k++) S.bassNote(bt(b, k / 2), 0.2, r + (k % 2 ? 12 : 0), { cutoff: 900, env: 2.5, drive: 1.6, vel: 0.85 });
      const four = b >= 12;
      for (let k = 0; k < 4; k++) if (four || k % 2 === 0) S.kick(bt(b, k), 1);
      S.snare80(bt(b, 1)); S.snare80(bt(b, 3));
      for (let k = 0; k < 8; k++) S.hat(bt(b, k / 2), k % 2 ? 0.7 : 0.4, false, 0.3);
    }
  }
  S.riser(bt(2), bt(4) - 0.05, 0.7); S.crash(bt(4)); S.crash(bt(12)); S.reverseCymbal(bt(12), 1.2);
  const MEL = [[12, 0, 1.5, 79], [12, 1.5, 0.5, 78], [12, 2, 2, 76], [13, 0, 1, 74], [13, 1, 1, 76], [13, 2, 2, 71], [14, 0, 1.5, 74], [14, 1.5, 0.5, 76], [14, 2, 2, 78], [15, 0, 4, 79],
    [16, 0, 1.5, 83], [16, 1.5, 0.5, 81], [16, 2, 2, 79], [17, 0, 2, 78], [17, 2, 2, 74]];
  for (const [b, k, d, m] of MEL) S.leadNote(bt(b, k), d * 0.5 * 0.92, m, 1.0);
  S.kick(bt(18), 1); S.snare80(bt(18), 1); S.crash(bt(18));
  S.pad(bt(18), bt(20), [52, 59, 64, 67, 71], { cutoff: 2200, vel: 1.1, attack: 0.01, release: 2 });
  S.bassNote(bt(18), 3.5, 28, { cutoff: 300, env: 1, vel: 0.9 });
});

// ---------------------------------------------------------------------------
// 3. Técnica: pulso electrónico, campanas FM y tic-tac. Do menor.
style('03', 'tecnica-pulso', 'Pulso electrónico, campanas y tic-tac de precisión. Para explicar cómo funciona la ingeniería.', { pump: 0.35, room: 0.8 }, (S) => {
  const C = { Cm: [36, [60, 63, 67]], Ab: [32, [60, 63, 68]], Eb: [39, [63, 67, 70]], Bb: [34, [62, 65, 70]] };
  const prog = ['Cm', 'Cm', 'Ab', 'Ab', 'Eb', 'Eb', 'Bb', 'Bb'];
  const chord = (b) => C[prog[b % 8]];
  for (let b = 0; b < 20; b += 2) {
    const [r, tri] = chord(b);
    S.pad(bt(b), bt(b + 2), tri, { cutoff: b < 4 ? 600 : b < 12 ? 900 + (b - 4) * 120 : 2000, vel: 0.85, attack: 0.5 });
  }
  for (let b = 0; b < 18; b++) {
    const [r, tri] = chord(b);
    const seq = [tri[0], tri[2], tri[1] + 12, tri[0] + 12];
    for (let k = 0; k < 16; k++) {
      const g = k % 8, acc = g === 0 || g === 3 || g === 6;
      S.tick(bt(b, k / 4), acc ? 0.5 : 0.18, acc ? 2600 : 4200);
      if (acc && (b >= 4 || k < 8)) S.bell(bt(b, k / 4), seq[(k / 3 | 0) % 4] + (b >= 12 ? 12 : 0), { vel: b < 4 ? 0.5 : 0.75, dur: 1.4, pan: (k % 3 - 1) * 0.4 });
    }
    if (b >= 4) {
      for (let k = 0; k < 16; k++) S.bassNote(bt(b, k / 4), 0.09, r + 12, { cutoff: 260 + (k % 8 === 0 ? 300 : 0), env: 3, drive: 1.6, vel: k % 4 === 0 ? 0.9 : 0.5 });
      for (let k = 0; k < 4; k++) S.kick(bt(b, k), 0.75);
    }
    if (b >= 12) { S.clap(bt(b, 1), 0.7); S.clap(bt(b, 3), 0.7); for (let k = 0; k < 4; k++) S.hat(bt(b, k + 0.5), 0.6, true, -0.3); }
  }
  S.strings(bt(12), bt(18), [60, 67, 72], { vel: 0.6, attack: 2.5, cutoff: 1800 });
  S.riser(bt(10), bt(12) - 0.05, 0.6); S.reverseCymbal(bt(12), 1.0, 0.8);
  S.impact(bt(18), 0.8);
  S.pad(bt(18), bt(20), [48, 55, 60, 63, 67], { cutoff: 1600, vel: 1, attack: 0.01, release: 2 });
  S.bell(bt(18), 72, { vel: 0.9, dur: 3.5 }); S.bell(bt(18, 1), 79, { vel: 0.6, dur: 3 });
});

// ---------------------------------------------------------------------------
// 4. Piano emotivo: piano, cuerdas y taikos muy suaves. La menor.
style('04', 'piano-emotivo', 'Piano y cuerdas. Para tragedias, despedidas y legados.', { pump: 0, room: 0.9 }, (S) => {
  const C = { Am: [45, [60, 64, 69]], F: [41, [60, 65, 69]], C: [48, [60, 64, 67]], G: [43, [59, 62, 67]] };
  const prog = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'];
  const chord = (b) => C[prog[b % 8]];
  for (let b = 0; b < 18; b++) {
    const [r, tri] = chord(b);
    const pat = [r, r + 7, r + 12, tri[0], tri[1], tri[2], tri[1], r + 12];
    for (let k = 0; k < 8; k++) S.piano(bt(b, k / 2), pat[k], { vel: (k === 0 ? 0.75 : 0.45) * (b < 4 ? 0.8 : 1), dur: k === 0 ? 2 : 1.2, pan: (k / 7 - 0.5) * 0.5 });
  }
  for (let b = 8; b < 18; b += 2) {
    const [r, tri] = chord(b);
    S.strings(bt(b), bt(b + 2), [...tri, r + 12], { vel: b >= 12 ? 0.95 : 0.6, attack: 1.5, cutoff: b >= 12 ? 2600 : 1600 });
  }
  for (const b of [12, 14, 16]) S.taiko(bt(b), 0.4, 46);
  const MEL = [[12, 0, 2, 76], [12, 2, 1, 74], [12, 3, 1, 72], [13, 0, 4, 72], [14, 0, 2, 72], [14, 2, 1, 71], [14, 3, 1, 69], [15, 0, 4, 67], [16, 0, 2, 69], [16, 2, 2, 72], [17, 0, 4, 76]];
  for (const [b, k, d, m] of MEL) S.piano(bt(b, k), m + 12, { vel: 0.85, dur: d * 0.5, pan: 0.15 });
  // Cierre: acorde de La menor y las cuerdas que se apagan.
  for (const [k, m] of [[0, 45], [0, 57], [0.25, 60], [0.5, 64], [0.75, 69], [1.5, 76]]) S.piano(bt(18, k), m, { vel: 0.7, dur: 4 });
  S.strings(bt(18), bt(20), [57, 60, 64, 69], { vel: 0.8, attack: 0.6, release: 2.5, cutoff: 1500 });
});

// ---------------------------------------------------------------------------
// 5. Rock de tramo: guitarras distorsionadas, bajo y batería. Mi menor.
style('05', 'rock-tramo', 'Guitarras distorsionadas y batería. Para onboards, tramos y acción pura.', { pump: 0, room: 0.6 }, (S) => {
  // Riff de dos compases: corcheas apagadas en Mi y acentos abiertos.
  const RIFF = [[40, 1], [40, 1], [40, 1], [40, 1], [43, 0], [43, 1], [45, 0], [45, 1], [40, 1], [40, 1], [40, 1], [40, 1], [48, 0], [48, 1], [50, 0], [50, 1]];
  const riff = (b, vel = 1) => {
    for (let k = 0; k < 8; k++) {
      const [m, mute] = RIFF[((b % 2) * 8 + k)];
      S.guitar(bt(b, k / 2), mute ? 0.2 : 0.45, m, { vel, mute: !!mute });
      if (b >= 4) S.bassNote(bt(b, k / 2), 0.22, m - 12, { cutoff: 700, env: 2, drive: 2.4, vel: 0.9 });
    }
  };
  const drums = (b, full = true) => {
    S.kick(bt(b, 0), 1); S.kick(bt(b, 1.5), 0.8); S.kick(bt(b, 2), 1);
    S.snare(bt(b, 1), 1.1); S.snare(bt(b, 3), 1.1);
    for (let k = 0; k < 8; k++) S.hat(bt(b, k / 2), k % 2 ? 0.5 : 0.8, false, 0.25);
    if (full && b % 4 === 3) for (let k = 0; k < 4; k++) S.tom(bt(b, 3 + k / 4), 140 - k * 22, 0.8, (k - 1.5) * 0.3);
  };
  for (let b = 0; b < 12; b++) {
    riff(b, b < 2 ? 0.8 : 1);
    if (b >= 2 && b < 4) { S.kick(bt(b), 0.9); S.kick(bt(b, 2), 0.9); for (let k = 0; k < 4; k++) S.hat(bt(b, k), 0.5); }
    if (b === 3) for (let k = 0; k < 8; k++) S.snare(bt(b, 2 + k / 4), 0.4 + k * 0.08);
    if (b >= 4) drums(b);
  }
  // Estribillo: acordes abiertos de quinta, batería con platos.
  const OPEN = [40, 48, 43, 50, 40, 48];
  for (let b = 12; b < 18; b++) {
    S.guitar(bt(b), 1.85, OPEN[b - 12], { vel: 1.1 });
    for (let k = 0; k < 8; k++) S.bassNote(bt(b, k / 2), 0.22, OPEN[b - 12] - 12, { cutoff: 800, env: 2, drive: 2.6, vel: 0.9 });
    drums(b, false); S.crash(bt(b), b === 12 ? 1 : 0.6);
  }
  for (let k = 0; k < 8; k++) S.tom(bt(17, 2 + k / 4), 160 - k * 14, 0.9, (k / 7 - 0.5) * 0.6);
  // Golpe final que suena hasta apagarse.
  S.guitar(bt(18), 3.2, 40, { vel: 1.2 }); S.bassNote(bt(18), 3, 28, { cutoff: 600, env: 1, drive: 2, vel: 1 });
  S.kick(bt(18), 1.2); S.crash(bt(18), 1.2); S.snare(bt(18), 1.2);
});

// ---------------------------------------------------------------------------
// 6. Tensión y misterio: ostinato frigio, reloj, cuerdas disonantes. Si menor.
style('06', 'tension-misterio', 'Ostinato grave, reloj y cuerdas disonantes. Para secretos, prohibiciones y misterios.', { pump: 0, room: 0.9 }, (S) => {
  const OST = [35, 35, 36, 35, 35, 35, 36, 38];
  for (let b = 0; b < 18; b++) {
    for (let k = 0; k < 8; k++) {
      S.tick(bt(b, k / 2), k % 2 ? 0.25 : 0.45, k % 2 ? 1500 : 1100);
      if (b >= 2) S.bassNote(bt(b, k / 2), 0.2, OST[k] + (b >= 12 ? 12 : 0), { cutoff: 380 + (b >= 12 ? 300 : 0), env: 1.5, drive: 1.6, vel: b < 4 ? 0.55 : 0.8 });
    }
    if (b % 2 === 0) S.taiko(bt(b), b >= 12 ? 1 : 0.6, 48);
    if (b >= 12) { S.taiko(bt(b, 2), 0.7, 56, -0.3); S.taiko(bt(b, 3.5), 0.6, 62, 0.3); }
  }
  // Cuerdas: cluster con segunda menor (Si, Do, Fa#) que se abre en el clímax.
  S.strings(bt(0), bt(8), [59, 60, 66], { vel: 0.7, attack: 3, cutoff: 1200 });
  S.strings(bt(8), bt(12), [59, 62, 66, 72], { vel: 0.8, attack: 1.5, cutoff: 1600 });
  S.strings(bt(12), bt(18), [59, 62, 66, 71, 72], { vel: 1.1, attack: 0.6, cutoff: 2600 });
  // Motivo de campana: Si, Re, Do.
  for (const b of [4, 6, 8, 10, 14, 16]) { S.bell(bt(b), 71, { vel: 0.6, dur: 2.5, pan: -0.3 }); S.bell(bt(b, 1), 74, { vel: 0.55, dur: 2.5, pan: 0.3 }); S.bell(bt(b, 2), 72, { vel: 0.6, dur: 3 }); }
  for (const b of [12, 14, 16]) S.brass(bt(b), 1.4, [35, 42, 47], { vel: 0.9, swell: 0.25, bright: 0.7 });
  S.riser(bt(16), bt(18) - 0.05, 1.0); S.reverseCymbal(bt(18), 1.6);
  S.impact(bt(18), 1.3); S.subDrop(bt(18), 2.4, 1); S.taiko(bt(18), 1.3, 42);
  S.strings(bt(18), bt(19), [47, 54, 59], { vel: 0.9, attack: 0.05, release: 2.5, cutoff: 1400 });
  S.bell(bt(19), 71, { vel: 0.5, dur: 3.5 });
});

// ---------------------------------------------------------------------------
const only = process.argv[2];
for (const s of STYLES) {
  if (only && s.id !== only) continue;
  const S = createStudio(LEN, s.opts);
  s.fn(S);
  const file = path.join(root, 'out', `${s.id}-${s.name}.wav`);
  const r = S.render(file);
  console.log(`${s.id} ${s.name}  pico previo ${r.peakIn.toFixed(1)} dBFS  -> ${file}`);
}
export { STYLES };
