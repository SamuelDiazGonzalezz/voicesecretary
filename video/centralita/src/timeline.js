// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 100 BPM: 1 tiempo = 0,6 s. 16:9. La locución entra tras el logotipo y «Las centralitas en el rally».
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 100;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5;
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const E = (i) => VO[i].end;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.25) * 0.25;

// Tramos del vídeo del cliente, extraídos a 30 fps.
export const CLIP_FPS = 30;

// Secciones musicales: documental tranquilo; un leve crecimiento en cada capítulo.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'open', start: 2.5 },          // el cerebro del coche
  { name: 'carb', start: beat(14) },     // años 60 y 70: carburadores; K-Jetronic; cajas analógicas
  { name: 'groupa', start: beat(33) },   // Grupo A: brida, turbo lag y anti-lag
  { name: 'wrc', start: beat(52) },      // World Rally Car: diferenciales activos, telemetría, picado
  { name: 'rally1', start: beat(71) },   // Rally1: centralita única, CAN e híbrido
  { name: 'maps', start: beat(88) },     // sensores, mapas 3D, launch control
  { name: 'fuel', start: beat(102) },    // combustibles sostenibles y bucle cerrado
  { name: 'outro', start: beat(110) },
];
