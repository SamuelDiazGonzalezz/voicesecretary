# Promo EVO HERITAGE: decisiones de producción

Promo vertical (9:16) de 44 s para el canal de YouTube **EvoHeritage** (@EvoHeritageRally), pensada para Shorts, Reels y TikTok. Usa:
- la locución del cliente generada con ElevenLabs (voz «Mario», 40,5 s) sobre un guion escrito para la promo;
- fotos y el clip del Evo VI de los documentales anteriores del canal;
- el logotipo del canal.

La música está sintetizada desde cero a 120 BPM. Todo el 3D (cubos, vuelos de cámara, planos en perspectiva, carrusel, muro de fotos y chasis tubular) se calcula por código en Canvas 2D y se renderiza fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/promo-evoheritage.mp4` | Máster: 1080×1920, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 2 s del máster |
| `vo/guion.txt`, `out/vo-map.json` | Guion y las 21 frases con su inicio y su fin en la toma |
| `src/scenes.js` | Motor 3D, componentes de ingeniería, 20 planos y montaje |
| `src/timeline.js`, `src/vo.js` | Tiempos de la voz y secciones de la música |
| `audio/music.mjs` | Sintetizador, arreglo, diseño sonoro y máster |
| `scripts/` | Alineador, preparación del material, render, mezcla y hoja de contactos |

Para reproducirlo todo:
1. `npm run images`
2. `npm run music`
3. `node scripts/render.mjs`
4. `npm run mix`
5. `npm run contact`

---

## Qué decidí y por qué

### 1. Un guion que es el índice del canal
Una promo de canal tiene que decir en 40 segundos qué vas a encontrar. El guion sigue el orden de los dos pilares que el cliente usa para describir el canal, **historia** e **ingeniería**:
- un gancho sensorial («Fuego por el escape»);
- el nombre del canal;
- cuatro leyendas reales de sus documentales;
- cuatro conceptos técnicos que el canal explica;
- los documentales;
- el mensaje de comunidad que pidió el cliente («Esta comunidad es de todos ustedes… porque el rally es de todos»);
- la suscripción.

Los números van escritos con letras en el guion («cero treinta y siete», «dos dos dos de») para que ElevenLabs los lea bien. En pantalla aparecen como cifras.

### 2. «Épico, con transiciones 3D»: 3D de verdad, no deslizamientos
El cliente pidió transiciones profesionales en 3D. En lugar de simularlas con escalados, escribí un pequeño **motor de perspectiva** (`stripsY` y `stripsX`). Cada imagen se proyecta en franjas finas, cada una con su escala según su profundidad, igual que una cámara real. Con él se construyen:
- **Cubo** horizontal y vertical: el plano saliente gira como la cara de un cubo, se oscurece al girar, y la cámara se aleja a mitad del giro para que se lea el volumen.
- **Vuelo:** la cámara atraviesa el plano saliente, con desenfoque radial, y el siguiente llega desde el fondo.
- **Fotos como planos 3D:** cada foto a sangre gira unos grados mientras la cámara avanza. Se amplían solo lo justo para que nunca asomen los bordes.
- **El clip del Evo VI en un panel que gira en el espacio,** sobre su propia imagen desenfocada. Así se aprovecha un vídeo de 640×360 sin estirarlo a pantalla completa.
- **«Ingeniería»** se levanta desde el plano de una lámina técnica.
- **Plantas del Quattro y del 205 T16 tumbadas en el suelo,** vistas en perspectiva con el par fluyendo a las ruedas. En el 205, el motor gira de longitudinal a transversal.
- **Chasis tubular del 222D,** en 3D real (nodos y tubos), con la jaula en rojo.
- **Carrusel de documentales:** cuatro tarjetas genéricas en un anillo que gira. La del Anti-lag reproduce el clip.
- **Muro con todas las fotos del canal** visto desde el aire, mientras la cámara se eleva con «Esta comunidad es de todos ustedes».

### 3. Identidad del canal
- **Colores:** los del logotipo (rojo, naranja y amarillo), que aparecen como franjas en la entrada, bajo los titulares, en las cortinillas y en «El rally es de todos». No hay otros colores de acento.
- **Tipografía:** Barlow Condensed en cursiva negra, el mismo registro que las miniaturas del canal, con Barlow para las etiquetas.
- **Logotipo:** al decir «Esto es Evo Heritage» entra girando en 3D sobre las franjas de la marca, y vuelve en el cierre con el nombre, la cuenta y el botón.
- **Interfaces:** no imito la de YouTube. Las tarjetas y el botón «Suscríbete» son genéricos, con los colores del canal. Los títulos y duraciones de las tarjetas son los reales del canal (5:48, 4:42, 5:43 y 2:31).

### 4. Locución sincronizada
El alineador de la serie casó las 21 frases con la toma. En el tramo rápido («el antilag, la tracción total, el motor central, el chasis tubular») el reparto por sílabas no era fiable, así que corregí cada frase a mano con el mapa de silencios de la toma (umbral −38 dB, 60 ms). Cada nombre de coche y cada palabra técnica aparece cuando se dice. Los cuatro esquemas de ingeniería duran un segundo cada uno, al ritmo de la voz.

### 5. Música y sonido
Es el motor DSP de la serie, en **La menor**:
- **Arranque:** bordón grave y petardeos sintetizados bajo «Fuego por el escape». El sonido real del clip del Evo VI suena mientras se ve el coche.
- **Primer drop** en «Esto es Evo Heritage», con golpe, sacudida de cámara y franjas.
- **Leyendas:** ritmo completo, con un golpe en cada nombre.
- **Respiro** en «Pero no solo te contamos su historia» y **subida** en «Te explicamos su ingeniería».
- **Segundo drop** en «el antilag», con acentos mecánicos 3-3-2, un petardeo por cada destello del dibujo, el silbido del turbo y golpes de gas en la tracción y el motor central.
- **Melodía suave** en «Esta comunidad es de todos ustedes». Sube a pleno en el **clímax**, «porque el rally es de todos».
- **Cierre:** acorde final largo tras «nos vemos en el próximo tramo».
- **Transiciones con sonido propio:** cada cubo, vuelo o cortinilla lleva su barrido, y los cubos llevan además un golpe grave.

La voz manda en la mezcla: la música entra a −8 dB y se comprime con la voz como llave. El clip, a −3 dB, también se comprime con la voz.

---

## Qué descarté

- **El clip a pantalla completa en vertical.** Mide 640×360, y recortado a 9:16 habría quedado borroso. Va en un panel 3D.
- **Copiar la interfaz de YouTube** (la lista de vídeos, el botón rojo con su logotipo o las miniaturas del canal). El encargo lo prohíbe, y las miniaturas contienen retratos de pilotos.
- **Destellos, partículas, humo o barridos de luz** para dar «épica». La épica la ponen el movimiento 3D, el ritmo de los cortes y la música.
- **Texto 3D extruido.** Suele delatar las plantillas genéricas. El volumen está en los planos y en la cámara, no en las letras.

---

## Iteraciones

1. **Material:** revisé las fotos de los cinco documentales y elegí las que aguantan un recorte vertical, más las tres del público y de la parrilla del Grupo B para el muro y para «El rally es de todos». Comprobé que los dos clips miden 640×360 y 618×360.
2. **Guion:** primera versión para ElevenLabs; el cliente pidió añadir el mensaje de comunidad al final.
3. **Alineación:** corregí a mano el tramo rápido de ingeniería (ver el punto 4).
4. **v0, 25 fotogramas sueltos.** Corregí:
   - **las fotos de las leyendas,** demasiado ampliadas y blandas: ahora el sobredimensionado se calcula con el ángulo de giro;
   - **las plantas del Quattro y del 205,** que se salían por abajo al inclinarlas;
   - **el chasis,** visto casi desde arriba e irreconocible: ahora va en tres cuartos;
   - **las tarjetas del carrusel,** que eran pequeñas y no se leían;
   - **la foto de fondo de «El rally es de todos»,** que competía con las letras.
5. **Música:** medí la sonoridad por tramos. Los drops y el clímax quedan sobre −13 dB y los respiros sobre −20 dB, así que se nota la dinámica.
6. **v1, render completo, mezcla y hoja de contactos del máster.**

## Tiempo total

Unas 2 horas desde el encargo:
- 15 min para el guion, el material y la alineación;
- 1 h para el motor 3D y los 20 planos;
- 15 min para la música;
- unos 30 min de render, mezcla y revisión.

## Material de terceros

- **Fotografías y clip:** los proporcionó el cliente para sus documentales anteriores.
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** ElevenLabs, generada por el cliente (`vo/take.mp3`).
- **Fuentes:** Barlow y Barlow Condensed, de Jeremy Tribby (SIL Open Font License).
