# Peugeot 205 Turbo 16: decisiones de producción

Pieza de 5:42 en 16:9 sobre el Peugeot 205 Turbo 16 para el canal EVO HERITAGE. Lleva la locución del cliente (ElevenLabs, voz «Mario», 5:37), sus 12 fotografías y su logotipo. La música está sintetizada desde cero a 120 BPM y la animación se genera por código y se renderiza fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/peugeot-205-t16.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS integrados y pico real de −1,5 dBTP |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 106 cláusulas del guion con su inicio y su fin en la toma |
| `src/timeline.js` | Duración, secciones musicales ancladas a frases y la función `cut(i)` |
| `src/vo.js` | El mapa de la locución en forma de módulo |
| `src/lib.js` | Curvas, tipografía, bandas de la librea, cortinillas, grano |
| `src/scenes.js` | Las plantillas de plano, los 73 planos y el montaje |
| `audio/music.mjs` | Sintetizador, arreglo, diseño sonoro y máster |
| `scripts/align.py` | Alineador del guion con la toma |
| `scripts/` (resto) | Preparación de fotos, render, mezcla y hoja de contactos |

Para reproducirlo todo:
1. `python3 -I scripts/align.py vo/take16.wav vo/guion.txt out/vo-map.json` (antes, `ffmpeg -i vo/take.mp3 -ac 1 -ar 16000 vo/take16.wav`)
2. `node scripts/vo-js.mjs`
3. `npm run images`
4. `npm run music`
5. `node scripts/render.mjs --to 342`
6. `npm run mix`
7. `npm run contact`

---

## Qué decidí y por qué

### 1. Identidad: la librea Peugeot Talbot Sport y el canal
Los colores salen de las propias fotos del coche (las bandas del capó y los costados): rojo `#D7262D`, azul marino `#26318C`, filete amarillo `#F2C21C` y azul claro `#3E9FD8`, sobre blanco roto y negro. Esas cuatro bandas son el recurso gráfico de todo el vídeo: cortinillas, subrayados y el cierre en papel. No hay más colores ni degradados decorativos.

- **Tipografía:** Saira Semi Condensed en cursiva Black para los titulares (sus formas cuadradas y redondeadas recuerdan los rótulos de los 80) y Saira para el texto de apoyo. Cada vídeo de la serie tiene su familia (Barlow en el Lancia, Archivo en el Audi), pero la rejilla y la jerarquía son las mismas.
- **Canal:** el logotipo de EVO HERITAGE abre el vídeo en una entrada de 2 s y vuelve en la tarjeta final, cuando la voz dice «suscríbete al canal».

### 2. La historia contada con dibujos técnicos
El guion es, sobre todo, una historia de ingeniería, así que la planta del coche dibujada por código es el hilo conductor. Tiene tres configuraciones de motor: el cinco cilindros del Audi colgado por delante del eje, el central longitudinal del Lancia y el central transversal del 205.
- **El cara a cara inicial:** Audi, con tracción total y fuerza bruta, frente a Lancia, con tracción trasera y equilibrio.
- **El análisis de Todt:**
  - el Audi sigue su trayectoria real, que se abre respecto a la ideal por el subviraje;
  - el Lancia patina con las ruedas traseras en nieve y barro;
  - **las dos plantas se funden en la del 205** («lo mejor de ambos mundos»);
  - la barra del reparto de pesos se equilibra al centro.
- **El motor:** gira de longitudinal a transversal («¿Por qué transversal?»), luego se ve el espacio para la caja y la transmisión, y una cota marca el coche «corto y ratonero».
- **Para el Dakar,** el chasis se alarga ante la cámara y aparecen los depósitos de gasolina.

Hay además otros gráficos propios:
- un **motor de 4 cilindros** con orden de encendido 1-3-4-2;
- el **turbo** con desenfoque de giro;
- la **gráfica del retraso del turbo** (el acelerador en escalón y la presión que llega un segundo tarde, con la cota «1 segundo» y la marca de la curva);
- el **manómetro** hasta 2,5 bar;
- los **contadores** de 350 → 500 caballos, 910 kilos y 20 minutos;
- la **ruta París–Dakar**;
- **Pikes Peak** (las crestas y la carretera de herraduras del vídeo del Audi, como guiño de serie);
- unas **dunas** con ruido con semilla;
- tarjetas genéricas para los **dos títulos de pilotos y los dos de constructores**.

La interfaz que aparece (el cheque en blanco, «Me gusta», «Suscríbete») es genérica y va en los colores del cliente; no imita la de ninguna marca.

### 3. Fotos: cada una donde mejor cuenta
- **El coche con la zaga abierta** va justo en «se abría como una almeja», con un revelado en arco desde la bisagra. Un recorte del mismo coche muestra el motor en «detrás de los asientos», y en blanco y negro ilustra «prototipos que ya no podían correr».
- **La foto con Shell y el público** lleva anotaciones animadas (faros, parrilla, parabrisas y puertas) en «del coche de calle solo conservaba…».
- **El despiece** se compone sobre papel en modo multiplicar, con sus materiales y, más tarde, con las flechas de carga aerodinámica del Evo 2.
- **Salonen con sus gafas,** en blanco y negro, acompaña la lista «regordete · gafas gruesas · fumador empedernido».
- **Las fotos verticales** (los espectadores en el árbol y el piloto agachado) y **las pequeñas** (el número 4 y el piloto al volante) van en planos partidos, para no ampliarlas más de lo que aguantan.
- **El 205 de calle gris** sale en «un asesino con piel de utilitario» y dentro de las cifras «205».

### 4. Locución: alineada automáticamente, sin tocar la voz
La toma dura 5:37 y entra entera, desplazada 2 s tras la entrada del logotipo. Sin reconocimiento de voz disponible, escribí un alineador (`scripts/align.py`) que hace esto:
1. Detecta los 125 fragmentos de voz y los núcleos silábicos.
2. Cuenta las sílabas de las 106 cláusulas del guion, con los números y siglas en su forma hablada: «doscientos cinco», «ka ka ka», «uno coma ocho»…
3. Las casa por programación dinámica, de modo que cada grupo de cláusulas queda alineado con un grupo de fragmentos.

El recuento global coincide al 96 % (1747 sílabas detectadas frente a 1811 del guion). Todos los cortes del montaje se calculan a partir de ese mapa (`cut(i)` en `timeline.js`): si la toma cambia, el montaje se recoloca solo.

Proceso de voz: pasa-altos a 70 Hz, −2 dB a 250 Hz, +2 dB a 3 kHz, un shelf suave en agudos y una compresión 3:1. La música entra a −11 dB y se comprime con la voz como llave.

### 5. Música y diseño sonoro sintetizados, sin muestras
Es el mismo motor DSP de la serie: osciladores polyBLEP, filtros SVF, batería sintetizada, bajo saturado, arpegio, pads, melodía, Freeverb, delay, sidechain y limitador. Esta vez en **Sol menor** (Solm–Mi♭–Si♭–Fa), con **22 secciones ancladas a frases del guion**:
- entrada del logotipo;
- intro tensa;
- primer drop en «Hoy desentrañamos el mito»;
- análisis en medio tiempo;
- subida y drop en «Nació así el 205 Turbo 16»;
- **sección mecánica con acentos 3-3-2** para la ingeniería;
- groove del Evo 1;
- el drop más pesado en el Evo 2;
- medio tiempo en el retraso del turbo;
- dos **réquiems sin batería**: el accidente de Vatanen y la prohibición del Grupo B;
- triunfo con melodía en los títulos;
- groove del desierto;
- subida a Pikes Peak;
- clímax con melodía en «la perfección del Grupo B»;
- cierre con acorde largo sobre el logotipo.

El diseño sonoro sale de la propia lista de planos: cada transición genera su whoosh y cada golpe de montaje su impacto. Además suenan:
- el **motor de 4 cilindros** al nacer el 205, al debutar, con el Evo 2 y en «misil balístico»;
- el **silbido del turbo con descarga** de la válvula;
- los **petardeos del antilag**;
- en la gráfica del retraso, **el motor sube con el acelerador y el silbido del turbo llega un segundo después**, igual que en el dibujo;
- un golpe sordo cuando se abre la almeja;
- clics en los contadores y en los botones.

### 6. Montaje, determinismo y render
- **Planos y transiciones:** 73 planos con seis tipos de transición: cortes secos con golpe de cámara, barridos horizontales y verticales con desenfoque de 24 muestras, cortinillas con las bandas de la librea, persianas de seis franjas y fundidos (estos solo en los pasajes tristes y reflexivos).
- **Ritmo:** cada corte cae en la rejilla de corcheas, como mucho un cuarto de tiempo antes de su frase.
- **Determinismo:** `seek(t)` dibuja cada fotograma únicamente a partir de `t`, sin `Math.random`, relojes ni estado.
- **Desenfoque de movimiento:** se renderiza a 60 fps en tres pestañas de Chromium y el máster de 30 fps promedia cada par de fotogramas (obturador de 180°).

---

## Qué descarté

- **Recortar o acelerar la voz.** No hacía falta, y las pausas de «Mario» marcan bien el ritmo.
- **Reproducir los logotipos de Peugeot, Audi, Lancia, Ferrari o la FIA.** Las marcas solo aparecen en las fotos reales; los nombres van compuestos en tipografía propia.
- **Dramatizar el accidente de Vatanen** con animaciones de vueltas de campana o efectos. Se cuenta con tipografía sobria sobre negro, fundidos y música sin batería, por respeto. Lo mismo con las tragedias de Portugal y Córcega.
- **Un cronómetro corriendo en los «20 minutos».** El anillo se llena y la cifra sube como dato, no como contador de segundos.
- **Más cifras de las que da el guion,** como cilindradas exactas, tiempos de Pikes Peak o nombres de rallys concretos.
- **Partículas, destellos, aberración cromática y neón.** Era decoración sin función, prohibida en el encargo.

## Correcciones de texto
- **«el antítesis»** (en la locución) aparece en pantalla como «LA ANTÍTESIS DEL ATLETA MODERNO»: *antítesis* es femenino.
- **«1.8 litros» y «2.5 bares»** van en pantalla como «1,8 litros» y «2,5 bares», con coma decimal.

---

## Iteraciones

1. **Encargo sin guion.** Pedí el texto y alineé las 106 cláusulas con el alineador automático. Revisé que cada inicio cayera en un silencio de la toma y que las duraciones fueran coherentes con las sílabas.
2. **v0, un fotograma por plano (73) en dos hojas.** Revisándolas corregí:
   - el despiece, que tenía un filete rojo en los bordes: ahora se recorta;
   - las anotaciones de «faros, parrilla…», que caían sobre el público porque la foto está reescalada ×1,5 y no había corregido las coordenadas;
   - el botón «Suscríbete», que se quedaba debajo de la pregunta final porque la función del botón sobrescribía la opacidad.
3. **Música.** Comprobé la curva de sonoridad cada 6 s (de −24 a −26 dB en los réquiems y el cierre, de −12 a −13 dB en los drops), que no hay NaN y el pico tras el limitador.
4. **v1, render completo (20.520 fotogramas), mezcla y hoja de contactos del máster.** Revisándolos vi:
   - **un resto de descendente** (la «y» de «y diabólica») que quedaba visible cuando un titular salía para dejar paso al siguiente. Lo corregí en el revelado de texto: lo que ya ha salido no se dibuja y la salida sube un 50 % más;
   - **etiquetas solapadas** («ACELERADOR» y «CURVA») en la gráfica del retraso del turbo;
   - **la etiqueta del Lancia** pisaba el dibujo de la planta. La acorté («EL LANCIA 037 ERA ÁGIL») y el resto pasó a texto de apoyo.
5. **v2 por empalme.** En vez de volver a renderizar los 5:42, `scripts/splice.sh` re-renderiza solo los tramos afectados (70,25–83 s y 191,75–201,5 s) y los empalma en el render de 60 fps. Recomprimí el máster a CRF 22 para que baje de los 100 MB que admite GitHub.
6. **v3, último empalme.** En el máster v2 vi que la etiqueta «EL RETRASO DEL TURBO ERA TAN BESTIAL QUE» cruzaba el eje de la gráfica. La partí en etiqueta («EL RETRASO DEL TURBO») y texto de apoyo («era tan bestial que…»), y empalmé solo ese tramo sobre el render v2. Comprobé en el MP4 final los tres planos corregidos y la sonoridad: −14,0 LUFS y pico de −1,5 dBTP. El máster final pesa 71 MB.

## Tiempo total

Unas 2 horas desde el encargo:
- 10 min de análisis de fotos y del audio;
- 10 min del alineador;
- 30 min de las plantillas y los 73 planos;
- 10 min de la música;
- 40 min de render (20.520 fotogramas) y mezcla;
- 25 min de revisión, empalmes y remezcla.

## Notas sobre el contenido

Las afirmaciones son del guion del cliente y coinciden con la historia conocida del coche:
- el debut en 1984;
- el accidente de Vatanen en Argentina en 1985;
- los títulos de Salonen (1985) y Kankkunen (1986), este último tras la anulación del Rally de San Remo que enfrentó a Peugeot y Lancia;
- las victorias en el París-Dakar de 1987 y 1988.

La de 1988 fue de Kankkunen; el guion no dice quién ganó esa edición y en pantalla tampoco se afirma.

## Material de terceros

- **Fotografías:** las proporcionó el cliente en `205 Turbo 16.zip`.
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** ElevenLabs, voz «Mario», generada por el cliente (`vo/take.mp3`).
- **Fuentes:** Saira, de Omnibus-Type (SIL Open Font License).
