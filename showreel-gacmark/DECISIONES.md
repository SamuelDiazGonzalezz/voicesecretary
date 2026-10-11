# GACMARK · Showreel de motion graphics: decisiones

**Entregables** (carpeta `showreel-gacmark/`)

| Archivo | Qué es |
|---|---|
| `out/GACMARK_showreel_1920x1080_60fps.mp4` | Vídeo principal: 1920×1080, 60 fps, 50 s, H.264 + AAC 320 kbps |
| `out/GACMARK_showreel_9x16_1080x1920_60fps.mp4` | El mismo showreel en vertical 9:16 (1080×1920, 60 fps) |
| `src/showreel.js`, `src/index.html` | Motor y escenas. Todo el vídeo es `seek(t)` |
| `audio/music.py` | Banda sonora sintetizada desde cero (solo numpy) |
| `render/render.mjs` | Render cuadro a cuadro (Chromium headless → ffmpeg) |

Para previsualizar: abrir `src/index.html` en un navegador (tiene un *scrubber* y reproduce `out/music.wav` en sincronía). Para usar otro tamaño, basta con pasar `?w=1080&h=1920` en la URL.

---

## 1. Qué decidí y por qué

### Contradicciones del encargo y cómo las resolví
- **«4K» frente a «1920×1080»**: la entrega pedía de forma explícita un MP4 a 1920×1080 y 60 fps, así que ese es el máster. El motor no depende de la resolución (todo se mide en la unidad `U = min(W,H)/1080`), así que `node render/render.mjs --w 3840 --h 2160` genera la versión 4K sin tocar código. No la rendericé para no cuadruplicar el tiempo de render ni el peso del repositorio.
- **«Formato 9:16»**: lo apliqué en dos niveles. (1) Dentro del vídeo, cada servicio se presenta como un anuncio vertical 9:16 en un móvil 3D (story, feed, buscador, tienda), que es el formato en el que de verdad viven esas campañas. (2) Como el motor es responsive, también entrego el showreel completo en vertical a 1080×1920: el diseño se recoloca (el título arriba y el móvil debajo) en vez de recortarse.
- **gacmark.com no era accesible** desde el entorno (el proxy rechazó la conexión). No pude copiar el lema real, así que escribí uno propio: **«Marketing que se ve. Resultados que se miden.»**. Las cifras que aparecen en pantalla (12.480 clics, #1, +48.700 seguidores…) son **ilustrativas** y habría que sustituirlas por datos reales antes de publicar.

### Identidad visual
- **Logo**: el original es una serif didona negra sobre blanco. Lo reconstruí con *Bodoni Moda* 800 (OFL, licencia incluida en `src/fonts`), con un tracking final de 0,045 em. El vídeo empieza y termina con el logo en negro sobre papel (`#EEEAE2`), igual que el logotipo original. Así funciona como apertura y cierre del showreel.
- **Paleta**: negro cálido, papel y un único acento bermellón (`#FF4A26`). La marca es monocroma; un solo acento le da energía sin inventar una identidad nueva.
- **Tipografía**: la mezcla es el recurso de rango. *Inter* Black y Light aporta lo cinético y digital, y *Bodoni* italic lo editorial y la voz de marca («se *eligen*.», «se *miden*.»).

### Estructura y ritmo (96 BPM: negra = 0,625 s, compás = 2,5 s, 20 compases = 50 s)
| Tiempo | Compases | Escena | Técnica principal |
|---|---|---|---|
| 0–5 | 1–2 | «Hay marcas que se ven. Y marcas que se *eligen*.» | Tipografía cinética palabra a palabra en corcheas; horizonte de luz anamórfico; colapso de partículas → destello |
| 5–7,5 | 3 | Revelado del logo sobre papel | Máscaras por letra, tracking animado, subrayado; **zoom a través del trazo más grueso del logo** (el punto se calcula analizando los píxeles) |
| 7,5–10 | 4 | «6 servicios · 1 objetivo · CRECER.» | Numeral Bodoni **extruido en 3D** que gira y cambia de 6 a 1 de canto |
| 10–15 | 5–6 | SEM / Google Ads | Búsqueda tecleada, anuncio patrocinado, toque, panel con barras en muelle |
| 15–20 | 7–8 | SEO | Gráfica 3D sobre rejilla en perspectiva con **cámara virtual que sigue la cabeza de la línea**; el resultado sube del #37 al #1 |
| 20–25 | 9–10 | Community manager | **Corazones con física** (gravedad, arrastre, rebotes) que salen del botón «me gusta» en cada tiempo |
| 25–30 | 11–12 | Publicidad en redes | Story 9:16 con **morphing de formas** en cada negra; tarjetas de otros formatos en abanico 3D |
| 30–35 | 13–14 | Tiendas online | Pulsación de compra, producto que vuela al carrito, **monedas con física** y pedido confirmado |
| 35–40 | 15–16 | Diseño web | **Web despiezada en capas 3D** que se ensamblan en un navegador y después la versión móvil |
| 40–45 | 17–18 | Montaje | **Carrusel 3D** de los seis anuncios, un icono que cambia de forma y una palabra por negra; a 44,375 s todo colapsa en un punto (silencio de una negra) |
| 45–50 | 19–20 | Final | Explosión de **2.600 partículas que forman el logo** con muelles, inundación a papel, lema y URL |

Cada corte cae en un tiempo fuerte (5, 7,5, 10, 15, 20…, 45 s) y la música refuerza cada uno con un *impact*, *whoosh* o *tick*. Las palabras de la intro caen en corcheas, y la forma del story y las palabras del montaje cambian en cada negra.

### Transiciones por máscara (todas distintas)
- 10 s: iris circular (la «lupa» del buscador).
- 15 s: el círculo se convierte en flecha mientras se expande como máscara.
- 20 s: lamas verticales escalonadas.
- 25 s: bocadillo → corazón.
- 30 s: barrido diagonal con una banda de acento.
- 35 s: bolsa → ventana de navegador.
- 40 s: lamas horizontales.

Todas las máscaras llevan el borde en bermellón. Un icono pequeño junto al índice de cada servicio repite la misma forma, para que la transición y el contenido tengan continuidad.

### Cómo cubro cada requisito técnico
- **Determinismo y `seek(t)`**: `drawScene(ctx, t)` es una función pura del tiempo. No se usa `Math.random`: todo lo aleatorio sale de `mulberry32` con semilla. Las partículas no se integran paso a paso, sino que usan **física en forma cerrada**: balística con arrastre lineal (`x = x0 + v(1−e^{−kt})/k`), rebotes calculados analíticamente con restitución (`ballistic()`) y muelles amortiguados con su solución exacta (`spring()`). Por eso cualquier cuadro se puede renderizar suelto, en cualquier orden, y cuatro procesos trabajan en paralelo.
- **3D con perspectiva**: hay una cámara virtual propia (`Cam`/`proj`). Las texturas (pantallas de móvil, capas web) se mapean sobre una malla de triángulos afines: unos 120 por tarjeta, así que la perspectiva es real y no un simple sesgado.
- **Desenfoque de movimiento**: es temporal y real. Cada cuadro promedia 5 subcuadros con un obturador de 216°, que sube a 360° en los cortes. Los contadores se evalúan en el tiempo del centro del cuadro (`qz()`) para que los números se lean nítidos.
- **Resplandor en las altas luces**: es un bloom de verdad. Primero un umbral (`brightness(0.556) contrast(9)` ≈ `max(0,(v−0,8)/0,2)`), después dos desenfoques a 1/4 y 1/12 de la resolución y una suma aditiva. Su intensidad depende de la escena: se apaga sobre el papel.
- **Acabado**: viñeta, grano de película con semilla que cambia cada 2 cuadros y un HUD con timecode en modo `difference`, que se lee tanto sobre negro como sobre papel.

### Música (`audio/music.py`)
Se sintetiza todo, sin muestras:
- **Pad**: sierras aditivas limitadas en banda con un filtro de 24 dB/oct aplicado por armónico.
- **Bajo**: senos saturados.
- **Kick**: barrido de tono.
- **Clap y hats**: ruido con semilla y filtros FFT.
- **Arpegio**: *pluck* con eco ping-pong de corchea con puntillo.
- **Campanas**: síntesis FM.
- **FX**: *risers* con filtro que varía en el tiempo (overlap-add), *whooshes*, platillo invertido e *impacts*.
- **Reverb**: por convolución con una respuesta al impulso sintética.
- **Mezcla**: *sidechain* del pad y el bajo contra el kick, y saturación de master.

La progresión es Dm–B♭–F–C a medio tiempo (ritmo lento, como pedía el encargo). Acaba en un Dm9 sobre el logo. Hay un silencio dramático de una negra justo antes del impacto final.

---

## 2. Qué descarté
- **WebGL o three.js**: lo descarté por control y determinismo. En Chromium headless sin GPU, el Canvas 2D es más predecible, y escribir el 3D a mano permitía demostrar el oficio (proyección, mapeo de texturas y orden de profundidad).
- **Simulación de partículas paso a paso**: rompe `seek(t)`, porque habría que simular desde 0 o cachear estados. La sustituí por física analítica.
- **Desenfoque de movimiento falso** (rastros por *feedback* de cuadros): no es determinista por cuadro. Lo sustituí por supermuestreo temporal.
- **Usar la marca de Google o logos reales de redes sociales**: el buscador y el feed son genéricos («buscar», «Patrocinado»), para no infringir marcas.
- **Paleta multicolor por servicio**: se perdía la elegancia del logo. Me quedé con un único acento.
- **Render en 4K**: el motor lo soporta, pero el encargo fijaba 1080p para la entrega.
- **Copiar el lema de la web**: no fue posible porque la web era inaccesible desde el entorno.

## 3. Iteraciones
1. **Música primero**. Fijé la rejilla de 96 BPM y los 20 compases para que todos los cortes del vídeo se anclaran a ella. El primer *bounce* ya salía a 50,0 s exactos (−1 dBFS de pico).
2. **Primera tanda de fotogramas sueltos** (0–10 s):
   - La frase de la intro no aparecía. Era un bug: el tiempo de cada palabra sobrescribía el tiempo global en `phrase()`.
   - El bloom quemaba las pantallas claras de los móviles. Subí el umbral de 0,7 a 0,8 y bajé la intensidad en los servicios.
   - «OBJETIVO» se solapaba con «CRECER.». Adelanté su salida.
3. **Segunda tanda** (todas las escenas):
   - El icono del índice pisaba la etiqueta «SERVICIOS». Ahora se coloca tras medir el texto.
   - Las tarjetas fantasma del servicio de redes tapaban el título. Las moví detrás y a la derecha del móvil.
   - La cámara de la web centraba el grupo en pantalla en vez de orbitarlo en su sitio. Añadí un pivote de proyección.
   - Los contadores salían emborronados por el desenfoque de movimiento. Ahora se cuantizan al cuadro.
4. **Tercera tanda**: verificación en vertical 9:16. El layout responsive funcionó sin cambios específicos.
5. **Render final** de los dos formatos, con 4 procesos en paralelo, a unos 0,9 s por cuadro y proceso.

## 4. Tiempo total
- **Diseño, código y música**: unos 25 minutos.
- **Iteraciones sobre fotogramas de prueba**: unos 10 minutos.
- **Render de los dos vídeos** (2 × 3.000 cuadros con 5 subcuadros cada uno): ver el registro en `out/render_*.log`, unos 20 minutos por formato.
- **Total aproximado**: alrededor de 1 h 15 min de reloj, desde el encargo hasta los dos MP4.
