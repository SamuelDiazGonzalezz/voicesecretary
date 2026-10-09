# DECISIONES — Reel Evo Heritage

Encargo: 20 s de motion graphics en 4K, dinámico y con sonido, para **Evo Heritage**, una tienda de ropa rally ambientada en el Grupo B y lo retro que abrirá pronto. Tenía que servir como showreel de un motion designer. Condición: **solo código**, sin modelos de generación de imagen, vídeo ni audio.

Entrega: `entrega/evo-heritage-reel-4k.mp4` (3840×2160 · 30 fps · H.264 High · AAC 320 kbps) + el código fuente de esta carpeta.

---

## 1. Qué decidí y por qué

### Stack: Three.js + Canvas 2D en Chromium headless, audio en numpy y ffmpeg
- **Three.js (WebGL)** me da 3D real con materiales PBR (clearcoat en la pintura, sheen en el algodón), sombras, luces de área para los barridos de luz y una cadena de post-procesado. Pedías "movimientos 3D", así que no quería un 2.5D de capas con parallax.
- **Canvas 2D** encima para la tipografía. El texto de motion design necesita *tracking*, máscaras, type-on y estelas, y eso se controla mucho mejor en 2D que con geometría.
- **Render offline determinista**: todo el vídeo es una función pura `renderFrame(t)`. No hay reloj real ni `Math.random()` sin semilla, así que cada frame es reproducible y el render se puede trocear y paralelizar sin costuras.
- **Audio sintetizado en numpy** (síntesis aditiva, ruido filtrado por STFT, convolución). Sin samples ni bibliotecas de sonido, para cumplir la regla de "solo código".
- **`timeline.json` como fuente única de verdad.** Escenas, tempo (120 BPM), golpes, whooshes, **curva de RPM y marchas** y petardeos anti-lag están ahí. La imagen y el sonido leen el mismo archivo. La aguja del tacómetro del HUD y el tono del motor que se oye son literalmente la misma curva. Para mí ese es el detalle que separa un reel "con música encima" de uno diseñado con el sonido.

### Dirección de arte (sacada de las referencias)
- **Paleta**: franjas navy / azul claro / rojo (el lenguaje de las liveries clásicas del Grupo B de tus referencias 1 y 4), amarillo del logo Evo Heritage, crema de papel y negro asfalto.
- **Tipografía**: Inter Display Black Italic para los titulares (la cursiva pesada transmite velocidad), Inter Display ExtraLight con mucho tracking para los subtítulos ("lujo retro") y DejaVu Mono para la telemetría y el timecode.
- **Estructura de seis actos alineada al tempo**: cada corte cae en un beat de 120 BPM (0,5 s).

| t (s) | Acto | Qué pasa | Recursos de motion |
|---|---|---|---|
| 0–2,5 | Ignición | Cuenta atrás de tramo 3-2-1 sobre la silueta del coche en la oscuridad, encendido de faros | Punch-scale de los dígitos, anillo que se vacía, franjas que barren en cada pulso, flare anamórfico proyectado desde los faros 3D, desenfoque radial |
| 2,5–6,5 | La leyenda | Revelado en estudio, "GRUPO B" en 3D emerge del suelo | **Dolly-zoom (vértigo)** y órbita, barrido de luz de área sobre el clearcoat, contador 1982→1986, **callouts anclados a puntos 3D** que siguen al coche |
| 6,2–6,7 | Transición | Cortinilla de franjas diagonales | Escalonado por capas con inOutExpo |
| 6,5–10,5 | Tramo nocturno | El coche derrapa por un bosque con público en la cuneta | Cuatro planos de cámara en corte por compás (frontal bajo, travelling lateral, persecución, grúa), grava balística, polvo, conos volumétricos, shake con ruido, **whip-pan** con desenfoque direccional, palabras slam "DERRAPA. ACELERA. A FONDO. SIN DUDAR." y HUD con tacómetro, marcha y cronómetro |
| 10,5–14 | La colección | 4 liveries sobre paneles inclinados de color | Travelling "hold-move-hold" de un coche por compás, motion blur según la velocidad de cámara, push-in final con flash |
| 14–17 | Drop 01 | Camiseta 3D que gira y cambia de color y estampado | Giros de 360° sincronizados (el cambio ocurre cuando muestra la espalda), marquee de fondo, chips de producto. Los estampados reutilizan **el render real del coche 3D** y su perfil lateral |
| 17–20 | Logo | El coche entra derrapando y frena con polvo, franja amarilla y cheurón rojo se dibujan en el suelo, letras 3D "EVO HERITAGE" crecen una a una y "PRÓXIMAMENTE" golpea | Composición que traduce a 3D tu referencia 4 (logo Evo Heritage), fundido final |

### El coche
Todo es procedural en `src/car.js`. Un **perfil lateral** (con los pasos de rueda como arcos) se extruye como carrocería, y otro perfil más estrecho forma el habitáculo con tumblehome. Encima van aletas ensanchadas, llantas de 8 agujeros pintadas en canvas, 4 faros más una barra de 4 auxiliares, alerón, toma de techo, faldillas y dorsales.
- **Truco clave**: las tapas de `ExtrudeGeometry` reciben UV en las mismas coordenadas que el perfil. Así las liveries se pintan en un canvas en "metros del coche" y encajan solas. Ese mismo canvas me permite dibujar la silueta 2D exacta del coche para los estampados de las camisetas: un solo origen y tres usos (3D, camiseta negra, camiseta azul).
- **Cuatro liveries "inspiradas", sin marcas registradas** (HERITAGE, GIALLO, BLEU, NOIR). Evocan a los Delta, Quattro, 205 y Manta de tus referencias sin copiar logotipos ni nombres comerciales.

### Post-procesado (pase propio en GLSL)
Bloom (UnrealBloom) → tone mapping ACES → mi pase final, que compone la capa 2D y aplica aberración cromática radial, desenfoque radial y direccional de 14 muestras con *jitter*, flash de color, viñeta, grano y fundido. Cada escena devuelve sus parámetros de post en cada frame, así que los "impactos" son coreografía y no un filtro fijo. Los textos también reciben parte del desenfoque, para que se integren en los movimientos rápidos.

### Sonido
- **Motor**: un 4 cilindros turbo. La frecuencia de explosión es RPM/60·2, con 10 órdenes armónicos, pulsos de combustión que modulan ruido (el "rasp" del escape), saturación según el acelerador (derivada de las RPM), silbido del turbo, admisión filtrada y motor de arranque.
- **Blow-off**: se detecta solo en cada caída brusca de RPM (cambios de marcha) a partir del timeline.
- **Petardeos anti-lag**, muy del Grupo B: golpe grave, chasquido y cola de llama.
- **Música** synthwave a 120 BPM en Mi menor: bombo, palmas, hi-hats, bajo, arpegio y pads, con **sidechain** al bombo, filtro paso-bajo que se abre en la ignición y se cierra bajo el logo, y redoble antes del tramo.
- **Efectos**: whooshes con filtro paso-banda que barre (STFT), risers, impactos con *reverse swell*, pitidos de salida de tramo, ticks en cada callout y en cada letra 3D del logo, grava y piedras, público al paso y derrape.
- **Máster**: reverb por convolución con IR de ruido decorrelado, saturación tanh y normalización a −1 dBFS.

---

## 2. Qué descarté

- **Cualquier asset externo o generado** (fotos de coches, texturas, samples de motor): lo prohibía el encargo y además quería que todo saliera del mismo sistema.
- **Logotipos y marcas reales** (Martini, Lancia, Audi, Peugeot, Opel) y la firma o el nombre de Colin McRae que aparecen en las referencias. Se publican en una pieza comercial de una tienda y podrían dar problemas legales, así que uso liveries y frases propias.
- **Blender, Remotion u otros motores**: no estaban disponibles en el entorno y añadían dependencias. Three.js + Chromium ya venían configurados.
- **Motion blur real por sub-frames** (acumular de 4 a 8 renders por frame): multiplicaba un render que ya cuesta unos 11 s/frame a 4K por CPU. Lo sustituí por desenfoques direccionales y radiales coreografiados.
- **Reflejos de suelo con `Reflector`**: renderiza la escena dos veces. Uso suelo metálico-rugoso más un environment map PMREM.
- **Luz volumétrica con raymarching**: la cambié por conos aditivos con fresnel, que son baratos y quedan bien con la niebla.
- **60 fps**: duplicaba el tiempo de render sin una mejora proporcional para un reel de 20 s.
- **Una sola escena gigante**: separé estudio, tramo, lineup, merch y logo para controlar mejor la luz y el post de cada acto.
- **Texto 3D en todas partes**: lo reservé para dos momentos ("GRUPO B" y "EVO HERITAGE"). El resto en 2D lee mejor y deja que el 3D tenga peso cuando aparece.

---

## 3. Iteraciones

Revisé cada versión con hojas de contacto de fotogramas (y el audio con espectrograma más el RMS por stem, porque no podía escucharlo).

1. **v1 – Sistema completo.** Timeline, coche, 5 escenas, overlay, post, render offline. Primera hoja de contactos a 960×540: la estructura funcionaba, pero había **sobreexposición** en la ignición y el revelado, la rejilla delantera estaba girada 90°, había bruma beige en el tramo y el desenfoque del lineup era excesivo.
2. **v2 – Luz.** Bajé la emisión de los faros, el radio del bloom y la intensidad de los conos (y los atenué cuando la cámara mira de frente). Arreglé la rejilla y reduje el polvo. Reencuadré la ignición a un 3/4 frontal con la silueta recortada por luces de borde que laten con la cuenta atrás.
3. **v3 – Letras 3D.** La "O" de "EVO HERITAGE" salía como un punto. Hipótesis: Inter es OTF/CFF y sus contornos giran al revés que en TrueType. Lo comprobé renderizando A/B con `reversed` a false y a true, y lo dejé en true.
4. **v4 – El blanco seguía quemado en el revelado.** No eran los faros: la luz clave era un SpotLight **sin atenuación** (decay 0) a intensidad 140 sobre carrocería blanca. La bajé a 3,2 y equilibré los rim lights rojo y azul. Además: nombres de librea sin marcas, la palabra "SIN DUDAR." que pisaba el cronómetro, y un estampado blanco rediseñado más contundente.
5. **v5 – Logo y ritmo.** Las letras "emergían del suelo", pero el suelo es un `ShadowMaterial` transparente y se veían por debajo, así que pasé a crecer en escala Y desde la base. El lineup iba a 0,875 s por coche, fuera de compás; lo alineé a 1,0 s (2 beats) para que cada desplazamiento caiga a tempo con su whoosh.
6. **Audio v1.** El espectrograma confirmaba la sincronía: pitidos a 0 / 0,5 / 1 s, arranque a 1,05 s, el silbido del turbo dibujando los cambios de marcha. El balance de stems mostró el motor al ralentí demasiado alto bajo la música del revelado; lo bajé a 0,45 con un golpe de gas en el beat 4,5.
7. **v6 – Escenas claras.** Aparecía un halo blanco central en el lineup, el merch y el logo porque el suelo claro superaba 1,0 y activaba el bloom. Subí el umbral a 1,6 en esas escenas. El estampado se cortaba por la curvatura del bisel de la camiseta, así que reduje el plano de impresión.
8. **Rendimiento.** Perfilado a 4K: unos 11–13 s/frame de render en SwiftShader y menos de 0,5 s de PNG. Lo resolví con `render-parallel.mjs`: 3 Chromium con trozos contiguos, cada uno con su segmento casi sin pérdida (CRF 8), y una concatenación final con audio (CRF 17, `-tune film` para conservar el grano).

---

## 4. Tiempo total

__TIEMPO__
