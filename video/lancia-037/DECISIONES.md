# Lancia Rally 037: decisiones de producción

Spot vertical de 45 s sobre el Lancia Rally 037, con la locución del cliente (ElevenLabs, voz «Juan»), música sintetizada desde cero a 120 BPM y animación generada por código y renderizada fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/lancia-037.mp4` | Máster final: 1080×1920, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS integrados y pico real de −1,5 dBTP |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 1,5 s del máster |
| `src/` | Animación: `timeline.js` (tiempos), `lib.js` (curvas, tipografía y recursos gráficos), `scenes.js` (planos y montaje) e `index.html` |
| `audio/music.mjs` | Sintetizador, arreglo y máster de la música y del diseño sonoro |
| `scripts/` | Preparación de fotos, render, mezcla y hoja de contactos |

Para reproducirlo todo: `npm install && npm run all`. Hace falta `ffmpeg` y Chromium; Playwright lo encuentra solo.

---

## Qué decidí y por qué

### 1. La librea Martini como sistema gráfico
Toda la identidad del spot sale de las tres bandas del 037: azul claro, azul marino y rojo, sobre blanco roto o negro. Con ellas resuelvo las cortinillas diagonales, los subrayados, el tachado del «4×4», el relleno inclinado del plano «Lancia logró lo imposible» y el cierre. No hay ningún otro color ni ningún degradado decorativo, así que cada fotograma se reconoce como «Lancia Martini» sin copiar logotipos.

- **Paleta:** tinta `#0B0C0F`, papel `#F2EFE8`, azul `#49A6DD`, marino `#12305E` y rojo `#E0261D`.
- **Tipografía:** Barlow Condensed Black/ExtraBold Italic para los titulares (la cursiva condensada evoca la rotulación de rally de los 80) y Barlow para las etiquetas. Son fuentes libres (OFL) y van en `assets/fonts`.
- **Rejilla:** margen lateral de 96 px, todo alineado a la izquierda menos el «1983» de apertura, y zonas seguras de redes (titulares entre 230 y 1640 px de alto). Cada plano lleva un solo mensaje y como mucho tres niveles: etiqueta, titular y apoyo.

### 2. Un hilo visual propio: la planta técnica del coche
Sobre el guion del cliente («dos ruedas motrices» frente al «4×4») construí un esquema en planta del 037 dibujado a mano en código: contorno, habitáculo, motor central de cuatro cilindros, caja de cambios y árboles de transmisión. Aparece cuatro veces y cada vez cuenta algo distinto:
1. **Gancho:** solo las ruedas traseras se encienden en rojo.
2. **«El mundo entero se pasaba a la tracción total»:** las cuatro ruedas en azul, con el par circulando hacia los dos ejes.
3. **«Directos al eje trasero»:** el par fluye solo hacia atrás.
4. **«Dejarlo rotar, dejarlo vivir»:** el coche derrapa sobre un arco y va dejando la huella de las ruedas traseras.

Es la manera de explicar la tracción sin imágenes de archivo y con una estética de ficha técnica, no de plantilla.

### 3. Montaje a 120 BPM
Los 17 cortes caen en la rejilla de tiempos de la música (múltiplos de 0,5 s). Cada uno está elegido para entrar como mucho medio tiempo antes de la frase que ilustra, de modo que la imagen se adelanta ligeramente a la voz, como en un montaje profesional. Las secciones musicales empiezan en esos mismos cortes, y los impactos de sonido y los golpes de cámara coinciden con ellos (`HITS` en `timeline.js`).

### 4. Locución: la toma del cliente, editada
El cliente generó en ElevenLabs su propio guion, más largo que el que yo le propuse: una toma de 48,8 s. Lo resolví así:
- **Mapa de frases:** sin reconocimiento de voz disponible, localicé las 20 frases detectando silencios y contando núcleos silábicos por fragmento. Cada recuento coincidió con el texto con un error de ±2 sílabas.
- **Cortes:** cada frase se corta en silencio, comprobado a −64 dB o menos en todos los puntos de corte.
- **Pausas:** se compactan según la puntuación: 0,07 s en respiraciones, 0,12 s en comas, 0,20 s en finales de frase y 0,16 s antes del «¡Suscríbete!».
- **Tempo:** un único factor de ×1,069 (`atempo`, que no altera el tono) para que entre entera entre 0,15 s y 44,8 s. Se calcula en `layoutVO()` y lo comparten el mezclador y la línea de tiempo.
- **Proceso de voz:** pasa-altos a 75 Hz, −2,5 dB a 280 Hz (le quita barro), +2 dB a 3,2 kHz (presencia), un shelf suave en agudos y una compresión 3:1.

### 5. Música y diseño sonoro sintetizados, sin una sola muestra
`audio/music.mjs` es un sintetizador escrito desde cero. Incluye osciladores con antialiasing polyBLEP, filtros de variable de estado, bombo, palmas, caja, charles y toms, bajo con saturación, arpegio, pads con supersierra, una melodía para el clímax, reverb tipo Freeverb, delay ping-pong a 3/16, sidechain desde el bombo y un limitador con anticipación. Todo el ruido sale de un PRNG con semilla.

- **Tonalidad y progresión:** Re menor, i–VI–III–VII (Rem–Si♭–Fa–Do).
- **Forma:** intro tensa → groove A al revelar el coche → corte de un compás en «Su fórmula era extrema» → groove B más pesado → medio tiempo oscuro con Röhrl → silencio de batería en «te comía vivo» → subida de toms → clímax con progresión ascendente (Si♭–Do–Rem) y melodía → golpe final con cola.
- **Diseño sonoro, sincronizado con la imagen:**
  - motor de cuatro cilindros sintetizado (tren de explosiones a rpm/30 por resonancias de escape) al revelar el coche y en «este monstruo»;
  - silbido del compresor que sigue la velocidad de los rotores;
  - clics de contador mecánico en el «300»;
  - whooshes en cada cortinilla, impactos con subgrave, risers y platos invertidos antes de cada drop;
  - el clic del botón «Suscríbete».
- **Mezcla:** la música entra a −11 dB y se comprime con la voz como llave. La voz queda unos 7 dB por encima, y la música respira en las pausas y en los golpes. El máster se normaliza a −14 LUFS en dos pasadas (estándar de Reels, TikTok y Shorts).

### 6. Efectos: rango sin ruido
Cada efecto tiene una función narrativa:
- **Texto revelado por máscara**, letra a letra, con curvas cubic-bezier (expo-out para entradas y expo-in para salidas). No hay ninguna interpolación lineal ni rebotes.
- **Cortinillas diagonales** con las bandas Martini: la escena saliente se ve entre los huecos de las bandas.
- **Barridos rápidos** con desenfoque de movimiento direccional (24 copias promediadas).
- **Transición por franjas:** el plano blanco se desmonta en ocho tiras escalonadas.
- **Foto dentro de las cifras «037»** y zoom ×26 a través del trazo del «0», con desenfoque radial.
- **Rotores Roots trilobulados** que engranan sin solaparse: el perfil se calcula para que la suma de radios en la línea de centros sea constante. El desenfoque de giro sale de la velocidad angular real.
- **Contador 0 → 300** con cifras de ancho fijo y ceros apagados.
- **Báscula genérica** que se detiene justo antes de los 1000 kg.
- **Tachado del «4×4»** con las tres bandas.
- **Inversión a fondo claro en el clímax**: es el único plano blanco del spot, y por eso pesa.
- **Derrape en planta** con huellas calculadas a partir de la trayectoria.
- **Cámara:** golpes de zoom que decaen en los impactos y un temblor breve en los cinco más fuertes, con ruido suave con semilla.
- **Grano de película** sutil, con teselas fijas elegidas por fotograma, que además unifica la textura de fotos de calidades muy distintas.

### 7. Determinismo y render
- **Función de tiempo:** `seek(t)` dibuja el fotograma únicamente a partir de `t`. No hay `Math.random` (todo sale de `rng(semilla)`), ni relojes, ni estado entre fotogramas.
- **Paralelo:** `scripts/render.mjs` abre tres pestañas de Chromium sin interfaz, pide cada fotograma por su tiempo, lo vuelve a ordenar y lo envía a ffmpeg. Como cada fotograma es independiente, el resultado es idéntico en cualquier orden.
- **Desenfoque de movimiento:** se renderiza a 60 fps y el máster a 30 fps promedia cada par de fotogramas (`tmix`). Equivale a un obturador de 180°: el desenfoque es real, no simulado.
- **Fotos:** se reescalan una sola vez con Lanczos, una máscara de enfoque suave y un etalonaje común (contraste +6 %, saturación +7 %). Se componen como bandas horizontales a lo ancho, así que nunca se amplían más de lo que aguantan.

---

## Qué descarté

- **Generar la voz con la API desde aquí.** La red del entorno bloquea `api.elevenlabs.io`. Le pasé el guion al cliente y él me devolvió la toma.
- **Mi guion original (11 frases, unas 135 sílabas).** El cliente trajo su propio texto y en pantalla solo uso sus palabras, en extractos de una idea por plano.
- **Buscar más fotos en internet.** Wikimedia, Google y los demás bancos de imágenes están bloqueados por la red. En lugar de rellenar con material dudoso, compensé con gráficos propios (planta, rotores, báscula, contador y tipografía).
- **Extender el vídeo a 49 s** para no tocar el tempo de la voz. El encargo pedía 45 s; el ×1,069 se nota poco y encaja con el tono dinámico del texto. Si se prefiere la voz al 100 %, basta con cambiar `VO_END` y `DURATION`.
- **Reproducir los logotipos de Lancia o Martini.** Las marcas solo aparecen en las fotos reales; los rótulos van compuestos en tipografía propia.
- **Comillas en «te comía vivo».** El guion lo presenta como algo que «dijo» Röhrl, pero no he podido verificar la cita literal, así que va como texto de la narración y no como cita entrecomillada.
- **Cifras que el cliente no dice:** 960 kg, 325 CV, 1995 cm³. Las fuentes no coinciden entre sí y el guion habla de «menos de mil kilos» y «más de 300 caballos». La báscula y el contador ilustran eso mismo, sin inventar un dato más preciso.
- **Brillo especular sobre el rótulo final, partículas y aberración cromática.** Era decoración sin función, justo lo que el encargo prohibía.
- **Numerar los planos o los datos («01», «02»…).** Lo prohíbe el encargo y además suena a plantilla.
- **El crédito de la maqueta del motor.** La foto lleva sobreimpreso «Artist – Dmitry Golosov @twdmodelling / Motor – GPmodeling production». Lo recorto del encuadre porque el vídeo no admite textos ajenos, y lo acredito aquí.

---

## Iteraciones

1. **v0, fotogramas sueltos con mi guion.** Hice una hoja de 29 fotogramas para validar el sistema gráfico, las cortinillas y el zoom a través del «037».
2. **Llega la toma del cliente.** Tenía el doble de sílabas que mi guion. Pregunté qué texto había usado, mapeé las 20 frases por sílabas y reescribí el montaje entero (17 planos) sobre su texto.
3. **v1, primer render completo.** A partir de la hoja de contactos y de fotogramas sueltos corregí:
   - el desenfoque de los barridos, que dejaba copias visibles (de 10 a 24 muestras);
   - el contorno del «4×4», con poco contraste;
   - el coche del derrape, demasiado pequeño;
   - los cuerpos de los titulares, que eran tímidos;
   - el botón final, que era pequeño;
   - un corte de voz a −64 dB en «ganó», que adelanté 50 ms.
4. **v1, revisión del audio.** Con espectrograma, RMS por segundo y sonoridad por pistas vi que la música ducked quedaba solo 5 dB por debajo de la voz. La bajé 2 dB más, hasta unos 7 dB por debajo.
5. **v2.** El primer fotograma salía en negro, un mal gancho para redes y una mala miniatura: ahora arranca con la planta ya dibujándose. El contador con rodillos era ilegible en pausa: ahora sube en cifras enteras de ancho fijo. Volví a renderizar, mezclar y revisar la hoja de contactos.

## Tiempo total

Unos 50 minutos desde el encargo hasta el máster v2:
- 10 min de comprobación de datos y montaje del proyecto;
- 15 min del motor gráfico y las escenas;
- 10 min para adaptar el montaje a la toma del cliente;
- 10 min del sintetizador;
- 5 min de renders y revisión.

Cada render completo tarda unos 5 minutos en este contenedor (4 núcleos).

---

## Notas sobre el contenido

Las afirmaciones son del guion del cliente. Coinciden con las fuentes en lo esencial: el título de constructores de 1983 frente al Audi Quattro, que fue el último coche de tracción trasera en ganar el Mundial, el motor central sobrealimentado por compresor volumétrico Abarth y que Röhrl y Alén eran los pilotos. Hay dos cifras que dependen de la versión:
- **«Más de 300 caballos»** corresponde a la Evolución 2 de 1984 (unos 325 CV).
- **«Menos de mil kilos»**: el peso mínimo homologado (960 kg) que citan algunas fuentes.

La cita de Röhrl no está verificada palabra por palabra.

## Material de terceros

- **Fotografías:** las proporcionó el cliente y no se pudieron ampliar con otras por las restricciones de red del entorno.
- **Maqueta del motor:** obra de Dmitry Golosov (@twdmodelling), con motor de GPmodeling production.
- **Locución:** ElevenLabs, voz «Juan», generada por el cliente (`vo/take.mp3`).
- **Fuentes:** Barlow y Barlow Condensed, de Jeremy Tribby (SIL Open Font License).
