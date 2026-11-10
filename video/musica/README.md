# Catálogo de música de EVO HERITAGE

Seis estilos para los documentales largos, todos compuestos y sintetizados desde cero por código, sin muestras ni bancos de sonidos, a 120 BPM. Cada demo dura 40 s: intro (4 compases), desarrollo (8), clímax (6) y cierre (2). Así se oye cómo respira cada estilo bajo una locución.

| Demo | Estilo | Tonalidad | Para qué vídeos |
|---|---|---|---|
| `out/01-epico-orquestal.mp3` | Cuerdas, metales y taikos | Re menor | Leyendas, victorias, grandes historias |
| `out/02-retro-80s.mp3` | Sintetizadores de los 80, caja con eco, bajo en octavas | Mi menor | La era del Grupo B, nostalgia |
| `out/03-tecnica-pulso.mp3` | Pulso electrónico, campanas FM, tic-tac | Do menor | Explicar ingeniería («Así funciona…») |
| `out/04-piano-emotivo.mp3` | Piano y cuerdas | La menor | Tragedias, despedidas, legados |
| `out/05-rock-tramo.mp3` | Guitarras distorsionadas, bajo y batería | Mi menor | Onboards, tramos, acción |
| `out/06-tension-misterio.mp3` | Ostinato grave, reloj, cuerdas disonantes | Si menor | Secretos, prohibiciones, misterios |

En un vídeo largo se pueden combinar: por ejemplo, *tensión* en la parte del secreto, *técnica* en la ingeniería y *épico* en el clímax.

## Cómo está hecho

- `synth.mjs`: la biblioteca de síntesis de la serie, compartida por todos los vídeos:
  - osciladores con antialiasing, filtros, reverb, delay ping-pong, sidechain y limitador;
  - batería, bajo, pads, arpegios y melodía;
  - **sección de cuerdas** (cinco voces por nota con vibrato);
  - **metales** (filtro que se abre al soplar);
  - **piano** (parciales inarmónicos y macillo);
  - **guitarra distorsionada** (doble toma abierta en estéreo);
  - **campanas FM**, **taiko**, **plato de choque**, **caja con puerta de los 80** y **caída de subgrave**;
  - diseño sonoro de motor, turbo y antilag.
- `demos/estilos.mjs`: las seis composiciones. `node demos/estilos.mjs` las genera todas y `node demos/estilos.mjs 04` solo una.

Todo es determinista: el mismo código da siempre el mismo audio. Las MP3 están normalizadas a −16 LUFS para compararlas en igualdad. En cada vídeo se mezclan bajo la voz a −14 LUFS.
