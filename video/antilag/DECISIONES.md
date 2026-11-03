# Anti-lag: decisiones de producción

Documental de ingeniería de 4:41 en 16:9 sobre el sistema Anti-lag («Bang-Bang») de los rallys de los 80 y 90, para el canal EVO HERITAGE. Usa la locución del cliente (ElevenLabs, 4:35), sus 12 fotografías, su logotipo y los segundos 9 a 16 de su clip del Mitsubishi Evo VI. La música está sintetizada desde cero a 120 BPM y todos los esquemas de ingeniería se generan por código y se renderizan fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/antilag.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 89 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de ingeniería, plantillas, 56 planos y montaje |
| `src/timeline.js`, `src/vo.js`, `src/clip-env.js` | Tiempos, mapa de la locución y envolvente medida del sonido del clip |
| `audio/music.mjs` | Sintetizador, arreglo, diseño sonoro y máster |
| `scripts/` | Alineador, preparación de fotos y clip, render, empalmes, mezcla y hoja de contactos |

Para reproducirlo todo:
1. `ffmpeg -i vo/take.mp3 -ac 1 -ar 16000 vo/take16.wav`
2. `python3 -I scripts/align.py vo/take16.wav vo/guion.txt out/vo-map.json`
3. `node scripts/vo-js.mjs`
4. `npm run images`
5. `npm run music`
6. `node scripts/render.mjs --to 281`
7. `npm run mix`
8. `npm run contact`

---

## Qué decidí y por qué

### 1. Tono: documental de ingeniería, no anuncio de rally
Los vídeos anteriores de la serie eran épicos. Este pedía explicar, así que cambié el registro:
- **Tipografía:** Barlow Semi Condensed recta, en lugar de cursiva, más cercana a la rotulación técnica, con Barlow para las etiquetas.
- **Fondos:** una retícula de puntos muy tenue, como el papel de ingeniería, solo en los planos de esquema.
- **Diagramas:** son el protagonista; las fotos acompañan.
- **Colores:** los del logotipo de EVO HERITAGE (rojo, naranja y amarillo), más dos colores con función, que se mantienen en todo el vídeo: **azul = aire de admisión** y **naranja = gases de escape**. Así el espectador aprende a leer los esquemas sin leyendas.

### 2. El canal y el clip del cliente
- **Entrada:** logotipo de EVO HERITAGE y debajo «Anti-Lag», como pidió el cliente.
- **Arranque con el clip real:** el vídeo empieza con los segundos 9 a 16 del clip, con su sonido de petardeos, justo mientras la voz dice «Fuego por el escape. Explosiones que suenan como ráfagas de ametralladora». En la segunda mitad del tramo, cuando la cámara del clip gira hacia el comisario, la imagen se oscurece y encima se dibuja la **envolvente real del sonido del clip, medida de su audio** (120 valores por segundo). Es literalmente la «ráfaga de ametralladora».
- **Reprise:** el paso del coche vuelve a cámara lenta (0,75×) en «el sonido atronador que bautizó al sistema», y la misma onda cierra el vídeo en «¿Conocías la ciencia detrás de este sonido?».
- **Cierre:** el logotipo vuelve en la tarjeta final con el botón genérico «Suscríbete».

### 3. La ingeniería, explicada con un sistema completo y una cámara que se acerca
El núcleo es un **esquema del motor completo**: admisión, compresor, mariposa, válvula bypass, plénum, inyectores, bloque de cuatro cilindros, colector de escape, turbina y escape, con la centralita y sus señales. Cada parámetro es animable: apertura de la mariposa, bypass, inyección, mezcla sin quemar, caudal de escape, régimen de la turbina, temperatura, grietas y detonación. Un mismo dibujo cuenta toda la historia mientras la cámara se acerca a cada parte:
1. **La idea:** vista general; la explosión ocurre fuera del motor.
2. **La centralita ordena:** zoom a la admisión. Las señales llegan a los inyectores, que siguen pulverizando gasolina, y a la bypass, que deja pasar el aire con la mariposa cerrada.
3. **La mezcla viaja:** zoom al colector, que empieza a calentarse (800 °C).
4. **¡BAM!:** la detonación en el colector, la onda de presión y la turbina que se acelera.
5. **Explosiones continuas:** destellos cada 0,25 s al ritmo de la música, la llama por el escape y «120.000».
6. **El precio:** el colector pasa del rojo al naranja y al amarillo (1.100 °C), se raja con grietas que se propagan, y la turbina se frena al fundirse.

Componentes dedicados:
- **Turbo en corte,** como una lámina técnica: carcasas en sección con rayado, volutas, carcasa central con paso de aceite, eje y rodetes en perfil. El aire entra axial, sale por la voluta hacia el motor, y los gases llegan del colector y salen axiales al escape.
- **Turbina vista de frente** con desenfoque de giro calculado a partir del régimen. Se frena (de más de 100.000 a casi nada) y se acelera con los golpes de presión.
- **Gráfica del retraso:** el acelerador en escalón y la presión que llega con una cota de «dos segundos». Más adelante, la misma gráfica con la curva del Anti-lag ya al máximo («La presión, al máximo»).
- **Manómetro** del «boost» que salta de golpe y que cae a cero.
- **Mariposa de admisión** en gran plano, cerrándose mientras el aire se detiene, junto a la foto real de los cuerpos de mariposa.
- **Barras de combustible, aire y gases de escape** que caen al levantar el pie.
- **Dial del cigüeñal** con el PMS y la chispa que se retrasa hasta 40° con su arco rojo.
- **Cilindro en sección** con el ciclo de 4 tiempos animado con cinemática real (biela y manivela), las levas de admisión y escape y la chispa. Primero se ve el encendido normal, con el pistón arriba; después, con el Anti-lag, la llama sale por la válvula de escape abierta.
- **Mapa de la centralita** (régimen × carga) y **selector del salpicadero** que pasa de «Córcega · asfalto seco» a «Gales · barro». Son interfaces genéricas, en los colores del canal.

### 4. Locución: alineada automáticamente, sin tocar la voz
La toma dura 4:35 y entra entera tras la entrada de 2,5 s. El alineador de la serie (`scripts/align.py`) casa los 107 fragmentos de voz con las 89 cláusulas del guion por recuento de sílabas y programación dinámica: 1439 sílabas detectadas frente a 1522 del guion, un 95 %. Una buena prueba: la cláusula «¡BAM!» (una sola sílaba) cae en un fragmento aislado de 0,6 s. Todos los cortes se calculan a partir de ese mapa.

En la mezcla:
- la voz va procesada como en la serie;
- la música entra a −11 dB y se comprime con la voz como llave;
- **el sonido del clip** entra a −17 dB al principio (−24 dB en la reprise), con un sidechain 4:1 desde la voz, de modo que los petardeos asoman entre palabras sin tapar la voz.

### 5. Música y diseño sonoro sintetizados, sin muestras
Es el motor DSP de la serie, ahora en **La menor**, con 19 secciones ancladas a frases:
- en el arranque, solo un bordón grave, para que mande el sonido real del clip;
- un hueco en «el coche estaba muerto»;
- una sección mecánica (acentos 3-3-2) mientras se explica la centralita;
- una subida que se corta en seco antes de «¡BAM!»;
- el clímax con melodía y el cierre con acorde largo sobre el logotipo.

El diseño sonoro sigue a los esquemas:
- el turbo que se carga en la gráfica y silba en «de golpe»;
- el chasquido de la mariposa al cerrarse;
- **el silbido que cae mientras la turbina se frena**;
- la descarga de la válvula cuando la presión cae a cero;
- los pulsos de inyección cuando la centralita ordena;
- **un clic por cada chispa del cilindro dibujado**;
- **un petardeo por cada destello del colector**;
- el motor que sube sin esperar en «Cero lag»;
- los crujidos metálicos cuando el colector se raja.

### 6. Determinismo y render
- **Función de tiempo:** `seek(t)` dibuja cada fotograma únicamente a partir de `t`, sin `Math.random`, relojes ni estado.
- **Giros:** el ángulo de las turbinas se integra en cada fotograma desde el inicio del plano.
- **Clip:** sus fotogramas se extraen una vez y se eligen por tiempo.
- **Desenfoque de movimiento:** render a 60 fps y máster a 30 fps promediando pares de fotogramas.

---

## Qué descarté

- **Recortar o acelerar la voz.** No hacía falta.
- **Mostrar el clip entero sin tratar.** Del segundo 11,7 en adelante la cámara se queda en el comisario. Mantengo el sonido completo, porque es lo valioso, pero esa parte va oscurecida bajo la forma de onda.
- **Inventar cifras en los mapas o en el selector.** Las celdas muestran intensidades sin números, y las posiciones de Córcega y Gales solo se diferencian visualmente.
- **Efectos de «fuego» con partículas o resplandores de neón.** Las detonaciones son formas planas con ruido con semilla, en los tres colores del logotipo, y duran unas décimas.
- **Texto en tipografía monoespaciada.** Podía leerse como «texto tipo terminal», que el encargo prohíbe.
- **Un borde duro tras el texto en los planos de esquema ampliado.** Parecía un marco, así que lo sustituí por un fundido a negro (el mismo tipo de viñeta que llevan las fotos).

---

## Iteraciones

1. **Material:** revisé las 12 fotos y el clip fotograma a fotograma (dónde se ve el coche y dónde solo se oye), medí la envolvente del sonido del clip y alineé la locución.
2. **v0, un fotograma por plano (56) en dos hojas.** Corregí:
   - **el turbo en corte:** eran dos cajas con líneas. Lo rediseñé como una lámina técnica, con secciones rayadas, volutas, carcasa central y caminos reales de aire y gases;
   - **el texto sobre el esquema ampliado:** se montaba sobre los dibujos, así que añadí el velo con fundido;
   - **las etiquetas de la gráfica del retraso,** que se solapaban («ACELERADOR» y «CON ANTI-LAG»), y la etiqueta superior, que cruzaba el eje: alejé la gráfica;
   - **el dial de la chispa,** que repetía el «40» del titular: ahora marca «CHISPA» en el punto exacto;
   - **las etiquetas del cilindro,** que flotaban lejos del dibujo: las acerqué y amplié el cilindro.
3. **Música:** comprobé la curva de sonoridad cada 6 s y que no hubiera NaN.
4. **v1, render completo (16.860 fotogramas), mezcla y hoja de contactos del máster.**
5. **Balance del clip.** Medí la sonoridad por tramos y en la apertura el sonido del clip quedaba unos 14 dB por encima de la voz: habría tapado «Fuego por el escape». Lo bajé de −5 a −17 dB y endurecí su sidechain (4:1). Ahora la apertura mide −13,6 dB RMS, igual que el resto del vídeo (−13,2), y la voz manda.

## Tiempo total

Unas 2 horas y cuarto desde el encargo:
- 15 min de material y alineación;
- 50 min de los componentes de ingeniería y los 56 planos;
- 15 min de la música;
- 45 min de render (16.860 fotogramas), mezcla y revisión.

## Notas sobre el contenido

Las cifras y afirmaciones son las del guion del cliente:
- más de 100.000 y 120.000 vueltas;
- 40° de retraso;
- 800 °C y más de 1.100 °C en el colector;
- los mapas ajustables del Impreza WRC97.

La explicación visual sigue el guion. Por claridad, el dibujo del cilindro muestra la chispa a 40° después del PMS y la válvula de escape abriéndose poco después, como dice la locución («la bujía salta cuando la válvula de escape ya se está abriendo»).

## Material de terceros

- **Fotografías y clip:** los proporcionó el cliente (`video_antilag.zip`, `EVO_VI_Crazy_Antilag.mp4`).
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** ElevenLabs, generada por el cliente (`vo/take.mp3`).
- **Fuentes:** Barlow y Barlow Semi Condensed, de Jeremy Tribby (SIL Open Font License).
