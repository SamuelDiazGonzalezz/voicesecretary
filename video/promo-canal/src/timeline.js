// Línea de tiempo compartida por la imagen y el sintetizador. 120 BPM: 1 tiempo = 0,5 s. Vertical 9:16, 30 s.
export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const DURATION = 30;

// Planos, en tiempos de la rejilla (cada corte cae en un tiempo).
export const T = {
  hook: 0,          // las llamas del 205 T16 y «Revive la historia del rally»
  historia: 3,      // palabra «Historia»
  lancia: 4.5,      // cuatro leyendas, una cada tres tiempos
  audi: 6,
  peugeot: 7.5,
  toyota: 9,
  ingenieria: 10.5, // palabra «Ingeniería»
  antilag: 12,      // cuatro esquemas, uno por compás
  quattro: 14,
  central: 16,
  chasis: 18,
  cards: 20,        // los documentales del canal
  end: 23,          // logotipo y suscripción
};
export const PRESS = 25.5; // se pulsa «Suscríbete»

// Clip del cliente (Evo VI, segundos 9 a 16 de su vídeo), en la tarjeta del documental del Anti-lag.
export const CLIP = { fps: 30, hookFrom: 0.2 };

export const SECTIONS = [
  { name: 'intro', start: 0 },
  { name: 'groove', start: T.historia },
  { name: 'stop', start: T.ingenieria },
  { name: 'mech', start: T.antilag },
  { name: 'lift', start: T.cards },
  { name: 'outro', start: T.end },
];
