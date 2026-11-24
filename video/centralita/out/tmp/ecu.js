
// ---------------------------------------------------------------------------
// Componentes de la centralita (1): motor 3D mínimo, la ECU en 3D, la placa analógica,
// el carburador en sección y el cilindro del anti-lag.

// Proyección axonométrica (ortográfica) con guiñada y cabeceo. x derecha, y hacia el fondo, z arriba.
// Devuelve [x, y, profundidad]; más profundidad = más cerca de la cámara.
function proj3(cx, cy, s, yaw, pitch) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = (x, y, z) => {
    const X = x * cyw - y * syw, Y = x * syw + y * cyw;
    return [cx + X * s, cy + (-z * cp - Y * sp) * s, -Y * cp + z * sp];
  };
  f.n = (nx, ny, nz) => { const X = nx * cyw - ny * syw, Y = nx * syw + ny * cyw; return [X, Y, nz, -Y * cp + nz * sp]; };
  return f;
}
const LIGHT = (() => { const v = [-0.45, -0.55, 0.72]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
function shadeRGB(rgb, f, n) {
  const [X, Y, Z] = f.n(...n);
  const k = 0.42 + 0.58 * clamp(X * LIGHT[0] + Y * LIGHT[1] + Z * LIGHT[2]);
  return `rgb(${rgb.map((v) => Math.round(v * k)).join(',')})`;
}
function quad(pts, fill, stroke = null, lw = 1.5) {
  const c = ctx;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
// Textura en una cara plana: con proyección paralela, la cara es un paralelogramo y basta una transformación afín.
function texFace(img, P0, P1, P3) {
  const c = ctx;
  c.save();
  c.transform((P1[0] - P0[0]) / img.width, (P1[1] - P0[1]) / img.width, (P3[0] - P0[0]) / img.height, (P3[1] - P0[1]) / img.height, P0[0], P0[1]);
  c.drawImage(img, 0, 0);
  c.restore();
}
// Caja con las caras visibles sombreadas. `top`: textura opcional para la cara superior.
function box3(f, x0, y0, z0, x1, y1, z1, rgb, { top = null, topRGB = null, stroke = 'rgba(232,233,230,0.28)', lw = 1.2 } = {}) {
  const F = [
    [[0, 0, 1], [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], 'top'],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
    [[0, 1, 0], [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]]],
    [[-1, 0, 0], [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]]],
    [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
    [[0, 0, -1], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]],
  ];
  for (const [n, pts, kind] of F) {
    if (f.n(...n)[3] <= 1e-4) continue;
    const P = pts.map((p) => f(...p));
    quad(P, shadeRGB(kind === 'top' && topRGB ? topRGB : rgb, f, n), stroke, lw);
    if (kind === 'top' && top) texFace(top, P[0], P[1], P[3]);
  }
}
const depth3 = (f, x, y, z) => f(x, y, z)[2];

// Cilindro con eje según -y (conector circular en la cara frontal).
function cylY(f, x, z, r, y0, y1, rgb, faceFn = null) {
  const N = 28;
  const ring = (y) => Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2; return f(x + Math.cos(a) * r, y, z + Math.sin(a) * r); });
  const A0 = ring(y0), A1 = ring(y1);
  // Envolvente: cuadriláteros laterales visibles.
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2;
    const n = [Math.cos(a), 0, Math.sin(a)];
    if (f.n(...n)[3] <= 0) continue;
    quad([A0[i], A0[(i + 1) % N], A1[(i + 1) % N], A1[i]], shadeRGB(rgb, f, n), null);
  }
  const front = f.n(0, -1, 0)[3] > 0 ? A0 : A1;
  quad(front, shadeRGB(rgb.map((v) => v * 0.55), f, [0, -1, 0]), 'rgba(232,233,230,0.35)', 1.5);
  faceFn?.(front);
}

// Textura de la placa base (estática, con semilla) y pulsos de datos animados.
const PCB_W = 980, PCB_H = 660; // 2 px por unidad: placa de 490 × 330
const CHIPS = [
  { id: 'mcu', x0: -10, y0: -60, x1: 120, y1: 70, h: 9, name: 'MICROCONTROLADOR' },
  { id: 'flash', x0: -160, y0: 40, x1: -60, y1: 90, h: 7, name: 'MEMORIA FLASH' },
  { id: 'ram', x0: -160, y0: -30, x1: -90, y1: 10, h: 7, name: 'RAM' },
  { id: 'can1', x0: -225, y0: -130, x1: -185, y1: -100, h: 6, name: 'CAN' },
  { id: 'can2', x0: -170, y0: -130, x1: -130, y1: -100, h: 6, name: 'CAN' },
  { id: 'reg', x0: 160, y0: 80, x1: 225, y1: 140, h: 12, name: 'REGULADOR' },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `drv${i}`, x0: 150 + (i % 4) * 22, y0: -140 + Math.floor(i / 4) * 40, x1: 166 + (i % 4) * 22, y1: -116 + Math.floor(i / 4) * 40, h: 6, name: 'POTENCIA' })),
];
const toTex = (x, y) => [(x + 245) * 2, (165 - y) * 2];
let PCB_STATIC = null, PCB_TRACES = null;
function pcbStatic() {
  if (PCB_STATIC) return PCB_STATIC;
  const cv = makeCanvas(PCB_W, PCB_H), g = cv.getContext('2d');
  g.fillStyle = '#1E2226'; g.fillRect(0, 0, PCB_W, PCB_H);
  g.strokeStyle = 'rgba(201,162,74,0.55)'; g.lineWidth = 2;
  const R = rng(11);
  PCB_TRACES = [];
  const mcu = CHIPS[0];
  // Pistas en ángulo recto desde el microcontrolador hacia los demás integrados y el conector frontal.
  for (let i = 0; i < 60; i++) {
    const side = i % 4;
    const [sx, sy] = side === 0 ? [mcu.x0, lerp(mcu.y0 + 8, mcu.y1 - 8, R())] : side === 1 ? [mcu.x1, lerp(mcu.y0 + 8, mcu.y1 - 8, R())]
      : side === 2 ? [lerp(mcu.x0 + 8, mcu.x1 - 8, R()), mcu.y0] : [lerp(mcu.x0 + 8, mcu.x1 - 8, R()), mcu.y1];
    const tx = lerp(-235, 235, R()), ty = side === 2 ? -158 : side === 3 ? 158 : lerp(-150, 150, R());
    const mid = side < 2 ? [[sx + (side === 0 ? -1 : 1) * (10 + R() * 30), sy]] : [[sx, sy + (side === 2 ? -1 : 1) * (10 + R() * 30)]];
    const p1 = mid[0];
    const pts = side < 2 ? [[sx, sy], p1, [p1[0], ty], [tx, ty]] : [[sx, sy], p1, [tx, p1[1]], [tx, ty]];
    PCB_TRACES.push(pts.map(([x, y]) => toTex(x, y)));
  }
  // Bus del conector: pistas paralelas hacia el borde frontal.
  for (let i = 0; i < 26; i++) {
    const x = -220 + i * 17;
    PCB_TRACES.push([toTex(x, -164), toTex(x, -150 + (i % 3) * 6), toTex(lerp(-200, 200, i / 25) * 0.55, -100 + (i % 5) * 6)]);
  }
  for (const tr of PCB_TRACES) { g.beginPath(); g.moveTo(...tr[0]); for (const p of tr.slice(1)) g.lineTo(...p); g.stroke(); }
  // Vías y pads.
  g.fillStyle = 'rgba(201,162,74,0.8)';
  for (const tr of PCB_TRACES) for (const p of [tr.at(-1)]) { g.beginPath(); g.arc(p[0], p[1], 3.2, 0, Math.PI * 2); g.fill(); }
  // Serigrafía de los contornos de componente y de los condensadores.
  g.strokeStyle = 'rgba(232,233,230,0.35)'; g.lineWidth = 1.5;
  for (const ch of CHIPS) { const [a, b] = toTex(ch.x0 - 4, ch.y1 + 4), [c2, d] = toTex(ch.x1 + 4, ch.y0 - 4); g.strokeRect(a, b, c2 - a, d - b); }
  for (let i = 0; i < 18; i++) { const [x, y] = toTex(lerp(-230, 230, R()), lerp(-60, 150, R())); g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke(); }
  // Peine del conector en el borde frontal.
  g.fillStyle = 'rgba(201,162,74,0.9)';
  for (let i = 0; i < 26; i++) { const [x, y] = toTex(-220 + i * 17, -160); g.fillRect(x - 4, y - 6, 8, 12); }
  PCB_STATIC = cv;
  return cv;
}
function pcbTexture(t, pulse) {
  const base = pcbStatic();
  if (!layers.pcb) layers.pcb = makeCanvas(PCB_W, PCB_H);
  const cv = layers.pcb, g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(base, 0, 0);
  if (pulse > 0) {
    g.save(); g.globalAlpha = pulse; g.strokeStyle = COLOR.yellow; g.lineWidth = 4; g.lineCap = 'round';
    PCB_TRACES.forEach((tr, i) => {
      const P = poly(tr), ph = ((t * (0.6 + (i % 7) * 0.13) + i * 0.137) % 1.4) - 0.2;
      if (ph < 0 || ph > 1) return;
      const a = pointAt(P, ph), b = pointAt(P, clamp(ph + 70 / P.len));
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    });
    g.restore();
  }
  return cv;
}

// La ECU de competición en 3D: carcasa de aluminio con aletas, tres conectores circulares, placa y componentes.
// open: la tapa sube; lift: la placa sale de la carcasa; pulse: datos por las pistas. Devuelve la proyección.
function drawECU3D(t, { cx, cy, s = 1, yaw = -0.55, pitch = 0.62, open = 0, lift = 0, pulse = 0, appear = 1, tint = null, lidFade = false } = {}) {
  if (appear <= 0) return null;
  const f = proj3(cx, cy, s, yaw, pitch);
  ctx.save(); ctx.globalAlpha *= appear;
  const ALU = tint ?? [150, 155, 162], DARK = [64, 68, 74];
  const lidZ = 70 + open * 460, pcbZ = 44 + lift * 150;
  // Pestañas de anclaje.
  for (const [x, y] of [[-290, -110], [-290, 70], [260, -110], [260, 70]]) box3(f, x, y, 0, x + 30, y + 40, 8, ALU);
  // Bandeja (paredes) y fondo interior.
  box3(f, -260, -180, 0, 260, 180, 70, ALU, { topRGB: [40, 43, 48] });
  // Borde interior visible cuando la tapa no está.
  if (open > 0.02) {
    const P = [f(-246, 166, 70), f(246, 166, 70), f(246, -166, 70), f(-246, -166, 70)];
    ctx.save(); ctx.globalAlpha *= clamp(open * 4); quad(P, 'rgba(11,12,14,0.85)', 'rgba(232,233,230,0.2)'); ctx.restore();
  }
  // Conectores circulares con sus anillos de color.
  const rings = [COLOR.yellow, COLOR.red, COLOR.blue];
  [-160, -10, 140].forEach((x, i) => cylY(f, x, 36, 30, -180 - 34, -180, [70, 74, 80], (front) => {
    ctx.save(); ctx.strokeStyle = rings[i]; ctx.lineWidth = 3 * s;
    ctx.beginPath(); front.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    // Contactos.
    ctx.fillStyle = 'rgba(201,162,74,0.9)';
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; const p = f(x + Math.cos(a) * 16, -180 - 34, 36 + Math.sin(a) * 16); ctx.beginPath(); ctx.arc(p[0], p[1], 2.2 * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }));
  // Placa y componentes (ordenados por profundidad).
  if (lift > 0 || open > 0.05) {
    box3(f, -245, -165, pcbZ, 245, 165, pcbZ + 4, [36, 40, 44], { top: pcbTexture(t, pulse) });
    const list = CHIPS.map((ch) => ({ ch, d: depth3(f, (ch.x0 + ch.x1) / 2, (ch.y0 + ch.y1) / 2, pcbZ) })).sort((a, b) => a.d - b.d);
    for (const { ch } of list) box3(f, ch.x0, ch.y0, pcbZ + 4, ch.x1, ch.y1, pcbZ + 4 + ch.h, ch.id === 'reg' ? [120, 124, 130] : [28, 30, 34], { stroke: 'rgba(232,233,230,0.22)' });
    // Marca del microcontrolador.
    const m = CHIPS[0], c0 = f((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, pcbZ + 4 + m.h);
    ctx.save(); ctx.fillStyle = 'rgba(232,233,230,0.18)'; ctx.beginPath(); ctx.arc(c0[0] - 30 * s, c0[1] + 8 * s, 4 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // Tapa con aletas de disipación.
  const lidA = lidFade ? 1 - clamp((open - 0.75) / 0.25) : 1;
  if (lidA > 0) {
    ctx.save(); ctx.globalAlpha *= lidA;
    box3(f, -260, -180, lidZ, 260, 180, lidZ + 10, ALU);
    const fins = Array.from({ length: 13 }, (_, k) => -228 + k * 38).map((x) => ({ x, d: depth3(f, x, 0, lidZ + 20) })).sort((a, b) => a.d - b.d);
    for (const { x } of fins) box3(f, x - 7, -168, lidZ + 10, x + 7, 168, lidZ + 40, ALU);
    ctx.restore();
  }
  ctx.restore();
  f.pcbZ = pcbZ; f.lidZ = lidZ;
  return f;
}
// Rótulos de los componentes de la placa (con línea guía), en pantalla.
function ecuLabels(t, f, list, t0, step = 0.35) {
  if (!f) return;
  list.forEach(([id, lx, ly, str], i) => {
    const ch = CHIPS.find((c) => c.id === id);
    let p;
    if (ch) p = f((ch.x0 + ch.x1) / 2, (ch.y0 + ch.y1) / 2, f.pcbZ + 4 + ch.h);
    else if (id === 'conn') p = f(-10, -214, 36);
    else if (id === 'case') p = f(260, 60, 50);
    else if (id === 'lid') p = f(150, 0, f.lidZ + 40);
    pin(t, p[0], p[1], lx, ly, str, t0 + i * step, COLOR.paper);
  });
}

// ---------------------------------------------------------------------------
// Placa analógica de los primeros 80, vista desde arriba: transistores, resistencias, pistas gruesas y la ROM en su zócalo.
function drawAnalogBoard(t, { cx, cy, s = 1, appear = 1, out = 0, inn = 1, solder = 0, iron = null, highlight = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  // Placa.
  rr(c, -460, -300, 920, 600, 18); c.fillStyle = '#1E2226'; c.fill(); c.strokeStyle = 'rgba(232,233,230,0.35)'; c.lineWidth = 2; c.stroke();
  // Pistas gruesas a mano alzada (curvas suaves, como las placas de la época).
  const R = rng(5);
  c.strokeStyle = 'rgba(201,162,74,0.5)'; c.lineWidth = 7; c.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const x0 = lerp(-420, 420, R()), y0 = lerp(-260, 260, R()), x1 = lerp(-420, 420, R()), y1 = lerp(-260, 260, R());
    c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0, (y0 + y1) / 2, x1, (y0 + y1) / 2, x1, y1); c.stroke();
  }
  c.fillStyle = 'rgba(201,162,74,0.85)';
  for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(lerp(-430, 430, R()), lerp(-270, 270, R()), 7, 0, Math.PI * 2); c.fill(); }
  // Transistores de potencia (TO-3) y pequeños (TO-92).
  for (const [x, y] of [[-330, -180], [-200, -180], [-330, -40]]) {
    c.fillStyle = '#8C9096'; c.beginPath(); c.ellipse(x, y, 62, 44, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5A5E64'; c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLOR.ink; for (const d of [-46, 46]) { c.beginPath(); c.arc(x + d, y, 7, 0, Math.PI * 2); c.fill(); }
  }
  for (let i = 0; i < 6; i++) { const x = -120 + i * 44, y = -210; c.fillStyle = '#2A2D32'; c.beginPath(); c.arc(x, y, 15, Math.PI, 0); c.lineTo(x + 15, y + 10); c.lineTo(x - 15, y + 10); c.closePath(); c.fill(); }
  // Resistencias con bandas.
  const bands = [COLOR.red, COLOR.yellow, COLOR.fire, COLOR.paper];
  for (let i = 0; i < 9; i++) {
    const x = 160 + (i % 3) * 90, y = -230 + Math.floor(i / 3) * 70;
    c.strokeStyle = '#8C9096'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 40, y); c.lineTo(x + 40, y); c.stroke();
    rr(c, -24 + x, y - 11, 48, 22, 10); c.fillStyle = '#C8B48A'; c.fill();
    for (let b = 0; b < 3; b++) { c.fillStyle = bands[(i + b) % 4]; c.fillRect(x - 14 + b * 10, y - 11, 5, 22); }
  }
  // Condensadores electrolíticos.
  for (const [x, y, r] of [[-60, 120, 34], [20, 150, 26], [-160, 170, 30]]) {
    c.fillStyle = '#3A4E6A'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(232,233,230,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - r * 0.5, y); c.lineTo(x + r * 0.5, y); c.moveTo(x, y - r * 0.5); c.lineTo(x, y + r * 0.5); c.stroke();
  }
  // Zócalo de la ROM y los dos chips (el viejo sale, el nuevo entra).
  const zx = 230, zy = 120, zw = 240, zh = 110;
  c.fillStyle = '#2A2D32'; c.fillRect(zx - zw / 2 - 12, zy - zh / 2 - 12, zw + 24, zh + 24);
  c.fillStyle = 'rgba(201,162,74,0.9)';
  const pinsX = Array.from({ length: 12 }, (_, i) => zx - zw / 2 + 10 + i * ((zw - 20) / 11));
  for (const x of pinsX) for (const y of [zy - zh / 2 - 6, zy + zh / 2 + 6]) c.fillRect(x - 4, y - 5, 8, 10);
  const chip = (dx, dy, a, fresh) => {
    if (a <= 0) return;
    c.save(); c.globalAlpha *= a; c.translate(zx + dx, zy + dy);
    c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = Math.abs(dy) * 0.3 + Math.abs(dx) * 0.1; c.shadowOffsetY = 8;
    rr(c, -zw / 2, -zh / 2, zw, zh, 6); c.fillStyle = '#121418'; c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(232,233,230,0.3)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(232,233,230,0.25)'; c.beginPath(); c.arc(-zw / 2, 0, 12, -Math.PI / 2, Math.PI / 2); c.fill();
    if (fresh) { rr(c, -70, -24, 140, 48, 4); c.fillStyle = COLOR.yellow; c.fill(); }
    c.font = FONT.text(800, 30); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fresh ? COLOR.ink : 'rgba(232,233,230,0.7)';
    c.fillText('ROM', 0, 2);
    c.restore();
  };
  chip(lerp(0, 520, ease.inOut(out)), lerp(0, -260, ease.inOut(out)), 1 - clamp((out - 0.8) * 5), false);
  chip(lerp(-560, 0, ease.out(inn)), lerp(-300, 0, ease.out(inn)), clamp(inn * 4), true);
  // Soldaduras: los pines se iluminan uno a uno según `solder` (0..1).
  const all = pinsX.flatMap((x) => [[x, zy - zh / 2 - 6], [x, zy + zh / 2 + 6]]);
  all.forEach(([x, y], i) => {
    const k = clamp(solder * all.length - i);
    if (k <= 0) return;
    const hot = clamp(1 - (solder * all.length - i - 1) / 4);
    c.fillStyle = heatCol(0.55 + 0.45 * hot, 1); c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
    if (hot > 0.2) { c.save(); c.globalAlpha *= hot * 0.5; c.fillStyle = COLOR.fire; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fill(); c.restore(); }
  });
  // Soldador: punta que recorre los pines.
  if (iron) {
    const idx = clamp(Math.floor(solder * all.length), 0, all.length - 1);
    const [x, y] = all[idx];
    c.save(); c.globalAlpha *= iron; c.translate(x, y); c.rotate(-0.6);
    c.fillStyle = '#8C9096'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -60); c.lineTo(10, -60); c.closePath(); c.fill();
    c.fillStyle = '#5A5E64'; c.fillRect(-14, -150, 28, 90);
    c.fillStyle = COLOR.red; rr(c, -22, -380, 44, 230, 18); c.fill();
    c.restore();
  }
  if (highlight > 0) {
    c.save(); c.globalAlpha *= highlight; c.strokeStyle = COLOR.yellow; c.lineWidth = 4; c.setLineDash([12, 10]);
    c.strokeRect(zx - zw / 2 - 30, zy - zh / 2 - 30, zw + 60, zh + 60); c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Carburador horizontal en sección: difusor (venturi), mariposa, cuba con flotador, chiclé y surtidor.
// air: caudal de aire (0..1); fuel: gasolina aspirada (0..1); rich: mezcla más rica (en altura).
function drawCarb(t, { cx, cy, s = 1, appear = 1, air = 1, fuel = 1, labels = 0, throttle = 0.7, rich = 0, depress = 1, atm = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  c.lineJoin = 'round';
  // Paredes del conducto: el difusor estrecha el paso en el centro.
  const wall = (sgn) => poly(catmull([[-620, sgn * 150], [-380, sgn * 150], [-150, sgn * 82], [0, sgn * 70], [150, sgn * 82], [380, sgn * 140], [620, sgn * 140]], false, 10));
  const top = wall(-1), bot = wall(1);
  const body = (P, sgn) => {
    c.beginPath(); c.moveTo(P.pts[0][0], P.pts[0][1]); for (const p of P.pts) c.lineTo(p[0], p[1]);
    c.lineTo(620, sgn * 240); c.lineTo(-620, sgn * 240); c.closePath();
  };
  for (const [P, sgn] of [[top, -1], [bot, 1]]) { body(P, sgn); c.fillStyle = COLOR.ink2; c.fill(); hatch(c, () => body(P, sgn), 16, 0.12); }
  c.strokeStyle = COLOR.line; c.lineWidth = 3;
  for (const P of [top, bot]) { c.beginPath(); c.moveTo(P.pts[0][0], P.pts[0][1]); for (const p of P.pts) c.lineTo(p[0], p[1]); c.stroke(); }
  // Cuba debajo, con nivel de gasolina y flotador.
  const bx = -360, by = 300, bw = 260, bh = 220;
  c.fillStyle = COLOR.ink; c.fillRect(bx - bw / 2, by - bh / 2 + 40, bw, bh);
  c.fillStyle = 'rgba(233,168,37,0.55)'; c.fillRect(bx - bw / 2, by - 10, bw, bh / 2 + 50);
  c.strokeStyle = COLOR.line; c.lineWidth = 3; c.strokeRect(bx - bw / 2, by - bh / 2 + 40, bw, bh);
  rr(c, bx - 70, by - 40, 140, 40, 14); c.fillStyle = '#8C9096'; c.fill();
  // Respiradero: presión atmosférica sobre la gasolina.
  if (atm > 0) {
    for (let k = 0; k < 3; k++) arrowPath([[bx - 80 + k * 80, by - 120], [bx - 80 + k * 80, by - 30]], ease.out(clamp(atm * 1.5 - k * 0.2)), COLOR.blue, 4, 14);
  }
  // Chiclé y conducto hasta el surtidor en la garganta.
  const jet = poly([[bx, by + 120], [bx + 160, by + 120], [bx + 360, by + 120], [bx + 360, 60]]);
  c.strokeStyle = 'rgba(233,168,37,0.85)'; c.lineWidth = 10; c.beginPath(); c.moveTo(...jet.pts[0]); for (const p of jet.pts) c.lineTo(...p); c.stroke();
  c.fillStyle = COLOR.yellow; c.beginPath(); c.moveTo(bx + 140, by + 104); c.lineTo(bx + 180, by + 112); c.lineTo(bx + 180, by + 128); c.lineTo(bx + 140, by + 136); c.closePath(); c.fill();
  flowLine(jet, t, { color: COLOR.paper, width: 4, amount: fuel * 0.9, speed: 0.7, dash: [10, 18] });
  // Surtidor.
  c.fillStyle = '#8C9096'; c.fillRect(-12, 50, 24, 30);
  // Mariposa a la salida.
  c.save(); c.translate(420, 0); c.rotate(lerp(Math.PI / 2, 0.15, throttle));
  rr(c, -10, -138, 20, 276, 8); c.fillStyle = '#8C9096'; c.fill(); c.restore();
  c.fillStyle = COLOR.ink; c.beginPath(); c.arc(420, 0, 10, 0, Math.PI * 2); c.fill();
  // Aire: líneas de corriente que se juntan en la garganta (más rápidas).
  for (let k = -2; k <= 2; k++) {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const x = lerp(-600, 600, i / 40); const w = lerp(150, 70, Math.exp(-((x / 260) ** 2))) - 22; pts.push([x, (k / 2.6) * w]); }
    flowLine(poly(pts), t, { color: COLOR.blue, width: 5, amount: air * 0.85, speed: 1.3, dash: [30, 26], offset: k * 13 });
  }
  // Gasolina pulverizada que sale del surtidor y viaja con el aire.
  if (fuel > 0) {
    const R = rng(4);
    c.save();
    for (let i = 0; i < 46; i++) {
      const ph = (t * (0.55 + R() * 0.3) + R()) % 1;
      const x = lerp(0, 600, ph), spread = 16 + ph * 70;
      const y = 50 - ph * 60 + (R() - 0.5) * spread;
      c.globalAlpha = appear * fuel * (1 - ph * 0.6) * clamp(0.6 + rich);
      c.fillStyle = rich > 0.3 && i % 2 ? COLOR.fire : COLOR.yellow;
      c.beginPath(); c.arc(x, y, 4 + 3 * rich, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  // Depresión en la garganta.
  if (depress > 0 && labels > 0.3) {
    c.save(); c.globalAlpha *= depress * clamp(labels * 2 - 0.6); c.strokeStyle = COLOR.red; c.lineWidth = 3; c.setLineDash([6, 6]);
    c.beginPath(); c.ellipse(0, 0, 90, 50, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  c.restore();
  if (labels > 0) {
    const P = (x, y) => [cx + x * s, cy + y * s];
    const L = [['AIRE', -600, -175, COLOR.blue, 'left'], ['DIFUSOR', 0, -110, COLOR.paper, 'center'], ['MARIPOSA', 420, -175, COLOR.paper, 'center'],
      ['CUBA', -360, 560, COLOR.paper, 'center'], ['CHICLÉ', -200, 470, COLOR.yellow, 'center'], ['DEPRESIÓN', 0, 125, COLOR.red, 'center']];
    L.forEach(([str, x, y, col, al], i) => { const [qx, qy] = P(x, y); label(ctx, str, qx, qy, col, clamp(labels * 2.2 - i * 0.25), { size: 22, spacing: 6, weight: 700, align: al }); });
  }
}

// ---------------------------------------------------------------------------
// Cilindro en sección (un solo cilindro de un 4 en línea) con admisión, escape y turbina.
// Fases del ciclo de cuatro tiempos a partir del ángulo del cigüeñal. Opciones del anti-lag:
// spark (encendido), inj (inyección), thr (mariposa), als (gasolina sin quemar hacia el escape).
function engineAngle(t, t0, rps = 1.1) { return Math.PI * 2 * rps * Math.max(0, t - t0); }
function drawCylinder(t, { cx, cy, s = 1, appear = 1, crank = 0, spark = 1, inj = 1, thr = 1, direct = false, restrictor = 0, exhaust = 1, als = 0, turbo = true, th = 0, dth = 0, hot = 0, labels = 0, knock = 0, ducts = true } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  c.lineJoin = 'round'; c.lineCap = 'round';
  const bore = 200, x0 = -bore / 2, x1 = bore / 2, yHead = -160, yBot = 220;
  // Cigüeñal y biela.
  const stroke = 120, rod = 240, ccy = 330;
  const ox = Math.sin(crank) * stroke / 2, oy = -Math.cos(crank) * stroke / 2;
  const pinY = ccy + oy - Math.sqrt(rod * rod - ox * ox);
  // Ciclo: 0..4π. Admisión (0..π), compresión (π..2π), explosión (2π..3π), escape (3π..4π).
  const cyc = ((crank % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4);
  const intakeOpen = cyc < Math.PI ? Math.sin(cyc) : 0;
  const exhOpen = cyc > Math.PI * 3 ? Math.sin(cyc - Math.PI * 3) : 0;
  const fire = cyc >= Math.PI * 2 && cyc < Math.PI * 2.6 ? 1 - (cyc - Math.PI * 2) / (Math.PI * 0.6) : 0;
  // Bloque y culata.
  const solid = (fn) => { fn(); c.fillStyle = COLOR.ink2; c.fill(); hatch(c, fn, 16, 0.12); fn(); c.strokeStyle = COLOR.line; c.lineWidth = 3; c.stroke(); };
  solid(() => { c.beginPath(); c.rect(x0 - 60, yHead + 20, 60, yBot - yHead); });
  solid(() => { c.beginPath(); c.rect(x1, yHead + 20, 60, yBot - yHead); });
  // Culata con puertos.
  solid(() => { c.beginPath(); c.moveTo(x0 - 60, yHead + 20); c.lineTo(x0 - 60, yHead - 120); c.lineTo(-70, yHead - 120); c.lineTo(-40, yHead); c.lineTo(x0, yHead + 20); c.closePath(); });
  solid(() => { c.beginPath(); c.moveTo(x1 + 60, yHead + 20); c.lineTo(x1 + 60, yHead - 120); c.lineTo(70, yHead - 120); c.lineTo(40, yHead); c.lineTo(x1, yHead + 20); c.closePath(); });
  solid(() => { c.beginPath(); c.rect(-40, yHead - 120, 80, 100); });
  if (ducts) {
  // Conducto de admisión (izquierda) con mariposa y brida opcional.
  const inP = [[-760, -330], [-300, -330], [-160, -300], [-80, yHead - 10]];
  c.strokeStyle = COLOR.line; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-760, -390); c.lineTo(-300, -390); c.lineTo(-110, -330); c.stroke();
  c.beginPath(); c.moveTo(-760, -270); c.lineTo(-330, -270); c.lineTo(-170, -230); c.stroke();
  if (restrictor > 0) {
    c.save(); c.globalAlpha *= restrictor; c.fillStyle = COLOR.yellow;
    c.beginPath(); c.moveTo(-640, -390); c.lineTo(-600, -390); c.lineTo(-610, -360); c.lineTo(-630, -360); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-640, -270); c.lineTo(-600, -270); c.lineTo(-610, -300); c.lineTo(-630, -300); c.closePath(); c.fill();
    c.restore();
  }
  c.save(); c.translate(-460, -330); c.rotate(lerp(Math.PI / 2, 0.1, thr)); rr(c, -7, -56, 14, 112, 6); c.fillStyle = '#8C9096'; c.fill(); c.restore();
  // Conducto de escape (derecha) hasta la turbina.
  const exTop = -330;
  c.beginPath(); c.moveTo(110, -330); c.lineTo(300, -390); c.lineTo(820, -390); c.stroke();
  c.beginPath(); c.moveTo(170, -230); c.lineTo(330, -270); c.lineTo(820, -270); c.stroke();
  const glowK = clamp(hot);
  if (glowK > 0) { c.save(); c.globalAlpha *= glowK * 0.5; c.fillStyle = COLOR.red; c.beginPath(); c.moveTo(110, -330); c.lineTo(300, -390); c.lineTo(820, -390); c.lineTo(820, -270); c.lineTo(330, -270); c.lineTo(170, -230); c.closePath(); c.fill(); c.restore(); }
  }
  // Válvulas.
  const valve = (x, open, col) => {
    const dy = open * 34;
    c.strokeStyle = '#8C9096'; c.lineWidth = 10; c.beginPath(); c.moveTo(x, yHead - 110); c.lineTo(x, yHead - 6 + dy); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 34, yHead + dy); c.lineTo(x + 34, yHead + dy); c.lineTo(x + 12, yHead - 14 + dy); c.lineTo(x - 12, yHead - 14 + dy); c.closePath(); c.fill();
  };
  valve(-60, intakeOpen, '#8C9096');
  valve(60, exhOpen, '#8C9096');
  // Cámara: mezcla (amarilla) o llama.
  const chamberBottom = pinY - 40;
  if (fire > 0 && spark > 0.5) { c.fillStyle = `rgba(238,122,30,${0.9 * fire})`; c.fillRect(x0 + 3, yHead + 3, bore - 6, chamberBottom - yHead - 3); }
  else if (cyc >= Math.PI && cyc < Math.PI * 2 && inj > 0) { c.fillStyle = `rgba(233,168,37,${0.18 + 0.2 * (cyc - Math.PI) / Math.PI})`; c.fillRect(x0 + 3, yHead + 3, bore - 6, chamberBottom - yHead - 3); }
  // Picado: frente de llama secundario y onda en las paredes.
  if (knock > 0 && fire > 0.2) {
    c.save(); c.globalAlpha *= knock * fire; c.fillStyle = COLOR.red;
    c.beginPath(); c.arc(x1 - 30, chamberBottom - 30, 40 * (1 - fire) + 14, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // Pistón y biela.
  rr(c, x0 + 6, chamberBottom, bore - 12, 80, 6); c.fillStyle = '#B9BDC2'; c.fill();
  c.fillStyle = COLOR.ink; for (const k of [12, 26]) c.fillRect(x0 + 6, chamberBottom + k, bore - 12, 4);
  c.strokeStyle = '#B9BDC2'; c.lineWidth = 18; c.beginPath(); c.moveTo(0, pinY); c.lineTo(ox, ccy + oy); c.stroke();
  c.strokeStyle = 'rgba(232,233,230,0.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, ccy, stroke / 2 + 30, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#8C9096'; c.beginPath(); c.arc(ox, ccy + oy, 16, 0, Math.PI * 2); c.fill();
  c.fillStyle = COLOR.ink; c.beginPath(); c.arc(0, ccy, 12, 0, Math.PI * 2); c.fill();
  // Bujía y chispa.
  c.fillStyle = '#E8E9E6'; c.fillRect(-12, yHead - 120, 24, 70); c.fillStyle = '#8C9096'; c.fillRect(-8, yHead - 50, 16, 46);
  const spk = spark > 0.5 && cyc > Math.PI * 1.92 && cyc < Math.PI * 2.12;
  if (spk) { c.save(); c.strokeStyle = COLOR.yellow; c.lineWidth = 4; for (let k = 0; k < 6; k++) { const a = k * 1.05 + t * 9; c.beginPath(); c.moveTo(0, yHead + 2); c.lineTo(Math.cos(a) * 30, yHead + 2 + Math.abs(Math.sin(a)) * 30); c.stroke(); } c.restore(); }
  if (spark <= 0.5) {
    c.save(); c.strokeStyle = COLOR.red; c.lineWidth = 6; c.globalAlpha *= clamp((0.5 - spark) * 4);
    c.beginPath(); c.moveTo(-30, yHead - 160); c.lineTo(30, yHead - 100); c.moveTo(30, yHead - 160); c.lineTo(-30, yHead - 100); c.stroke(); c.restore();
  }
  // Inyector: en el colector (indirecta) o en la cámara (directa).
  const ix = direct ? -100 : -210, iy = direct ? yHead - 40 : -360, ia = direct ? 0.9 : 1.15;
  c.save(); c.translate(ix, iy); c.rotate(ia);
  rr(c, -70, -12, 70, 24, 6); c.fillStyle = COLOR.paper; c.fill(); c.fillStyle = COLOR.yellow; c.fillRect(-70, -12, 18, 24);
  const sprayOn = inj > 0 && (direct ? (cyc > Math.PI * 1.0 && cyc < Math.PI * 1.6) : (cyc < Math.PI * 0.9));
  if (sprayOn) {
    const R = rng(Math.floor(t * 30));
    c.fillStyle = COLOR.yellow;
    for (let k = 0; k < 26; k++) { const d = 10 + R() * 120, a = (R() - 0.5) * 0.5; c.globalAlpha = (1 - d / 140) * inj; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 3.5, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
  if (ducts) {
  // Flujos: aire entrando, gases saliendo y, con anti-lag, gasolina sin quemar hacia la turbina.
  flowLine(poly([[-760, -330], [-300, -330], [-160, -300], [-100, -260]]), t, { color: COLOR.blue, width: 9, amount: lerp(0.15, 1, thr) * clamp(appear), speed: lerp(0.3, 1.2, thr) });
  flowLine(poly([[120, -260], [300, -330], [820, -330]]), t, { color: als > 0 ? COLOR.yellow : COLOR.fire, width: 9, amount: exhaust * (1 - als * 0.3), speed: lerp(0.4, 1.6, exhaust) });
  if (als > 0) {
    const R = rng(8);
    c.save();
    for (let i = 0; i < 34; i++) {
      const ph = (t * (0.45 + R() * 0.25) + R()) % 1;
      const x = lerp(140, 800, ph), y = -330 + (R() - 0.5) * 80;
      c.globalAlpha = appear * als * 0.95; c.fillStyle = i % 3 ? COLOR.yellow : COLOR.fire;
      c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  if (turbo) {
    drawWheel(th, dth, 960, -330, 110, 1, { housing: true, hot: clamp(hot + als * 0.6), blades: 12 });
  }
  }
  c.restore();
  if (labels > 0) {
    const P = (x, y) => [cx + x * s, cy + y * s];
    const L = [['ADMISIÓN', -760, -420, COLOR.blue, 'left'], ['MARIPOSA', -460, -220, COLOR.paper, 'center'], ['ESCAPE', 820, -420, COLOR.fire, 'right'],
      ['BUJÍA', 0, -330, COLOR.paper, 'center'], ['TURBINA', 960, -150, COLOR.paper, 'center']];
    L.forEach(([str, x, y, col, al], i) => { const [qx, qy] = P(x, y); label(ctx, str, qx, qy, col, clamp(labels * 2 - i * 0.2), { size: 22, spacing: 6, weight: 700, align: al }); });
  }
  return { spark: spk, fire, cyc };
}
