// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras el logotipo y «La evolución de los frenos».
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5;
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const E = (i) => VO[i].end;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Tramos del onboard del cliente, extraídos a 30 fps.
export const CLIP_FPS = 30;

// Secciones musicales: documental tranquilo; un leve crecimiento en cada capítulo.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'open', start: 2.5 },          // energía y calor
  { name: 'drum', start: beat(16) },     // años 60: el tambor
  { name: 'disc', start: beat(25) },     // años 70: disco macizo y fading
  { name: 'groupb', start: beat(52) },   // Grupo B: ventilados, pinzas y turbofans
  { name: 'surface', start: beat(73) },  // asfalto y tierra
  { name: 'carbon', start: beat(105) },  // carbono-carbono
  { name: 'water', start: beat(121) },   // pinzas refrigeradas por agua
  { name: 'hand', start: beat(135) },    // freno de mano hidráulico y pedal box
  { name: 'rally1', start: beat(164) },  // Rally1
  { name: 'outro', start: beat(186) },
];
