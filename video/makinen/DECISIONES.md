# Tommi Mäkinen: decisiones de producción

Documental de ingeniería de 5:59 en 16:9 sobre Tommi Mäkinen y el Mitsubishi Lancer Evolution, para el canal EVO HERITAGE. Usa:
- la locución del cliente (5:53);
- sus 24 imágenes;
- seis tramos de su vídeo de archivo (una retransmisión de Eurosport). La entrada es el tramo de 2:03 a 2:09 que pidió.

La música es el estilo 01 del catálogo (orquestal, Re menor, 120 BPM) en versión tranquila, sintetizada desde cero. Todos los esquemas de ingeniería se generan por código y se renderizan fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/makinen.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 113 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de ingeniería, motor 3D, plantillas, 68 planos y montaje |
| `src/timeline.js`, `src/vo.js` | Tiempos, las cuatro rupturas y mapa de la locución |
| `scripts/clips.json` | Los seis tramos del vídeo de archivo con su recorte |
| `audio/music.mjs` | Arreglo y diseño sonoro; los instrumentos están en `video/musica/synth.mjs` |
| `scripts/` | Alineador, preparación del material, render, mezcla y hoja de contactos |

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

### 1. Identidad propia dentro de la serie
Cada documental del canal tiene su tipografía y su color, para que la serie no sea una plantilla repetida:
- **Tipografía:** Titillium Web, una letra de rotulación técnica muy ligada al automovilismo, recta y legible.
- **Colores con significado:**
  - **rojo Mitsubishi Ralliart** para el coche y los momentos de victoria;
  - **azul hielo** para Mäkinen como piloto: la «mirada de hielo», la precisión nórdica, los diferenciales activos que él calibraba;
  - **naranja** solo para el «fuego» de McRae;
  - **azul Subaru** solo para su etapa en Subaru;
  - las franjas rojo, naranja y amarillo del logotipo en las cortinillas y bajo los titulares.

### 2. El vídeo de archivo, limpio
El vídeo del cliente es una retransmisión de televisión de 640×360 y lleva tres elementos ajenos: la mosca de Eurosport, la marca «@rosmanao» del usuario que lo subió y los rótulos de tiempos. El encargo prohíbe marcas de agua, así que:
- revisé cada tramo fotograma a fotograma;
- le di a cada uno un recorte fijo que deja fuera esos elementos (`scripts/clips.json`);
- lo escalé 2× con reducción de ruido suave.

Elegí seis tramos: la entrada, la toma aérea del bosque, el derrape entre polvo, el coche de frente con «TOMMI» en el parabrisas, el coche acercándose por la pista y la entrevista dentro del coche.

En **la entrada (2:03 a 2:09)**, el primer segundo y medio aún lleva el panel de información de la cadena. En lugar de cortarlo, el encuadre empieza cerrado sobre el bosque y **se abre como un movimiento de cámara** justo cuando el panel desaparece y entra el coche. Va a cámara lenta (0,9×), con su sonido real también ralentizado, mientras la voz dice «Campeones… Leyendas…».

Los fotogramas de cada tramo se cargan solo mientras se usan, para que el render no agote la memoria.

### 3. La ingeniería, contada con dibujos propios
Cada idea técnica del guion tiene su componente dibujado por código:
- **Mapa de Finlandia** con su costa y sus fronteras reales (en esquema), Puuppola marcada y, más tarde, el mapa ampliado con la victoria en los 1000 Lagos.
- **Tractor forestal** en línea, con barras de agarre en barro y en hielo, para «bestias pesadas sobre hielo y barro». Son proporciones, sin cifras inventadas.
- **Una línea que no es recta** para «la historia de Mäkinen no fue una línea recta», junto a la recta que no siguió.
- **Piloto y máquina,** dos círculos que se funden en uno.
- **Grupo A frente a World Rally Car:** dos vistas frontales a la misma escala; la del WRC se ensancha con «chasis ensanchados».
- **La carrocería del coche de calle:** el perfil del Evo de rally con alerón, faldillas y faros, y encima, en discontinua, el coche de serie: el mismo contorno.
- **El 4G63** sobre la foto del cliente, con la culata y el turbo señalados.
- **Diferenciales activos:** la planta del Evo tumbada en perspectiva 3D, con motor transversal y los tres diferenciales (los dos activos en azul hielo, latiendo). El par fluye a las cuatro ruedas y el reparto cambia en tiempo real.
- **Calibración:** una interfaz genérica, con los colores del canal, en la que la curva del diferencial central se dobla mientras el coche rota en la esquina.
- **De 1996 a 1999:** una regla de años con los cuatro títulos marcados y, en la ruptura, los cuatro años golpeando uno tras otro.
- **Fuego contra hielo** y **dos trazadas en la misma curva:** la de McRae, abierta, con los coches cruzados en derrape; la de Mäkinen, ceñida y limpia.
- **1998 en Gran Bretaña:** la planta del Evo pisa la mancha de aceite y la rueda trasera sale despedida. Después, el Corolla de Sainz se para a 300 m de la bandera, con la cota.
- **Una llamada telefónica:** un teléfono de hotel en línea, que suena (y se oye).
- **El pie izquierdo en el freno:** el pedalier con los dos pies y las señales de acelerador a fondo y de freno modulado. Después, la planta con el círculo de agarre de cada rueda; la tracción va siempre a la que más agarre tiene.
- **En tres ruedas,** el final del Grupo A en la regla de años y **las 24 victorias** contadas una a una.

### 4. Música: el estilo 01, tranquilo
El cliente eligió el estilo 01 del catálogo (cuerdas, metales y taikos) en versión tranquila:
- **Casi todo el vídeo** lleva solo cuerdas, con un ostinato grave muy suave en las partes técnicas.
- **La historia de 1998** tiene una sección de tensión con corcheas obsesivas.
- **Solo cuatro rupturas,** calculadas sobre el instante exacto de la voz: «Cuatro mundiales consecutivos», «Cuatro campeonatos del mundo consecutivos», «tricampeón» y «voluntad de hierro». En cada una entran los taikos a pleno, el tema heroico en los metales, el plato y un golpe de cámara.
- **Sonoridad medida:** unos −24 dB en la calma, −21 dB en el pulso, −18 dB en la tensión y −12 dB en las rupturas.

En la mezcla la música va a −11 dB, comprimida con la voz como llave. El sonido del archivo va a −15 dB, también comprimido con la voz.

---

## Qué descarté

- **La foto del tractor.** Es una imagen de banco de imágenes con la marca de agua de Shutterstock impresa. El encargo prohíbe las marcas de agua, así que el tractor está dibujado por código.
- **La firma y el patrocinador de la foto del Escort** (era una tarjeta de autógrafos). Uso solo la parte de la foto y la encuadro para dejar fuera la firma.
- **El rótulo «GT» de la foto del Evo III blanco.** Queda fuera del encuadre.
- **El audio de los otros tramos de archivo.** Puede llevar comentarios de la retransmisión que chocarían con la voz.
- **Inventar cifras:** no hay potencias, pesos ni repartos de par numéricos. Los diagramas muestran proporciones y el guion pone las cifras: 30 años, 1000 Lagos, 1994, 1995, 1996 a 1999, 1998, 300 metros, 2002, 2003 y 24 victorias.
- **Fotos de la era equivocada en momentos concretos.** Por ejemplo, la victoria de 1994 con un Escort no se ilustra con imágenes del Mitsubishi de 2001.

---

## Iteraciones

1. **Material:** revisé las 24 imágenes y el vídeo completo en hojas de contactos, y el tramo de 2:03 a 2:09 cada medio segundo. Marqué con una rejilla dónde estaban la mosca, la marca del usuario y los rótulos, y probé los recortes de cada tramo en otra hoja. Moví dos inicios para evitar un fundido y un corte de cámara.
2. **Alineación:** 113 cláusulas, 1802 sílabas detectadas frente a 1887 del guion.
3. **v0, un fotograma por plano (68) y diez intermedios.** Corregí:
   - **el tramo del derrape («Salvaje»):** al final reaparecían el panel de la cadena y el rótulo de tiempos. Ajusté el recorte y la velocidad;
   - **el mapa de Finlandia,** que se salía del cuadro;
   - **los puntos de lagos del mapa ampliado,** que parecían partículas de relleno: ahora hay solo el contorno, el punto y su rótulo;
   - **los cuatro años del récord,** que se solapaban;
   - **la vista frontal del WRC,** que apenas se veía más ancha;
   - **las plantas en perspectiva,** que se cortaban por abajo y quedaban bajo los titulares;
   - **el titular final de la Tommi Mäkinen Edition,** rojo sobre el coche rojo: ahora va arriba y en blanco.
4. **Música:** en la primera versión la calma quedaba 18 dB por debajo de las rupturas y habría desaparecido bajo la voz. La subí hasta unos 12 dB de diferencia.
5. **v1, render completo (21.540 fotogramas a 60 fps), mezcla y hoja de contactos del máster.**

## Tiempo total

Unas 3 horas desde el encargo:
- 30 min de material, recortes del archivo y alineación;
- 1 h 15 min de los componentes de ingeniería y los 68 planos;
- 15 min de la música;
- unos 60 min de render, mezcla y revisión.

## Material de terceros

- **Fotografías y vídeo de archivo:** los proporcionó el cliente (`imagenestomimakinenvideo.zip`, `videoplayback.mp4`).
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (`vo/take.mp3`).
- **Fuente:** Titillium Web, de la Accademia di Belle Arti di Urbino (SIL Open Font License).
