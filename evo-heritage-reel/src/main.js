// Punto de entrada: inicializa todo y expone window.renderFrame(t) al renderizador offline.
// Abrir index.html?w=1280&h=720&t=4.2 en un navegador muestra un frame concreto; ?play=1 lo reproduce en tiempo real.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { makeCar, drawSideProfile } from './car.js';
import { buildStudio, buildStage, buildLineup, buildMerch, buildLogo, LINE } from './scenes.js';
import { makePost } from './post.js';
import { drawOverlay, makePrintCanvases } from './overlay.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 3840, H = +q.get('h') || 2160;

async function loadFonts() {
  const faces = [
    ['Evo Display', 'InterDisplay-BlackItalic.otf', { style: 'italic', weight: '900' }],
    ['Evo Light', 'InterDisplay-ExtraLight.otf', { weight: '200' }],
    ['Evo Bold', 'InterDisplay-Bold.otf', { weight: '700' }],
    ['Evo Semi', 'InterDisplay-SemiBoldItalic.otf', { style: 'italic', weight: '600' }],
    ['Evo Mono', 'DejaVuSansMono-Bold.ttf', { weight: '700' }],
  ];
  for (const [name, file, desc] of faces) {
    const f = new FontFace(name, `url(assets/fonts/${file})`, desc);
    await f.load(); document.fonts.add(f);
  }
  const buf = await (await fetch('assets/fonts/InterDisplay-BlackItalic.otf')).arrayBuffer();
  const loader = new TTFLoader(); loader.reversed = q.get('rev') !== '0'; // Inter es CFF: contornos en sentido inverso a TrueType
  return new Font(loader.parse(buf));
}

function renderPortrait(renderer, env) {
  // render del coche a 3/4 con fondo transparente -> lienzo 2D para los estampados
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.9;
  const car = makeCar('heritage'); car.rotation.y = 0.15; scene.add(car);
  scene.add(new THREE.HemisphereLight('#ffffff', '#888888', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(4, 8, 6); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 1.6, 0.1, 100); cam.position.set(6.6, 2.4, 7.4); cam.lookAt(0.05, 0.62, 0);
  const w = 1600, h = 1000;
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  return c;
}

async function init() {
  const TL = await (await fetch('timeline.json')).json();
  const font3D = await loadFonts();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const portrait = renderPortrait(renderer, env);
  const prints = makePrintCanvases(portrait, drawSideProfile).map((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
  const ctx = { env, font3D, prints, TL, LINE };
  const S = { studio: buildStudio(ctx), stage: buildStage(ctx), lineup: buildLineup(ctx), merch: buildMerch(ctx), logo: buildLogo(ctx) };

  const ov = document.createElement('canvas'); ov.width = W; ov.height = H;
  const og = ov.getContext('2d');
  const post = makePost(renderer, W, H, ov);
  const U = post.final.uniforms;

  function sceneFor(t) {
    const id = TL.scenes.find((s) => t >= s.start && t < s.end)?.id ?? 'logo';
    const key = id === 'ignition' || id === 'reveal' ? 'studio' : id;
    return [id, S[key]];
  }
  window.renderFrame = (t) => {
    const [id, sc] = sceneFor(t);
    const r = sc.update(t);
    sc.camera.aspect = W / H; sc.camera.updateProjectionMatrix();
    post.renderPass.scene = sc.scene; post.renderPass.camera = sc.camera;
    const P = r.P;
    renderer.toneMappingExposure = P.exposure ?? 1;
    [post.bloom.strength, post.bloom.radius, post.bloom.threshold] = P.bloom;
    U.uTime.value = t; U.uCA.value = P.ca; U.uRadial.value = P.radial || 0;
    U.uCenter.value.set(...(P.center || [0.5, 0.5])); U.uDir.value.set(...(P.dir || [0, 0]));
    U.uVignette.value = P.vignette; U.uGrain.value = P.grain; U.uFlash.value = P.flash || 0;
    U.uFlashColor.value.set(P.flashColor || '#ffffff'); U.uFade.value = P.fade || 0;
    drawOverlay(og, t, id, r, ctx);
    post.ovTex.needsUpdate = true;
    post.composer.render();
    return id;
  };
  window.TL = TL;
  window.ready = true;
  if (q.has('t')) window.renderFrame(+q.get('t'));
  if (q.has('play')) { const t0 = performance.now(); const loop = () => { window.renderFrame(((performance.now() - t0) / 1000) % TL.duration); requestAnimationFrame(loop); }; loop(); }
}
init().catch((e) => { console.error(e); window.initError = String(e && e.stack || e); });
