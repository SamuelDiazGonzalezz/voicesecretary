# La evolución de las cajas de cambio: decisiones de producción

Documental de ingeniería de 7:49 en 16:9 sobre la evolución de las cajas de cambio en el rally, para el canal EVO HERITAGE. Usa:
- la locución del cliente (7:43);
- sus 13 imágenes;
- seis tramos de su vídeo de onboards: la subida a Pikes Peak con el Peugeot 405 T16 y un 205 T16. La entrada es el tramo de 0:07 a 0:12 que pidió.

La música, tranquila, de documental, está sintetizada desde cero a 120 BPM. Todos los mecanismos se dibujan y se animan por código, fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/cajas.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 128 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de la caja, motor 3D, 62 planos y montaje |
| `src/timeline.js`, `src/vo.js` | Tiempos, secciones de la música y mapa de la locución |
| `scripts/clips.json` | Los seis tramos de onboard |
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

### 1. La caja de cambios por dentro, pieza a pieza
El cliente pidió explicar «las cajas de cambios y su movimiento con todo detalle de los piñones». Así que la base del vídeo es una pequeña biblioteca de mecanismos dibujados con su funcionamiento real:
- **Piñones con perfil de diente:** fondo, flancos curvos y punta, con la circunferencia primitiva en discontinua, aligeramientos y chavetero. Los trenes de piñones **engranan de verdad**: cada piñón gira en proporción inversa a su número de dientes y su fase se calcula para que un diente entre siempre en un hueco (`meshAngle`). No hay solapes ni giros inventados.
- **Helicoidal frente a dientes rectos:** el par visto de perfil, con los dientes en diagonal y las flechas del empuje lateral que llega a rajar la carcasa. Al lado, los dientes rectos, sin empuje, y la onda de alta frecuencia del «aullido agudo».
- **La caja en sección:** primario, toma constante, eje intermediario y secundario con cuatro marchas, manguitos y horquillas. Cada marcha que entra mueve su manguito, y el camino del par se ilumina en rojo de la entrada a la salida, pasando por la pareja elegida. Los dientes avanzan a la velocidad de cada eje.
- **El sincronizador:**
  - el anillo de latón se desliza sobre el cono del piñón mientras dos barras muestran la velocidad del motor y la de la caja igualándose;
  - con 500 CV, el latón pasa del dorado al naranja, se derrite y gotea;
  - después, la caja con sincronizadores «rasca y salta», con golpes en el manguito.
- **Los crabots:** un anillo con cuatro salientes macizos, y al lado las ventanas del piñón, mucho más anchas («muchísimo espacio libre»). En la vista lateral, el crabot avanza y entra de golpe, con una onda de choque, una pequeña sacudida y su golpe metálico en el sonido.
- **Descargar el par:** la gráfica del par que cae al levantar el pie, el tirón de la palanca y la vuelta a fondo.
- **La reja en «H»:**
  - el pomo recorre las marchas;
  - con las fuerzas G, el carril «se escapa»;
  - el *money shift* va de 5ª a 2ª en rojo, junto al camino correcto a 4ª en tenue, con el cuentavueltas pasando la zona roja.
- **La palanca secuencial:** atrás para subir y adelante para reducir, con la fuerza G del cuerpo del piloto.
- **El tambor desmodrómico:**
  - un cilindro con tapas en perspectiva y tres surcos que mueven tres horquillas;
  - debajo, su **desarrollo plano**: las tres pistas con los detentes de N a 6ª y la posición actual;
  - cada tirón gira el tambor un detente (60°) y solo una horquilla cambia de lado, así que se ve por qué es imposible saltarse una marcha.
- **La cadena electrohidráulica:** leva → ECU → electroválvula → actuador → tambor, con un pulso que la recorre.
- **El corte de encendido:** cuatro señales en una escala de 0 a 120 ms (acelerador, par en la rueda, presión del actuador y marcha). El acelerador no baja nunca, el par cae solo durante el corte y la presión sube justo antes de que entre la marcha, todo en menos de 50 ms.
- **150 bares:** el cilindro hidráulico empuja el tambor y cada golpe gira un detente, con su manómetro.
- **El cerebro de la tracción total:** la planta del coche con motor y caja transversales en la misma carcasa, el diferencial delantero y el central activo en rojo, y el par a las cuatro ruedas.
- **El centro de gravedad:** la caja se reubica, se inclina y se encoge, más baja y más cerca del piloto, y la marca del centro de gravedad baja con ella.
- **Momento de inercia polar:** dos siluetas con dos masas iguales, en los extremos o en el centro, giradas por el mismo par. El ángulo crece como `½·(par/I)·t²`, así que la de las masas centrales gira mucho antes. Es «la bailarina sobre hielo».
- **Rally1:** las levas y el diferencial central activo, tachados. Después, «siguen ahí» los engranajes rectos, los crabots y el tambor, y la curva de par de un motor eléctrico de 100 kW frente a la de un motor de combustión.
- **Las barras del tiempo de cambio** aparecen dos veces, cuando la voz da cada cifra: 0,4 s, 0,1 s y menos de 50 ms.

### 2. Los onboards del cliente
- **Entrada:** el tramo de 0:07 a 0:12, que pidió. La mano derecha suelta el volante para cambiar de marcha, la cámara lateral muestra al piloto yendo a la palanca y luego el coche derrapa entre el polvo. Va al 90 % de velocidad bajo la primera frase.
- **Más onboards en el vídeo:**
  - el 205 T16 derrapando en «una guerra de ingeniería»;
  - otro cambio de marcha en «cuando el piloto tira de la palanca» (0:28–0:31);
  - el piloto en «el piloto nunca levanta el pie del acelerador»;
  - la vista aérea en «la agilidad pura»;
  - **al final**, el onboard otra vez en «la próxima vez que escuches el aullido agudo de una transmisión…», como pidió.
- **Fundido de fotogramas:** a cámara lenta se funden dos fotogramas vecinos para que el movimiento no salte.

### 3. El sonido del coche en los onboards (petición del cliente)
El cliente pidió que en las partes de los onboards **baje la música** para que se oiga el coche, **sin tocar la voz**. Así que:
- en cada tramo de onboard suena el **audio real de su vídeo, exactamente el mismo trozo** y a la misma cámara lenta que la imagen. La mezcla lee las ventanas de uso y las velocidades directamente del montaje (`CLIP_USE`), así que imagen y sonido no pueden desincronizarse;
- la **música baja unos 10 dB** en esos tramos, con rampas de 0,4 s para que no se note el corte;
- **la voz no cambia.** El coche solo se comprime ligeramente (2:1) cuando habla el locutor, para que nunca lo tape.

### 4. Identidad
- **Tipografía:** Red Hat Display, nueva en la serie: geométrica y técnica, con buenas cifras.
- **Colores con significado:**
  - **rojo = par y potencia** (el camino del par, los diferenciales, el *money shift*);
  - **latón = sincronizadores**;
  - **azul = hidráulica y electricidad** (el actuador, los 150 bares, el motor eléctrico);
  - **amarillo = horquillas, surcos y rótulos**.
- **Capítulos:** cada época abre con una foto, su titular y una regla inferior que marca dónde estamos: patrón en H, dog box, secuencial, levas y Rally1.

### 5. Música
Tranquila, como pidió el cliente: Re menor, piano en arpegios lentos, cuerdas y, en las partes mecánicas, campanas suaves en un patrón 3-3-2, como un mecanismo, con un leve crecimiento en cada capítulo. El diseño sonoro sigue a los dibujos:
- el golpe metálico de los crabots en cada choque;
- el del actuador en cada empujón del tambor;
- el régimen que se dispara en el *money shift*;
- el botón de suscribirse.

---

## Qué descarté

- **Una cuenta en pantalla** de «40 cambios × 300 km × 0,4 s». El resultado (80 min) no coincide con los «más de 10 minutos» del guion, así que muestro cada cifra del guion por separado, sin operación.
- **Números inventados** en las gráficas. Solo aparecen las cifras de la locución:
  - 40 cambios por km, 0,4 s, 300 km, más de 10 minutos;
  - 300, 400 y 500 CV;
  - 0,1 s, 30–40 ms, 150 bares, menos de 50 ms;
  - 100 kW, 1997, 2022 y 40 años.

  Los ejes de las gráficas de par y régimen no llevan valores.
- **Interfaces de marcas reales:** la cadena de mando, el pedalier y la palanca son genéricos, con los colores del canal.
- **Usar el sonido del vídeo fuera de los onboards:** solo suena cuando se ven sus imágenes.

---

## Iteraciones

1. **Material:** revisé las 13 imágenes y el vídeo completo en hojas de contactos, y los tramos de 0:06 a 0:13 y de 0:24 a 0:34 cada cuarto de segundo para localizar los cambios de marcha.
2. **Alineación:** 128 cláusulas, 2414 sílabas detectadas frente a 2524 del guion.
3. **Comprobación automática:** recorrí toda la línea de tiempo (cada 0,43 s) buscando errores antes de renderizar. Encontré y corregí uno en la reja en «H»: durante la transición de entrada el tiempo del plano era negativo.
4. **v0, un fotograma por plano (62).** Corregí:
   - **el tambor desmodrómico,** que quedaba encima del titular: la cámara centraba el tambor en pantalla. Ahora un punto fijo del tambor se queda siempre en el mismo sitio aunque la cámara se acerque, y el cilindro lleva tapas en perspectiva;
   - **dos trenes de piñones** que se salían del cuadro, y un piñón que rozaba con otro que no era su pareja: recoloqué los centros y comprobé las distancias;
   - **el manómetro de los 150 bares,** que se cruzaba con el titular;
   - **los rótulos «levantar · tirar · pisar»,** que se pisaban.
5. **Sonido de los onboards (petición del cliente durante el trabajo):** añadí el audio real de cada tramo y la bajada de la música. Medí el balance: en los onboards la música queda unos 20 dB por debajo del coche, y bajé el coche 3 dB más para que no supere a la voz.
6. **v1, render completo (28.140 fotogramas a 60 fps), mezcla y hoja de contactos del máster.**

## Tiempo total

Unas 3 horas y media desde el encargo:
- 30 min de material, onboards y alineación;
- 1 h 30 min de los mecanismos y los 62 planos;
- 30 min de revisión y correcciones;
- 15 min de la música y la mezcla;
- unos 80 min de render.

## Material de terceros

- **Fotografías y vídeo de onboards:** los proporcionó el cliente (`imagenescajas_de_cambio.zip`, `2026-11-17_14-44-27_1.mp4`).
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (`vo/take.mp3`).
- **Fuente:** Red Hat Display, de Red Hat (SIL Open Font License).
