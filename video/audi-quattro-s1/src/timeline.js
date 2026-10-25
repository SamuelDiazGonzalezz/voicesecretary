// Línea de tiempo compartida por el render de imagen y el sintetizador de audio.
// 120 BPM: 1 tiempo = 0,5 s, 1 compás = 2 s. 16:9, 150 s.

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const DURATION = 150;
export const BPM = 120;
export const BEAT = 60 / BPM;

// La toma del cliente (ElevenLabs, voz «Mario») entra entera, desplazada VO_OFFSET.
export const VO_OFFSET = 0.5;

// Frases del guion con su posición en la toma original (inicio y fin de voz, en s).
// Sirven para sincronizar los textos en pantalla; no se recorta ni se acelera nada.
export const VO = [
  [0.0, 2.17, 'En la era más salvaje de los rallys,'],
  [2.32, 8.5, 'el Grupo B, un coche reescribió las leyes de la física y dejó obsoleta a la tracción trasera.'],
  [9.56, 11.51, 'Hoy hablamos del monstruo definitivo:'],
  [11.95, 14.05, 'el Audi Sport Quattro S1.'],
  [14.94, 20.62, 'A principios de los 80, la norma dictaba que los coches de rally debían ser de tracción trasera.'],
  [21.76, 26.41, 'Los ingenieros decían que un sistema 4x4 era demasiado pesado y complejo.'],
  [27.16, 29.06, 'Audi ignoró a todo el mundo.'],
  [29.61, 33.48, 'Metieron su sistema de tracción total "Quattro" en un chasis de rally'],
  [33.64, 37.39, 'y demostraron que, si puedes transmitir la potencia a las cuatro ruedas,'],
  [37.82, 40.74, 'el agarre sobre tierra y nieve es invencible.'],
  [41.54, 44.69, 'De repente, la potencia pura ya no era el límite.'],
  [45.24, 48.63, 'Pero la competencia apretó, y Audi tuvo que mutar.'],
  [49.42, 54.14, 'Así nació en 1985 la evolución más extrema:'],
  [54.89, 57.41, 'el Sport Quattro S1 E2.'],
  [58.7, 62.25, 'Los ingenieros acortaron la distancia entre ejes para hacerlo más ágil,'],
  [62.58, 66.93, 'creando una silueta desproporcionada, casi cómica, pero letal.'],
  [67.72, 70.3, 'Lo vistieron con un kit aerodinámico salvaje'],
  [70.61, 74.33, 'con alerones colosales diseñados para aplastar el coche contra el suelo.'],
  [75.26, 76.62, 'Bajo el capó de kevlar,'],
  [77.14, 80.63, 'el mítico motor de 5 cilindros en línea y 2.1 litros'],
  [80.89, 83.67, 'producía oficialmente unos 500 caballos,'],
  [83.98, 86.58, 'aunque muchos dicen que rozaba los 600.'],
  [87.42, 90.49, 'Conducir esto requería un nivel de habilidad sobrehumano.'],
  [91.27, 94.81, 'Con un reparto de pesos desequilibrado por llevar el motor tan adelantado,'],
  [95.2, 100.25, 'pilotos legendarios como Walter Röhrl, Michèle Mouton y Stig Blomqvist'],
  [100.81, 105.72, 'tenían que obligar al coche a girar basándose en pura fuerza bruta y transferencias de peso.'],
  [106.35, 107.18, 'Era una bala.'],
  [108.01, 111.0, 'Aceleraba de 0 a 100 en unos 3,1 segundos...'],
  [111.52, 112.54, 'sobre tierra.'],
  [113.01, 118.04, 'Era tan brutal que Audi incluso experimentó con una caja de cambios de doble embrague,'],
  [118.39, 121.48, 'sentando las bases de la tecnología que hoy usamos a diario.'],
  [122.3, 125.01, 'El Grupo B se canceló por ser demasiado peligroso,'],
  [125.68, 128.4, 'pero el S1 encontró un último campo de batalla:'],
  [129.01, 132.69, 'Pikes Peak, donde pulverizó el récord subiendo hacia las nubes.'],
  [133.33, 136.16, 'El Audi Quattro S1 no solo ganó carreras;'],
  [136.47, 139.73, 'demostró que la ingeniería radical puede cambiar la historia.'],
  [141.19, 142.92, '¿Cuál crees que fue su mayor rival?'],
  [144.23, 147.63, 'Déjalo en los comentarios y suscríbete para más leyendas del motor.'],
].map(([a, b, text]) => ({ start: a + VO_OFFSET, end: b + VO_OFFSET, text }));

// Secciones musicales: todas empiezan en un tiempo de la rejilla (múltiplo de 0,5 s).
export const SECTIONS = [
  { name: 'intro', start: 0 },
  { name: 'grooveA', start: 12.5 },
  { name: 'drop1', start: 27.5 },
  { name: 'break', start: 45.5 },
  { name: 'drop2', start: 55.0 },
  { name: 'engine', start: 75.5 },
  { name: 'dark', start: 87.5 },
  { name: 'bullet', start: 106.5 },
  { name: 'requiem', start: 122.5 },
  { name: 'ascent', start: 129.5 },
  { name: 'climax', start: 133.5 },
  { name: 'outro', start: 141.5 },
];

// Golpes con impacto sonoro y de cámara.
export const HITS = [2.75, 12.5, 27.5, 47.75, 55.0, 66.75, 75.5, 106.5, 122.5, 133.5, 144.5];
