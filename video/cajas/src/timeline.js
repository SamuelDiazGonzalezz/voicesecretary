// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la entrada del logotipo, sobre el cambio de marcha de la entrada.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5; // entrada: logotipo y «La evolución de las cajas de cambio»
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Tramos del vídeo de onboards del cliente, extraídos a 30 fps.
export const CLIP_FPS = 30;

// Secciones musicales: documental tranquilo; un leve crecimiento en cada capítulo.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'open', start: 2.5 },         // 40 cambios por kilómetro, 10 minutos
  { name: 'hpattern', start: beat(15) },// el patrón en H, los engranajes rectos
  { name: 'synchro', start: beat(28) }, // los sincronizadores se derriten
  { name: 'dog', start: beat(39) },     // la dog box
  { name: 'seq', start: beat(57) },     // money shift y caja secuencial
  { name: 'wrc', start: beat(78) },     // levas, actuadores y corte de encendido
  { name: 'xtrac', start: beat(95) },   // la caja como cerebro de la tracción
  { name: 'rally1', start: beat(110) }, // Rally1
  { name: 'outro', start: beat(121) },
];
