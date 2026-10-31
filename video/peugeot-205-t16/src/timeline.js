// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la cortinilla del logotipo.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.0; // la entrada del logotipo dura 2 s
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 2.5);

// Inicio de la frase i y corte en la rejilla de corcheas justo antes de ella.
export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i) => Math.floor((VO[i].start - 0.1) / 0.5) * 0.5;

// Secciones musicales ancladas a frases del guion (siempre en un tiempo de la rejilla).
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'intro', start: 2.0 },
  { name: 'drop1', start: beat(7) },      // «Hoy desentrañamos el mito…»
  { name: 'grooveA', start: beat(12) },   // Peugeot Talbot Sport, Todt
  { name: 'analysis', start: beat(18) },  // analiza a los rivales
  { name: 'build', start: beat(26) },
  { name: 'drop2', start: beat(29) },     // «Nació así el 205 Turbo 16»
  { name: 'tech', start: beat(35) },      // la magia detrás de los asientos
  { name: 'grooveB', start: beat(48) },   // Evo 1, debut
  { name: 'drop3', start: beat(56) },     // Evo 2
  { name: 'lag', start: beat(61) },       // retraso del turbo
  { name: 'drop3b', start: beat(62) },    // misil balístico
  { name: 'drivers', start: beat(63) },
  { name: 'requiem', start: beat(66) },   // el accidente de Vatanen
  { name: 'salonen', start: beat(69) },
  { name: 'triumph', start: beat(76) },
  { name: 'requiem2', start: beat(80) },  // la FIA prohíbe el Grupo B
  { name: 'desert', start: beat(84) },    // ¿Qué hizo Peugeot?
  { name: 'ascent', start: beat(91) },    // Pikes Peak
  { name: 'finale', start: beat(94) },
  { name: 'climax', start: beat(96) },    // «…la perfección del Grupo B»
  { name: 'outro', start: beat(101) },
];
