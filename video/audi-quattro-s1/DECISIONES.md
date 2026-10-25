# Audi Sport Quattro S1: decisiones de producción

Pieza de 2:30 en 16:9 sobre el Audi Sport Quattro S1, con la locución del cliente (ElevenLabs, voz «Mario»). La música está sintetizada desde cero a 120 BPM y la animación se genera por código y se renderiza fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/audi-quattro-s1.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS integrados y pico real de −1,5 dBTP |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 3 s del máster |
| `src/timeline.js` | Las 39 frases con su tiempo, las secciones musicales y los golpes |
| `src/lib.js` | Curvas, tipografía, bandas de la librea, cortinillas, grano |
| `src/scenes.js` | Los 39 planos, los gráficos técnicos y el montaje |
| `audio/music.mjs` | Sintetizador, arreglo, diseño sonoro y máster |
| `scripts/` | Preparación de fotos, render, mezcla y hoja de contactos |

Para reproducirlo todo: `npm install`, `npm run images`, `npm run music`, `node scripts/render.mjs --to 150`, `npm run mix` y `npm run contact`.

---

## Qué decidí y por qué

### 1. Identidad: la librea HB Audi Team, no los logotipos
La paleta sale de la carrocería del S1 E2: blanco roto, negro, amarillo `#F2B415`, naranja `#E35A26` y marrón `#5E2C22`. El recurso gráfico principal son las bandas naranja y marrón del capó separadas por un filete blanco, y en las cortinillas llevan delante el bloque amarillo de los bajos. No hay ningún otro color ni degradado decorativo. Los aros de Audi solo aparecen donde ya están en las fotos reales; los rótulos se componen en tipografía propia.

- **Tipografía:** Archivo Expanded Black Italic para los titulares (la grotesca ancha y en cursiva recuerda la rotulación de competición de los 80, y la distingo a propósito de las condensadas habituales) y Archivo para el texto de apoyo. Son fuentes libres (OFL).
- **Rejilla 16:9:** margen de 140 px. Los titulares van a la izquierda: en las fotos del coche, arriba, sobre el cielo, para no tapar el coche; en los esquemas, en una columna de 640 px con el gráfico a la derecha. Cada plano lleva un solo mensaje, con como mucho etiqueta, titular y apoyo.

### 2. Los gráficos cuentan la ingeniería
Toda la mecánica del guion se explica con dibujos técnicos animados por código, con estética de ficha técnica:
- **Planta del coche:** el motor de cinco cilindros va colgado por delante del eje delantero, y la caja, los diferenciales y los árboles están dibujados. Se usa para:
  - tracción trasera, la «norma» de la época;
  - el 4×4 «pesado y complejo», con los árboles en gris;
  - la potencia llegando a las cuatro ruedas, en amarillo;
  - el acortamiento de la batalla, con una cota que encoge;
  - el reparto de pesos, con una barra que se carga hacia delante;
  - la transferencia de peso al girar.
- **Motor de 5 cilindros en línea** visto de lado. El cigüeñal tiene las muñequillas a 144°, los pistones se mueven con biela real y las explosiones siguen el orden de encendido de verdad: 1-2-4-5-3.
- **Turbo:** rueda del compresor con doce álabes (seis completos y seis intermedios) y desenfoque de giro calculado a partir de la velocidad angular.
- **Contador de potencia** con cifras de ancho fijo: 0 → 500 («oficialmente») y, cuando la voz dice «rozaba los 600», se vuelve naranja y sube a 600.
- **Velocímetro genérico 0–100 km/h** que barre hasta la marca de 100 y entonces aparece «3,1 s». Es un dato del guion, no un cronómetro.
- **Caja de doble embrague:** embrague exterior para las impares y el interior para las pares, alternándose a cada cambio (1 → 6).
- **Selector P R N D genérico** para «la tecnología que hoy usamos a diario». Es interfaz inventada con los colores del cliente, no la de ninguna marca.
- **Carga aerodinámica** sobre el despiece del cliente: corrientes de aire y flechas que empujan hacia abajo mientras el coche baja unos píxeles.
- **Pikes Peak:** macizo y crestas en capas con ruido con semilla, la carretera en herraduras dibujándose hasta la cumbre con el coche como punto de luz y bancos de nubes a la deriva.

### 3. Montaje a 120 BPM
Hay 39 planos con 21 transiciones de seis tipos:
- cortes secos con golpe de cámara;
- barridos horizontales y verticales con desenfoque de movimiento de 24 muestras;
- cortinillas diagonales con las bandas de la librea;
- persianas de seis franjas;
- fundidos (solo al bajar la tensión: «monstruo», la ruptura, el habitáculo y el réquiem del Grupo B);
- un zoom a través del «1» de «S1 E2» con la foto dentro de las letras.

Cada corte cae en la rejilla de corcheas y entra como mucho medio tiempo antes de la frase que ilustra. Las secciones musicales empiezan en tiempos de la rejilla y los grandes golpes coinciden con ellas: «Audi ignoró a todo el mundo», «S1 E2», «Era una bala», el réquiem del Grupo B, el clímax y el cierre.

### 4. Locución: la toma del cliente, sin tocar
La toma de «Mario» dura 2:28, así que cabe entera en 2:30. No se recorta ni se acelera: solo se desplaza 0,5 s para que el primer fotograma ya esté en pantalla. Sin reconocimiento de voz disponible, localicé las 39 frases del guion detectando silencios y contando núcleos silábicos de cada fragmento; el recuento casa con el texto con un error de ±3 sílabas. Esos tiempos (`VO` en `timeline.js`) gobiernan cuándo entra cada texto.

Proceso de voz: pasa-altos a 70 Hz, −2 dB a 250 Hz, +2 dB a 3 kHz, un shelf suave en agudos y una compresión 3:1. La música entra a −11 dB y se comprime con la voz como llave.

### 5. Música y diseño sonoro sintetizados, sin muestras
Es el mismo motor DSP que escribí para el spot del Lancia: osciladores polyBLEP, filtros de variable de estado, batería sintetizada, bajo saturado, arpegio, pads, melodía, Freeverb, delay ping-pong, sidechain y limitador. Esta vez con arreglo, tonalidad y diseño sonoro nuevos, todo con PRNG con semilla.

- **Tonalidad y progresión:** Mi menor, i–VI–III–VII (Mim–Do–Sol–Re).
- **Forma, en 12 secciones que siguen la narración:**
  1. intro tensa;
  2. groove A;
  3. drop en «Audi ignoró a todo el mundo»;
  4. ruptura sin batería en «Audi tuvo que mutar»;
  5. el drop más pesado en «S1 E2»;
  6. una **sección mecánica con acentos en grupos de cinco semicorcheas sobre el 4/4**, el ritmo de un cinco cilindros, bajo «el mítico motor»;
  7. medio tiempo oscuro para los pilotos;
  8. «Era una bala», con la sección más rápida;
  9. **réquiem** sin batería cuando se cancela el Grupo B;
  10. subida con toms hacia Pikes Peak;
  11. clímax con melodía;
  12. cierre con acorde largo.
- **Diseño sonoro:**
  - **motor de cinco cilindros sintetizado:** cinco explosiones cada dos vueltas con una pequeña diferencia entre cilindros, que da su gorgoteo característico;
  - **turbo** que silba al subir la presión y descarga la válvula justo cuando el contador llega a 600;
  - **petardeos del antilag** en los drops y en cada cambio de la caja de doble embrague;
  - whooshes en cada transición, impactos con subgrave, risers y platos invertidos antes de cada drop, y clics del contador, del selector y del botón final.

### 6. Determinismo y render
- **Función de tiempo:** `seek(t)` dibuja cada fotograma únicamente a partir de `t`, sin `Math.random`, relojes ni estado entre fotogramas. Las fotos opcionales que falten se sustituyen por una alternativa fija, de modo que el render nunca depende del azar.
- **Paralelo:** tres pestañas de Chromium sin interfaz renderizan a 60 fps; los fotogramas se vuelven a ordenar y se envían a ffmpeg.
- **Desenfoque de movimiento:** el máster de 30 fps promedia cada par de fotogramas, como un obturador de 180°.
- **Fotos:** se recortan y reescalan una vez con Lanczos, una máscara de enfoque suave y un etalonaje común, y el grano de película unifica las distintas calidades. El despiece se compone en modo multiplicar para que su fondo blanco se funda con el papel.

---

## Qué descarté

- **Recortar o acelerar la voz.** No hacía falta: la toma cabe entera y sus pausas ya tienen intención dramática.
- **El logotipo de los aros en los rótulos.** Ni en el despiece (lo recorto junto con su rótulo «Audi Quattro S1») ni en el cierre: no se reproducen marcas, solo se muestran en las fotos reales.
- **Interfaz de YouTube para «suscríbete».** Va un botón genérico en el amarillo de la librea, y en «déjalo en los comentarios» no hay ninguna caja de comentarios falsa con texto de relleno.
- **Un cronómetro corriendo en el 0–100.** Se podía confundir con un contador de segundos. El velocímetro barre la velocidad y «3,1 s» aparece como dato fijo.
- **El render blanco (225 px) y la foto del motor de la composición.** Su resolución no aguanta un plano a 1080 p. El motor ya lo cuenta la foto del vano, que es de alta resolución.
- **Cifras que el guion no da:** batalla en milímetros, kilos, el tiempo de Pikes Peak. Lo dibujado ilustra lo que dice la voz.
- **Partículas de polvo, destellos, aberración cromática y neón.** Era decoración sin función, prohibida en el encargo.
- **«2.1 litros» con punto.** En pantalla va «2,1 litros», con coma decimal, que es la norma en español.

---

## Iteraciones

1. **Mapa de la locución.** Detecté 48 fragmentos de voz y los casé por sílabas con las 39 frases del guion.
2. **v0, 43 fotogramas sueltos (uno por plano).** Revisándolos corregí:
   - el revelado de texto, que cortaba los descendentes (la «g» de «ágil» parecía una «a»);
   - las plantas técnicas, que eran pequeñas para 16:9 (de ×0,74 a ×0,9);
   - los titulares sobre la foto del coche, que tapaban la carrocería: ahora van arriba, sobre el cielo;
   - el despiece, que dejaba ver su caja blanca sobre el papel: ahora va en modo multiplicar, con titular en cuatro líneas;
   - la caja de doble embrague, más grande y bajo su titular.
3. **Mutación del coche.** Probé un «morph» de la planta larga a la corta en «Audi tuvo que mutar», pero repetía el plano de la distancia entre ejes. Lo cambié por una cortinilla vertical amarilla en la que el quattro de calle se convierte en el S1.
4. **Música.** Comprobé la curva de sonoridad por secciones (de −24 dB en la ruptura y el réquiem a −12 dB en los drops) y el pico tras el limitador.
5. **v1, render completo, mezcla y hoja de contactos.** En la hoja vi que «Pilotos legendarios» usaba de alternativa la foto del vano motor junto a los nombres. La cambié por un recorte del habitáculo del S1, re-rendericé solo ese tramo (95–101,5 s), lo empalmé y recomprimí el máster a CRF 20 (53 MB) para que quepa en el repositorio.

6. **v2, con las 5 fotos de competición del cliente.** Las coloqué en los planos que tenían reservados y reencuadré cada uno según la foto:
   - **Tramo con polvo (vertical):** en «Agarre invencible» pasa a un plano partido, con la foto a la derecha y el titular sobre tinta. En el clímax va a sangre, encuadrada en el coche y el espectador, con velo para leer el texto.
   - **Röhrl en el habitáculo:** su traje blanco caía justo donde iba el titular, así que «Habilidad sobrehumana» también pasa a plano partido. En «Pilotos legendarios» uso un primer plano de su cara para no repetir el encuadre.
   - **Curva con público en blanco y negro:** tres encuadres distintos (la grada en la apertura, el coche en «quattro» y el plano completo en el réquiem del Grupo B).
   - **Nocturna:** más velo para leer el titular sobre la carrocería.
   - **Nombres de los pilotos:** «Michèle Mouton» se metía bajo la foto; ahora el cuerpo se calcula con el nombre más largo.

   Revisé fotogramas sueltos de cada plano nuevo y volví a renderizar, mezclar y revisar la hoja de contactos.

## Tiempo total

Unos 80 minutos en total:
- 5 min de análisis del audio y del guion;
- 20 min del motor gráfico y los 39 planos;
- 10 min de la música y el diseño sonoro;
- 20 min del render y la mezcla de la v1;
- 25 min de la v2 con las fotos nuevas, de los que 20 son de render.

Cada render completo son 9000 fotogramas, unos 18 minutos en este contenedor (4 núcleos).

## Fotos por plano

| Foto del cliente | Planos |
|---|---|
| S1 E2 «ROC» con cielo de tormenta | «monstruo definitivo», título, «S1 E2», «desproporcionada… pero letal», «Audi tuvo que mutar», cierre |
| En tierra con polvo | «las leyes de la física», «Era una bala» |
| Tramo con polvo y público | «Agarre invencible», «no solo ganó carreras» |
| Curva con público (B/N) | «la era más salvaje», «quattro», «Grupo B cancelado» |
| Nocturna | «kit aerodinámico salvaje» |
| Röhrl en el habitáculo | «Habilidad sobrehumana», «Pilotos legendarios» |
| Quattro de calle verde | «A principios de los 80», «Audi tuvo que mutar» |
| Vano motor | «Bajo el capó de kevlar» |
| Despiece | «aplastar el coche contra el suelo» |

## Notas sobre el contenido

Las afirmaciones son del guion del cliente. Algunas se citan habitualmente con matices:
- **«La norma dictaba que los coches de rally debían ser de tracción trasera»** se refiere a la costumbre de la época, no a un reglamento.
- **El 0–100 en unos 3,1 s** es la cifra que suele darse para el S1 E2 sobre tierra.
- **El récord de Pikes Peak** lo logró Walter Röhrl en 1987 con un S1 E2 evolucionado.

## Material de terceros

- **Fotografías y despiece:** los proporcionó el cliente.
- **Locución:** ElevenLabs, voz «Mario», generada por el cliente (`vo/take.mp3`).
- **Fuentes:** Archivo, de Omnibus-Type (SIL Open Font License).
