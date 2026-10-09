// Coche de rally Grupo B 100% procedural: perfil lateral extruido + piezas.
import * as THREE from 'three';
import { C } from './util.js';

// Coordenadas del perfil (metros). x hacia delante, y hacia arriba.
const WHEEL_X = 1.25, WHEEL_R = 0.34, WHEEL_Y = 0.34;
const BODY_W = 1.78; // ancho sin bisel
const TEX = { x0: -2.25, x1: 2.25, y0: 0, y1: 1.5, W: 3072, H: 1024 };

function bodyShape() {
  const s = new THREE.Shape();
  const archR = 0.45, by = 0.22;
  const a0 = Math.asin((by - WHEEL_Y) / archR);
  s.moveTo(-2.02, 0.28);
  s.lineTo(-2.0, by);
  for (const wx of [-WHEEL_X, WHEEL_X]) {
    const dx = Math.cos(a0) * archR;
    s.lineTo(wx - dx, by);
    s.absarc(wx, WHEEL_Y, archR, Math.PI - a0, a0, true);
  }
  s.lineTo(1.95, by);
  s.lineTo(2.08, 0.32);
  s.lineTo(2.1, 0.56);
  s.lineTo(2.02, 0.7);
  s.lineTo(1.05, 0.86);
  s.lineTo(-1.55, 0.92);
  s.lineTo(-1.98, 0.88);
  s.lineTo(-2.06, 0.6);
  s.lineTo(-2.02, 0.28);
  return s;
}
function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(1.06, 0.8);
  s.lineTo(0.08, 1.36);
  s.lineTo(-1.32, 1.38);
  s.lineTo(-1.9, 0.92);
  s.lineTo(-1.9, 0.8);
  s.lineTo(1.06, 0.8);
  return s;
}

// --- Texturas de librea (se pintan en coordenadas del perfil) ---
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const px = (x) => ((x - TEX.x0) / (TEX.x1 - TEX.x0)) * TEX.W;
const py = (y) => (1 - (y - TEX.y0) / (TEX.y1 - TEX.y0)) * TEX.H;
function band(ctx, pts, color) { // polígono en coords de perfil
  ctx.fillStyle = color; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
  ctx.closePath(); ctx.fill();
}
function sweep(ctx, y0f, y1r, thick, color) { // franja que sube de delante (x=2.2) a atrás (x=-2.2)
  band(ctx, [[2.3, y0f], [2.3, y0f + thick], [-2.3, y1r + thick], [-2.3, y1r]], color);
}

export const LIVERIES = {
  heritage: {
    name: 'HERITAGE', num: '6', base: '#f4f3ef', glassTint: '#0c1116', pillar: '#f4f3ef', rim: '#f2f2f2', hood: [[C.navy, 0.0, 0.16], [C.light, 0.17, 0.07], [C.red, 0.245, 0.05]],
    paint(ctx) {
      ctx.fillStyle = this.base; ctx.fillRect(0, 0, TEX.W, TEX.H);
      sweep(ctx, 0.42, 0.66, 0.12, C.navy);
      sweep(ctx, 0.555, 0.795, 0.045, C.light);
      sweep(ctx, 0.61, 0.85, 0.035, C.red);
      band(ctx, [[2.3, 0.0], [2.3, 0.3], [-2.3, 0.3], [-2.3, 0]], '#1a1c20');
    },
  },
  quattro: {
    name: 'GIALLO', num: '1', base: '#f2b71e', glassTint: '#0c0c0c', pillar: '#f2b71e', rim: '#f5f5f5', hood: [['#111', -0.3, 0.6]],
    paint(ctx) {
      ctx.fillStyle = this.base; ctx.fillRect(0, 0, TEX.W, TEX.H);
      band(ctx, [[2.3, 0.0], [2.3, 0.36], [-2.3, 0.36], [-2.3, 0]], '#141414');
      band(ctx, [[0.9, 0.2], [1.25, 0.2], [0.55, 1.1], [0.2, 1.1]], '#f6f3ea');
      band(ctx, [[1.32, 0.2], [1.5, 0.2], [0.8, 1.1], [0.62, 1.1]], C.red);
      sweep(ctx, 0.62, 0.62, 0.03, '#141414');
    },
  },
  lion: {
    name: 'BLEU', num: '4', base: '#f5f5f2', glassTint: '#0b1220', pillar: '#f5f5f2', rim: '#e9e9e9', hood: [[C.blue, 0.3, 0.12], [C.red, 0.43, 0.06]],
    paint(ctx) {
      ctx.fillStyle = this.base; ctx.fillRect(0, 0, TEX.W, TEX.H);
      const cols = [C.navy, C.blue, C.light, C.red];
      cols.forEach((c, i) => {
        const o = i * 0.24;
        band(ctx, [[-0.4 - o, 0.2], [-0.25 - o, 0.2], [-1.0 - o, 1.4], [-1.15 - o, 1.4]], c);
      });
      band(ctx, [[2.3, 0.0], [2.3, 0.27], [-2.3, 0.27], [-2.3, 0]], C.navy);
    },
  },
  manta: {
    name: 'NOIR', num: '3', base: '#ececea', glassTint: '#111', pillar: '#16171a', rim: '#cfcfcf', hood: [['#16171a', 0.2, 0.3], [C.yellow, 0.52, 0.1]],
    paint(ctx) {
      ctx.fillStyle = this.base; ctx.fillRect(0, 0, TEX.W, TEX.H);
      band(ctx, [[-0.2, 0.2], [0.35, 0.2], [-0.35, 1.4], [-0.9, 1.4]], '#16171a');
      band(ctx, [[0.4, 0.2], [0.62, 0.2], [-0.08, 1.4], [-0.3, 1.4]], C.yellow);
      band(ctx, [[-1.0, 0.2], [-0.6, 0.2], [-1.3, 1.4], [-1.7, 1.4]], '#8d9096');
      band(ctx, [[2.3, 0.0], [2.3, 0.3], [-2.3, 0.3], [-2.3, 0]], '#16171a');
    },
  },
};

function cabinPaint(ctx, liv) {
  ctx.fillStyle = liv.pillar; ctx.fillRect(0, 0, TEX.W, TEX.H);
  ctx.fillStyle = liv.glassTint;
  ctx.beginPath(); // ventanas laterales
  [[0.86, 0.95], [0.12, 1.3], [-1.24, 1.32], [-1.72, 0.95]].forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
  ctx.closePath(); ctx.fill();
  // pilar B
  ctx.fillStyle = liv.pillar; ctx.fillRect(px(-0.42), py(1.36), px(-0.3) - px(-0.42), py(0.9) - py(1.36));
  // reflejo en cristal
  const g = ctx.createLinearGradient(px(0.5), py(1.3), px(-0.4), py(0.95));
  g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(px(1), py(1.4), px(-1.8) - px(1), py(0.9) - py(1.4));
}

const texCache = new Map();
function liveryTextures(key) {
  if (texCache.has(key)) return texCache.get(key);
  const liv = LIVERIES[key];
  const body = mkCanvas(TEX.W, TEX.H); liv.paint(body.getContext('2d'));
  const cab = mkCanvas(TEX.W, TEX.H); cabinPaint(cab.getContext('2d'), liv);
  const mk = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.repeat.set(1 / (TEX.x1 - TEX.x0), 1 / (TEX.y1 - TEX.y0));
    t.offset.set(-TEX.x0 / (TEX.x1 - TEX.x0), -TEX.y0 / (TEX.y1 - TEX.y0));
    return t;
  };
  const r = { body: mk(body), cab: mk(cab), bodyCanvas: body, cabCanvas: cab };
  texCache.set(key, r);
  return r;
}

function numberTexture(num) {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#fbfbf8'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#111'; g.font = 'italic 900 190px "Evo Display"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(num, 128, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rimTexture(color) {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#121212'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = color; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16161a';
  for (let i = 0; i < 8; i++) { // agujeros tipo llanta de rally
    const a = (i / 8) * Math.PI * 2;
    g.beginPath(); g.arc(128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78, 24, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(128, 128, 26, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textTexture(text, w, h, font, fg = '#fff', bg = 'rgba(0,0,0,0)') {
  const c = mkCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const paint = (color, map = null) => new THREE.MeshPhysicalMaterial({
  color: map ? 0xffffff : color, map, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06,
});

// Coloca un plano sobre un segmento inclinado del perfil (capó / parabrisas)
function slopePlane(geo, mat, a, b, along, normalOffset, zc = 0) {
  const m = new THREE.Mesh(geo, mat);
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0).normalize(); // sube por la pendiente
  const xAxis = new THREE.Vector3(0, 0, -1);
  const n = new THREE.Vector3().crossVectors(xAxis, dir).normalize();
  const basis = new THREE.Matrix4().makeBasis(xAxis, dir, n);
  m.quaternion.setFromRotationMatrix(basis);
  m.position.set(a[0] + (b[0] - a[0]) * along, a[1] + (b[1] - a[1]) * along, zc).addScaledVector(n, normalOffset);
  return m;
}

export function makeCar(key = 'heritage') {
  const liv = LIVERIES[key];
  const tx = liveryTextures(key);
  const car = new THREE.Group();
  car.name = 'car-' + key;

  // Carrocería inferior
  const bevelT = 0.06;
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(), { depth: BODY_W, bevelEnabled: true, bevelThickness: bevelT, bevelSize: 0.05, bevelSegments: 4, curveSegments: 28 });
  bodyGeo.translate(0, 0, -BODY_W / 2);
  const body = new THREE.Mesh(bodyGeo, [paint(liv.base, tx.body), paint(liv.base)]);
  body.castShadow = body.receiveShadow = true;
  car.add(body);

  // Habitáculo
  const cabW = 1.42;
  const cabGeo = new THREE.ExtrudeGeometry(cabinShape(), { depth: cabW, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4, curveSegments: 8 });
  cabGeo.translate(0, 0, -cabW / 2);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 });
  const cab = new THREE.Mesh(cabGeo, [paint(liv.pillar, tx.cab), glass]);
  cab.castShadow = true;
  car.add(cab);

  // Techo + toma de aire
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, cabW + 0.06), paint(liv.base));
  roof.position.set(-0.62, 1.395, 0); roof.rotation.z = -0.012; car.add(roof);
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.42), paint(liv.base));
  scoop.position.set(-0.55, 1.46, 0); car.add(scoop);
  const scoopHole = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.06), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  scoopHole.position.set(-0.299, 1.46, 0); scoopHole.rotation.y = Math.PI / 2; car.add(scoopHole);

  // Pancarta del parabrisas
  const banner = slopePlane(new THREE.PlaneGeometry(1.25, 0.16),
    new THREE.MeshBasicMaterial({ map: textTexture('EVO HERITAGE', 1024, 132, 'italic 900 92px "Evo Display"', '#f2f2f2', '#0a0a0a'), toneMapped: false }),
    [1.06, 0.8], [0.08, 1.36], 0.86, 0.056);
  car.add(banner);

  // Rayas del capó
  const hoodA = [2.02, 0.7], hoodB = [1.05, 0.86];
  const hoodLen = Math.hypot(hoodB[0] - hoodA[0], hoodB[1] - hoodA[1]);
  for (const [col, z, w] of liv.hood) {
    for (const s of z === 0 ? [0] : [1, -1]) {
      const m = slopePlane(new THREE.PlaneGeometry(w, hoodLen), paint(col), hoodA, hoodB, 0.5, 0.058, s * z);
      car.add(m);
    }
  }

  // Aletas ensanchadas (box flares)
  const flareShape = new THREE.Shape();
  flareShape.absarc(0, 0, 0.56, -0.2, Math.PI + 0.2, false);
  flareShape.absarc(0, 0, 0.45, Math.PI + 0.2, -0.2, true);
  const flareGeo = new THREE.ExtrudeGeometry(flareShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
  for (const wx of [-WHEEL_X, WHEEL_X]) for (const s of [1, -1]) {
    const f = new THREE.Mesh(flareGeo, paint(liv.base));
    f.position.set(wx, WHEEL_Y, s > 0 ? BODY_W / 2 + bevelT - 0.04 : -(BODY_W / 2 + bevelT - 0.04) - 0.1);
    f.castShadow = true; car.add(f);
  }

  // Ruedas
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ map: rimTexture(liv.rim), roughness: 0.4, metalness: 0.3 });
  const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.27, 36); tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CircleGeometry(0.23, 36);
  const wheels = [];
  for (const wx of [-WHEEL_X, WHEEL_X]) for (const s of [1, -1]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat); tire.castShadow = true; w.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.z = s * 0.137; if (s < 0) rim.rotation.y = Math.PI; w.add(rim);
    const holder = new THREE.Group(); holder.position.set(wx, WHEEL_Y, s * (BODY_W / 2 - 0.05)); holder.add(w);
    car.add(holder); wheels.push({ spin: w, steer: holder, front: wx > 0 });
  }

  // Frontal: rejilla + 4 faros + barra de faros auxiliar
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.26), new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.6 }));
  grille.position.set(2.157, 0.52, 0); grille.rotation.y = Math.PI / 2; car.add(grille);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xc9d3dc, emissive: 0xfff4dc, emissiveIntensity: 0, roughness: 0.12, metalness: 0.7 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15 });
  const lampGeo = new THREE.CircleGeometry(0.085, 32), ringGeo = new THREE.TorusGeometry(0.09, 0.014, 8, 32);
  const lamps = [];
  const addLamp = (x, y, z, r = 1) => {
    const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(x, y, z); l.rotation.y = Math.PI / 2; l.scale.setScalar(r); car.add(l);
    const ri = new THREE.Mesh(ringGeo, ringMat); ri.position.set(x - 0.005, y, z); ri.rotation.y = Math.PI / 2; ri.scale.setScalar(r); car.add(ri);
    lamps.push(new THREE.Vector3(x + 0.02, y, z));
  };
  for (const z of [-0.62, -0.4, 0.4, 0.62]) addLamp(2.165, 0.52, z);
  // barra de faros de rally sobre el paragolpes
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  bar.position.set(2.24, 0.78, 0); car.add(bar);
  const podGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 32); podGeo.rotateZ(Math.PI / 2);
  for (const z of [-0.5, -0.17, 0.17, 0.5]) {
    const pod = new THREE.Mesh(podGeo, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4, metalness: 0.4 }));
    pod.position.set(2.27, 0.86, z); car.add(pod);
    addLamp(2.325, 0.86, z, 1.25);
  }

  // Pilotos traseros
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });
  for (const z of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12), tailMat);
    tl.position.set(-2.115, 0.72, z); tl.rotation.y = -Math.PI / 2; car.add(tl);
  }

  // Alerón trasero
  const wingMat = paint(liv.base);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 1.62), wingMat);
  blade.position.set(-1.88, 1.2, 0); blade.rotation.z = 0.12; car.add(blade);
  for (const z of [-0.8, 0.8]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.025), wingMat); ep.position.set(-1.86, 1.15, z); car.add(ep);
  }

  // Faldones, faldillas y dorsales
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.7 });
  for (const s of [1, -1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.06), blackMat);
    skirt.position.set(0, 0.24, s * (BODY_W / 2 + 0.06)); car.add(skirt);
    for (const wx of [-WHEEL_X, WHEEL_X]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: key === 'heritage' ? C.red : 0x1a1a1a, roughness: 0.8 }));
      flap.position.set(wx - 0.5, 0.13, s * (BODY_W / 2 - 0.08)); car.add(flap);
    }
    const nm = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshStandardMaterial({ map: numberTexture(liv.num), roughness: 0.5 }));
    nm.position.set(0.25, 0.6, s * (BODY_W / 2 + bevelT + 0.003)); if (s < 0) nm.rotation.y = Math.PI; car.add(nm);
  }

  car.userData = { wheels, lamps, lampMat, liv, key, tx };
  return car;
}

export function setLamps(car, k) {
  car.userData.lampMat.emissiveIntensity = k;
}
export function rollWheels(car, distance, steer = 0) {
  for (const w of car.userData.wheels) {
    w.spin.rotation.z = -distance / WHEEL_R;
    w.steer.rotation.y = w.front ? steer : 0;
  }
}
export { liveryTextures, TEX };

// Silueta lateral 2D (para estampados de camiseta): reutiliza el mismo perfil que el modelo 3D.
export function drawSideProfile(g, key, X, Y, s) {
  const tx = liveryTextures(key);
  const toPath = (shape) => {
    const p = new Path2D();
    shape.getPoints(24).forEach((v, i) => (i ? p.lineTo(X + v.x * s, Y - v.y * s) : p.moveTo(X + v.x * s, Y - v.y * s)));
    p.closePath(); return p;
  };
  const dst = [X + TEX.x0 * s, Y - TEX.y1 * s, (TEX.x1 - TEX.x0) * s, (TEX.y1 - TEX.y0) * s];
  g.save(); g.clip(toPath(cabinShape())); g.drawImage(tx.cabCanvas, ...dst); g.restore();
  g.save(); g.clip(toPath(bodyShape())); g.drawImage(tx.bodyCanvas, ...dst); g.restore();
  g.fillStyle = LIVERIES[key].base; g.fillRect(X - 1.98 * s, Y - 1.25 * s, 0.36 * s, 0.05 * s);
  for (const wx of [-WHEEL_X, WHEEL_X]) {
    g.fillStyle = '#101012'; g.beginPath(); g.arc(X + wx * s, Y - WHEEL_Y * s, WHEEL_R * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = LIVERIES[key].rim; g.beginPath(); g.arc(X + wx * s, Y - WHEEL_Y * s, 0.22 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(X + wx * s, Y - WHEEL_Y * s, 0.06 * s, 0, Math.PI * 2); g.fill();
  }
  // dorsal
  g.fillStyle = '#fbfbf8'; g.beginPath(); g.arc(X + 0.25 * s, Y - 0.6 * s, 0.2 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111'; g.font = `italic 900 ${0.28 * s}px "Evo Display"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(LIVERIES[key].num, X + 0.25 * s, Y - 0.585 * s);
}
