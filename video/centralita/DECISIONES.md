# Las centralitas en el rally: decisiones de producción

Documental de ingeniería de 9:32 en 16:9 sobre la centralita (ECU) en el rally, para el canal EVO HERITAGE. Usa:
- la locución del cliente (9:26);
- 16 de sus 19 imágenes;
- siete tramos del vídeo `videocentralita.mp4` de su Google Drive. El primero es el del minuto 1:38, colocado al empezar, como pidió.

Los mecanismos se dibujan y se animan por código, fotograma a fotograma, con una función `seek(t)`. La música, tranquila, de documental, está sintetizada desde cero. No hay `Math.random` sin semilla: todo lo «aleatorio» (pistas de la placa, detonaciones, cortes de inyección, sensores) sale de un generador con semilla.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/centralita.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 120 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Motor 3D, componentes, 67 planos y montaje (montado desde `out/tmp/*.js`) |
| `out/tmp/ecu.js`, `out/tmp/ecu2.js` | Los componentes nuevos de este vídeo |
| `src/timeline.js`, `src/vo.js` | Tiempos, secciones de la música y mapa de la locución |
| `scripts/clips.json` | Los siete tramos del vídeo |
| `audio/music.mjs` | Arreglo y diseño sonoro; los instrumentos están en `video/musica/synth.mjs` |
| `scripts/mix.mjs` | Mezcla: voz, música (que baja en los tramos de vídeo) y sonido real de los coches |

El vídeo de origen (285 MB) no se sube al repositorio: está en el Drive del cliente (`videosevoheritage/videocentralita.mp4`) y se copia a `assets/clip/rally.mp4`.

Para reproducirlo todo:
1. `ffmpeg -i vo/take.mp3 -ac 1 -ar 16000 vo/take16.wav`
2. `python3 -I scripts/align.py vo/take16.wav vo/guion.txt out/vo-map.json`
3. `node scripts/vo-js.mjs`
4. `npm run images`
5. `npm run music`
6. `node scripts/render.mjs`
7. `npm run mix`
8. `npm run contact`

---

## Qué decidí y por qué

### 1. Un motor 3D mínimo para «abrir la carcasa»
El guion promete abrir la carcasa de las centralitas más avanzadas del planeta, así que la pieza central es una **ECU de competición en 3D** hecha solo con código:
- **Proyección axonométrica** con guiñada y cabeceo. Las caras planas son paralelogramos y las texturas se mapean con una sola transformación afín; las cajas se ordenan por profundidad.
- **La centralita:**
  - carcasa de aluminio con aletas de disipación y pestañas de anclaje;
  - tres conectores circulares con sus anillos de color y sus contactos;
  - placa con pistas en ángulo recto, vías, peine del conector y serigrafía; por las pistas corren pulsos de datos;
  - microcontrolador, memoria flash, RAM, transceptores CAN, etapas de potencia y regulador como volúmenes reales.
- **Vista explosionada:** la tapa sube, la placa sale de la bandeja y cada componente se rotula con una línea guía. La misma pieza vuelve en «Una centralita estándar única» (cinco iguales) y en el cierre, «Se escribe con código».

### 2. Cada capítulo con su mecanismo, explicado con física
- **Carburador horizontal en sección:** el difusor estrecha el paso y las líneas de corriente se aceleran en la garganta; la depresión aspira la gasolina de la cuba por el chiclé y el surtidor; la presión atmosférica empuja sobre la cuba por el respiradero.
- **Montecarlo:** perfil del puerto, una muestra de aire que pierde moléculas al subir (densidad), la mezcla que se enriquece y la potencia que cae.
- **De aspirada a inyectada:** surtidor por vacío frente a inyector a presión con su manómetro.
- **La ROM soldada a mano:** placa analógica de los 80 (transistores TO-3 y TO-92, resistencias con bandas, condensadores, pistas a mano alzada). El chip viejo sale del zócalo, entra el nuevo y el soldador recorre los pines uno a uno, que se iluminan con el color del calor.
- **Brida restrictora:** el conducto se estrecha y el compresor gira más despacio.
- **Turbo lag:** la sección del turbo pierde caudal de gases cuando se suelta el acelerador, y una gráfica de acelerador y presión del turbo marca el «vacío de potencia».
- **Anti-lag en un cilindro en sección:** ciclo de cuatro tiempos real (válvulas, pistón, biela y cigüeñal sincronizados), bujía, inyector, mariposa y turbina. Se ve, en orden:
  - el pie se levanta;
  - la ECU corta el encendido (la chispa desaparece), sigue inyectando y deja la mariposa ligeramente abierta;
  - la gasolina sin quemar baja por el colector al rojo;
  - detona antes de la turbina con una onda de presión;
  - la turbina sigue a 100.000 rpm.
- **World Rally Car:** planta del coche con la centralita en el centro y «nervios» a los sensores (velocidad de rueda, acelerómetro de tres ejes, ángulo del volante y presión de frenada), por los que corren las señales. Después:
  - deslizamiento por rueda;
  - el eje delantero pierde tracción;
  - **embrague multidisco en sección:** pistón hidráulico, discos de fricción y de acero alternos que se cierran, y cronómetro por debajo de 10 ms;
  - el coche rota neutro frente a la trayectoria del subviraje.
- **Telemetría:** el coche en el tramo envía por radio al box, y una interfaz genérica con los colores del canal muestra régimen, presión de aceite y un fallo eléctrico.
- **Picado de biela:** frente de llama secundario en la cámara, sensor de picado en el bloque, señal de vibración con ráfagas y la chispa que se aleja del PMS (menos avance).
- **Rally1:**
  - motor térmico con inyección directa y brida;
  - **bus CAN** diferencial (CAN-H y CAN-L) con tramas que viajan entre ECU, PCU y MGU;
  - estrategia de despliegue: +134 CV a la salida de las curvas lentas y regeneración en las frenadas, con la energía de la batería;
  - batería con celdas coloreadas por temperatura y su límite térmico.
- **Mapa de avance de encendido en 3D:** superficie real (X régimen, Y carga MAP, Z avance antes del PMS) que se construye y gira. Al final se acerca a un punto de trabajo y se ve la interpolación entre las cuatro celdas vecinas.
- **Launch control:** régimen bloqueado en el óptimo de par y cortes de inyección por cilindro.
- **Cifrado:** el mismo mapa se desordena y se cierra con un candado.
- **Combustible sostenible:** densidad y vaporización ligeramente distintas, bucle cerrado (inyector → combustión → escape → sonda lambda → ECU), oxígeno del escape que converge a la relación estequiométrica y el *duty cycle* del inyector con la cota del tiempo de apertura.

### 3. El vídeo de Drive
- **El minuto 1:38**, un Lancia 037 que sale de la horquilla derrapando, abre el documental bajo «un motor de 500 caballos… inútil sin una mente que lo gobierne».
- **Más tramos repartidos:**
  - Ford Escort para los carburadores;
  - Audi Quattro para la K-Jetronic;
  - un tramo nocturno para «el famoso petardeo»;
  - Subaru Impreza para el World Rally Car de 1997;
  - Ford Puma Rally1 para la era híbrida;
  - **al final**, un Citroën C3 WRC para «ya no se escribe solo con llave inglesa y grasa de motor».
- **Marca de agua «PALBO» (esquina inferior derecha):**
  - la medí: ocupa x 1545-1840, y 980-1025;
  - de cada tramo solo uso el cuadro por encima de y = 958 (1704 × 958, centrado, en 16:9), así que la marca no aparece nunca;
  - lo comprobé en fotogramas de los siete tramos.
- **Sonido real:** en cada tramo suena el audio del propio vídeo, el mismo trozo que la imagen. La música baja unos 10 dB y la voz no se toca.

### 4. Identidad
- **Tipografía y rejilla:** Red Hat Display y la rejilla de la serie (margen de 140 px). Texto a la izquierda y mecanismo a la derecha.
- **Colores con significado:**
  - **amarillo = la centralita, los datos y la gasolina**;
  - **azul = aire, sensores, hidráulica y bus CAN**;
  - **naranja y rojo = calor, combustión y avisos**.
- **Capítulos:** cada época abre con una foto y la regla inferior de fechas (años 60, 70, 80, 90, 1997 y 2022).

### 5. Música, distinta de las anteriores
En **Si menor a 100 BPM**:
- el motivo es un **«latido de datos»**, un arpegio de campana FM muy suave que recorre el acorde como un procesador que calcula (corcheas en la narración, semicorcheas en las partes técnicas);
- pads cálidos, un bajo que late en el 1 y en el «y» del 3, y acordes de piano espaciados;
- en cada capítulo, un crecimiento de cuerdas;
- **diseño sonoro sincronizado:** la carcasa que se abre, la ROM que encaja, la soldadura pin a pin, cada detonación del anti-lag (mismos instantes y misma semilla que el dibujo), el embrague que se cierra, el candado y el botón de suscribirse.

---

## Qué descarté

- **Partículas de relleno:** el bosque de Finlandia lo dibujé primero con copas de árbol como círculos; en la revisión parecían partículas sin función y los quité. Queda solo la carretera.
- **Cifras inventadas:** solo aparecen las del guion (500 CV, 1.000 veces por segundo, 800 grados, 100.000 rpm, 10 ms, 180 km/h, 1.6 litros, 100 kW, 134 CV, 3,9 kWh, más de mil grados). Los ejes y las barras de densidad o vaporización no llevan números.
- **Texto tipo terminal:** el cifrado y el «código binario» no se cuentan con columnas de unos y ceros, sino con el mapa que se desordena y la placa con datos en las pistas.
- **Tres imágenes del ZIP:**
  - la infografía del Rally1, en inglés y con el logotipo del campeonato;
  - un diagrama de ECU de terceros: lo dibujé yo, con los colores del canal;
  - una foto duplicada del Toyota.
- **Llamas del escape en el vídeo:** las busqué en todos los tramos nocturnos y las que hay son bengalas del público, así que el petardeo se ve en el esquema y se oye en el tramo nocturno.
- **Interfaces de marcas reales:** la telemetría y la red CAN son genéricas. Bosch, Magneti Marelli y Compact Dynamics aparecen solo como texto o en las fotos del cliente, porque las nombra el guion.

---

## Iteraciones

1. **Material:**
   - descargué el vídeo de Drive (1080p a 50 fps, 7:27);
   - lo revisé entero, un fotograma cada 5 s, y del 1:36 al 2:00 cada medio segundo;
   - revisé los tramos nocturnos a 2 y 6 fotogramas por segundo buscando llamas;
   - medí la marca de agua;
   - revisé las 19 imágenes en una hoja numerada.
2. **Guion y alineación:** 120 cláusulas, 3.096 sílabas detectadas frente a 3.194 del guion.
3. **Comprobación automática:** recorrí toda la línea de tiempo (cada 0,37 s) buscando errores: ninguno.
4. **v0, dos fotogramas por plano (134).** Corregí:
   - **la ECU en 3D,** que se veía pequeña: más grande y con la tapa flotando arriba en la vista explosionada;
   - **rótulos que se salían del cuadro** (microcontrolador, etapas de potencia, sensores);
   - **esquemas que pisaban el titular** (carburador, anti-lag, picado, motor térmico, red CAN);
   - **el tramo nocturno,** que al final cambiaba a un plano de día: ahora acaba antes del corte;
   - **la curva neutra,** donde el coche se salía del cuadro;
   - **los círculos del bosque** (descartados);
   - **etiquetas superpuestas** en el embrague multidisco y en la caja de la PCU.
5. **v1:** volví a revisar los 134 fotogramas. Ajusté los rótulos de los sensores, la caja de la PCU, el tamaño de los mapas 3D y la turbina, que quedaba en el borde.
6. **Render** a 60 fps por tramos de 60 s (con reintento), mezcla, hoja de contactos y revisión del máster.

## Tiempo total

Unas 5 horas desde el encargo:
- 40 min de material, vídeo de Drive y alineación;
- 2 h de los componentes (motor 3D incluido) y los 67 planos;
- 45 min de revisión y correcciones;
- 15 min de música y mezcla;
- unos 70 min de render.

## Material de terceros

- **Fotografías:** las proporcionó el cliente (`videocentralitaimagenes.zip`).
- **Vídeo de tramos:** el cliente lo dejó en su Google Drive (`videosevoheritage/videocentralita.mp4`). Su marca de agua queda fuera del encuadre.
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (ElevenLabs).
- **Fuente:** Red Hat Display, de Red Hat (SIL Open Font License).
