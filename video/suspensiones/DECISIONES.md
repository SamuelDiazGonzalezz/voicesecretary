# La evolución de las suspensiones: decisiones de producción

Documental de ingeniería de 6:40 en 16:9 sobre la evolución de las suspensiones en los coches de rally, para el canal EVO HERITAGE. Usa:
- la locución del cliente (6:35);
- sus 11 imágenes;
- siete tramos de su vídeo de saltos del Rally de Polonia 2015. La entrada es el salto del segundo 31.

La música, tranquila, de documental, está sintetizada desde cero a 120 BPM. Todos los esquemas de ingeniería se dibujan y se animan por código, fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/suspensiones.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 132 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de suspensión, simulación, motor 3D, 68 planos y montaje |
| `src/timeline.js`, `src/vo.js` | Tiempos, secciones de la música y mapa de la locución |
| `scripts/clips.json` | Los siete tramos de saltos |
| `audio/music.mjs` | Arreglo y diseño sonoro; los instrumentos están en `video/musica/synth.mjs` |

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

### 1. Un documental de ingeniería: los esquemas son el protagonista
El cliente pidió «mucha ingeniería» y explicada con detalle. Por eso cada mecanismo que nombra la voz está dibujado y animado con su funcionamiento real, no como icono:
- **Amortiguador monotubo en sección:**
  - cuerpo con paredes rayadas;
  - aceite;
  - pistón con orificios;
  - vástago con sus anclajes.

  El vástago sube y baja, y unas flechas muestran el aceite pasando por los orificios en el sentido correcto: hacia arriba al comprimir y hacia abajo al extender.
- **Calentamiento y cavitación:** el aceite pasa del ámbar al rojo oscuro mientras sube el termómetro. Con «cavitación» aparecen burbujas en la cara de baja presión del pistón.
- **Sobre los muelles puros:** una masa sobre un muelle sin amortiguación, con su oscilación calculada (amortiguamiento del 4 %) y su gráfica.
- **Ejes rígidos y ballestas:** el eje visto desde atrás inclina las dos ruedas a la vez cuando una pisa un bache. La ballesta, de perfil, flexiona sus hojas con ojo, gemela y abarcones.
- **Doble amortiguador por rueda:** uno solo se recalienta (y cavita); dos se reparten el trabajo y se quedan templados.
- **Dobles triángulos:** cinemática real del cuadrilátero articulado. El brazo inferior gira, la rótula superior se calcula por intersección de circunferencias y la caída de la rueda se mide en pantalla (−1,6° en reposo, hasta −4,2° al comprimir, porque el brazo superior es más corto). Después llega la fuerza G lateral sobre la huella.
- **MacPherson:** brazo inferior y columna telescópica hasta la copela, con el muelle concéntrico.
- **Depósito remoto:**
  - cilindro externo unido por un latiguillo con malla trenzada dibujada hilo a hilo;
  - dentro, aceite, pistón flotante y nitrógeno;
  - el volumen que desplaza el vástago al entrar empuja el pistón flotante y comprime el gas.
- **Con presión, el aceite no hierve:** los dos amortiguadores a la misma temperatura. El de la izquierda cavita; el del nitrógeno, no. Después, la gráfica de amortiguación por kilómetro, con la marca del **km 41**.
- **La masa no suspendida:** el **modelo de cuarto de coche**, el esquema clásico de la ingeniería de suspensiones (masa suspendida, muelle y amortiguador, masa no suspendida y neumático), **simulado de verdad** con gravedad, precarga y un neumático que solo empuja. Sobre los mismos baches, la rueda pesada despega (su gráfica de agarre toca cero) y la ligera no. Comprobado numéricamente: 1,2 s en el aire de cada 20 s frente a 0.
- **MacPherson invertido:** la columna gira 180° («le dieron la vuelta»). Montada en el coche, lo que se mueve con la rueda se pinta en rojo (masa no suspendida). Después, la comparación de rigidez: con la misma fuerza lateral, la convencional flexa y la invertida casi no.
- **Sobre los agujeros:** el coche avanza sobre baches con la carrocería en una línea de referencia nivelada mientras las ruedas bajan al fondo.
- **Taco de goma frente a tope hidráulico:**
  - el amortiguador hace tope contra la goma, con la onda del golpe y la curva fuerza-recorrido con su pico;
  - luego, la copa cerrada con agujeros minúsculos y el pistón secundario, que entra en los últimos 3–4 cm con chorros de aceite, y la curva progresiva frente a la de goma;
  - el área bajo la curva se llena: la energía absorbida que se disipa como calor.
- **Control de rebote:**
  - el coche en el aire con su válvula, que se abre cuando la rueda cuelga;
  - el cuarto de coche sobre un agujero, simulado sin y con la válvula de rebote: la rueda pasa de 0,50 s a 0,09 s en el aire y la carrocería se mueve menos.
- **Rally1:** el perfil del coche con las baterías (+100 kg), el alerón en discontinua (aerodinámica recortada) y la caja de cambios. Después, las cargas que acaban en las ruedas.
- **Ordenadores analógicos de fluidos:** la pila de láminas del pistón, que se dobla con el caudal, y un panel genérico de ajuste con las tres filas del guion: piloto, rally y clima.
- **Los recorridos de suspensión** forman una serie: la misma rueda con su cota, y una regla que crece de época en época (10–15 cm, más de 25 cm, más de 30 cm).
- **Escondido detrás de las llantas:** una llanta de radios que gira y se vuelve translúcida hasta dejar ver el muelle y el amortiguador.

### 2. Estructura por épocas
El guion es una línea de tiempo, así que el vídeo también lo es. Cada época abre con un capítulo (foto o salto real oscurecido, época y titular) y una regla inferior que marca dónde estamos: años 70, Grupo B, Grupo A, WRC 1997 y hoy.

### 3. Los saltos del cliente
- **Entrada:** el tramo de 0:28,4 a 0:33,6. Es el salto más cercano al segundo 31: el Polo WRC despega frente al público, aterriza y pasa junto a la cámara. Justo después, otro coche corona un cambio de rasante.
- **Cámara lenta:** va al 72 % de velocidad, con su sonido ralentizado bajo la voz.
- **Otros seis saltos** van donde el guion habla de la suspensión más forzada: «volar 50 metros», «los saltos se multiplicaron», el capítulo de los World Rally Cars, «algo antinatural», «vuela nivelado, aterriza sin rebotar» y el cierre.
- **Fundido de fotogramas:** el vídeo es de 25 fps, así que a cámara lenta se funden dos fotogramas vecinos para que el movimiento no salte.
- **Sin marcas de agua:** los tramos elegidos no llevan ninguna. El rótulo final del vídeo («J-Records») queda fuera.

### 4. Identidad
- **Tipografía:** Overpass, una letra derivada de la rotulación de carreteras, técnica y legible. Es nueva en la serie.
- **Colores con significado, constantes en todo el vídeo:**
  - **ámbar = aceite** (y rojo oscuro cuando se quema);
  - **azul = nitrógeno**;
  - **rojo = masa no suspendida e impactos**;
  - **naranja = calor y fuerzas**;
  - **amarillo = muelles, cotas y rótulos**.

  Las franjas del logotipo aparecen en la entrada y en las cortinillas.

### 5. Música
Tranquila, como pidió el cliente: Do menor, piano en arpegios lentos y cuerdas de fondo. En las partes técnicas entran unas campanas FM en patrón 3-3-2, como un mecanismo de precisión, y un tic casi inaudible. En cada cambio de época hay solo un leve crecimiento: platillo invertido, caída de subgrave y un taiko lejano. La sonoridad es estable, sobre −19 dB, y bajo la voz va a −10 dB con compresión por la voz.

El diseño sonoro acompaña a los esquemas: un golpe seco cada vez que el amortiguador hace tope contra la goma, un siseo progresivo en el tope hidráulico, el vuelo y el aterrizaje del salto de 50 m y los botones del canal.

---

## Qué descarté

- **La foto del chasis tubular con amortiguadores King.** Es de un vehículo todoterreno de desierto, no de un coche de rally, y la voz habla de estructuras de titanio. Usarla habría inducido a error.
- **Cifras inventadas.** No hay fuerzas, temperaturas ni presiones con número en los ejes. Las cifras son las del guion:
  - 50 m y 160 km/h;
  - 10–15 cm, más de 25 cm y más de 30 cm;
  - 250 y 500 CV;
  - km 40 y km 41;
  - 3–4 cm;
  - +100 kg.

  La caída que se muestra sale del propio dibujo cinemático.
- **Animar las ruedas «a ojo»** en el cuarto de coche. Si el vídeo dice que la rueda pesada pierde agarre, tiene que perderlo en la simulación, no por decisión del animador.
- **Superponer trayectorias dibujadas sobre el vídeo real:** la perspectiva de la cámara no coincidiría. La parábola de los 50 m va en su propio esquema.

---

## Iteraciones

1. **Material:** revisé las imágenes (con zoom en las que parecían de tienda, por si tenían marcas de agua: no las tienen) y el vídeo en hojas de contactos, y el entorno del segundo 31 cada cuarto de segundo.
2. **Alineación:** 132 cláusulas, 2094 sílabas detectadas frente a 2157 del guion.
3. **Comprobación automática:** recorrí la línea de tiempo cada 0,5–0,7 s buscando errores de ejecución antes de cada render.
4. **v0, un fotograma por plano (68).** Corregí:
   - **el modelo de cuarto de coche,** que no aparecía: sin gravedad, el primer bache lanzaba el coche hacia arriba para siempre. Añadí la gravedad y la precarga estática y comprobé los resultados numéricamente;
   - **los dobles triángulos,** que salían con la mangueta invertida: la intersección de circunferencias elegía la solución equivocada. Ahora se elige la rótula superior por encima de la inferior. También ajusté las longitudes de los brazos para una caída realista;
   - **el bache con y sin válvula,** que al principio apenas se diferenciaban. Afiné la profundidad del bache y la amortiguación hasta un contraste claro;
   - **el tamaño de los esquemas:** amortiguadores, ballestas, rueda de recorrido, MacPherson y comparaciones eran demasiado pequeños para leerse. Los amplié entre un 25 y un 40 %;
   - **los rótulos del MacPherson invertido,** que se cruzaban con el titular: el titular baja.
5. **La carrocería del coche (aviso del cliente: «la carrocería del coche es muy rara»):** la silueta tenía el capó caído, el techo raro, ruedas pequeñas y el faldón inclinado (los pasos de rueda empezaban en un punto equivocado). La rehíce con las proporciones de un WRC compacto: unas 6 veces el diámetro de la rueda de largo y 2 de alto, parabrisas inclinado, techo plano, portón casi vertical con alerón de techo, pasos ensanchados y ruedas mayores. Después el cliente pidió el coche «un poco menos largo»: lo acorté un 10 % (la batalla y la carrocería; la altura y las ruedas, igual). En una segunda indicación («el chasis por la parte de alante está un poco más bajo que la rueda; el capó, y acórtalo un poco más») subí el morro y el capó para que cubran el paso de rueda delantero y lo dejé en el 82 % de la longitud inicial y volví a renderizar solo los cinco planos en los que aparece, empalmándolos en el render completo.
6. **v1, render completo (24.000 fotogramas a 60 fps), mezcla y hoja de contactos del máster.**

## Tiempo total

Unas 3 horas y media desde el encargo:
- 30 min de material, saltos y alineación;
- 1 h 30 min de los componentes de ingeniería, la simulación y los 68 planos;
- 30 min de revisión y correcciones;
- 15 min de la música;
- unos 70 min de render y mezcla.

## Material de terceros

- **Fotografías y vídeo de saltos:** los proporcionó el cliente (`imagenes_video_suspensiones.zip`, `WRC_72.Rally_Poland_2015_-_Jump_Compilation_1_1.mp4`).
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (`vo/take.mp3`).
- **Fuente:** Overpass, de Delve Withrington y Red Hat (SIL Open Font License).
