// ---------------------------------------------------------------------------
// Componentes de freno. Todo es función de parámetros explícitos (y de t para el giro): determinista.
// Rampa de temperatura: el color de la incandescencia del hierro (gris → rojo oscuro → rojo → naranja → amarillo),
// con los colores de la marca. Azul = aire y líquido frío.

const HEAT = [[0, [58, 61, 66]], [0.3, [107, 31, 23]], [0.55, [215, 38, 45]], [0.8, [238, 122, 30]], [1, [242, 193, 78]]];
function heatRGB(k) {
  k = clamp(k);
  let i = 0;
  while (i < HEAT.length - 2 && k > HEAT[i + 1][0]) i++;
  const [a0, c0] = HEAT[i], [a1, c1] = HEAT[i + 1];
  const f = clamp((k - a0) / (a1 - a0));
  return c0.map((v, j) => Math.round(lerp(v, c1[j], f)));
}
const heatCol = (k, a = 1) => { const [r, g, b] = heatRGB(k); return `rgba(${r},${g},${b},${a})`; };
const STEEL = '#3A3D42', STEEL2 = '#55595F', ALU = '#9EA3A9', TI = '#7C8794';
function mixRGB(c0, c1, f) { return `rgb(${c0.map((v, j) => Math.round(lerp(v, c1[j], f))).join(',')})`; }
const BLUE = [127, 180, 221], HOT = [238, 122, 30];
const fluidCol = (h) => mixRGB(BLUE, HOT, clamp(h));

function arrowHead(x, y, ang, size = 16, color = COLOR.paper) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.55); ctx.lineTo(-size, size * 0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Flecha que avanza por una polilínea (p: 0..1 dibujado).
function arrowPath(pts, p, color, width = 5, head = 16) {
  if (p <= 0) return;
  const P = poly(pts);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trace(ctx, P, p);
  ctx.restore();
  const [x, y, a] = pointAt(P, clamp(p));
  arrowHead(x + Math.cos(a) * head * 0.6, y + Math.sin(a) * head * 0.6, a, head, color);
}
function spring(x0, y0, x1, y1, n = 9, amp = 10) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i < n * 2; i++) {
    const f = i / (n * 2), s = (i % 2 ? 1 : -1) * amp;
    ctx.lineTo(x0 + dx * f - uy * s, y0 + dy * f + ux * s);
  }
  ctx.lineTo(x1, y1); ctx.stroke();
}
function glow(color, blur, fn) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); }

// Burbujas deterministas que suben dentro de un rectángulo (k: cantidad 0..1).
function bubbles(x, y, w, h, k, t, seed = 3, rmax = 9) {
  if (k <= 0) return;
  const R = rng(seed);
  const n = Math.round(28 * k);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < 28; i++) {
    const bx = R(), ph = R(), sp = 0.25 + R() * 0.5, rs = 0.4 + R() * 0.6;
    if (i >= n) continue;
    const yy = y + h - ((ph + t * sp) % 1) * (h + 20);
    const r = rmax * rs * clamp(k * 1.5);
    ctx.fillStyle = 'rgba(232,233,230,0.85)';
    ctx.strokeStyle = 'rgba(11,12,14,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + bx * w + Math.sin(t * 3 + i) * 3, yy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// --- Disco de freno visto de frente ---------------------------------------
// holes: 'none' | 'drilled' | 'slots'; crack: grietas radiales 0..1; carbon: textura de carbono.
function drawDiscFront(cx, cy, R, { rot = 0, heat = 0, holes = 'none', crack = 0, carbon = false, alpha = 1, bolts = 5, vanes = 0 } = {}) {
  const c = ctx, ri = R * 0.6, rb = R * 0.42;
  c.save(); c.translate(cx, cy); c.globalAlpha *= alpha;
  // Anillo de fricción.
  const ring = () => { c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.arc(0, 0, ri, 0, Math.PI * 2, true); };
  if (heat > 0.45) glow(heatCol(heat), 60 * (heat - 0.45) * 2, () => { ring(); c.fillStyle = heatCol(heat); c.fill(); });
  ring();
  if (carbon) c.fillStyle = '#26282C';
  else {
    const g = c.createRadialGradient(0, 0, ri, 0, 0, R);
    g.addColorStop(0, heatCol(heat * 0.8)); g.addColorStop(0.55, heatCol(heat)); g.addColorStop(1, heatCol(heat * 0.85));
    c.fillStyle = g;
  }
  c.fill();
  // Huellas de mecanizado.
  c.strokeStyle = 'rgba(232,233,230,0.08)'; c.lineWidth = 1;
  for (let r = ri + 8; r < R - 4; r += 9) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
  if (carbon) {
    c.save(); ring(); c.clip(); c.rotate(rot);
    c.strokeStyle = 'rgba(232,233,230,0.07)'; c.lineWidth = 2;
    for (let k = -R; k < R; k += 16) { c.beginPath(); c.moveTo(k, -R); c.lineTo(k + R * 0.3, R); c.stroke(); }
    c.restore();
  }
  // Aletas internas asomando por el canto (disco ventilado visto de frente: solo en el borde interior).
  if (vanes > 0) {
    c.save(); c.rotate(rot); c.globalAlpha *= vanes; c.strokeStyle = 'rgba(11,12,14,0.55)'; c.lineWidth = R * 0.03;
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * ri, Math.sin(a) * ri); c.lineTo(Math.cos(a + 0.12) * (ri + R * 0.06), Math.sin(a + 0.12) * (ri + R * 0.06)); c.stroke(); }
    c.restore();
  }
  c.save(); c.rotate(rot);
  if (holes === 'drilled') {
    c.fillStyle = COLOR.ink;
    const rows = [ri + (R - ri) * 0.25, ri + (R - ri) * 0.5, ri + (R - ri) * 0.75];
    rows.forEach((r, j) => { for (let i = 0; i < 24; i++) { const a = ((i + j * 0.33) / 24) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, R * 0.022, 0, Math.PI * 2); c.fill(); } });
  } else if (holes === 'slots') {
    c.strokeStyle = 'rgba(11,12,14,0.8)'; c.lineWidth = R * 0.018; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * (ri + (R - ri) * 0.5) * 0.25, Math.sin(a) * (ri + (R - ri) * 0.5) * 0.25, (ri + (R - ri) * 0.5) * 0.8, a + 0.6, a + 0.95); c.stroke(); }
  }
  // Grietas por choque térmico: nacen en el borde y avanzan hacia dentro.
  if (crack > 0) {
    const Rr = rng(11);
    c.strokeStyle = COLOR.ink; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2 + Rr() * 0.4, len = (R - ri) * (0.5 + Rr() * 0.6) * clamp(crack * 1.4 - i * 0.05);
      if (len <= 0) continue;
      c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
      const steps = 8;
      for (let k = 1; k <= steps; k++) {
        const r = R - len * (k / steps), a = a0 + (noise1(i * 7 + k * 0.9) * 0.05);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.stroke();
    }
  }
  // Campana y tornillería.
  c.beginPath(); c.arc(0, 0, ri, 0, Math.PI * 2); c.fillStyle = STEEL2; c.fill();
  c.beginPath(); c.arc(0, 0, rb, 0, Math.PI * 2); c.fillStyle = '#6E7379'; c.fill();
  c.strokeStyle = 'rgba(232,233,230,0.35)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = COLOR.ink;
  for (let i = 0; i < bolts; i++) { const a = (i / bolts) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * rb * 0.62, Math.sin(a) * rb * 0.62, rb * 0.1, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(0, 0, rb * 0.32, 0, Math.PI * 2); c.fill();
  // Flotantes de la campana.
  c.fillStyle = '#8A8F96';
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * ri, Math.sin(a) * ri, R * 0.025, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.strokeStyle = 'rgba(232,233,230,0.5)'; c.lineWidth = 2; c.stroke();
  c.restore();
}

// --- Pinza vista de frente, abrazando el disco ------------------------------
// n: pistones por lado (solo se ven como cotas fantasma); mono: monobloque sin tornillos de unión.
function drawCaliperFront(cx, cy, R, ang = -0.75, { n = 2, span = 0.5, heat = 0, alpha = 1, ghost = 0, color = COLOR.red, mono = false } = {}) {
  const c = ctx, r0 = R * 0.6, r1 = R * 1.1;
  c.save(); c.translate(cx, cy); c.rotate(ang); c.globalAlpha *= alpha;
  c.beginPath();
  c.arc(0, 0, r1, -span, span);
  c.arc(0, 0, r0, span * 0.92, -span * 0.92, true);
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = 'rgba(11,12,14,0.45)'; c.lineWidth = 3; c.stroke();
  // Ventana central y relieve.
  c.beginPath(); c.arc(0, 0, (r0 + r1) / 2, -span * 0.55, span * 0.55); c.strokeStyle = 'rgba(11,12,14,0.35)'; c.lineWidth = R * 0.12; c.stroke();
  if (!mono) { c.fillStyle = 'rgba(11,12,14,0.6)'; for (const s of [-1, 1]) { const a = s * span * 0.8; c.beginPath(); c.arc(Math.cos(a) * r1 * 0.95, Math.sin(a) * r1 * 0.95, R * 0.025, 0, Math.PI * 2); c.fill(); } }
  if (ghost > 0) {
    c.globalAlpha *= ghost; c.strokeStyle = COLOR.paper; c.lineWidth = 2.5; c.setLineDash([6, 6]);
    for (let i = 0; i < n; i++) {
      const a = lerp(-span * 0.62, span * 0.62, n === 1 ? 0.5 : i / (n - 1)), rp = (r0 + r1) / 2;
      const rad = R * (n === 3 ? 0.085 : 0.1);
      c.beginPath(); c.arc(Math.cos(a) * rp, Math.sin(a) * rp, rad, 0, Math.PI * 2); c.stroke();
    }
    c.setLineDash([]);
  }
  c.restore();
}

// --- Sección de pinza y disco (la anatomía del freno) -----------------------
// Unidades locales ≈ 0,5 mm. El disco es vertical, el borde exterior arriba; la pinza lo abraza.
// clamp: carrera de pistones (0 suelto, 1 apretado). gas: colchón de gas entre pastilla y disco.
// boil: burbujas en el líquido. heat: temperatura del disco. heatPath: flechas del calor (0..1 recorrido).
// vented: canal central del disco ventilado. air: flujo de aire por el canal. ti: pistones de titanio huecos.
// water: canales de refrigeración por agua. deflect: la pinza se abre bajo presión. labels: rótulos.
function drawSection(t, { cx, cy, s = 1, clamp: cl = 0, gas = 0, boil = 0, heat = 0, padHeat = null, fluidHeat = 0, heatPath = 0, vented = 0, air = 0,
  ti = 0, water = 0, deflect = 0, labels = 0, appear = 1, explode = 0, pressure = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.globalAlpha *= appear;
  const px = 1 / s;
  const gap = lerp(16, 0, ease.inOut(clamp(cl))) + gas * 9;
  const ex = explode * 220; // vista explosionada: las piezas se separan en horizontal
  const dTop = -320, dBot = 230;
  // Disco (con línea de rotura abajo).
  const discShape = (x0, x1) => {
    c.beginPath(); c.moveTo(x0, dTop); c.lineTo(x1, dTop); c.lineTo(x1, dBot);
    for (let k = 0; k <= 4; k++) c.lineTo(lerp(x1, x0, k / 4), dBot + (k % 2 ? 14 : -4));
    c.closePath();
  };
  const faceCol = heatCol(heat);
  if (heat > 0.5) glow(faceCol, 50 * (heat - 0.5), () => { discShape(-30, 30); c.fillStyle = faceCol; c.fill(); });
  if (vented > 0) {
    discShape(-30, -12); c.fillStyle = faceCol; c.fill();
    discShape(12, 30); c.fillStyle = faceCol; c.fill();
    // Aletas del canal en discontinua y paso hacia el buje.
    c.save(); c.globalAlpha *= vented;
    c.fillStyle = 'rgba(232,233,230,0.06)'; c.fillRect(-12, dTop, 24, dBot - dTop);
    c.strokeStyle = 'rgba(232,233,230,0.25)'; c.lineWidth = 2 * px; c.setLineDash([10, 10]);
    c.beginPath(); c.moveTo(0, dTop); c.lineTo(0, dBot); c.stroke(); c.setLineDash([]);
    c.restore();
    if (vented < 1) { c.save(); c.globalAlpha *= 1 - vented; discShape(-12, 12); c.fillStyle = faceCol; c.fill(); c.restore(); }
  } else { discShape(-30, 30); c.fillStyle = faceCol; c.fill(); }
  discShape(-30, 30); c.strokeStyle = 'rgba(232,233,230,0.55)'; c.lineWidth = 2 * px; c.stroke();
  // Aire por el canal: entra frío por el buje, sale caliente por el borde.
  if (air > 0 && vented > 0) {
    for (let k = 0; k < 3; k++) {
      const P = poly([[0, dBot + 60], [0, dTop - 70]]);
      c.save(); c.globalAlpha *= air;
      const g = c.createLinearGradient(0, dBot, 0, dTop);
      g.addColorStop(0, COLOR.blue); g.addColorStop(1, COLOR.fire);
      c.strokeStyle = g; c.lineWidth = 8 * px; c.lineCap = 'round'; c.setLineDash([22, 26]); c.lineDashOffset = -t * 220 - k * 16;
      c.beginPath(); c.moveTo(0, dBot + 60); c.lineTo(0, dTop - 70); c.stroke();
      c.restore();
      if (k === 0) arrowHead(0, dTop - 82, -Math.PI / 2, 20, COLOR.fire);
    }
  }

  for (const sd of [-1, 1]) {
    c.save(); c.scale(sd, 1);
    // Abertura de la pinza bajo presión: gira cada mitad alrededor del puente.
    const open = deflect * 0.07;
    c.translate(ex, 0);
    c.translate(0, -420); c.rotate(-open); c.translate(0, 420);
    const pad0 = 30 + gap + ex * 0.15, padW = 34, plateW = 13;
    const pistonX0 = pad0 + padW + plateW + ex * 0.25, pistonW = 92;
    const bodyX0 = 54, bodyX1 = 290;
    const yb0 = -360, yb1 = -90;
    const bx = ex * 0.4;
    c.fillStyle = '#1E2125';
    c.beginPath(); c.rect(bodyX0 + 40 + bx, yb0, bodyX1 - bodyX0 - 40, yb1 - yb0); c.fill();
    hatch(c, () => { c.beginPath(); c.rect(bodyX0 + 40 + bx, yb0, bodyX1 - bodyX0 - 40, yb1 - yb0); }, 16, 0.12);
    // Cilindro (hueco) y líquido detrás del pistón.
    const cyl0 = bodyX0 + 40 + bx, cyl1 = 236 + bx, cy0 = -282, cy1 = -150;
    c.fillStyle = COLOR.ink; c.fillRect(cyl0, cy0, cyl1 - cyl0, cy1 - cy0);
    const pBack = Math.max(cyl0 + 4, pistonX0 + pistonW);
    c.fillStyle = fluidCol(fluidHeat); c.fillRect(pBack, cy0, cyl1 - pBack, cy1 - cy0);
    if (pressure > 0) { c.save(); c.globalAlpha *= pressure * (0.5 + 0.5 * Math.sin(t * 9)); c.fillStyle = 'rgba(232,233,230,0.35)'; c.fillRect(pBack, cy0, cyl1 - pBack, cy1 - cy0); c.restore(); }
    if (boil > 0) bubbles(pBack, cy0, cyl1 - pBack, cy1 - cy0, boil, t, sd > 0 ? 4 : 9, 10);
    // Canales de agua alrededor del cilindro.
    if (water > 0) {
      c.save(); c.globalAlpha *= water;
      for (const yy of [cy0 - 26, cy1 + 26]) {
        c.fillStyle = COLOR.blue; c.fillRect(cyl0 + 8, yy - 9, cyl1 - cyl0 + 20, 18);
        c.strokeStyle = 'rgba(232,233,230,0.7)'; c.lineWidth = 3 * px; c.setLineDash([12, 12]); c.lineDashOffset = -t * 90 * (yy < -200 ? 1 : -1);
        c.beginPath(); c.moveTo(cyl0 + 10, yy); c.lineTo(cyl1 + 26, yy); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
    c.strokeStyle = 'rgba(232,233,230,0.6)'; c.lineWidth = 2 * px;
    c.strokeRect(bodyX0 + 40 + bx, yb0, bodyX1 - bodyX0 - 40, yb1 - yb0);
    // Retén del pistón.
    c.fillStyle = '#0B0C0E'; c.fillRect(cyl0 + 14, cy0 - 7, 16, 7); c.fillRect(cyl0 + 14, cy1, 16, 7);
    // Pistón: acero macizo o titanio hueco y perforado.
    const pc = ti > 0.5 ? TI : '#8E939A';
    c.fillStyle = pc;
    c.beginPath(); c.rect(pistonX0, cy0 + 4, pistonW, cy1 - cy0 - 8); c.fill();
    if (ti > 0) {
      c.save(); c.globalAlpha *= ti;
      c.fillStyle = COLOR.ink; c.fillRect(pistonX0 + 12, cy0 + 22, pistonW - 12, cy1 - cy0 - 44);
      c.fillStyle = TI; for (const yy of [cy0 + 46, cy1 - 46]) { c.fillRect(pistonX0 + 4, yy - 6, 10, 12); }
      c.fillStyle = COLOR.ink; for (const yy of [cy0 + 46, cy1 - 46]) { c.beginPath(); c.arc(pistonX0 + 8, yy, 6, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    c.strokeStyle = 'rgba(232,233,230,0.75)'; c.lineWidth = 2 * px; c.strokeRect(pistonX0, cy0 + 4, pistonW, cy1 - cy0 - 8);
    // Pastilla: placa de acero y material de fricción.
    const ph = padHeat ?? heat * 0.85;
    c.fillStyle = '#6E7379'; c.fillRect(pad0 + padW, -300, plateW, 170);
    c.fillStyle = heatCol(ph); c.fillRect(pad0, -296, padW, 162);
    c.save(); c.beginPath(); c.rect(pad0, -296, padW, 162); c.clip();
    c.fillStyle = 'rgba(232,233,230,0.12)';
    const Rp = rng(5); for (let i = 0; i < 40; i++) c.fillRect(pad0 + Rp() * padW, -296 + Rp() * 162, 3, 3);
    c.restore();
    c.strokeStyle = 'rgba(232,233,230,0.55)'; c.strokeRect(pad0, -296, padW + plateW, 162);
    // Colchón de gas entre pastilla y disco.
    if (gas > 0) {
      c.save(); c.globalAlpha *= clamp(gas * 1.4);
      const gx0 = 30, gx1 = pad0;
      c.fillStyle = 'rgba(232,233,230,0.28)'; c.fillRect(gx0, -296, gx1 - gx0, 162);
      const Rg = rng(21);
      for (let i = 0; i < 16; i++) {
        const yy = -296 + ((Rg() + t * (0.2 + Rg() * 0.3)) % 1) * 162;
        c.fillStyle = 'rgba(232,233,230,0.9)'; c.beginPath(); c.arc(lerp(gx0, gx1, Rg()), yy, 2 + Rg() * 2.5, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    c.restore();
  }
  // Puente de la pinza y paso de líquido de un lado al otro.
  if (explode < 0.5) {
    c.save(); c.globalAlpha *= 1 - explode * 2;
    c.fillStyle = '#1E2125'; c.fillRect(-290, -440, 580, 80);
    hatch(c, () => { c.beginPath(); c.rect(-290, -440, 580, 80); }, 16, 0.12);
    c.strokeStyle = 'rgba(232,233,230,0.6)'; c.lineWidth = 2 * px; c.strokeRect(-290, -440, 580, 80);
    c.strokeStyle = fluidCol(fluidHeat); c.lineWidth = 10 * px;
    c.beginPath(); c.moveTo(-215, -282); c.lineTo(-215, -400); c.lineTo(215, -400); c.lineTo(215, -282); c.stroke();
    c.restore();
  }
  // Recorrido del calor: disco → pastilla → pistón → líquido.
  if (heatPath > 0) {
    const pts = [[30, -215], [30 + gap + 40, -215], [30 + gap + 60, -255], [30 + gap + 120, -255], [30 + gap + 170, -215], [215, -215]];
    arrowPath(pts, heatPath, COLOR.fire, 7 * px, 20 * px);
  }
  // Rótulos.
  if (labels > 0) {
    const L = [['DISCO', 0, dBot + 70, 'center'], ['PASTILLA', -120, 40, 'center'], ['PISTÓN', 120 + gap, 40, 'center'], ['LÍQUIDO', 330, -196, 'left'], ['PINZA', 0, -470, 'center']];
    L.forEach(([str, x, y, al], i) => label(ctx, str, x, y, COLOR.paper, clamp(labels * 1.8 - i * 0.15), { size: 24 * px, spacing: 6, weight: 700, align: al }));
    // Guías.
    c.save(); c.globalAlpha *= clamp(labels * 1.5); c.strokeStyle = 'rgba(232,233,230,0.4)'; c.lineWidth = 1.5 * px;
    c.beginPath(); c.moveTo(-60 - gap, -150); c.lineTo(-110, 10); c.moveTo(120 + gap, -150); c.lineTo(120 + gap, 10); c.moveTo(225, -215); c.lineTo(290, -205); c.stroke();
    c.restore();
  }
  c.restore();
}

// --- Freno de tambor en corte, visto de frente -------------------------------
// apply: las zapatas giran sobre su anclaje inferior hacia el tambor; dilate: el tambor crece por el calor.
function drawDrum(t, { cx, cy, R = 300, rot = 0, apply = 0, dilate = 0, heat = 0, appear = 1, labels = 0, trapped = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.globalAlpha *= appear;
  const Rd = R * (1 + 0.085 * dilate);
  // Aire caliente atrapado.
  if (trapped > 0) {
    c.save(); c.globalAlpha *= trapped;
    const g = c.createRadialGradient(0, 0, R * 0.2, 0, 0, Rd);
    g.addColorStop(0, 'rgba(215,38,45,0.05)'); g.addColorStop(1, 'rgba(238,122,30,0.42)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, Rd, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // Tambor: anillo con aletas exteriores y espárragos que giran.
  if (heat > 0.5) glow(heatCol(heat), 50 * (heat - 0.5), () => { c.beginPath(); c.arc(0, 0, Rd + 34, 0, Math.PI * 2); c.arc(0, 0, Rd, 0, Math.PI * 2, true); c.fillStyle = heatCol(heat); c.fill(); });
  c.beginPath(); c.arc(0, 0, Rd + 34, 0, Math.PI * 2); c.arc(0, 0, Rd, 0, Math.PI * 2, true); c.fillStyle = heatCol(heat); c.fill();
  c.save(); c.rotate(rot); c.fillStyle = heatCol(heat * 0.9);
  for (let i = 0; i < 24; i++) { c.save(); c.rotate((i / 24) * Math.PI * 2); c.fillRect(Rd + 30, -5, 22, 10); c.restore(); }
  c.restore();
  c.strokeStyle = 'rgba(232,233,230,0.55)'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, Rd, 0, Math.PI * 2); c.stroke();
  // Plato portafrenos (fijo).
  c.beginPath(); c.arc(0, 0, R * 0.93, 0, Math.PI * 2); c.fillStyle = 'rgba(30,33,37,0.9)'; c.fill();
  // Anclaje inferior y bombín superior.
  const anchorY = R * 0.72, cylY = -R * 0.74;
  c.fillStyle = STEEL2; rr(c, -40, anchorY - 22, 80, 44, 8); c.fill();
  const push = ease.inOut(clamp(apply));
  // Ángulo de contacto: las zapatas llegan al tambor sin dilatar; con dilatación queda holgura.
  const maxRot = 0.034, contact = 0.026;
  const th = Math.min(push * maxRot, contact);
  for (const sd of [-1, 1]) {
    c.save(); c.scale(sd, 1);
    c.translate(22, anchorY); c.rotate(-th); c.translate(-22, -anchorY);
    // Zapata: alma (web), mesa y forro de fricción.
    const a0 = -Math.PI / 2 + 0.2, a1 = Math.PI / 2 - 0.28;
    const rl = R * 0.885;
    c.beginPath(); c.arc(0, 0, rl, a0, a1); c.arc(0, 0, rl - R * 0.08, a1, a0, true); c.closePath();
    c.fillStyle = heatCol(heat * 0.8 + 0.05); c.fill(); // forro
    c.beginPath(); c.arc(0, 0, rl - R * 0.08, a0, a1); c.arc(0, 0, rl - R * 0.1, a1, a0, true); c.closePath();
    c.fillStyle = '#8E939A'; c.fill();
    c.beginPath(); c.arc(0, 0, rl - R * 0.1, a0 + 0.05, a1 - 0.05); c.lineWidth = R * 0.04; c.strokeStyle = '#6E7379'; c.stroke();
    c.restore();
  }
  // Bombín con dos pistones.
  c.fillStyle = '#6E7379'; rr(c, -70, cylY - 24, 140, 48, 10); c.fill();
  c.fillStyle = COLOR.blue; c.fillRect(-46, cylY - 12, 92, 24);
  c.fillStyle = '#B5B9BE'; for (const sd of [-1, 1]) c.fillRect(sd > 0 ? 46 + push * 10 : -66 - push * 10, cylY - 14, 20, 28);
  // Muelles de retorno.
  c.strokeStyle = COLOR.yellow; c.lineWidth = 3;
  spring(-R * 0.55, cylY + 70, R * 0.55, cylY + 70, 10, 10);
  spring(-R * 0.5, anchorY - 50, R * 0.5, anchorY - 50, 9, 9);
  // Cubo central.
  c.beginPath(); c.arc(0, 0, R * 0.2, 0, Math.PI * 2); c.fillStyle = '#6E7379'; c.fill();
  c.fillStyle = COLOR.ink; c.beginPath(); c.arc(0, 0, R * 0.07, 0, Math.PI * 2); c.fill();
  c.restore();
  if (labels > 0) {
    label(ctx, 'TAMBOR', cx, cy - Rd - 70, COLOR.paper, clamp(labels * 2), { size: 24, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'ZAPATA', cx - R * 0.6, cy + 12, COLOR.paper, clamp(labels * 2 - 0.3), { size: 22, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'ZAPATA', cx + R * 0.6, cy + 12, COLOR.paper, clamp(labels * 2 - 0.3), { size: 22, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'BOMBÍN', cx, cy - R * 0.74 - 44, COLOR.blue, clamp(labels * 2 - 0.6), { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
}

// --- Pedal de freno visto de lado ---------------------------------------------
// travel: 0 arriba, 1 hasta el suelo. Devuelve la punta del vástago.
function drawPedal(x, y, travel, { appear = 1, s = 1, firm = false, floor = true, col = COLOR.paper } = {}) {
  const c = ctx;
  c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha *= appear;
  const a = lerp(0.18, 0.95, clamp(travel));
  // Pivote y brazo.
  c.strokeStyle = col; c.lineWidth = 12; c.lineCap = 'round';
  const L = 300;
  const tipX = Math.sin(a) * L, tipY = Math.cos(a) * L;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(tipX, tipY); c.stroke();
  c.save(); c.translate(tipX, tipY); c.rotate(-a); c.fillStyle = col; rr(c, -46, -10, 92, 26, 6); c.fill(); c.restore();
  c.fillStyle = COLOR.ink; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill(); c.strokeStyle = col; c.lineWidth = 4; c.stroke();
  // Vástago hacia la bomba.
  const rx = Math.sin(a) * 90, ry = Math.cos(a) * 90;
  c.strokeStyle = 'rgba(232,233,230,0.7)'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(rx, ry); c.lineTo(-180 + rx * 0.6, 60); c.stroke();
  if (floor) {
    c.strokeStyle = 'rgba(232,233,230,0.35)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-60, L + 34); c.lineTo(L + 120, L + 34); c.stroke();
    c.setLineDash([8, 8]); for (let k = 0; k < 10; k++) { c.beginPath(); c.moveTo(-50 + k * 36, L + 34); c.lineTo(-66 + k * 36, L + 52); c.stroke(); }
    c.setLineDash([]);
  }
  c.restore();
}

// --- Rueda con tapa Turbofan --------------------------------------------------
function drawTurbofan(t, { cx, cy, R = 300, rot = 0, extract = 0, appear = 1, heat = 0.7, blades = 14 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.globalAlpha *= appear;
  // Neumático.
  c.beginPath(); c.arc(0, 0, R * 1.32, 0, Math.PI * 2); c.arc(0, 0, R * 1.02, 0, Math.PI * 2, true); c.fillStyle = '#18191C'; c.fill();
  c.strokeStyle = 'rgba(232,233,230,0.3)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R * 1.32, 0, Math.PI * 2); c.stroke();
  // Disco incandescente al fondo, visible entre las aspas.
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = heatCol(heat * 0.6); c.fill();
  // Tapa: aspas curvas que giran (con estela de movimiento).
  for (let k = 0; k < 4; k++) {
    c.save(); c.rotate(rot - k * 0.035); c.globalAlpha *= k === 0 ? 1 : 0.25;
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2;
      c.save(); c.rotate(a);
      c.beginPath();
      c.moveTo(R * 0.28, 0);
      c.quadraticCurveTo(R * 0.65, R * 0.08, R * 0.98, R * 0.28);
      c.lineTo(R * 0.98, R * 0.36);
      c.quadraticCurveTo(R * 0.6, R * 0.2, R * 0.28, R * 0.12);
      c.closePath();
      c.fillStyle = '#E8E9E6'; c.fill();
      c.restore();
    }
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, R * 0.3, 0, Math.PI * 2); c.fillStyle = '#C9CBCF'; c.fill();
  c.fillStyle = COLOR.ink; for (let i = 0; i < 5; i++) { const a = rot + (i / 5) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18, R * 0.035, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // Aire caliente extraído: corrientes en espiral hacia fuera.
  if (extract > 0) {
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 16; k++) { const f = k / 16; const r = lerp(R * 0.5, R * 1.75, f); const a = a0 + rot * 0.15 + f * 0.9; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      const P = poly(pts);
      ctx.save(); ctx.globalAlpha *= extract * appear;
      const g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.75);
      g.addColorStop(0, COLOR.fire); g.addColorStop(1, 'rgba(238,122,30,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.setLineDash([30, 30]); ctx.lineDashOffset = -t * 200 - i * 9;
      ctx.beginPath(); ctx.moveTo(P.pts[0][0], P.pts[0][1]); for (const p of P.pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.restore();
    }
  }
}

// --- Rueda de perfil a escala: llanta, neumático y disco (mm reales × k) ----------
// rimIn: pulgadas; disc: mm; tyreD: diámetro exterior en mm.
function drawWheelScale(t, { cx, cy, k = 0.9, rimIn = 18, disc = 380, tyreD = 650, appear = 1, discHeat = 0, rot = 0, clash = 0, labels = 1 } = {}) {
  const c = ctx;
  const rRim = (rimIn * 25.4) / 2 * k, rT = (tyreD / 2) * k, rD = (disc / 2) * k;
  c.save(); c.translate(cx, cy); c.globalAlpha *= appear;
  // Neumático (flanco).
  c.beginPath(); c.arc(0, 0, rT, 0, Math.PI * 2); c.arc(0, 0, rRim + 6 * k * 2, 0, Math.PI * 2, true); c.fillStyle = '#17181B'; c.fill();
  c.strokeStyle = 'rgba(232,233,230,0.4)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, rT, 0, Math.PI * 2); c.stroke();
  c.save(); c.rotate(rot); c.strokeStyle = 'rgba(232,233,230,0.12)'; c.lineWidth = 6;
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * (rT - 4), Math.sin(a) * (rT - 4)); c.lineTo(Math.cos(a) * (rT - 22 * k), Math.sin(a) * (rT - 22 * k)); c.stroke(); }
  c.restore();
  // Llanta: pestaña y barril.
  c.beginPath(); c.arc(0, 0, rRim + 12 * k, 0, Math.PI * 2); c.arc(0, 0, rRim - 10 * k, 0, Math.PI * 2, true); c.fillStyle = '#B5B9BE'; c.fill();
  // Disco y pinza dentro de la llanta.
  drawDiscFront(0, 0, rD, { rot, heat: discHeat, holes: 'none', vanes: 0 });
  drawCaliperFront(0, 0, rD, -0.9, { n: 3, span: 0.42 });
  if (clash > 0) {
    c.save(); c.globalAlpha *= clash; c.strokeStyle = COLOR.red; c.lineWidth = 6; c.setLineDash([14, 10]);
    c.beginPath(); c.arc(0, 0, rD * 1.1, -1.4, -0.4); c.stroke(); c.restore();
  }
  // Radios de la llanta, por encima del disco (giran).
  c.save(); c.rotate(rot); c.strokeStyle = 'rgba(181,185,190,0.9)'; c.lineWidth = 16 * k;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * rRim * 0.22, Math.sin(a) * rRim * 0.22); c.lineTo(Math.cos(a) * (rRim - 8 * k), Math.sin(a) * (rRim - 8 * k)); c.stroke(); }
  c.restore();
  c.beginPath(); c.arc(0, 0, rRim * 0.2, 0, Math.PI * 2); c.fillStyle = '#B5B9BE'; c.fill();
  c.restore();
  // Cotas.
  if (labels > 0) {
    dimV(cx + rT + 60, cy - rT, cy - rRim, labels, 'FLANCO');
  }
  return { rRim, rT, rD };
}
// Cota vertical corta con rótulo.
function dimV(x, y0, y1, p, text, align = 'left') {
  if (p <= 0) return;
  const c = ctx;
  c.save(); c.globalAlpha *= ease.out(p); c.strokeStyle = COLOR.yellow; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x - 14, y0); c.lineTo(x + 14, y0); c.moveTo(x - 14, y1); c.lineTo(x + 14, y1); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
  c.restore();
  label(ctx, text, align === 'right' ? x - 30 : x + 30, (y0 + y1) / 2 + 8, COLOR.yellow, p, { size: 22, spacing: 6, weight: 700, align });
}

// --- Gráficas -----------------------------------------------------------------
function axes(x, y, w, h, p, { xl = '', yl = '' } = {}) {
  const c = ctx;
  c.save(); c.globalAlpha *= ease.out(p); c.strokeStyle = 'rgba(232,233,230,0.5)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h * ease.inOut(clamp(p * 1.3))); c.moveTo(x, y + h); c.lineTo(x + w * ease.inOut(clamp(p * 1.3)), y + h); c.stroke();
  c.restore();
  if (xl) label(ctx, xl, x + w, y + h + 50, DIM, p, { size: 22, spacing: 6, weight: 700, align: 'right' });
  if (yl) label(ctx, yl, x, y - 24, DIM, p, { size: 22, spacing: 6, weight: 700 });
}
// Curva y = f(u), u en [0,1] → y en [0,1]; p: fracción dibujada.
function plot(x, y, w, h, f, p, color, width = 5, { dash = null, fill = 0 } = {}) {
  if (p <= 0) return;
  const c = ctx, n = 160, m = Math.max(1, Math.round(n * clamp(p)));
  c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round';
  if (dash) c.setLineDash(dash);
  c.beginPath();
  for (let i = 0; i <= m; i++) { const u = i / n; const yy = y + h - f(u) * h; if (i === 0) c.moveTo(x + u * w, yy); else c.lineTo(x + u * w, yy); }
  c.stroke();
  if (fill > 0) { c.lineTo(x + (m / n) * w, y + h); c.lineTo(x, y + h); c.closePath(); c.globalAlpha *= fill; c.fillStyle = color; c.fill(); }
  c.restore();
  const u = m / n;
  return [x + u * w, y + h - f(u) * h];
}
// Línea de referencia horizontal o vertical con rótulo.
function refLine(x0, y0, x1, y1, p, color, text, { size = 24, align = 'left', dx = 12, dy = -14 } = {}) {
  if (p <= 0) return;
  const c = ctx;
  c.save(); c.globalAlpha *= ease.out(p); c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash([10, 10]);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(x0, x1, ease.inOut(p)), lerp(y0, y1, ease.inOut(p))); c.stroke(); c.restore();
  if (text) label(ctx, text, (align === 'right' ? x1 : x0) + dx, (align === 'right' ? y1 : y0) + dy, color, p, { size, spacing: 4, weight: 700, align });
}

// --- Vista en planta: tracción total con diferencial central y frenos -------------
// rearLock: ruedas traseras bloqueadas; decouple: diferencial central abierto (0..1); power: par del motor.
function drawAWD(t, { cx, cy, s = 1, rot = 0, power = 1, rearLock = 0, decouple = 0, stress = 0, appear = 1, rearPress = 0, frontPress = 0, sensor = 0 } = {}) {
  const c = ctx;
  c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(s, s); c.globalAlpha *= appear;
  const px = 1 / s;
  c.strokeStyle = COLOR.paper; c.lineWidth = 3 * px; c.lineJoin = 'round';
  trace(c, body(0), 1);
  c.globalAlpha *= 0.42; c.lineWidth = 2 * px; trace(c, CABIN, 1); c.globalAlpha /= 0.42;
  const fX = 300, rX = -300;
  // Motor delante (transversal) y diferencial central.
  c.fillStyle = 'rgba(232,233,230,0.08)'; c.strokeStyle = COLOR.paper; c.lineWidth = 2.4 * px;
  rr(c, 120, -90, 140, 120, 10); c.fill(); c.stroke();
  label(ctx, 'MOTOR', 190, 130, DIM, 1, { size: 20 * px, spacing: 5, weight: 700, align: 'center' });
  // Diferencial central.
  const dcx = 0, dcy = 0;
  // Ejes: del motor al centro, del centro atrás y delante.
  const shaft = (pts, on, col = COLOR.yellow) => {
    c.save(); c.strokeStyle = 'rgba(232,233,230,0.35)'; c.lineWidth = 8 * px; c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.stroke();
    if (on > 0) { c.globalAlpha *= on; c.strokeStyle = col; c.lineWidth = 7 * px; c.setLineDash([22, 18]); c.lineDashOffset = -t * 260; c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.stroke(); }
    c.restore();
  };
  const rearOn = power * (1 - decouple);
  shaft([[120, 0], [dcx + 50, 0]], power);
  shaft([[dcx - 50, 0], [rX, 0]], rearOn);
  shaft([[fX, -40], [fX, -200]], power); shaft([[fX, 40], [fX, 200]], power);
  shaft([[rX, -40], [rX, -200]], rearOn); shaft([[rX, 40], [rX, 200]], rearOn);
  // Caja del diferencial central: se abre (las dos mitades se separan) al desacoplar.
  const gapD = 26 * ease.inOut(decouple);
  const dCol = stress > 0 ? mixRGB([232, 233, 230], [215, 38, 45], stress) : COLOR.paper;
  c.fillStyle = COLOR.ink; c.strokeStyle = dCol; c.lineWidth = 3 * px;
  rr(c, dcx - 50 - gapD, -44, 50, 88, 8); c.fill(); c.stroke();
  rr(c, dcx + gapD, -44, 50, 88, 8); c.fill(); c.stroke();
  if (stress > 0) { c.save(); c.globalAlpha *= stress * (0.6 + 0.4 * Math.sin(t * 30)); c.fillStyle = COLOR.red; rr(c, dcx - 50, -44, 100, 88, 8); c.fill(); c.restore(); }
  for (const [x, y] of [[fX, 0], [rX, 0]]) { rr(c, x - 40, y - 40, 80, 80, 10); c.fillStyle = COLOR.ink; c.fill(); c.strokeStyle = COLOR.paper; c.stroke(); }
  // Ruedas con freno: amarillo = tracciona, rojo = bloqueada.
  [[fX, -226, 1], [fX, 226, 1], [rX, -226, 0], [rX, 226, 0]].forEach(([x, y, front]) => {
    rr(c, x - 75, y - 30, 150, 60, 14); c.fillStyle = COLOR.ink; c.fill();
    const on = front ? power : rearOn * (1 - rearLock);
    if (on > 0) { c.save(); c.globalAlpha *= on * 0.85; c.fillStyle = COLOR.yellow; c.fill(); c.restore(); }
    if (!front && rearLock > 0) { c.save(); c.globalAlpha *= rearLock; c.fillStyle = COLOR.red; c.fill(); c.restore(); }
    c.strokeStyle = COLOR.paper; c.lineWidth = 3 * px; c.stroke();
  });
  // Línea hidráulica trasera del freno de mano.
  if (rearPress > 0) {
    c.save(); c.globalAlpha *= rearPress; c.strokeStyle = COLOR.blue; c.lineWidth = 5 * px; c.setLineDash([14, 10]); c.lineDashOffset = t * 120;
    c.beginPath(); c.moveTo(-40, -120); c.lineTo(rX + 60, -120); c.lineTo(rX + 60, -190); c.moveTo(rX + 60, -120); c.lineTo(rX + 60, 120); c.lineTo(rX + 60, 190); c.stroke(); c.restore();
  }
  if (frontPress > 0) {
    c.save(); c.globalAlpha *= frontPress; c.strokeStyle = COLOR.blue; c.lineWidth = 5 * px; c.setLineDash([14, 10]); c.lineDashOffset = t * 120;
    c.beginPath(); c.moveTo(80, -150); c.lineTo(fX - 60, -150); c.lineTo(fX - 60, -190); c.moveTo(fX - 60, -150); c.lineTo(fX - 60, 190); c.stroke(); c.restore();
  }
  // Palanca con sensor de presión y señal a la centralita.
  if (sensor > 0) {
    c.save(); c.globalAlpha *= sensor;
    c.fillStyle = COLOR.blue; c.beginPath(); c.arc(-40, -120, 16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = COLOR.yellow; c.lineWidth = 3 * px; c.setLineDash([6, 8]); c.lineDashOffset = -t * 160;
    c.beginPath(); c.moveTo(-40, -120); c.lineTo(-40, -70); c.lineTo(0, -70); c.lineTo(0, -46); c.stroke();
    c.restore();
  }
  c.restore();
}
