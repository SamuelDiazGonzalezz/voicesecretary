// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la entrada del logotipo.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5; // entrada: logotipo y «Anti-Lag»
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

// Clip del cliente (Mitsubishi Evo VI): segundos 9 a 16, a partir de la entrada.
export const CLIP = { at: VO_OFFSET, from: 9, dur: 7, fps: 30 };

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Secciones musicales ancladas a frases del guion.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'cold', start: VO_OFFSET },        // el clip con sus petardeos
  { name: 'intro', start: beat(4) },         // los ingenieros y la bestia
  { name: 'drop1', start: beat(6) },         // «el sistema Anti-lag»
  { name: 'tension', start: beat(12) },      // la enfermedad: el turbo lag
  { name: 'groove', start: beat(15) },       // motores pequeños, turbos gigantes
  { name: 'dead', start: beat(21) },         // «el coche estaba muerto»
  { name: 'hit', start: beat(23) },          // de golpe
  { name: 'brake', start: beat(26) },        // el momento crítico: frenar
  { name: 'drop2', start: beat(42) },        // la genialidad del Anti-lag
  { name: 'mech', start: beat(48) },         // centralita, inyectores, bypass
  { name: 'build', start: beat(55) },        // la mezcla viaja al colector
  { name: 'bam', start: beat(60) },          // ¡BAM!
  { name: 'climax', start: beat(61) },
  { name: 'history', start: beat(69) },      // del 205 T16 al WRC
  { name: 'precise', start: beat(74) },      // mapas ajustables
  { name: 'price', start: beat(78) },        // el precio
  { name: 'outro', start: beat(85) },
  { name: 'end', start: beat(88) },
];
