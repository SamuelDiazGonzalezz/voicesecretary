
// ---------------------------------------------------------------------------
// Componentes de la centralita (2): el coche con tres diferenciales y sus sensores, el embrague multidisco,
// la red CAN, la batería, el mapa de encendido en 3D y el bucle cerrado de la sonda lambda.

// Planta del coche con la centralita en el centro. Unidades del coche: ruedas en x = ±300, y = ±226.
const CAR_ECU = [-110, -120];
const SENSORS = {
  wheel: [[300, -226], [300, 226], [-300, -226], [-300, 226]],
  accel: [[-20, 70]],
  steer: [[150, -110]],
  brake: [[230, -170]],
};
function carToScreen(o, x, y) {
  const c = Math.cos(o.rot ?? 0), s = Math.sin(o.rot ?? 0);
  return [o.cx + (x * c - y * s) * o.s, o.cy + (x * s + y * c) * o.s];
}
function drawCarECU(t, o) {
  const { cx, cy, s = 1, rot = 0, appear = 1, nerves = 0, sensors = [0, 0, 0, 0], diffs = [0, 0, 0], power = 0, split = 0.5, slip = [0, 0, 0, 0], hyd = 0, ecuGlow = 0, engine = 1, dim = 0 } = o;
  const c = ctx;
  c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(s, s); c.globalAlpha *= appear;
  const px = 1 / s;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = COLOR.paper; c.lineWidth = 3 * px; trace(c, body(0), 1);
  c.save(); c.globalAlpha *= 0.4; c.lineWidth = 2 * px; trace(c, CABIN, 1); c.restore();
  const fX = 300, rX = -300;
  // Motor.
  if (engine > 0) { c.save(); c.globalAlpha *= engine; rr(c, 130, -80, 130, 110, 10); c.fillStyle = 'rgba(232,233,230,0.08)'; c.fill(); c.strokeStyle = COLOR.paper; c.lineWidth = 2.4 * px; c.stroke(); c.restore(); }
  // Ejes con flujo de par: el reparto `split` (0 = todo delante, 1 = todo detrás) cambia el grosor.
  const shaft = (pts, on, w) => {
    c.save(); c.strokeStyle = 'rgba(232,233,230,0.3)'; c.lineWidth = 8 * px; c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.stroke();
    if (on > 0) { c.globalAlpha *= on; c.strokeStyle = COLOR.yellow; c.lineWidth = w * px; c.setLineDash([22, 18]); c.lineDashOffset = -t * 260; c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.stroke(); }
    c.restore();
  };
  const wf = lerp(4, 14, 1 - split), wr = lerp(4, 14, split);
  shaft([[130, -20], [50, -20], [50, 0], [36, 0]], power, 9);
  shaft([[36, 0], [fX - 40, 0]], power, wf); shaft([[-36, 0], [rX + 40, 0]], power, wr);
  shaft([[fX, -40], [fX, -196]], power, wf); shaft([[fX, 40], [fX, 196]], power, wf);
  shaft([[rX, -40], [rX, -196]], power, wr); shaft([[rX, 40], [rX, 196]], power, wr);
  // Diferenciales: delantero, central y trasero (resaltados según `diffs`).
  [[fX, 0], [0, 0], [rX, 0]].forEach(([x, y], i) => {
    rr(c, x - 40, y - 40, 80, 80, 12); c.fillStyle = COLOR.ink; c.fill();
    if (diffs[i] > 0) { c.save(); c.globalAlpha *= diffs[i]; c.fillStyle = COLOR.fire; c.fill(); c.restore(); }
    c.strokeStyle = COLOR.paper; c.lineWidth = 3 * px; c.stroke();
    // Paquete de discos esquemático.
    c.save(); c.strokeStyle = diffs[i] > 0.5 ? COLOR.ink : 'rgba(232,233,230,0.5)'; c.lineWidth = 2 * px;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 10, y - 22); c.lineTo(x + k * 10, y + 22); c.stroke(); }
    c.restore();
  });
  // Ruedas: amarillo = tracción; rojo = patina.
  SENSORS.wheel.forEach(([x, y], i) => {
    rr(c, x - 75, y - 30, 150, 60, 14); c.fillStyle = COLOR.ink; c.fill();
    if (slip[i] > 0) { c.save(); c.globalAlpha *= clamp(slip[i]); c.fillStyle = COLOR.red; c.fill(); c.restore(); }
    c.strokeStyle = COLOR.paper; c.lineWidth = 3 * px; c.stroke();
  });
  // Línea hidráulica de la centralita al diferencial central.
  if (hyd > 0) {
    const P = poly([[CAR_ECU[0] + 30, CAR_ECU[1]], [-20, -120], [-20, -46]]);
    c.save(); c.strokeStyle = COLOR.blue; c.lineWidth = 6 * px; trace(c, P, ease.out(clamp(hyd * 2))); c.restore();
    if (hyd > 0.5) flowLine(P, t, { color: COLOR.paper, width: 3 * px, amount: 1, speed: 1.6, dash: [8, 14] });
  }
  // Nervios: de cada sensor a la centralita, con pulsos de señal.
  const nerve = (x, y, k, i) => {
    if (k <= 0) return;
    const [ex, ey] = CAR_ECU;
    const mid = [(x + ex) / 2 + (y > 0 ? 30 : -30), (y + ey) / 2 - 40];
    const P = poly(catmull([[x, y], mid, [ex, ey]], false, 10));
    c.save(); c.strokeStyle = 'rgba(127,180,221,0.65)'; c.lineWidth = 2.5 * px; trace(c, P, ease.out(clamp(k * 1.5))); c.restore();
    if (k > 0.6) {
      const ph = (t * 0.9 + i * 0.23) % 1;
      const [qx, qy] = pointAt(P, ph);
      c.fillStyle = COLOR.yellow; c.beginPath(); c.arc(qx, qy, 6 * px, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = COLOR.blue; c.beginPath(); c.arc(x, y, 10 * px * ease.outExpo(clamp(k * 3)), 0, Math.PI * 2); c.fill();
  };
  SENSORS.wheel.forEach(([x, y], i) => nerve(x + (x > 0 ? -60 : 60), y + (y > 0 ? -34 : 34), sensors[0] * nerves, i));
  SENSORS.accel.forEach(([x, y], i) => nerve(x, y, sensors[1] * nerves, 5 + i));
  SENSORS.steer.forEach(([x, y], i) => nerve(x, y, sensors[2] * nerves, 7 + i));
  SENSORS.brake.forEach(([x, y], i) => nerve(x, y, sensors[3] * nerves, 9 + i));
  // La centralita.
  const [ex, ey] = CAR_ECU;
  c.save();
  if (ecuGlow > 0) { c.shadowColor = COLOR.yellow; c.shadowBlur = 40 * ecuGlow; }
  rr(c, ex - 46, ey - 30, 92, 60, 8); c.fillStyle = COLOR.yellow; c.fill();
  c.restore();
  c.font = FONT.text(800, 22 * px > 30 ? 30 : 22 * px); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = COLOR.ink; c.fillText('ECU', ex, ey + 1);
  if (dim > 0) { c.fillStyle = `rgba(11,12,14,${dim})`; c.fillRect(-600, -400, 1200, 800); }
  c.restore();
}

// Indicador de deslizamiento junto a cada rueda (en pantalla).
function slipBars(t, o, slip, appear) {
  if (appear <= 0) return;
  SENSORS.wheel.forEach(([x, y], i) => {
    const [sx, sy] = carToScreen(o, x, y + (y > 0 ? 80 : -80));
    const w = 120, h = 14;
    ctx.save(); ctx.globalAlpha *= appear;
    ctx.fillStyle = 'rgba(232,233,230,0.16)'; ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    ctx.fillStyle = slip[i] > 0.5 ? COLOR.red : COLOR.yellow; ctx.fillRect(sx - w / 2, sy - h / 2, w * clamp(slip[i]), h);
    ctx.restore();
  });
}

// Embrague multidisco del diferencial central en sección: pistón hidráulico, discos alternos y par de salida.
function drawClutchPack(t, { cx, cy, s = 1, appear = 1, press = 0, oil = 0, torque = 0, labels = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  // Campana exterior (unida al eje trasero) y cubo interior (unido al delantero).
  c.strokeStyle = COLOR.line; c.lineWidth = 3;
  const solid = (fn) => { fn(); c.fillStyle = COLOR.ink2; c.fill(); hatch(c, fn, 16, 0.12); fn(); c.strokeStyle = COLOR.line; c.lineWidth = 3; c.stroke(); };
  solid(() => { c.beginPath(); c.rect(-380, -300, 760, 40); });
  solid(() => { c.beginPath(); c.rect(-380, 260, 760, 40); });
  solid(() => { c.beginPath(); c.rect(340, -260, 40, 520); });
  // Ejes.
  c.fillStyle = '#8C9096'; c.fillRect(-720, -26, 400, 52); c.fillRect(380, -26, 380, 52);
  c.fillStyle = '#5A5E64'; c.fillRect(-330, -150, 600, 300);
  // Pistón y cámara de aceite.
  const gap0 = 26, g = lerp(gap0, 4, ease.inOut(press));
  const nP = 7, pw = 18;
  const packW = nP * 2 * pw + (nP * 2 - 1) * g;
  const px0 = 300 - packW;
  c.fillStyle = `rgba(127,180,221,${0.25 + 0.6 * oil})`;
  c.fillRect(-370, -250, px0 - 60 + 370, 500);
  rr(c, px0 - 60, -250, 40, 500, 6); c.fillStyle = '#B9BDC2'; c.fill();
  // Discos: de fricción (naranja, al cubo) y de acero (a la campana), alternos.
  for (let k = 0; k < nP * 2; k++) {
    const x = px0 + k * (pw + g);
    const friction = k % 2 === 0;
    c.fillStyle = friction ? COLOR.fire : '#B9BDC2';
    const y0 = friction ? -170 : -250, y1 = friction ? 250 : 170;
    c.fillRect(x, y0, pw, y1 - y0);
  }
  // Presión: flechas sobre el pistón.
  if (oil > 0) for (let k = -1; k <= 1; k++) arrowPath([[px0 - 200, k * 140], [px0 - 70, k * 140]], ease.out(oil), COLOR.blue, 6, 18);
  // Par transmitido al eje trasero.
  if (torque > 0) {
    c.save(); c.globalAlpha *= torque; c.strokeStyle = COLOR.yellow; c.lineWidth = 10; c.setLineDash([24, 18]); c.lineDashOffset = -t * 300;
    c.beginPath(); c.moveTo(-720, 0); c.lineTo(-330, 0); c.moveTo(380, 0); c.lineTo(760, 0); c.stroke(); c.restore();
  }
  c.restore();
  if (labels > 0) {
    const P = (x, y) => [cx + x * s, cy + y * s];
    const L = [['PISTÓN HIDRÁULICO', -360, -290, COLOR.blue, 'center'], ['DISCOS DE FRICCIÓN', 140, 320, COLOR.fire, 'center'], ['DISCOS DE ACERO', 140, -320, COLOR.paper, 'center']];
    L.forEach(([str, x, y, col, al], i) => { const [qx, qy] = P(x, y); label(ctx, str, qx, qy, col, clamp(labels * 2 - i * 0.3), { size: 22, spacing: 6, weight: 700, align: al }); });
  }
}

// ---------------------------------------------------------------------------
// Red CAN: nodos y bus diferencial (CAN-H y CAN-L) con tramas que viajan.
function node(t, x, y, w, h, title, sub, appear, color = COLOR.paper, fillA = 0) {
  if (appear <= 0) return;
  const a = ease.outExpo(appear);
  ctx.save(); ctx.globalAlpha *= clamp(appear * 2);
  ctx.translate(x, y); ctx.scale(lerp(0.9, 1, a), lerp(0.9, 1, a));
  rr(ctx, -w / 2, -h / 2, w, h, 12); ctx.fillStyle = fillA > 0 ? color : COLOR.ink2; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  label(ctx, title, x, y + (sub ? -4 : 9), fillA > 0 ? COLOR.ink : COLOR.paper, appear, { size: 28, spacing: 3, weight: 800, align: 'center' });
  if (sub) label(ctx, sub, x, y + 34, fillA > 0 ? COLOR.ink : DIM, appear, { size: 20, spacing: 4, weight: 700, align: 'center' });
}
function canBus(t, x0, x1, y, p, taps = [], traffic = 0) {
  if (p <= 0) return;
  const xe = lerp(x0, x1, ease.inOut(clamp(p)));
  ctx.save(); ctx.lineWidth = 4;
  ctx.strokeStyle = COLOR.yellow; ctx.beginPath(); ctx.moveTo(x0, y - 14); ctx.lineTo(xe, y - 14); ctx.stroke();
  ctx.strokeStyle = COLOR.blue; ctx.beginPath(); ctx.moveTo(x0, y + 14); ctx.lineTo(xe, y + 14); ctx.stroke();
  for (const [tx, ty] of taps) {
    if (tx > xe) continue;
    ctx.strokeStyle = 'rgba(232,233,230,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tx - 8, ty); ctx.lineTo(tx - 8, y - 14); ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + 8, y + 14); ctx.stroke();
  }
  // Tramas: bloques que recorren el bus; en CAN-H suben y en CAN-L bajan (señal diferencial).
  if (traffic > 0) {
    for (let k = 0; k < 7; k++) {
      const ph = (t * 0.32 + k / 7) % 1, dir = k % 2 ? 1 : -1;
      const xx = dir > 0 ? lerp(x0, x1, ph) : lerp(x1, x0, ph);
      if (xx > xe) continue;
      ctx.globalAlpha = traffic * Math.sin(Math.PI * ph);
      ctx.fillStyle = COLOR.yellow; ctx.fillRect(xx - 26, y - 26, 52, 10);
      ctx.fillStyle = COLOR.blue; ctx.fillRect(xx - 26, y + 16, 52, 10);
    }
  }
  ctx.restore();
}

// Batería en planta: celdas coloreadas por temperatura y su límite térmico.
function drawBattery(t, { cx, cy, s = 1, appear = 1, soc = 0.5, temp = 0.3, cols = 8, rows = 4 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  const w = 560, h = 300;
  rr(c, -w / 2, -h / 2, w, h, 18); c.fillStyle = COLOR.ink2; c.fill(); c.strokeStyle = COLOR.paper; c.lineWidth = 3; c.stroke();
  const cw = (w - 60) / cols, ch = (h - 60) / rows;
  const R = rng(21);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const local = clamp(temp + (R() - 0.5) * 0.12 + (j === 1 || j === 2 ? 0.05 : 0));
    const col = local < 0.5 ? mixRGB([127, 180, 221], [233, 168, 37], local * 2) : mixRGB([233, 168, 37], [215, 38, 45], (local - 0.5) * 2);
    rr(c, -w / 2 + 30 + i * cw + 4, -h / 2 + 30 + j * ch + 4, cw - 8, ch - 8, 6); c.fillStyle = col; c.fill();
  }
  // Bornes.
  c.fillStyle = '#8C9096'; c.fillRect(-w / 2 + 40, -h / 2 - 24, 40, 24); c.fillRect(w / 2 - 80, -h / 2 - 24, 40, 24);
  c.restore();
}

// ---------------------------------------------------------------------------
// Mapa de avance de encendido: superficie 3D (X régimen, Y carga, Z avance) con un punto de trabajo.
const MAPN = 14;
const advance = (u, v) => clamp(0.18 + 0.62 * Math.pow(u, 0.7) * (1 - 0.62 * v) + 0.08 * Math.sin(u * 3.1) * (1 - v) - 0.08 * v * v);
function heightCol(k, a = 1) {
  const [r, g, b] = k < 0.5 ? [lerp(127, 233, k * 2), lerp(180, 168, k * 2), lerp(221, 37, k * 2)] : [lerp(233, 238, (k - 0.5) * 2), lerp(168, 122, (k - 0.5) * 2), lerp(37, 30, (k - 0.5) * 2)];
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}
function drawSurface(t, { cx, cy, s = 1, yaw = -0.7, pitch = 0.55, build = 1, rise = 1, appear = 1, pt = null, cell = 0, axes = 0, shade = 1, scramble = 0 } = {}) {
  const f = proj3(cx, cy, s, yaw, pitch);
  const L = 600, Hh = 380; // tamaño del mapa: X e Y de −300 a 300, Z de 0 a 340
  const P = (u, v, k = 1) => f(-L / 2 + u * L, -L / 2 + v * L, advance(u, v) * Hh * rise * k);
  ctx.save(); ctx.globalAlpha *= appear;
  // Base y ejes.
  const base = [f(-L / 2, -L / 2, 0), f(L / 2, -L / 2, 0), f(L / 2, L / 2, 0), f(-L / 2, L / 2, 0)];
  quad(base, 'rgba(232,233,230,0.04)', 'rgba(232,233,230,0.25)', 1.5);
  // Celdas de atrás adelante.
  const cells = [];
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) {
    const u0 = i / MAPN, u1 = (i + 1) / MAPN, v0 = j / MAPN, v1 = (j + 1) / MAPN;
    const order = (i + (MAPN - 1 - j)) / (2 * MAPN - 2);
    const k = ease.outExpo(clamp(build * 1.6 - order * 0.9));
    if (k <= 0) continue;
    const d = depth3(f, -L / 2 + (u0 + u1) / 2 * L, -L / 2 + (v0 + v1) / 2 * L, 0);
    cells.push({ i, j, u0, u1, v0, v1, k, d });
  }
  cells.sort((a, b) => a.d - b.d);
  const R = rng(3);
  const shuf = Array.from({ length: MAPN * MAPN }, () => R());
  for (const q of cells) {
    const pts = [P(q.u0, q.v0, q.k), P(q.u1, q.v0, q.k), P(q.u1, q.v1, q.k), P(q.u0, q.v1, q.k)];
    let hv = advance((q.u0 + q.u1) / 2, (q.v0 + q.v1) / 2);
    if (scramble > 0) hv = lerp(hv, shuf[q.j * MAPN + q.i], scramble);
    // Sombreado simple por la pendiente (normal aproximada).
    const dz = (advance(q.u1, q.v0) - advance(q.u0, q.v0)) - (advance(q.u0, q.v1) - advance(q.u0, q.v0));
    const lit = clamp(0.75 + dz * 2.2 * shade, 0.45, 1.1);
    const col = heightCol(hv, 1);
    quad(pts, col, 'rgba(11,12,14,0.55)', 1.2);
    ctx.save(); ctx.globalAlpha *= clamp(1 - lit) * 0.9; quad(pts, '#0B0C0E'); ctx.restore();
    if (lit > 1) { ctx.save(); ctx.globalAlpha *= (lit - 1) * 2; quad(pts, '#FFFFFF'); ctx.restore(); }
  }
  // Ejes con rótulos.
  if (axes > 0) {
    ctx.save(); ctx.globalAlpha *= axes; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
    const o = f(-L / 2, -L / 2, 0), ax = f(L / 2 + 60, -L / 2, 0), ay = f(-L / 2, L / 2 + 60, 0), az = f(-L / 2, -L / 2, Hh + 80);
    for (const e of [ax, ay, az]) { ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); arrowHead(e[0], e[1], Math.atan2(e[1] - o[1], e[0] - o[0]), 16, COLOR.paper); }
    ctx.restore();
  }
  // Punto de trabajo con interpolación entre las cuatro celdas vecinas.
  let out = null;
  if (pt) {
    const [u, v] = pt;
    const i = Math.min(MAPN - 1, Math.floor(u * MAPN)), j = Math.min(MAPN - 1, Math.floor(v * MAPN));
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => P(a / MAPN, b / MAPN));
    const p = P(u, v), g = f(-L / 2 + u * L, -L / 2 + v * L, 0);
    ctx.save();
    if (cell > 0) {
      ctx.globalAlpha *= cell;
      quad(corners, 'rgba(233,168,37,0.25)', COLOR.yellow, 3);
      ctx.strokeStyle = 'rgba(232,233,230,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      for (const q of corners) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR.paper; for (const q of corners) { ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha /= cell;
    }
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    out = p;
  }
  ctx.restore();
  f.L = L; f.Hh = Hh;
  return { f, pt: out };
}

// ---------------------------------------------------------------------------
// Trazas genéricas: señal en un recuadro, con cursor.
function trace2(x, y, w, h, fn, p, color, width = 3) {
  if (p <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 4, w * clamp(p), h + 8); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 400; i++) { const u = i / 400; const yy = y + h * (1 - fn(u)); if (i) ctx.lineTo(x + u * w, yy); else ctx.moveTo(x, yy); }
  ctx.stroke(); ctx.restore();
}
// Pulsos de mando del inyector (PWM): `duty` 0..1 de cada periodo.
function pwm(x, y, w, h, periods, duty, p, color = COLOR.yellow) {
  const f = (u) => { const k = (u * periods) % 1; return k < (typeof duty === 'function' ? duty(u) : duty) ? 1 : 0; };
  trace2(x, y, w, h, f, p, color, 4);
}
