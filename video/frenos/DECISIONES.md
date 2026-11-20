# La evolución de los frenos: decisiones de producción

Documental de ingeniería de 10:55 en 16:9 sobre la evolución de los frenos en el rally, para el canal EVO HERITAGE. Usa:
- la locución del cliente (10:49);
- 21 de sus 23 imágenes;
- cinco tramos de su onboard de Grupo B, entre ellos el de a partir del minuto 4, colocado en «Llegaron los años 80 y el Grupo B…», como pidió.

Los mecanismos se dibujan y se animan por código, fotograma a fotograma, con una función `seek(t)`. La música, tranquila, de documental, está sintetizada desde cero. No hay `Math.random` sin semilla.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/frenos.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 195 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de freno, motor 3D, 70 planos y montaje (montado desde `out/tmp/*.js`) |
| `src/timeline.js`, `src/vo.js` | Tiempos, secciones de la música y mapa de la locución |
| `scripts/clips.json` | Los cinco tramos del onboard |
| `audio/music.mjs` | Arreglo y diseño sonoro; los instrumentos están en `video/musica/synth.mjs` |
| `scripts/mix.mjs` | Mezcla: voz, música (que baja en los onboards) y sonido real del coche |

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

### 1. Una biblioteca de frenos que funciona de verdad
El cliente pidió explicar los frenos, «su composición y su funcionamiento, y todo», con mucho detalle. Antes de montar planos escribí los componentes (`out/tmp/brakes.js`), cada uno con su física:
- **Disco visto de frente:**
  - anillo de fricción con huellas de mecanizado, campana con flotantes y tornillería;
  - taladros en tres filas al tresbolillo, aletas visibles en el canto de los ventilados y textura de carbono;
  - grietas por choque térmico que nacen en el borde y avanzan hacia dentro.
- **Color según la temperatura:** el color es el de la incandescencia del hierro, de gris a rojo oscuro, rojo, naranja y amarillo, todos colores de la marca. El calor nunca es decorativo: cuanto más claro, más caliente.
- **Pinza en sección, la anatomía del freno:**
  - disco, pastillas (placa de acero y material de fricción), pistones con su retén, cilindros, líquido y el puente con el paso de líquido de un lado a otro;
  - es una sola función con parámetros, así que el mismo dibujo enseña el apriete, el colchón de gas del fade de pastillas, las burbujas del líquido hirviendo, el recorrido del calor (disco → pastilla → pistón → líquido), el canal de un disco ventilado con el aire entrando frío por el buje y saliendo caliente por el borde, los canales de agua, la pinza que se abre bajo presión y el pistón de titanio hueco y perforado.
- **Freno de tambor en corte:**
  - zapatas con forro, mesa y alma, que giran sobre su anclaje inferior, el bombín con dos pistones y los muelles de retorno;
  - al dilatarse, el tambor crece y el ángulo máximo de las zapatas ya no alcanza: la holgura aparece sola, no está dibujada aparte.
- **Llanta, neumático y disco a escala real en milímetros:** 18″ = 457 mm y 15″ = 381 mm. Por eso un disco de 380 mm «simplemente no cabe» en una llanta de 15″, y se ve con las medidas de verdad.
- **Turbofan:** tapa de aspas curvas que gira con estela y el aire caliente extraído en espiral.
- **Tracción total en planta:**
  - el diferencial central se separa en dos mitades al desacoplarse;
  - las ruedas están en amarillo cuando traccionan y en rojo cuando están bloqueadas;
  - se ven la línea hidráulica trasera y el sensor de presión con su señal a la centralita.
- **Otros esquemas:**
  - pedal con su vástago y el suelo;
  - pedal box con dos bombas y una barra basculante cuyo pivote se desplaza y cambia el reparto;
  - circuito de refrigeración por agua: depósito, bomba eléctrica, pinza y radiador;
  - fresado CNC por pasadas;
  - frenada regenerativa en el eje trasero con la batería;
  - gráfica de *blending*: el par eléctrico más el hidráulico da siempre la misma curva, «lo que siente el pie».

### 2. Los onboards del cliente
- **El tramo del minuto 4** abre el capítulo del Grupo B: 13 s a velocidad real, bajo «Llegaron los años 80 y el Grupo B multiplicó la potencia…».
- **Más tramos repartidos por el vídeo:**
  - «los frenos no sirven para ir despacio» (1:00);
  - «bombear el freno a 150 por hora» (1:40);
  - «tras una recta larga bajo la lluvia… los discos se enfriaban», con lluvia de verdad en el parabrisas (2:28);
  - **el final**, «Cualquiera puede pisar el acelerador a fondo…», con 15 s del onboard (5:28).
- **La marca de agua de Duke (petición del cliente):**
  - del vídeo solo uso la imagen 4:3 central (sin las bandas laterales desenfocadas);
  - recorto 40 px a la derecha y 44 px abajo, así que la esquina inferior derecha no sale nunca;
  - además, el encuadre 16:9 recorta otra parte por abajo;
  - el rótulo DUKE del final del vídeo original no se usa.
- **Calidad del original:** es de 360p. Se escala con lanczos y un enfoque suave, y en cámara lenta se funden dos fotogramas vecinos.

### 3. El sonido del coche en los onboards
Lo mismo que en las cajas, ya con el ajuste que pidió el cliente:
- en cada tramo suena el **audio real del onboard, el mismo trozo** que la imagen. La mezcla lee las ventanas directamente del montaje, así que no pueden desincronizarse;
- la música baja unos 10 dB en esos tramos;
- la música de fondo está 3 dB más baja en todo el vídeo, como pidió en las cajas;
- la voz no se toca. El coche entra 6 dB más bajo que en las cajas porque este onboard está grabado más fuerte.

### 4. Identidad
- **Tipografía y rejilla:** Red Hat Display y la misma rejilla de la serie (margen de 140 px). Texto a la izquierda y mecanismo a la derecha.
- **Colores con significado:**
  - **rampa de incandescencia = temperatura**;
  - **azul = aire frío, líquido de frenos y agua**;
  - **amarillo = tracción y rótulos**;
  - **rojo = bloqueo, peligro y prohibición**.
- **Capítulos:** cada época abre con una foto y una regla inferior: años 60, 70, 80, 90, 2000 y hoy.

### 5. Música, distinta de la de las cajas
El cliente pidió que cada vídeo tenga su música. Esta va en **Mi menor**:
- **pads cálidos, un pulso de cuerdas pulsadas y una sola nota de piano por compás**, en lugar del piano en arpegios y las campanas 3-3-2 de las cajas;
- en las partes técnicas, el pulso pasa a corcheas y entra una campana grave;
- en cada época, un leve crecimiento;
- **diseño sonoro sincronizado:** la subida cuando la velocidad se convierte en calor, el disco que se raja, el sello «PROHIBIDOS», el tirón del freno de mano, el diferencial que se abre y se cierra de golpe, y el botón de suscribirse.

---

## Qué descarté

- **Calcular la energía en pantalla:** ½·m·v² con 1.200 kg y 190 km/h da 1,67 MJ. Repartido en dos segundos no coincide exactamente con los «más de 2.000 caballos» del guion, así que muestro solo las cifras del guion, sin operación.
- **Valores inventados en las gráficas:**
  - los ejes de capacidad de frenada, temperatura, par y fuerza no llevan números;
  - solo aparecen las cifras del guion: 400° y 1.200° en la gráfica del carbono, y 400° en la temperatura del tramo.
- **Dos imágenes del ZIP:**
  - la del sistema de frenos con marca de agua de Shutterstock;
  - una infografía duplicada del Rally1.
- **El logotipo de Duke y el mapa inicial del onboard.**
- **Interfaces de marcas reales:** la centralita, el reparto de frenada y los diagramas son genéricos, con los colores del canal. Las marcas que se citan (AP Racing, Brembo, Subaru, Ford, Citroën, Xtrac) aparecen solo como texto, porque las nombra el guion.

---

## Iteraciones

1. **Material:**
   - revisé las 23 imágenes en una hoja numerada y el vídeo entero, un fotograma cada 4 s;
   - analicé de 4:00 a 4:24 segundo a segundo;
   - busqué la marca de agua: medí la esquina inferior derecha en 9 momentos y la imagen media del vídeo.
2. **Guion:** el texto no llegó con el primer mensaje y desde aquí no se puede transcribir el audio, así que lo pedí. Alineación: 195 cláusulas, 3.425 sílabas detectadas frente a 3.513 del guion.
3. **Comprobación automática:** recorrí toda la línea de tiempo (cada 0,37 s) buscando errores y encontré uno: una curva de animación que no existía (`ease.in`) en el plano del diferencial.
4. **v0, un fotograma por plano (70).** Corregí:
   - **las secciones ampliadas** (fade de pastillas, burbujas y titanio), que pisaban el titular: ahora la ampliación se ancla a la derecha y un velo protege la columna de texto;
   - **la vista explosionada,** que separaba demasiado las piezas: ahora es una separación ligera y más grande;
   - **las barras de potencia,** que eran confusas (una barra cruzaba el eje): ahora salen las dos del mismo origen, a escala, 500 frente a 2.000;
   - **rótulos que se salían por la derecha:** pinza de 6 pistones, flanco alto, balance bar y colchón de gas;
   - **el trineo,** que se iba fuera del cuadro;
   - **el depósito,** cuyo rótulo cruzaba la tubería;
   - **la frase del freno de mano,** que invadía la foto.
5. **v1:** fotogramas de los 70 planos revisados de nuevo y render completo a 60 fps, mezcla y hoja de contactos.
6. **El render se cortó** en el fotograma 15.840 de 39.300 (el navegador se cerró). Lo cambié a **tramos de 60 s**, cada uno en su propio proceso con hasta tres intentos, que luego se unen sin recodificar. Así un fallo solo obliga a repetir un minuto.
7. **v2, revisión del último instante de cada plano.** La v1 miraba un fotograma por plano, pero algunos subtítulos aparecen tarde. Al revisar el final de los 70 planos encontré:
   - en la frenada regenerativa y en el desacoplamiento del diferencial, el subtítulo tocaba el dibujo del coche: lo acorté («Actúa como un generador», «La centralita desacopla el diferencial»);
   - en el pistón de titanio, «ESCUDO TÉRMICO» quedaba sobre el disco incandescente y «800°» casi en el borde inferior: los recoloqué y desplacé la sección a la derecha para dejar aire al titular.

   Volví a renderizar solo los dos minutos afectados.
8. **Peso:** a CRF 22 el máster pesaba 118 MB, por encima del límite de 100 MB de GitHub. Lo codifiqué a CRF 24 desde el máster intermedio a 60 fps (calidad casi sin pérdidas), no desde el MP4 ya comprimido.

## Tiempo total

Unas 5 horas desde el encargo:
- 30 min de material y alineación;
- 1 h 45 min de los componentes y los 70 planos;
- 30 min de revisión y correcciones;
- 15 min de música y mezcla;
- unos 80 min de render y 30 min más de la revisión v2, el render parcial y la mezcla final.

## Material de terceros

- **Fotografías y vídeo de onboard:** los proporcionó el cliente (`imagenes_frenos.zip`, `videoplayback.zip`).
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (ElevenLabs).
- **Fuente:** Red Hat Display, de Red Hat (SIL Open Font License).
