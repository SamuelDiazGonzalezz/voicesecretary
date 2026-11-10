// Línea de tiempo compartida por la imagen y el sintetizador. 120 BPM: 1 tiempo = 0,5 s. Vertical 9:16.
// La locución del cliente entra tras medio segundo de petardeos del Evo VI.
import { VO_RAW } from './vo.js';

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 0.5;
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 2.6);

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Clip del cliente (Evo VI, segundos 9 a 16 de su vídeo).
export const CLIP = { fps: 30 };

// Secciones musicales ancladas a frases de la locución.
export const SECTIONS = [
  { name: 'intro', start: 0 },          // fuego por el escape, coches imposibles, una era
  { name: 'drop1', start: beat(3) },    // «Esto es Evo Heritage»
  { name: 'legends', start: beat(4) },  // la historia: cuatro leyendas
  { name: 'pause', start: beat(10) },   // «Pero no solo te contamos su historia»
  { name: 'build', start: beat(11) },   // «Te explicamos su ingeniería»
  { name: 'drop2', start: beat(12) },   // antilag, tracción total, motor central, chasis tubular
  { name: 'groove', start: beat(16) },  // documentales
  { name: 'soft', start: beat(17) },    // «Esta comunidad es de todos ustedes»
  { name: 'climax', start: beat(18) },  // «porque el rally es de todos»
  { name: 'outro', start: beat(19) },   // suscríbete
];
