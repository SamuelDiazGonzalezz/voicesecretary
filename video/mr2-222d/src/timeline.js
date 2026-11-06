// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la entrada del logotipo.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5; // entrada: logotipo y «Toyota MR2 222D»
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Clip del cliente (el 222D en Goodwood): sus 9 primeros segundos, cuando la voz nombra Goodwood.
export const CLIP = { at: Math.floor((VO[86].start + 1.8) / 0.25) * 0.25, from: 0, dur: 9, fps: 30 };

// Los cuatro momentos en que rompe la música (y golpea la imagen), en la rejilla de 1/2 tiempo.
const half = (x) => Math.floor(x / 0.5) * 0.5;
export const T222 = half(VO[13].start + 2.0);   // aparece «222D»
export const TS = half(VO[29].start + 1.1);     // la «S» del Grupo S
export const T750 = half(VO[68].start + 4.5);   // «750 caballos»
export const TYSI = half(VO[89].start + 0.4);   // «el mayor "y si…"»

// Secciones musicales: tranquilas casi siempre; solo rompen en esos cuatro momentos.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'intro', start: 2.5 },            // la era dorada, un secreto en Europa
  { name: 'dark', start: beat(8) },         // extremo, violento, oscuro
  { name: 'rise', start: beat(11) },        // «Darth Vader», el arma secreta
  { name: 'break1', start: T222 },          // el código 222D
  { name: 'calm', start: beat(15) },        // TTE, el Celica
  { name: 'pulse', start: beat(21) },       // el problema, la revolución
  { name: 'break2', start: TS },            // nacería el Grupo S
  { name: 'calm2', start: beat(31) },       // 10 coches, carta blanca, el MR2
  { name: 'pulse2', start: beat(42) },      // ingeniería paramilitar
  { name: 'dark2', start: beat(53) },       // la nuca del piloto, el 503E
  { name: 'rise2', start: beat(65) },       // sin restricciones… 750
  { name: 'break3', start: T750 },          // 750 caballos
  { name: 'pulse3', start: beat(70) },      // impredecible
  { name: 'requiem', start: beat(73) },     // Toivonen, la cancelación
  { name: 'calm3', start: beat(85) },       // museos y Goodwood
  { name: 'rise3', start: beat(88) },       // no es solo un prototipo
  { name: 'break4', start: TYSI },          // el mayor «y si…»
  { name: 'outro', start: beat(91) },
];
