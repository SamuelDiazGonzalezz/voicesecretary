// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s, 1 compás = 2 s.

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const DURATION = 45;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

// Locución del cliente (toma única de ElevenLabs, voz «Juan», vo/take.mp3).
// Cada fragmento: [entrada, salida] en la toma original, texto y pausa que le sigue
// ('w' respiración dentro de la frase, 'c' coma, 's' fin de frase).
export const VO_TAKE = [
  [0.03, 4.56, '¿Sabías que el último coche en ganar un Mundial de Rally con solo dos ruedas motrices', 'w'],
  [4.84, 8.03, 'humilló al todopoderoso Audi Quattro 4x4?', 's'],
  [8.22, 9.98, 'Es el Lancia 037.', 's'],
  [10.17, 12.42, 'Era el año 1983,', 'c'],
  [12.64, 15.54, 'y mientras el mundo entero se pasaba a la tracción total,', 'c'],
  [15.69, 18.94, 'los italianos decidieron ir a contracorriente con este monstruo.', 's'],
  [19.10, 20.60, 'Su fórmula era extrema:', 'c'],
  [20.79, 24.25, 'menos de mil kilos de peso y un motor central sobrealimentado', 'w'],
  [24.48, 27.45, 'que escupía más de 300 caballos de pura rabia', 'w'],
  [27.63, 29.07, 'directos al eje trasero.', 's'],
  [29.27, 31.76, 'Era tan salvaje que el propio Walter Röhrl dijo', 'w'],
  [31.95, 34.78, 'que si intentabas forzarlo contra su naturaleza,', 'c'],
  [34.96, 35.78, 'te comía vivo.', 's'],
  [35.94, 37.32, 'Tenías que dejarlo rotar,', 'c'],
  [37.47, 38.40, 'dejarlo vivir.', 's'],
  [38.54, 40.06, 'Lancia logró lo imposible,', 'c'],
  [40.15, 41.25, 'ganó el campeonato', 'w'],
  [41.53, 45.17, 'y el 037 se convirtió en el último rey de la tracción trasera.', 's'],
  [45.41, 47.21, '¿Conocías esta leyenda de los rallys?', 'q'],
  [47.34, 48.50, '¡Suscríbete para más!', 'end'],
];
export const VO_GAP = { w: 0.07, c: 0.12, s: 0.2, q: 0.16, end: 0 };
export const VO_START = 0.15;
export const VO_END = 44.8;

// Coloca cada fragmento en el montaje: pausas compactadas y un único factor de tempo
// para que la locución entre entera entre VO_START y VO_END.
export function layoutVO() {
  const speech = VO_TAKE.reduce((s, [a, b]) => s + (b - a), 0);
  const gaps = VO_TAKE.reduce((s, c) => s + VO_GAP[c[3]], 0);
  const tempo = speech / (VO_END - VO_START - gaps);
  let t = VO_START;
  return {
    tempo,
    lines: VO_TAKE.map(([a, b, text, kind], i) => {
      const dur = (b - a) / tempo;
      const line = { i, srcIn: a, srcOut: b, start: t, end: t + dur, text };
      t += dur + VO_GAP[kind];
      return line;
    }),
  };
}

// Cortes de montaje (en la rejilla de corcheas, 0,5 s = 1 tiempo) y secciones musicales.
export const CUTS = [0, 4.5, 7.5, 9.5, 11.5, 14.5, 17.5, 19.0, 21.0, 22.5, 25.5, 27.0, 29.5, 33.0, 35.5, 38.0, 41.5];
export const SECTIONS = [
  { name: 'intro', start: 0 },
  { name: 'grooveA', start: 7.5 },
  { name: 'break', start: 17.5 },
  { name: 'grooveB', start: 19.0 },
  { name: 'dark', start: 27.0 },
  { name: 'build', start: 33.0 },
  { name: 'climax', start: 35.5 },
  { name: 'outro', start: 41.5 },
];
// Golpes con impacto sonoro y de cámara.
export const HITS = [4.5, 7.5, 9.5, 19.0, 21.0, 32.0, 35.5, 41.5];
