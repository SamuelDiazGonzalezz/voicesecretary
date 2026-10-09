// Las seis escenas 3D. Cada una expone update(t) -> parámetros de post y datos para el overlay.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { makeCar, setLamps, rollWheels } from './car.js';
import { C, clamp, lerp, range, ease, rng, noise1, shake, keys } from './util.js';

RectAreaLightUniformsLib.init();

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.userData.canvas = c;
  return t;
}
function speckle(g, w, h, n, colors, seed, rmax = 2) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.globalAlpha = 0.2 + r() * 0.6;
    const s = 0.5 + r() * rmax; g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float a = pow(vY, 2.2) * f * uI; gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
}
function addBeams(car, len = 10, rad = 1.5) {
  const mat = beamMaterial('#cfe3ff');
  const geo = new THREE.ConeGeometry(rad, len, 40, 1, true);
  geo.rotateZ(Math.PI / 2); // vértice hacia -x
  car.userData.lamps.slice(4).forEach((p) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p).add(new THREE.Vector3(len / 2, 0, 0));
    m.rotation.z = -0.05; m.renderOrder = 10; car.add(m);
  });
  return mat;
}

function text3D(font, str, size, depth, mat) {
  const geo = new TextGeometry(str, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.08, bevelSize: size * 0.012, bevelSegments: 2 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

// ------------------------------------------------------------ ESTUDIO (ignición + revelado)
export function buildStudio(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030406');
  scene.fog = new THREE.FogExp2('#05070b', 0.03);
  scene.environment = ctx.env;

  const floorTex = canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 60000, ['#1b1e23', '#0b0c0e', '#23262c'], 7);
    g.translate(w / 2, h / 2);
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 6;
    for (const r of [420, 440]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 3;
    for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2, r0 = i % 10 === 0 ? 380 : 400; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 420, Math.sin(a) * 420); g.stroke(); }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.3, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.5, metalness: 0.2 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.005; outer.receiveShadow = true; scene.add(outer);

  const car = makeCar('heritage'); scene.add(car);
  const beams = addBeams(car, 11, 1.7);

  const hemi = new THREE.HemisphereLight('#8aa4c8', '#050505', 0.2); scene.add(hemi);
  const key = new THREE.SpotLight('#fff6ea', 0, 0, 0.55, 0.7, 0); key.position.set(2.5, 9, 3.5); key.target.position.set(0, 0.5, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; scene.add(key, key.target);
  const rimL = new THREE.RectAreaLight(C.light, 0, 7, 1.2); rimL.position.set(-4.5, 2.4, 4.2); rimL.lookAt(0, 0.8, 0); scene.add(rimL);
  const rimR = new THREE.RectAreaLight(C.red, 0, 7, 1.2); rimR.position.set(-4.5, 2.4, -4.2); rimR.lookAt(0, 0.8, 0); scene.add(rimR);
  const sweep = new THREE.RectAreaLight('#ffffff', 0, 0.5, 9); sweep.position.set(0, 3.4, 0); sweep.lookAt(0, 0, 0); scene.add(sweep);
  const head = new THREE.SpotLight('#fff1d6', 0, 40, 0.5, 0.6, 1.0); head.position.set(2.4, 0.8, 0); head.target.position.set(14, 0, 0); scene.add(head, head.target);

  let title = null;
  if (ctx.font3D) {
    const mat = new THREE.MeshStandardMaterial({ color: '#e9e3d6', roughness: 0.35, metalness: 0.15 });
    title = new THREE.Group();
    const a = text3D(ctx.font3D, 'GRUPO B', 3.1, 0.8, mat); title.add(a);
    title.position.set(-10, 0, 0); title.rotation.y = Math.PI / 2; scene.add(title);
  }
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  const lampProj = new THREE.Vector3();

  function update(t) {
    const P = { bloom: [0.9, 0.55, 0.78], exposure: 1.0, ca: 0.0025, radial: 0, dir: [0, 0], vignette: 0.75, grain: 0.06, flash: 0, flashColor: '#ffffff' };
    let lamps = 0;
    car.rotation.set(0, 0, 0); car.position.set(0, 0, 0);
    if (t < 2.5) {
      // ---------------- IGNICIÓN
      const on = t >= 1.5 ? clamp((t - 1.5) / 0.1) * (t < 1.62 ? 0.4 + 0.6 * (noise1(t * 90) * 0.5 + 0.5) : 1) : 0;
      lamps = on;
      const beat = t < 1.5 ? 1 - ((t % 0.5) / 0.5) : 0;
      rimL.intensity = 0.6 + beat * 5; rimR.intensity = 0.3 + beat * 2.5;
      key.intensity = 0; hemi.intensity = 0.05; sweep.intensity = 0;
      scene.environmentIntensity = 0.12 + on * 0.1;
      const push = ease.outCubic(range(t, 0, 1.5));
      const pull = ease.inOutExpo(range(t, 1.62, 2.5));
      const camA = new THREE.Vector3(6.4, 1.05, 2.9).lerp(new THREE.Vector3(5.3, 0.95, 2.2), push);
      const camB = new THREE.Vector3(11, 2.2, 6.5);
      camera.position.copy(camA).lerp(camB, pull);
      const s = shake(t, 3, 1);
      const look = new THREE.Vector3(1.2, 0.7, 0.0).lerp(new THREE.Vector3(0, 0.7, 0), pull);
      camera.position.x += s[0] * 0.02; camera.position.y += s[1] * 0.02;
      camera.fov = lerp(34, 42, pull); camera.lookAt(look);
      camera.rotateZ(lerp(-0.06, 0.03, pull) + (t > 1.5 ? noise1(t * 40) * 0.01 * (1 - range(t, 1.5, 2)) : 0));
      P.flash = t >= 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.18) * 0.55 : 0;
      P.flashColor = '#dfeeff';
      P.radial = 0.12 * Math.max(0, 1 - (t - 1.5) / 0.4) * (t >= 1.5 ? 1 : 0) + 0.14 * Math.sin(Math.PI * range(t, 1.65, 2.5));
      P.ca = 0.003 + P.radial * 0.03;
      P.bloom = [0.8, 0.3, 0.85];
      if (title) title.position.y = -4;
    } else {
      // ---------------- REVELADO 360 con dolly-zoom
      const lt = t - 2.5;
      lamps = 1;
      scene.environmentIntensity = 0.32;
      hemi.intensity = 0.15; key.intensity = 3.2 * ease.outCubic(range(lt, 0, 0.3)); rimL.intensity = 6; rimR.intensity = 6;
      const sw = (lt % 2) / 2; sweep.position.set(lerp(4.5, -4.5, ease.inOutSine(sw)), 3.0, 0); sweep.lookAt(sweep.position.x, 0, 0); sweep.intensity = 7 * Math.sin(Math.PI * sw);
      car.rotation.y = lt * 0.05;
      const K = lerp(2.25, 2.75, ease.inOutSine(range(lt, 0.9, 4)));
      let r, theta, h;
      if (lt < 0.9) { const p = ease.inOutCubic(range(lt, 0, 0.9)); r = lerp(4.4, 12, p); theta = lerp(0.42, 0.3, p); h = lerp(0.55, 0.9, p); }
      else { const p = ease.inOutCubic(range(lt, 0.9, 4)); r = lerp(12, 8.2, p); theta = lerp(0.3, -1.1, p); h = lerp(0.9, 1.7, p); }
      camera.position.set(Math.cos(theta) * r, h, Math.sin(theta) * r);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(K / r));
      camera.lookAt(0.1, 0.72, 0);
      camera.rotateZ(lerp(0.04, -0.02, range(lt, 0, 4)));
      if (title) title.position.y = lerp(-4, 0, ease.outExpo(range(lt, 0.15, 1.4)));
      P.flash = Math.max(0, 1 - lt / 0.22) * 0.9;
      P.radial = 0.08 * Math.max(0, 1 - lt / 0.5) + 0.25 * ease.inExpo(range(lt, 3.6, 4));
      P.ca = 0.0025 + P.radial * 0.03;
      P.bloom = [0.45, 0.28, 0.9];
    }
    const blast = t < 2.5 ? 1 + 3 * Math.max(0, 1 - (t - 1.5) / 0.25) : 0.3;
    const face = clamp((camera.position.x - 2) / Math.max(1e-3, camera.position.length()));
    setLamps(car, lamps * 2.5 * blast);
    beams.uniforms.uI.value = lamps * (t < 2.5 ? 0.1 : 0.05) * (1 - face * 0.85);
    head.intensity = lamps * (t < 2.5 ? 220 : 12);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); car.updateMatrixWorld();
    // datos para overlay
    const lampsScreen = car.userData.lamps.slice(4).map((p) => {
      lampProj.copy(p).applyMatrix4(car.matrixWorld).project(camera);
      return { x: (lampProj.x * 0.5 + 0.5), y: (1 - (lampProj.y * 0.5 + 0.5)), z: lampProj.z };
    });
    const proj = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(car.matrixWorld).project(camera); return { x: v.x * 0.5 + 0.5, y: 1 - (v.y * 0.5 + 0.5), z: v.z }; };
    const facing = camera.position.clone().normalize().x;
    return { P, lamps, lampsScreen, facing, proj };
  }
  return { scene, camera, update };
}

// ------------------------------------------------------------ TRAMO NOCTURNO
export function buildStage(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070e');
  scene.fog = new THREE.FogExp2('#080d1a', 0.035);
  scene.environment = ctx.env; scene.environmentIntensity = 0.12;
  const L = 240, X0 = -70; // ventana de mundo que se recicla

  const gravel = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#4a443c'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 90000, ['#6d665b', '#2c2924', '#837a6c', '#3a352f'], 3, 3);
    g.fillStyle = 'rgba(20,18,15,0.35)';
    for (const y of [0.3, 0.42, 0.58, 0.7]) g.fillRect(0, y * h, w, h * 0.05);
  });
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.repeat.set(L / 8, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, 9), new THREE.MeshStandardMaterial({ map: gravel, roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.x = X0 + L / 2; road.receiveShadow = true; scene.add(road);
  const dirt = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#121510'; g.fillRect(0, 0, w, h); speckle(g, w, h, 30000, ['#1d2218', '#0a0c08', '#262b1f'], 5, 3); });
  dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping; dirt.repeat.set(L / 6, 14);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(L, 84), new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(X0 + L / 2, -0.02, 0); ground.receiveShadow = true; scene.add(ground);

  const R = rng(42);
  const mkInst = (geo, mat, list) => { const m = new THREE.InstancedMesh(geo, mat, list.length); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return { m, list }; };
  const trees = [], trunks = [], crowd = [], poles = [];
  for (let i = 0; i < 220; i++) { const side = R() < 0.5 ? -1 : 1; trees.push({ x: R() * L, z: side * (7 + Math.pow(R(), 1.5) * 26), s: 0.7 + R() * 0.9, r: R() * 6 }); }
  trees.forEach((tr) => trunks.push(tr));
  for (let c = 0; c < 9; c++) { // grupos de público al borde del tramo (icono Grupo B)
    const cx = R() * L, side = R() < 0.5 ? -1 : 1, n = 10 + (R() * 14) | 0;
    for (let i = 0; i < n; i++) crowd.push({ x: cx + (R() - 0.5) * 9, z: side * (5.4 + R() * 3.5), s: 0.85 + R() * 0.3, r: R() });
  }
  for (let i = 0; i < L / 12; i++) for (const side of [-1, 1]) poles.push({ x: i * 12 + (side > 0 ? 6 : 0), z: side * 5.0, s: 1, r: 0 });
  const treeI = mkInst(new THREE.ConeGeometry(1.7, 8, 7), new THREE.MeshStandardMaterial({ color: '#0f1d15', roughness: 1, flatShading: true }), trees);
  const trunkI = mkInst(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#1b140e', roughness: 1 }), trunks);
  const crowdI = mkInst(new THREE.CapsuleGeometry(0.24, 1.0, 4, 10), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.8 }), crowd);
  const poleI = mkInst(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8), new THREE.MeshStandardMaterial({ color: '#d8232c', emissive: '#ff3a2a', emissiveIntensity: 0.4, roughness: 0.4 }), poles);
  const dummy = new THREE.Object3D();
  function placeAll(d) {
    const wrap = (x) => ((((x - d) % L) + L) % L) + X0;
    treeI.list.forEach((o, i) => { dummy.position.set(wrap(o.x), 2.2 + 4 * o.s, o.z); dummy.scale.setScalar(o.s); dummy.rotation.set(0, o.r, 0); dummy.updateMatrix(); treeI.m.setMatrixAt(i, dummy.matrix); });
    trunkI.list.forEach((o, i) => { dummy.position.set(wrap(o.x), 1.1, o.z); dummy.scale.setScalar(o.s); dummy.updateMatrix(); trunkI.m.setMatrixAt(i, dummy.matrix); });
    crowdI.list.forEach((o, i) => { dummy.position.set(wrap(o.x), 0.75 * o.s + 0.02, o.z); dummy.scale.set(o.s, o.s * (0.9 + o.r * 0.2), o.s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); crowdI.m.setMatrixAt(i, dummy.matrix); });
    poleI.list.forEach((o, i) => { dummy.position.set(wrap(o.x), 0.65, o.z); dummy.scale.setScalar(1); dummy.updateMatrix(); poleI.m.setMatrixAt(i, dummy.matrix); });
    [treeI, trunkI, crowdI, poleI].forEach((k) => (k.m.instanceMatrix.needsUpdate = true));
    gravel.offset.x = (d / 8) % 1; dirt.offset.x = (d / 6) % 1;
  }

  const car = makeCar('heritage'); scene.add(car);
  const beams = addBeams(car, 14, 2.4);
  setLamps(car, 3);
  const heads = [-0.5, 0.5].map((z, i) => {
    const s = new THREE.SpotLight('#fff0d0', 900, 80, 0.42, 0.55, 1.1);
    s.position.set(2.3, 0.85, z); s.target.position.set(16, 0, z * 3);
    if (i === 0) { s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0005; s.shadow.camera.near = 0.5; s.shadow.camera.far = 80; }
    car.add(s, s.target); return s;
  });
  const tail = new THREE.PointLight('#ff2a1a', 6, 8, 1.5); tail.position.set(-2.6, 0.7, 0); car.add(tail);
  const moon = new THREE.DirectionalLight('#7894cc', 0.7); moon.position.set(-30, 40, 20); scene.add(moon);
  scene.add(new THREE.HemisphereLight('#3c5280', '#050505', 0.25));

  // polvo en suspensión
  const dustN = 2200, dustPos = new Float32Array(dustN * 3), dustBase = [];
  const RD = rng(9);
  for (let i = 0; i < dustN; i++) dustBase.push([RD() * 90 - 20, RD() * 5, RD() * 22 - 11]);
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const spr = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.07, map: spr, color: '#d6dcea', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; scene.add(dust);
  // proyección de grava desde las ruedas traseras
  const gN = 1400, gPos = new Float32Array(gN * 3), gSeed = [];
  const RG = rng(77);
  for (let i = 0; i < gN; i++) gSeed.push([RG(), RG(), RG(), RG()]);
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  const grav = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.05, map: spr, color: '#c9b79a', transparent: true, opacity: 0.9, depthWrite: false }));
  grav.frustumCulled = false; scene.add(grav);
  const dustCloud = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.9, map: spr, color: '#6f6656', transparent: true, opacity: 0.035, depthWrite: false }));
  dustCloud.frustumCulled = false; scene.add(dustCloud);

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 400);
  const SPEED = 36;

  function update(t) {
    const lt = t - 6.5;
    const d = lt * SPEED;
    placeAll(d);
    // deriva del coche
    const yaw = lt < 1 ? 0.06 * Math.sin(lt * 5) : lt < 2 ? 0.48 * ease.outCubic(range(lt, 1, 1.35)) - 0.1 * range(lt, 1.6, 2)
      : lt < 3 ? lerp(-0.22, 0.25, ease.inOutSine(range(lt, 2, 3))) : 0.62 * ease.outQuart(range(lt, 3, 3.6));
    const sway = 0.9 * Math.sin(lt * 1.7);
    car.position.set(0, 0.02 * noise1(lt * 30), sway);
    car.rotation.set(-yaw * 0.06 + noise1(lt * 25 + 3) * 0.006, yaw, 0.012 * noise1(lt * 20));
    rollWheels(car, d, -yaw * 0.9);
    car.updateMatrixWorld();
    // polvo
    for (let i = 0; i < dustN; i++) {
      const b = dustBase[i];
      dustPos[i * 3] = ((((b[0] - d * 0.98) % 90) + 90) % 90) - 25;
      dustPos[i * 3 + 1] = b[1] + Math.sin(lt * 0.7 + i) * 0.1; dustPos[i * 3 + 2] = b[2];
    }
    dustGeo.attributes.position.needsUpdate = true;
    // grava: partículas balísticas deterministas
    const wheelsW = [new THREE.Vector3(-1.25, 0.1, 0.85), new THREE.Vector3(-1.25, 0.1, -0.85)].map((v) => v.applyMatrix4(car.matrixWorld));
    const life = 0.55;
    for (let i = 0; i < gN; i++) {
      const s = gSeed[i];
      const age = (((lt + s[0] * life) % life) + life) % life;
      const birth = lt - age;
      const w = wheelsW[i & 1];
      const vx = -(8 + s[1] * 10), vy = 1.5 + s[2] * 4.5, vz = (s[3] - 0.5) * 6 + (i & 1 ? -1 : 1) * Math.abs(yaw) * 6;
      gPos[i * 3] = w.x + vx * age - (SPEED) * 0 + (birth - lt) * 0;
      gPos[i * 3 + 1] = Math.max(0.02, w.y + vy * age - 4.9 * age * age);
      gPos[i * 3 + 2] = w.z + vz * age;
    }
    gGeo.attributes.position.needsUpdate = true;

    // cámaras (corte en cada compás)
    const P = { bloom: [0.6, 0.3, 0.85], exposure: 1.05, ca: 0.003, radial: 0, dir: [0, 0], vignette: 0.85, grain: 0.07, flash: 0, flashColor: '#ffffff', center: [0.5, 0.5] };
    const cp = car.position;
    let pos, look, fov, roll = 0, shk = 0.04;
    if (lt < 1) {
      const p = lt;
      pos = new THREE.Vector3(7.8 - 2.6 * p, 0.42, 1.9 + 0.3 * p).add(new THREE.Vector3(0, 0, cp.z * 0.6));
      look = cp.clone().add(new THREE.Vector3(0.6, 0.7, 0)); fov = 36; roll = 0.07; shk = 0.03;
      P.flash = Math.max(0, 1 - lt / 0.15) * 0.8;
    } else if (lt < 2) {
      const p = lt - 1;
      pos = cp.clone().add(new THREE.Vector3(1.2 - 1.6 * p, 0.85, 6.9)); look = cp.clone().add(new THREE.Vector3(0.2 - 0.4 * p, 0.6, 0)); fov = 33; roll = -0.02; shk = 0.05;
    } else if (lt < 3) {
      const p = lt - 2;
      pos = cp.clone().add(new THREE.Vector3(-7.6 + 0.8 * p, 1.5, 1.2 - p * 1.5)); look = cp.clone().add(new THREE.Vector3(4, 0.5, 0)); fov = 50; roll = 0.03 * Math.sin(p * 6); shk = 0.09;
      P.radial = 0.06; P.center = [0.5, 0.48];
    } else {
      const p = ease.inOutCubic(range(lt, 3, 3.75));
      pos = cp.clone().add(new THREE.Vector3(lerp(4.5, -1.5, p), lerp(1.2, 8.5, p), lerp(6.5, 2.5, p))); look = cp.clone().add(new THREE.Vector3(1, 0.4, 0)); fov = lerp(38, 46, p); roll = lerp(0.05, -0.15, p); shk = 0.05;
    }
    const s = shake(t, 9, 3);
    pos.x += s[0] * shk; pos.y += s[1] * shk; pos.z += s[2] * shk;
    camera.position.copy(pos); camera.fov = fov; camera.lookAt(look); camera.rotateZ(roll);
    // whip pan de salida
    const whip = ease.inExpo(range(lt, 3.7, 4));
    camera.rotateY(-whip * 0.9);
    P.dir = [0.22 * whip, 0];
    P.ca += whip * 0.01;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    beams.uniforms.uI.value = lt < 1 ? 0.05 : 0.14;
    return { P, lt };
  }
  return { scene, camera, update };
}

// ------------------------------------------------------------ LINEUP
const LINE = [
  { key: 'heritage', name: 'HERITAGE', color: C.light, num: '01', year: '1983' },
  { key: 'quattro', name: 'GIALLO', color: C.yellow, num: '02', year: '1984' },
  { key: 'lion', name: 'BLEU', color: C.blue, num: '03', year: '1985' },
  { key: 'manta', name: 'NOIR', color: C.navy, num: '04', year: '1986' },
];
export function buildLineup(ctx) {
  const scene = new THREE.Scene();
  const bg = '#ebe5d8';
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 22, 60);
  scene.environment = ctx.env; scene.environmentIntensity = 0.85;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 80), new THREE.MeshStandardMaterial({ color: '#e7e1d4', roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b5ad9f', 1.0));
  const sun = new THREE.DirectionalLight('#fff7ea', 2.4); sun.position.set(8, 14, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 20, bottom: -20, near: 1, far: 60 }); sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const SP = 8;
  const cars = LINE.map((l, i) => {
    const car = makeCar(l.key); car.position.set(i * SP, 0, 0); scene.add(car);
    car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // panel inclinado de color
    const sh = new THREE.Shape(); sh.moveTo(-3.6, 0); sh.lineTo(2.4, 0); sh.lineTo(4.4, 6); sh.lineTo(-1.6, 6); sh.closePath();
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: l.color }));
    panel.position.set(i * SP, 0, -3.2); scene.add(panel);
    const tex = canvasTex(1600, 1600, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = 'italic 900 900px "Evo Display"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText(l.num, w * 0.55, h * 0.7);
      g.font = 'italic 900 150px "Evo Display"'; g.fillStyle = '#ffffff'; g.fillText(l.year, w * 0.62, h * 0.86);
      g.font = '200 64px "Evo Light"'; g.letterSpacing = '24px'; g.fillText('GRUPO B · ' + l.name, w * 0.6, h * 0.94);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    label.position.set(i * SP + 0.6, 3, -3.15); scene.add(label);
    return car;
  });
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const slot = 1.0; // un coche por compás de 2 tiempos (120 BPM)
  function camX(lt) {
    const u = lt / slot, i = Math.min(3, Math.floor(u));
    if (i >= 3) return 3 * SP;
    const f = u - i;
    return (i + ease.inOutExpo(clamp((f - 0.5) / 0.5))) * SP;
  }
  function update(t) {
    const lt = t - 10.5;
    const x = camX(lt);
    const vel = (camX(lt + 0.02) - camX(lt - 0.02)) / 0.04;
    cars.forEach((c, i) => { c.rotation.y = -0.75 + lt * 0.3 + i * 0.12; c.position.y = 0; });
    const end = ease.inExpo(range(lt, 3.15, 3.5));
    camera.position.set(x - 1.4 + end * 2.5, lerp(1.35, 1.0, end), lerp(9.2, 3.2, end) - (lt % slot) * 0.25);
    camera.fov = lerp(30, 38, end);
    camera.lookAt(x + 0.4, 0.85, 0); camera.rotateZ(-0.02 + noise1(lt * 2) * 0.01);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    sun.position.set(x + 8, 14, 10); sun.target.position.set(x, 0, 0); sun.target.updateMatrixWorld();
    const P = { bloom: [0.06, 0.2, 1.6], exposure: 0.95, ca: 0.002, radial: end * 0.35, dir: [clamp(vel / SP, 0, 3) * 0.012, 0], vignette: 0.35, grain: 0.045, flash: Math.max(0, 1 - lt / 0.15) * 0.9 + end * 0.9, flashColor: '#ffffff', center: [0.5, 0.5] };
    const idx = Math.min(3, Math.round(x / SP));
    return { P, lt, idx, vel };
  }
  return { scene, camera, update, LINE };
}

// ------------------------------------------------------------ MERCH (camiseta 3D)
function teeShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.37, -0.52);
  s.lineTo(0.37, -0.52);
  s.quadraticCurveTo(0.385, -0.1, 0.37, 0.2);
  s.lineTo(0.6, 0.06);
  s.lineTo(0.74, 0.32);
  s.quadraticCurveTo(0.5, 0.5, 0.26, 0.53);
  s.lineTo(0.14, 0.55);
  s.quadraticCurveTo(0, 0.42, -0.14, 0.55);
  s.lineTo(-0.26, 0.53);
  s.quadraticCurveTo(-0.5, 0.5, -0.74, 0.32);
  s.lineTo(-0.6, 0.06);
  s.lineTo(-0.37, 0.2);
  s.quadraticCurveTo(-0.385, -0.1, -0.37, -0.52);
  return s;
}
function bend(geo, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) - k * x * x - 0.03 * Math.sin(y * 9 + x * 4)); }
  geo.computeVertexNormals();
}
export function buildMerch(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6decd');
  scene.environment = ctx.env; scene.environmentIntensity = 0.7;
  const marquee = canvasTex(4096, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'italic 900 420px "Evo Display"'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#cfc5b0';
    g.strokeText('DROP 01 — EVO HERITAGE — ', 0, h * 0.28);
    g.fillStyle = '#e2d9c6'; g.fillText('GRUPO B — RETRO — RALLY — ', -900, h * 0.76);
  });
  marquee.wrapS = THREE.RepeatWrapping;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: marquee, transparent: true }));
  back.position.set(0, 0.1, -3.2); scene.add(back);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.95; floor.receiveShadow = true; scene.add(floor);

  const depth = 0.07;
  const geo = new THREE.ExtrudeGeometry(teeShape(), { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 5, curveSegments: 20 });
  geo.translate(0, 0, -depth / 2);
  const knit = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? '#9a9a9a' : '#666'; g.fillRect(x, 0, 2, h); } speckle(g, w, h, 8000, ['#555', '#aaa'], 2, 1); }, false);
  knit.wrapS = knit.wrapT = THREE.RepeatWrapping; knit.repeat.set(1.5, 1.5);
  const fabric = new THREE.MeshPhysicalMaterial({ color: '#f4f2ec', roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'), bumpMap: knit, bumpScale: 0.4 });
  // subdividir para que el doblado se note: re-extrusión ya tiene suficientes vértices en el contorno; las tapas se doblan por vértice
  bend(geo, 0.22);
  const tee = new THREE.Mesh(geo, fabric); tee.castShadow = true;
  const neck = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.14, 0.55, depth / 2 + 0.03), new THREE.Vector3(0, 0.41, depth / 2 + 0.05), new THREE.Vector3(-0.14, 0.55, depth / 2 + 0.03));
  const collarMat = new THREE.MeshPhysicalMaterial({ color: '#e7e3da', roughness: 0.9, sheen: 1 });
  const collar = new THREE.Mesh(new THREE.TubeGeometry(neck, 32, 0.022, 10), collarMat);
  const printGeo = new THREE.PlaneGeometry(0.54, 0.54, 30, 30);
  printGeo.translate(0, 0.02, depth / 2 + 0.037);
  bend(printGeo, 0.22);
  // la tapa extruida no tiene vértices interiores (no se curva igual que el estampado): se dibuja encima sin test de profundidad; al girar de espaldas se descarta por ser FrontSide
  const printMat = new THREE.MeshStandardMaterial({ map: ctx.prints[0], transparent: true, roughness: 0.75, depthTest: false });
  const print = new THREE.Mesh(printGeo, printMat); print.renderOrder = 5;
  const teeG = new THREE.Group(); teeG.add(tee, collar, print); scene.add(teeG);

  scene.add(new THREE.HemisphereLight('#ffffff', '#d8cfbf', 1.1));
  const key = new THREE.DirectionalLight('#fff3e2', 3); key.position.set(-2, 3, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe6ff', 2); rim.position.set(3, 2, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 100);
  const COLORS = [['#f4f2ec', '#e7e3da'], ['#141416', '#0e0e10'], ['#14284c', '#0e1d3a']];
  function update(t) {
    const lt = t - 14;
    const idx = lt < 1 ? 0 : lt < 2 ? 1 : 2;
    fabric.color.set(COLORS[idx][0]); collarMat.color.set(COLORS[idx][1]);
    fabric.sheenColor.set(idx ? '#6d7a96' : '#ffffff');
    printMat.map = ctx.prints[idx];
    const spin = (c) => Math.PI * 2 * ease.inOutExpo(range(lt, c - 0.24, c + 0.24));
    const intro = (1 - ease.outExpo(range(lt, 0, 0.6)));
    teeG.rotation.set(0.05 * Math.sin(lt * 2), 0.38 * Math.sin(lt * 1.6 + 0.6) + spin(1) + spin(2) - intro * 2.2, 0.03 * Math.sin(lt * 1.3));
    teeG.position.set(0.42 + intro * 1.5, 0.02 * Math.sin(lt * 2.4), -intro * 1.5);
    marquee.offset.x = lt * 0.06;
    camera.position.set(0.05, 0.08, lerp(2.75, 2.4, ease.inOutSine(range(lt, 0, 3))));
    camera.lookAt(0.05, 0.02, 0); camera.rotateZ(0.02 * Math.sin(lt));
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const spinV = Math.abs(spin(1) + spin(2) - (Math.PI * 2 * ease.inOutExpo(range(lt - 0.03, 0.76, 1.24)) + Math.PI * 2 * ease.inOutExpo(range(lt - 0.03, 1.76, 2.24))));
    const P = { bloom: [0.06, 0.2, 1.6], exposure: 1.0, ca: 0.0015 + spinV * 0.01, radial: 0, dir: [spinV * 0.05, 0], vignette: 0.3, grain: 0.04, flash: Math.max(0, 1 - lt / 0.12), flashColor: '#ffffff', center: [0.5, 0.5] };
    return { P, lt, idx };
  }
  return { scene, camera, update };
}

// ------------------------------------------------------------ LOGO FINAL
export function buildLogo(ctx) {
  const scene = new THREE.Scene();
  const bg = '#f2eee6';
  scene.background = new THREE.Color(bg);
  scene.environment = ctx.env; scene.environmentIntensity = 0.9;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc6b6', 1.3));
  const sun = new THREE.DirectionalLight('#fff8ee', 3.2); sun.position.set(3, 12, 7); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 }); sun.shadow.radius = 4; scene.add(sun);

  const car = makeCar('heritage'); scene.add(car);
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // gráficos sobre el suelo: franja amarilla + cheurón rojo (identidad Evo Heritage)
  const gfx = new THREE.Group(); scene.add(gfx);
  const mkFlat = (shape, color) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, toneMapped: false })); m.rotation.x = -Math.PI / 2; return m; };
  const stripe = new THREE.Shape(); stripe.moveTo(0, 0); stripe.lineTo(11, 0); stripe.lineTo(11.4, 0.32); stripe.lineTo(0.4, 0.32); stripe.closePath();
  const stripeM = mkFlat(stripe, C.yellow); const stripeB = mkFlat(stripe, '#141414');
  const chev = new THREE.Shape(); chev.moveTo(0, 0); chev.lineTo(3.2, 0); chev.lineTo(4.6, 0.75); chev.lineTo(2.2, 0.42); chev.lineTo(0.9, 0.8); chev.closePath();
  const chevM = mkFlat(chev, C.red);
  const sG = new THREE.Group(); sG.add(stripeB, stripeM); stripeB.position.set(-0.15, 0.001, 0.38); stripeM.position.y = 0.002;
  sG.position.set(-4.3, 0, 5.4); sG.rotation.y = 0.68; gfx.add(sG);
  chevM.position.set(-5.9, 0.003, 7.0); chevM.rotation.z = 0.68; gfx.add(chevM);

  // letras 3D "EVO HERITAGE" que emergen del suelo
  const letters = [];
  if (ctx.font3D) {
    const mat = new THREE.MeshStandardMaterial({ color: '#8f949b', roughness: 0.35, metalness: 0.6 });
    const word = 'EVO HERITAGE'; let x = 0; const size = 0.27, gap = 0.09;
    const g = new THREE.Group();
    for (const ch of word) {
      if (ch === ' ') { x += size * 0.7; continue; }
      const m = text3D(ctx.font3D, ch, size, 0.16, mat); m.geometry.computeBoundingBox();
      const w = m.geometry.boundingBox.max.x - m.geometry.boundingBox.min.x;
      m.position.x = x + w / 2; x += w + gap; m.castShadow = true; g.add(m); letters.push(m);
    }
    g.children.forEach((m) => (m.position.x -= x / 2));
    g.position.set(2.0, 0, 2.75); g.rotation.y = 0.68; scene.add(g);
  }
  // nube de polvo al frenar
  const pN = 500, pPos = new Float32Array(pN * 3), pS = []; const RP = rng(5);
  for (let i = 0; i < pN; i++) pS.push([RP(), RP(), RP(), RP()]);
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const spr = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const puffMat = new THREE.PointsMaterial({ size: 0.9, map: spr, color: '#b9ab92', transparent: true, opacity: 0.25, depthWrite: false });
  const puff = new THREE.Points(pGeo, puffMat); puff.frustumCulled = false; scene.add(puff);

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
  function update(t) {
    const lt = t - 17;
    const arrive = ease.outExpo(range(lt, 0, 0.9));
    const yaw = 0.75 * (1 - ease.outBack(range(lt, 0.1, 1.0)));
    car.position.set(lerp(-16, 0, arrive), 0, lerp(-3, 0, arrive));
    car.rotation.set(0, yaw, 0);
    rollWheels(car, car.position.x, -yaw);
    setLamps(car, 3);
    // polvo
    const pa = range(lt, 0.45, 2.6);
    for (let i = 0; i < pN; i++) {
      const s = pS[i], r = pa * (1.5 + s[0] * 3.5);
      pPos[i * 3] = -1.6 + (s[1] - 0.6) * 2 - r * 0.6; pPos[i * 3 + 1] = 0.2 + s[2] * 0.8 * pa + r * 0.15; pPos[i * 3 + 2] = (s[3] - 0.5) * 2.8 + (s[3] - 0.5) * r;
    }
    pGeo.attributes.position.needsUpdate = true;
    puffMat.opacity = 0.32 * (lt > 0.45 ? 1 - pa : 0);
    // franja y cheurón se "dibujan"
    sG.scale.x = Math.max(0.001, ease.outExpo(range(lt, 0.55, 1.2)));
    chevM.scale.set(Math.max(0.001, ease.outBack(range(lt, 0.75, 1.15))), 1, 1);
    letters.forEach((m, i) => { const p = ease.outBack(range(lt, 1.0 + i * 0.06, 1.4 + i * 0.06)); m.scale.set(1, Math.max(0.001, p), 1); m.visible = p > 0.001; m.rotation.x = (1 - clamp(p)) * -0.5; });
    const push = ease.inOutSine(range(lt, 0, 3));
    camera.position.set(lerp(5.9, 5.2, push), lerp(1.7, 1.45, push), lerp(7.4, 6.6, push));
    camera.fov = 31; camera.lookAt(0.5, 0.95, 1.2);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const slam = lt >= 2 ? Math.max(0, 1 - (lt - 2) / 0.25) : 0;
    const P = { bloom: [0.06, 0.2, 1.6], exposure: 1.0, ca: 0.0015 + slam * 0.01, radial: slam * 0.05, dir: [0, 0], vignette: 0.3, grain: 0.04, flash: Math.max(0, 1 - lt / 0.14) * 0.9, flashColor: '#ffffff', center: [0.5, 0.5], fade: ease.inCubic(range(lt, 2.75, 3)) };
    return { P, lt, slam };
  }
  return { scene, camera, update };
}
export { LINE };
