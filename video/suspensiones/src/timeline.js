// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la entrada del logotipo, sobre el salto de la entrada.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5; // entrada: logotipo y «La evolución de las suspensiones»
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Tramos del vídeo de saltos del cliente (Rally de Polonia 2015), 25 fps.
export const CLIP_FPS = 25;

// Secciones musicales: documental tranquilo; solo se abre en el cambio de época.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'open', start: 2.5 },          // la potencia no sirve de nada sin contacto
  { name: 'era70', start: beat(11) },    // los años 70
  { name: 'eraB', start: beat(33) },     // la bomba del Grupo B
  { name: 'eraA', start: beat(50) },     // los años 90, el Grupo A, los fluidos
  { name: 'wrc', start: beat(69) },      // 1997: los World Rally Cars
  { name: 'magic', start: beat(86) },    // lo antinatural: topes hidráulicos y válvulas
  { name: 'rally1', start: beat(111) },  // hoy: Rally1 híbridos
  { name: 'finale', start: beat(123) },  // detrás de las llantas
  { name: 'outro', start: beat(127) },
];
