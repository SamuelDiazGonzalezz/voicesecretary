# Evo Heritage — reel de motion graphics (20 s, 4K)

Pieza de 20 segundos para el lanzamiento de **Evo Heritage**, tienda de ropa rally inspirada en el Grupo B y lo retro.
Todo está generado por código: geometría 3D, liveries, tipografía, post-procesado y audio. Sin imágenes, vídeos ni sonidos generados por IA ni samples.

- Vídeo final: `entrega/evo-heritage-reel-4k.mp4` (3840×2160, 30 fps, H.264 + AAC 320k)
- Decisiones, descartes, iteraciones y tiempo: [`DECISIONES.md`](DECISIONES.md)

## Estructura

| Archivo | Qué hace |
|---|---|
| `timeline.json` | Fuente única de verdad: escenas, tempo, golpes, whooshes, curva de RPM, marchas, petardeos anti-lag. La leen el render y el audio. |
| `src/car.js` | Coche Grupo B procedural (perfil extruido, habitáculo, aletas, llantas, faros, alerón) + 4 liveries pintadas en canvas. |
| `src/scenes.js` | Las escenas 3D: estudio (ignición + revelado con dolly-zoom), tramo nocturno, lineup, camiseta 3D, logo final. |
| `src/overlay.js` | Capa 2D: tipografía cinética, HUD, tacómetro, callouts anclados a puntos 3D, transición de franjas, estampados. |
| `src/post.js` | Bloom + pase final propio: aberración cromática, desenfoque radial/direccional, flash, viñeta, grano. |
| `src/main.js` | Inicialización y `window.renderFrame(t)` (todo es función pura de `t`, render determinista). |
| `render.mjs` | Render offline: Chromium headless (WebGL vía SwiftShader) → PNG → ffmpeg. |
| `render-parallel.mjs` | Reparte los frames entre varios Chromium y une segmentos + audio. |
| `audio/synth.py` | Banda sonora sintetizada con numpy: motor turbo, anti-lag, blow-off, música 120 BPM, FX, reverb. |

## Reproducir

```bash
npm install                       # three + playwright (usa el Chromium del sistema/Playwright)
pip install numpy                 # único requisito del audio
node render-parallel.mjs --workers 3 --w 3840 --h 2160 --out out/evo-heritage-reel-4k.mp4
# preview rápida de fotogramas sueltos:
node render.mjs --w 960 --h 540 --times 1.6,4.0,8.5,12.0,15.5,19.5 --stills out/preview
```

Para verlo en vivo en un navegador: servir la carpeta (`npx serve .`) y abrir `index.html?w=1280&h=720&play=1`.

Fuentes: Inter Display (SIL OFL 1.1) y DejaVu Sans Mono (licencia libre de Bitstream Vera), incluidas en `assets/fonts`.
