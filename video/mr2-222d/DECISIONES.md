# Toyota MR2 222D: decisiones de producción

Documental de ingeniería de 5:47 en 16:9 sobre el Toyota MR2 222D, el prototipo del Grupo S que nunca llegó a competir, para el canal EVO HERITAGE. Usa:
- la locución del cliente (5:41);
- sus 15 fotografías y su logotipo;
- los 9 primeros segundos de su clip del 222D en Goodwood.

La música está sintetizada desde cero a 120 BPM. Todos los esquemas (perfiles, chasis en 3D, plantas, motor, turbo, gráficas) se generan por código y se renderizan fotograma a fotograma.

**Entrega**

| Archivo | Qué es |
|---|---|
| `out/mr2-222d.mp4` | Máster: 1920×1080, 30 fps, H.264 High, AAC 320 kbps, −14 LUFS |
| `out/hoja-de-contactos.jpg` | Un fotograma cada 5 s del máster |
| `out/vo-map.json` | Las 95 cláusulas del guion con su inicio y su fin en la toma |
| `src/scenes.js` | Componentes de ingeniería, plantillas, 59 planos y montaje |
| `src/timeline.js`, `src/vo.js` | Tiempos, los cuatro momentos de ruptura y mapa de la locución |
| `audio/music.mjs` | Sintetizador, arreglo, diseño sonoro y máster |
| `scripts/` | Alineador, preparación de fotos y clip, render, empalmes, mezcla y hoja de contactos |

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

### 1. Tono: documental de ingeniería, sobrio y oscuro
El 222D es el «Darth Vader» de los rallys: negro mate, escondido, cancelado. Por eso:
- **Paleta:** casi negra, con un solo acento, el **rojo** de la rotulación Toyota del propio coche. El amarillo del logotipo de EVO HERITAGE queda para las etiquetas pequeñas, el gris acero para lo que se descarta y no hay más colores.
- **Tipografía:** IBM Plex Sans Condensed, una tipografía de rótulo técnico sobria. Va recta y sin cursivas, y las etiquetas van en IBM Plex Sans.
- **Esquemas:** dibujados en línea fina sobre una retícula de puntos tenue, como una lámina de ingeniería. El rojo marca siempre lo que importa en ese plano: la línea de corte, la cola de pato, la jaula, el motor tras la nuca.

### 2. El canal y el clip del cliente
- **Entrada:** logotipo de EVO HERITAGE y debajo «Toyota MR2 222D», como se pidió.
- **El clip:** sus 9 primeros segundos entran justo cuando la voz nombra Goodwood («…festivales como Goodwood, donde su aullido…»). Primero el coche viene de frente y luego se aleja. La voz no se detiene. El sonido real del motor entra a −4 dB con un sidechain desde la voz, de modo que asoma entre palabras sin taparla. Encima solo hay dos rótulos: «GOODWOOD» y «Su aullido».
- **Cierre:** el logotipo vuelve en la tarjeta final cuando la voz dice «dale un buen like… y suscríbete». Los botones genéricos «Me gusta» y «Suscríbete» se pulsan al ritmo de la frase.

### 3. La ingeniería, contada con dibujos propios
Cada idea técnica del guion tiene su propio componente, animado con la voz:
- **Perfil lateral del MR2 que se transforma en el 222D** con los mismos puntos de control. Primero se resaltan en blanco el techo, el parabrisas y las puertas («solo quedó la silueta del techo, el parabrisas y las puertas»), mientras el resto queda en discontinua. Con «el resto fue pura ingeniería paramilitar», la silueta se ensancha y se alarga hasta el 222D.
- **El corte por la mitad:** una línea roja baja por el coche y las dos mitades se separan.
- **Chasis tubular en 3D real:** nodos y tubos proyectados en perspectiva, girando despacio, ordenados por profundidad y más gruesos cuanto más cerca. Con «extremadamente rígido», la jaula se enciende en rojo.
- **Vista frontal:** el MR2 de calle en discontinua y el 222D que se ensancha encima, con la cota de anchura («absurdamente ancha»).
- **Cola de pato y pasos de rueda** sobre el perfil, con anotación.
- **La zaga que se levanta en una pieza**, girando sobre su bisagra tras la cabina, deja ver el esqueleto tubular y el motor.
- **A centímetros de la nuca:** la cabeza del piloto, el motor que palpita detrás y una cota entre ambos.
- **Configuraciones:** tres fichas (V6, transversal y 503E). Las dos primeras se tachan y el 503E queda como «la especificación más extrema».
- **El 503E:** cuatro cilindros en línea con cinemática real de biela y manivela y orden de encendido 1-3-4-2, junto al plano del motor que envió el cliente.
- **Manómetro** para «presiones absurdas» y **turbo en corte** con un **restrictor** en la boca del compresor, que sale despedido con «sin ningún tipo de restricciones».
- **Homologación:** una rejilla de 200 coches de calle (Grupo B) frente a los 10 en rojo del Grupo S, que aparecen cuando la voz dice cada cifra.
- **Tracción total Xtrac:** la planta del coche con el par fluyendo a las cuatro ruedas y un control genérico de reparto delante/detrás, que se mueve («regulable desde el habitáculo»).
- **300 → 750 caballos:** un manómetro con la marca del límite de 300 del Grupo S, que la aguja rebasa hasta 750.
- **750 kg ÷ 750 CV = 1 kg por caballo:** solo la operación que se deduce de las cifras del guion.
- **Un milímetro con el acelerador:** una curva de respuesta en la que un recorrido mínimo del pedal dispara la potencia.

### 4. Locución: alineada automáticamente
La toma entra entera tras la entrada de 2,5 s. El alineador de la serie casa los 107 fragmentos de voz con las 95 cláusulas del guion, por recuento de sílabas y programación dinámica: detecta 1785 sílabas frente a 1867 del guion. Le añadí la lectura de las siglas y cifras de este guion: «222D», «TTE», «MR2», «503E», «2.1», «750», «Xtrac».

Todos los cortes y rótulos se calculan a partir de ese mapa. Por ejemplo:
- «Audi», «Lancia» y «Peugeot» aparecen cada uno con su palabra;
- «Black Monster» cambia a «Darth Vader» cuando se nombra.

### 5. Música: tranquila, y solo rompe cuatro veces
Es el motor DSP de la serie (osciladores con antialiasing, filtros, reverb, delay y limitador), ahora en **Re menor**, con 19 secciones ancladas a frases:
- **Casi todo el vídeo** es *calma* (pad, notas sueltas de campana y un bajo largo, sin batería) o *pulso* (bajo en corcheas, bombo suave a medio tiempo y sin palmas). Queda unos 9 dB por debajo de las rupturas.
- **Solo cuatro rupturas**, con batería completa, cada una calculada en `timeline.js` sobre el momento exacto de la imagen:
  1. cuando aparece «222D» con la foto dentro de las letras;
  2. en la «S» de «Grupo S»;
  3. en «750 caballos», con la aguja pasando el límite;
  4. en «el mayor "y si…"», el único momento con melodía.
- Antes de cada ruptura suenan una subida y un platillo invertido. Solo la de los 750 caballos lleva además redoble.
- **Réquiem** para Toivonen y la cancelación: solo un bordón grave y el pad.
- En el clip de Goodwood la música baja a *calma* para que se oiga el motor real.

El diseño sonoro sigue a la imagen:
- un toque por cada rey;
- las lamas de la persiana que baja «bajo llave»;
- diez toques para los diez coches;
- el corte y la zaga que se abre;
- el cuatro cilindros al ralentí sobre su dibujo;
- el turbo que carga en el manómetro;
- el restrictor que sale y el turbo que sube libre;
- el motor que sube hasta los 750 caballos;
- un golpe de gas seco en «un milímetro»;
- el roce grave de la lona.

### 6. Determinismo y render
- **Función de tiempo:** `seek(t)` dibuja cada fotograma únicamente a partir de `t`, sin `Math.random`, relojes ni estado. El ruido sale de tablas con semilla.
- **Giros:** el ángulo de la turbina se integra desde el inicio del plano en cada fotograma.
- **Clip:** sus fotogramas se extraen una vez y se eligen por tiempo.
- **Desenfoque de movimiento:** render a 60 fps y máster a 30 fps promediando pares de fotogramas.

---

## Qué descarté

- **Una banda sonora épica de principio a fin,** como en los vídeos anteriores. El encargo pedía calma, así que la batería completa suena solo unos 30 s en total.
- **Fotos de terceros** para Toivonen, el Delta S4 o el accidente de Córcega. El tramo de Córcega va en tipografía sobria, sin imágenes del accidente, por respeto. La pregunta final sobre el 205 T16 y el Delta S4 va en texto, junto a la foto del 222D.
- **Inventar cifras:** no aparecen pesos, potencias ni comparativas con la Fórmula 1 que no estén en el guion. La relación «1 kg por caballo» es solo la división de las dos cifras que da la locución.
- **Usar los 9 segundos del clip al principio.** El clip es la prueba de que el coche sobrevivió y aún corre, así que encaja donde la voz habla de Goodwood.
- **Partículas, humo o resplandores** alrededor del coche. El dramatismo lo ponen el negro, el rojo y el ritmo de los cortes.

---

## Iteraciones

1. **Material:** revisé las 15 fotos en una hoja de contactos y el clip fotograma a fotograma (de frente hasta el segundo 3, alejándose hasta el 9). Medí el sonido del clip y alineé la locución.
2. **v0, un fotograma por plano (59) y ocho intermedios.** Corregí:
   - **el «222D» con la foto dentro**, que no se veía: el velo oscuro de la foto, compuesto en modo `source-in`, sustituía a la imagen dentro de las letras. Ahora la foto entra sin velo y la cifra lleva un contorno fino;
   - **las rayas bajo los titulares,** que tachaban las etiquetas («Liderado por el genio Ove Andersson», «Prototipos cien por cien espaciales»): separé raya y etiqueta;
   - **«Audi», «Lancia» y «Peugeot»,** que se pisaban: reduje el cuerpo;
   - **la rejilla de homologación,** que tocaba la etiqueta superior;
   - **el chasis en 3D,** que giraba hasta quedar de punta: limité el giro y lo amplié;
   - **la anotación «PASOS DE RUEDA»,** que se salía del cuadro;
   - **el icono del V6,** ilegible: ahora es un V6 visto de frente;
   - **la tacha de las fichas descartadas,** que cruzaba los iconos: ahora tacha el nombre;
   - **el botón «Me gusta» pulsado,** con texto blanco sobre blanco.
3. **Rupturas en sincronía con la imagen:** moví las cuatro rupturas de la música desde el inicio de la frase hasta el instante exacto del golpe visual («222D», la «S», «750», «y si…»).
4. **Música:** medí la sonoridad por tramos. La sección oscura del motor quedaba casi tan fuerte como una ruptura (−14,6 dB), así que la suavicé hasta −17,5 dB.
5. **v1, render completo (20.820 fotogramas a 60 fps), mezcla y hoja de contactos del máster.**

## Tiempo total

Unas 2 horas y media desde el encargo:
- 20 min de material y alineación;
- 1 h de los componentes de ingeniería y los 59 planos;
- 15 min de la música;
- unos 50 min de render, mezcla y revisión.

## Notas sobre el contenido

Las cifras y afirmaciones son las del guion del cliente:
- 10 frente a 200 coches de homologación;
- el bloque 503E de 4 cilindros y 2,1 litros;
- 300 caballos de límite teórico, 750 caballos y unos 750 kilos;
- la tracción Xtrac;
- mayo de 1986 y el Tour de Córcega.

Los dibujos son esquemas explicativos, no planos a escala del coche real. El perfil, el chasis y la vista frontal están construidos para mostrar la idea que cuenta la voz.

## Material de terceros

- **Fotografías y clip:** los proporcionó el cliente.
- **Logotipo:** EVO HERITAGE, del cliente.
- **Locución:** la generó el cliente (`vo/take.mp3`).
- **Fuentes:** IBM Plex Sans e IBM Plex Sans Condensed, de IBM (SIL Open Font License).
