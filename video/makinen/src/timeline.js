// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s. 16:9. La locución entra tras la entrada del logotipo.
import { VO_RAW } from './vo.js';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VO_OFFSET = 2.5; // entrada: logotipo y «Tommi Mäkinen»
export const VO = VO_RAW.map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));
export const DURATION = Math.ceil(VO.at(-1).end + 3);

export const V = (i) => VO[i].start;
export const cut = (i, lead = 0.1) => Math.floor((VO[i].start - lead) / 0.25) * 0.25;
const beat = (i, d = 0) => Math.floor((VO[i].start + d - 0.1) / 0.5) * 0.5;
const half = (x) => Math.floor(x / 0.5) * 0.5;

// Tramos del vídeo de archivo del cliente (ver scripts/clips.json), con su velocidad de reproducción.
export const CLIP_FPS = 30000 / 1001;

// Los cuatro momentos en que rompe la música (y golpea la imagen).
export const BREAKS = {
  four: half(V(9)),            // «Cuatro mundiales consecutivos»
  record: half(V(54)),         // «Cuatro campeonatos del mundo consecutivos»
  triple: half(V(72) + 2.6),   // «…coronarse tricampeón del mundo»
  iron: half(V(105) + 5.0),    // «…la voluntad más de hierro del planeta»
};

// Secciones musicales: el estilo orquestal tranquilo casi siempre.
export const SECTIONS = [
  { name: 'ident', start: 0 },
  { name: 'open', start: 2.5 },               // dioses de la grava, los gigantes de los 90
  { name: 'rise1', start: beat(8) },           // la máquina roja
  { name: 'break1', start: BREAKS.four },      // cuatro mundiales
  { name: 'title', start: beat(11) },          // hoy desentrañamos el mito
  { name: 'calm1', start: beat(14) },          // orígenes: Puuppola, tractores
  { name: 'lift', start: beat(24) },           // 1994, el Escort y los 1000 Lagos
  { name: 'calm2', start: beat(32) },          // Cowan, 1995, el Evo
  { name: 'tech', start: beat(44) },           // Grupo A, el 4G63, los diferenciales activos
  { name: 'rise2', start: beat(52) },          // de 1996 a 1999
  { name: 'break2', start: BREAKS.record },    // cuatro campeonatos
  { name: 'calm3', start: beat(56) },          // fuego contra hielo
  { name: 'tense', start: beat(62) },          // 1998: la rueda, los 300 metros, la llamada
  { name: 'break3', start: BREAKS.triple },    // tricampeón
  { name: 'tech2', start: beat(73) },          // el pie izquierdo, los diferenciales, los vuelcos
  { name: 'calm4', start: beat(88) },          // el final del Grupo A, Subaru, 24 victorias
  { name: 'rise3', start: beat(100) },         // Toyota Gazoo Racing
  { name: 'break4', start: BREAKS.iron },      // voluntad de hierro
  { name: 'outro', start: beat(107) },         // la Tommi Mäkinen Edition y el cierre
];
