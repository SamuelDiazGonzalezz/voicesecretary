// Escenas del documental sobre la evolución de las cajas de cambio. Todo depende solo de `t`.
import { W, H, V, cut, DURATION, CLIP_FPS, SECTIONS } from './timeline.js';
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES, rng,
} from './lib.js';

let A; // imágenes cargadas
let ctx;
const layers = {};
const M = GRID.m;
const DIM = 'rgba(232,233,230,0.68)';

// ---------------------------------------------------------------------------
// Primitivas de composición.

function bg(color = COLOR.ink) {
  ctx.fillStyle = color;
  ctx.fillRect(-300, -300, W + 600, H + 600);
}

function zoomAbout(z, x = W / 2, y = H / 2) {
  ctx.translate(x, y);
  ctx.scale(z, z);
  ctx.translate(-x, -y);
}

// Foto en un rectángulo, con velo plano opcional. Devuelve la proyección de la imagen.
function photo(key, x, y, w, h, opts = {}, { dark = 0, vig = 0.4, open = 1, gray = false } = {}) {
  if (open <= 0) return null;
  const im = gray ? grayOf(key) : A[key];
  ctx.save();
  ctx.beginPath();
  const hh = h * open;
  ctx.rect(x, y + (h - hh) / 2, w, hh);
  ctx.clip();
  const map = drawCover(ctx, im, x, y, w, h, opts);
  if (dark > 0) {
    ctx.fillStyle = `rgba(11,12,14,${dark})`;
    ctx.fillRect(x, y, w, h);
  }
  if (vig > 0) vignette(ctx, x, y, w, h, vig);
  ctx.restore();
  return map;
}

// Titular de varias líneas con el mismo cuerpo, revelado por máscara.
function lines(t, list, x, y0, lead, maxPx, t0, { color = COLOR.paper, weight = 700, exit = null, step = 0.12, colors = null, maxW = GRID.w, align = 'left' } = {}) {
  const size = Math.min(...list.map((l) => fitSize(ctx, l, (px) => FONT.display(weight, px), maxW, maxPx)));
  list.forEach((l, i) => {
    revealText(ctx, l, x, y0 + i * lead, FONT.display(weight, size), colors?.[i] ?? color, prog(t, t0 + i * step, t0 + i * step + 0.75), {
      stagger: 0.016, align, exit: exit ? prog(t, exit[0] + i * 0.05, exit[1] + i * 0.05) : 0,
    });
  });
  return size;
}

function tag(t, str, x, y, t0, color = COLOR.yellow, opts = {}) {
  label(ctx, str, x, y, color, prog(t, t0, t0 + 0.5), { size: 26, spacing: 7, weight: 700, ...opts });
}

function accent(t, x, y, t0, len = 300, u = 9) {
  stripesH(ctx, y, u, prog(t, t0, t0 + 0.8), 0, { x0: x, x1: x + len });
}

function slam(t, str, x, y, t0, size, color = COLOR.paper, align = 'left') {
  if (t < t0) return;
  const s = ease.outExpo(prog(t, t0, t0 + 0.32));
  ctx.save();
  ctx.globalAlpha = clamp(s * 5);
  ctx.translate(x, y);
  ctx.scale(lerp(1.3, 1, s), lerp(1.3, 1, s));
  ctx.font = FONT.display(800, size);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// Cifra con dígitos de ancho fijo.
function counter(value, x, y, size, color = COLOR.paper, align = 'left', digits = 0) {
  const str = String(Math.round(value)).padStart(digits, ' ');
  ctx.save();
  ctx.font = FONT.display(700, size);
  const slot = ctx.measureText('0').width;
  const total = slot * str.length;
  const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  [...str].forEach((d, i) => ctx.fillText(d, x0 + slot * (i + 0.5), y));
  ctx.restore();
  return total;
}

function pill(t, str, cx, cy, t0, { press = null, color = COLOR.red, pressed = COLOR.fire, text = COLOR.paper, size = 40 } = {}) {
  const a = ease.outExpo(prog(t, t0, t0 + 0.45));
  if (a <= 0) return;
  const p = press ? Math.sin(Math.PI * prog(t, press, press + 0.3)) : 0;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = FONT.text(700, size);
  const tw = ctx.measureText(str).width;
  const bw = tw + size * 2.6, bh = size * 2.4;
  ctx.translate(cx, cy);
  const s = lerp(0.92, 1, a) * (1 - 0.05 * p);
  ctx.scale(s, s);
  ctx.fillStyle = press && t >= press ? pressed : color;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Geometría.

function catmull(points, closed = true, steps = 8) {
  const out = [];
  const n = points.length;
  const get = (i) => points[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < steps; s++) {
      const u = s / steps, u2 = u * u, u3 = u2 * u;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
      ]);
    }
  }
  out.push(closed ? out[0] : points[n - 1]);
  return out;
}
const mirror = (half) => [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [x, -y])];

function poly(pts) {
  let len = 0;
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    acc.push(len);
  }
  return { pts, len, acc };
}
function trace(c, P, p) {
  if (p <= 0) return;
  const target = P.len * clamp(p);
  c.beginPath();
  c.moveTo(P.pts[0][0], P.pts[0][1]);
  for (let i = 1; i < P.pts.length; i++) {
    if (P.acc[i] >= target) {
      const f = (target - P.acc[i - 1]) / (P.acc[i] - P.acc[i - 1] || 1);
      c.lineTo(lerp(P.pts[i - 1][0], P.pts[i][0], f), lerp(P.pts[i - 1][1], P.pts[i][1], f));
      break;
    }
    c.lineTo(P.pts[i][0], P.pts[i][1]);
  }
  c.stroke();
}
function pointAt(P, p) {
  const target = P.len * clamp(p);
  let i = 1;
  while (i < P.pts.length - 1 && P.acc[i] < target) i++;
  const f = clamp((target - P.acc[i - 1]) / (P.acc[i] - P.acc[i - 1] || 1));
  const a = P.pts[i - 1], b = P.pts[i];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

// Cota horizontal bajo la planta.
function dimLine(x0, x1, y, p, color = COLOR.yellow, text = null) {
  if (p <= 0) return;
  const c = ctx;
  c.save();
  c.globalAlpha = ease.out(p);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(x0, y - 20); c.lineTo(x0, y + 20);
  c.moveTo(x1, y - 20); c.lineTo(x1, y + 20);
  c.moveTo(x0, y); c.lineTo(x1, y);
  c.stroke();
  for (const [x, d] of [[x0, 1], [x1, -1]]) {
    c.beginPath();
    c.moveTo(x, y); c.lineTo(x + 16 * d, y - 8); c.lineTo(x + 16 * d, y + 8);
    c.closePath();
    c.fill();
  }
  c.restore();
  if (text) label(ctx, text, (x0 + x1) / 2, y + 56, color, p, { size: 22, spacing: 7, weight: 700, align: 'center' });
}

// Anotación: punto en la foto, línea y etiqueta.
function callout(t, x, y, lx, ly, str, t0, color = COLOR.yellow) {
  const p = ease.outExpo(prog(t, t0, t0 + 0.5));
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 9 * p, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 22 * p, 0, Math.PI * 2);
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(lerp(x, lx, p), lerp(y, ly, p));
  ctx.stroke();
  ctx.restore();
  label(ctx, str, lx + (lx < x ? -14 : 14), ly + 9, COLOR.paper, prog(t, t0 + 0.25, t0 + 0.7), { size: 30, spacing: 5, weight: 700, align: lx < x ? 'right' : 'left' });
}

let TURBO_T0 = 0;
function turboAngle(t) {
  const tau = clamp(t - TURBO_T0, 0, 30);
  return Math.PI * 2 * (0.25 * tau + 0.18 * Math.min(tau, 4) * tau);
}

// Indicador en arco genérico (presión del turbo).
function arcGauge(t, cx, cy, r, v, vmax, appear, ticks = 10, color = COLOR.yellow) {
  const c = ctx;
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  c.save();
  c.globalAlpha = appear;
  c.lineCap = 'butt';
  c.strokeStyle = 'rgba(244,242,238,0.16)';
  c.lineWidth = 20;
  c.beginPath();
  c.arc(cx, cy, r, a0, a0 + span);
  c.stroke();
  c.strokeStyle = color;
  c.beginPath();
  c.arc(cx, cy, r, a0, a0 + span * clamp(v / vmax));
  c.stroke();
  for (let k = 0; k <= ticks; k++) {
    const a = a0 + span * (k / ticks);
    c.strokeStyle = k / ticks <= v / vmax ? COLOR.paper : 'rgba(244,242,238,0.35)';
    c.lineWidth = k % 2 === 0 ? 4 : 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * (r - 36), cy + Math.sin(a) * (r - 36));
    c.lineTo(cx + Math.cos(a) * (r - (k % 2 === 0 ? 64 : 52)), cy + Math.sin(a) * (r - (k % 2 === 0 ? 64 : 52)));
    c.stroke();
  }
  c.restore();
}


// --- Reutilizado de la serie (Anti-lag) ---
function dots(alpha = 0.07) {
  ctx.save();
  ctx.fillStyle = `rgba(236,239,242,${alpha})`;
  for (let y = 40; y < H; y += 40) for (let x = 40; x < W; x += 40) ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

// Ángulo acumulado de una rueda cuyo régimen (rpm visual, en vueltas por segundo) varía con el tiempo.
function spinAngle(t, t0, rps) {
  if (t <= t0) return 0;
  let a = 0;
  const dt = 1 / 240;
  for (let u = t0; u < t; u += dt) a += rps(Math.min(u, t)) * dt;
  return a * Math.PI * 2;
}

// Rueda de turbina o compresor vista de frente, con desenfoque de giro (copias en el obturador).
function drawWheel(th, dth, cx, cy, r, appear, { housing = true, hot = 0, blades = 12 } = {}) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.globalAlpha = appear;
  if (housing) {
    c.strokeStyle = COLOR.line;
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const rr2 = r * (1.18 + 0.24 * (i / 200));
      if (i === 0) c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); else c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    c.lineTo(r * 1.42 + 150, 0);
    c.stroke();
    c.globalAlpha = appear * 0.3;
    c.beginPath();
    c.arc(0, 0, r * 1.06, 0, Math.PI * 2);
    c.stroke();
  }
  const N = Math.min(12, 2 + Math.round(Math.abs(dth) * 6));
  const col = hot > 0 ? `rgb(${Math.round(lerp(236, 240, hot))},${Math.round(lerp(239, 122, hot))},${Math.round(lerp(242, 26, hot))})` : COLOR.paper;
  for (let k = 0; k < N; k++) {
    c.globalAlpha = appear * (1 / (k + 1));
    const base = th - dth * (k / Math.max(1, N - 1));
    for (let b = 0; b < blades; b++) {
      const a0 = base + (b / blades) * Math.PI * 2;
      const full = b % 2 === 0;
      c.beginPath();
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const rad = lerp(r * 0.22, r * (full ? 1 : 0.9), u);
        const a = a0 + u * u * 0.85;
        if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      c.strokeStyle = full ? col : COLOR.steel;
      c.lineWidth = full ? r * 0.05 : r * 0.032;
      c.lineCap = 'round';
      c.stroke();
    }
  }
  c.globalAlpha = appear;
  c.fillStyle = COLOR.ink;
  c.beginPath();
  c.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  c.stroke();
  c.restore();
}

// Flujo animado a lo largo de una polilínea (aire, mezcla, gases).
function flowLine(P, t, { color, width = 10, speed = 1, amount = 1, dash = [26, 22], offset = 0 }) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= amount;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.lineDashOffset = -(t * 160 * speed) - offset;
  ctx.beginPath();
  ctx.moveTo(P.pts[0][0], P.pts[0][1]);
  for (const p of P.pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.restore();
}

// Estallido: forma irregular con ruido con semilla, de rápido decaimiento.
function burst(x, y, r, k, seed = 1) {
  if (k <= 0 || r <= 0) return;
  ctx.save();
  for (const [col, f] of [[COLOR.red, 1], [COLOR.fire, 0.72], [COLOR.yellow, 0.42]]) {
    ctx.fillStyle = col;
    ctx.globalAlpha = clamp(k * 1.4);
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const rr2 = r * f * (0.75 + 0.35 * noise1(i * 0.9 + seed * 17) + 0.15 * noise1(i * 2.7 + seed * 5));
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Onda de presión: anillos que se expanden desde la detonación.
function shock(x, y, p, rmax = 260) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const q = clamp(p * 1.3 - k * 0.15);
    if (q <= 0 || q >= 1) continue;
    ctx.strokeStyle = COLOR.fire;
    ctx.globalAlpha = (1 - q) * 0.8;
    ctx.lineWidth = 6 * (1 - q) + 1;
    ctx.beginPath();
    ctx.arc(x, y, rmax * ease.out(q), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function hatch(c, drawShape, step = 14, alpha = 0.16) {
  c.save();
  drawShape();
  c.clip();
  c.strokeStyle = `rgba(236,239,242,${alpha})`;
  c.lineWidth = 2;
  for (let k = -1400; k < 1400; k += step) { c.beginPath(); c.moveTo(k, -700); c.lineTo(k + 700, 700); c.stroke(); }
  c.restore();
}

function drawTurboSection(t, { cx, cy, s = 1, th = 0, air = 1, ex = 1, hot = 0, labels = 1, appear = 1 }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  c.lineJoin = 'round';
  const solid = (shape) => { shape(); c.fillStyle = COLOR.ink2; c.fill(); hatch(c, shape); shape(); c.strokeStyle = COLOR.line; c.lineWidth = 3; c.stroke(); };
  const ring = (x, y, r1, r2) => () => { c.beginPath(); c.arc(x, y, r1, 0, Math.PI * 2); c.arc(x, y, r2, 0, Math.PI * 2, true); };
  const box = (x, y, w, h, r = 10) => () => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  for (const side of [-1, 1]) {
    const xv = 250 * side;
    // Volutas (sección de la espiral) arriba y abajo del rodete.
    solid(ring(xv, -200, 96, 70));
    solid(ring(xv, 200, 84, 60));
    // Placa trasera y boca axial.
    solid(box(side < 0 ? -170 : 150, -300, 20, 600, 6));
    solid(box(side < 0 ? -620 : 360, -112, 260, 22, 6));
    solid(box(side < 0 ? -620 : 360, 90, 260, 22, 6));
    // Conducto vertical: salida de aire (compresor) o entrada de gases (turbina).
    solid(box(xv - 60, -560, 22, 270, 6));
    solid(box(xv + 38, -560, 22, 270, 6));
  }
  // Carcasa central con rodamientos y paso de aceite.
  solid(box(-150, -80, 300, 160, 14));
  c.strokeStyle = COLOR.yellow;
  c.lineWidth = 3;
  c.setLineDash([8, 8]);
  c.beginPath(); c.moveTo(0, -80); c.lineTo(0, -34); c.stroke();
  c.setLineDash([]);
  // Eje.
  c.fillStyle = COLOR.steel;
  c.fillRect(-360, -9, 720, 18);
  // Rodetes en perfil: cubo cónico y álabes que pasan según el ángulo de giro.
  for (const [side, col] of [[-1, COLOR.air], [1, hot > 0 ? COLOR.fire : COLOR.paper]]) {
    const x0 = 250 * side;
    c.fillStyle = COLOR.ink;
    c.strokeStyle = COLOR.line;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0 - 110 * side, -26); c.lineTo(x0 + 70 * side, -62); c.lineTo(x0 + 70 * side, 62); c.lineTo(x0 - 110 * side, 26); c.closePath();
    c.fill(); c.stroke();
    for (let k = 0; k < 11; k++) {
      const a = th + (k / 11) * Math.PI * 2;
      const vis = Math.cos(a);
      if (vis < -0.1) continue;
      const yb = Math.sin(a);
      c.strokeStyle = col;
      c.globalAlpha = appear * (0.3 + 0.7 * clamp(vis));
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x0 - 104 * side, yb * 26);
      c.quadraticCurveTo(x0 - 10 * side, yb * 60 + 40 * Math.sign(yb || 1) * 0.3, x0 + 62 * side, yb * 150);
      c.stroke();
    }
    c.globalAlpha = appear;
  }
  // Flujos: aire axial → voluta → salida hacia el motor; gases desde el colector → voluta → escape axial.
  const fl = (pts, color, amount, speed) => flowLine(poly(catmull(pts, false, 8)), t, { color, width: 12, amount, speed });
  fl([[-900, 0], [-620, 0], [-380, 0], [-250, -130], [-230, -200], [-230, -330], [-230, -620]], COLOR.air, air, lerp(0.3, 1.5, air));
  fl([[250, -620], [250, -330], [250, -200], [270, -130], [380, 0], [620, 0], [900, 0]], COLOR.fire, ex, lerp(0.3, 1.8, ex));
  c.restore();
  if (labels > 0) {
    const pt = (x, y) => [cx + x * s, cy + y * s];
    const L = [['AIRE DE ADMISIÓN', -880, -40, COLOR.air, 'left'], ['AL MOTOR', -270, -600, COLOR.air, 'right'], ['DESDE EL COLECTOR', 290, -600, COLOR.fire, 'left'],
      ['COMPRESOR', -250, 330, COLOR.paper, 'center'], ['CARCASA CENTRAL', 0, -110, COLOR.paper, 'center'], ['TURBINA', 250, 330, COLOR.paper, 'center'], ['AL ESCAPE', 880, -40, COLOR.fire, 'right']];
    L.forEach(([str, x, y, col, al], i) => { const [qx, qy] = pt(x, y); label(ctx, str, qx, qy, col, clamp(labels * 1.6 - i * 0.12), { size: 22, spacing: 6, weight: 700, align: al }); });
  }
}

// Fotogramas del clip (pre-extraídos), elegidos por el tiempo local del clip: determinista.
function drawClip(local, { dark = 0, zoom = 1.04, fx = 0.5, fy = 0.5 } = {}) {
  const k = clamp(Math.floor(local * CLIP.fps), 0, A.clip.length - 1);
  drawCover(ctx, A.clip[k], 0, 0, W, H, { zoom, fx, fy });
  if (dark > 0) { ctx.fillStyle = `rgba(11,13,16,${dark})`; ctx.fillRect(0, 0, W, H); }
  vignette(ctx, 0, 0, W, H, 0.5);
}

// Miles con punto, como en el guion («100.000», «1.100»).
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Velo plano tras la columna de texto cuando el esquema ampliado ocupa todo el cuadro.
function scrim(w = 820, alpha = 0.9) {
  const g = ctx.createLinearGradient(w - 260, 0, w + 120, 0);
  g.addColorStop(0, `rgba(11,13,16,${alpha})`);
  g.addColorStop(1, 'rgba(11,13,16,0)');
  ctx.fillStyle = `rgba(11,13,16,${alpha})`;
  ctx.fillRect(0, 0, w - 260, H);
  ctx.fillStyle = g;
  ctx.fillRect(w - 260, 0, 380, H);
}

function camera(x, y, z, fn) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

// --- Planta (Peugeot) ---
const CABIN = poly(catmull(mirror([[190, 0], [182, -150], [150, -184], [-40, -186], [-90, -160], [-96, 0]]), true, 6));
const bodyCache = new Map();
function bodyHalf(stretch) {
  const r = 1 + 0.22 * stretch; // el 205 «Dakar» alarga la zaga
  return [
    [492, 0], [489, -140], [478, -200], [455, -222], [380, -232], [330, -246], [210, -246], [170, -228],
    [-120 * r, -228], [-160 * r, -246], [-360 * r, -246], [-410 * r, -232], [-458 * r, -216], [-486 * r, -168], [-492 * r, 0],
  ];
}

function body(stretch) {
  const key = Math.round(stretch * 100);
  if (!bodyCache.has(key)) bodyCache.set(key, poly(catmull(mirror(bodyHalf(key / 100)), true, 6)));
  return bodyCache.get(key);
}

function drawPlan(t, { cx, cy, scale, rot = 0, draw = 1, layout = '205', drive = 'awd', power = 0, flow = COLOR.yellow,
  stretch = 0, engineRot = null, hot = 0, spin = 0, wing = true, dim = 0 }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.rotate(rot);
  c.scale(scale, scale);
  const px = 1 / scale;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const frontX = 290, rearX = -300 * (1 + 0.2 * stretch);

  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3 * px;
  trace(c, body(stretch), draw);
  c.globalAlpha = 0.42;
  c.lineWidth = 2 * px;
  trace(c, CABIN, prog(draw, 0.25, 1));
  const d2 = prog(draw, 0.5, 1);
  if (d2 > 0 && wing) {
    c.globalAlpha = 0.42 * d2;
    rr(c, -492 * (1 + 0.22 * stretch) - 40, -250, 40, 500, 8);
    c.stroke();
  }
  c.globalAlpha = 1;

  // Motor.
  const eng = prog(draw, 0.4, 1);
  if (eng > 0) {
    c.globalAlpha = eng;
    const fill = (on) => { if (on > 0) { c.fillStyle = `rgba(215,38,45,${0.9 * on})`; c.fill(); } };
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.4 * px;
    if (layout === 'audi') {
      rr(c, 300, -50, 186, 100, 10); fill(hot); c.stroke();
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(320 + i * 36, 0, 13, 0, Math.PI * 2); c.stroke(); }
      rr(c, 150, -34, 140, 68, 8); c.stroke();
    } else if (layout === 'lancia') {
      rr(c, -260, -48, 190, 96, 10); fill(hot); c.stroke();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-235 + i * 46, 0, 15, 0, Math.PI * 2); c.stroke(); }
      rr(c, -350, -32, 80, 64, 8); c.stroke();
    } else {
      // 205: bloque detrás de los asientos; `engineRot` gira de longitudinal (0) a transversal (1).
      const k = engineRot ?? 1;
      c.save();
      c.translate(-170, 0);
      c.rotate((Math.PI / 2) * ease.inOut(k));
      rr(c, -100, -46, 200, 92, 10); fill(hot); c.stroke();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-69 + i * 46, 0, 15, 0, Math.PI * 2); c.stroke(); }
      c.restore();
      // Caja de cambios al lado del motor y diferencial central.
      c.globalAlpha = eng * clamp((engineRot ?? 1) * 2 - 1);
      rr(c, -120, 110, 150, 70, 8); c.stroke();
      c.globalAlpha = eng;
    }
    c.globalAlpha = 1;
  }

  // Transmisión con flujo de par.
  const shafts = [];
  const gx = layout === '205' ? -50 : layout === 'audi' ? 150 : -300;
  if (drive === 'awd') {
    if (layout === '205') shafts.push([[30, 145], [frontX, 145], [frontX, 40]], [[-120, 145], [rearX, 145], [rearX, 40]]);
    else shafts.push([[gx, 0], [rearX + 40, 0]], [[gx + 100, 0], [frontX, 0]]);
    shafts.push([[frontX, -40], [frontX, -200]], [[frontX, 40], [frontX, 200]]);
  } else {
    shafts.push([[gx, 0], [rearX, 0]]);
  }
  shafts.push([[rearX, -40], [rearX, -200]], [[rearX, 40], [rearX, 200]]);
  if (power > 0) {
    c.save();
    c.globalAlpha = power * (1 - dim);
    c.strokeStyle = flow;
    c.lineWidth = 7 * px;
    c.setLineDash([22, 18]);
    c.lineDashOffset = -t * 260;
    for (const s of shafts) {
      c.beginPath();
      c.moveTo(s[0][0], s[0][1]);
      for (const q of s.slice(1)) c.lineTo(q[0], q[1]);
      c.stroke();
    }
    c.restore();
  }

  // Ruedas; `spin` añade trazos de patinaje en las traseras.
  const wheels = [[frontX, -226, true], [frontX, 226, true], [rearX, -226, false], [rearX, 226, false]];
  wheels.forEach(([x, y, front], i) => {
    const appear = prog(draw, 0.6 + i * 0.05, 0.9 + i * 0.025);
    if (appear <= 0) return;
    const driven = drive === 'awd' || !front;
    const on = driven ? ease.outExpo(clamp(power * 3 - i * 0.3)) * (1 - dim) : 0;
    c.globalAlpha = appear * (driven ? 1 : 0.5);
    rr(c, x - 75, y - 30, 150, 60, 14);
    c.fillStyle = COLOR.ink;
    c.fill();
    if (on > 0) { c.globalAlpha = appear * on; c.fillStyle = flow; c.fill(); c.globalAlpha = appear; }
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 3 * px;
    c.stroke();
    if (spin > 0 && !front) {
      c.strokeStyle = `rgba(244,242,238,${0.5 * spin})`;
      c.lineWidth = 3 * px;
      for (let k = 0; k < 5; k++) {
        const ph = (t * 3 + k * 0.2) % 1;
        const len = 60 + 90 * ph;
        c.globalAlpha = appear * spin * (1 - ph);
        c.beginPath();
        c.moveTo(x - 80 - 20 * k * ph, y + (k - 2) * 10);
        c.lineTo(x - 80 - len - 20 * k * ph, y + (k - 2) * 14);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  });
  c.restore();
  return { frontX, rearX };
}


// Motor de 4 cilindros en línea visto de lado (orden de encendido 1-3-4-2).
const FIRE4 = [0, 3, 1, 2]; // posición de cada cilindro en el ciclo
function drawInline4(t, t0, cx, cy, s, appear) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  c.lineJoin = 'round';
  const crank = Math.PI * 2 * Math.max(0, t - t0) * lerp(0.6, 2.2, ease.inOut(prog(t, t0, t0 + 3)));
  const pitch = 160, bore = 112, stroke = 72, rod = 150;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3;
  rr(c, -pitch * 2 - 26, -230, pitch * 4 + 52, 330, 18);
  c.stroke();
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * pitch;
    const a = crank - FIRE4[i] * Math.PI;
    const ox = Math.sin(a) * stroke / 2, oy = -Math.cos(a) * stroke / 2;
    const pistonY = oy - Math.sqrt(rod * rod - ox * ox);
    const cyc = ((a % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4);
    const flash = cyc < 0.9 ? 1 - cyc / 0.9 : 0;
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.5;
    c.strokeRect(x - bore / 2, -220, bore, 220);
    if (flash > 0) {
      c.fillStyle = `rgba(242,194,28,${0.95 * flash})`;
      c.fillRect(x - bore / 2 + 3, -217, bore - 6, pistonY - 30 + 217);
    }
    c.fillStyle = COLOR.paper;
    c.fillRect(x - bore / 2 + 6, pistonY - 30, bore - 12, 52);
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(x, pistonY);
    c.lineTo(x + ox, oy + 30);
    c.stroke();
    c.lineWidth = 2;
    c.globalAlpha = appear * 0.45;
    c.beginPath();
    c.arc(x, 30, stroke / 2, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = appear;
    label(ctx, String(i + 1), x, 150, DIM, 1, { size: 24, spacing: 2, weight: 600, align: 'center' });
  }
  c.restore();
}


// ---------------------------------------------------------------------------
// Perfil lateral: del MR2 de calle al 222D (mismos puntos clave, interpolables).
// Coordenadas: frente a la derecha, suelo en y = 0, unidades ≈ milímetros / 4.

const SIDE = {
  mr2: [[505, -40], [500, -112], [420, -130], [330, -145], [230, -170], [60, -285], [-150, -292], [-300, -212], [-420, -205], [-470, -200], [-500, -152], [-500, -45]],
  d222: [[512, -36], [508, -100], [430, -150], [330, -198], [230, -180], [60, -285], [-150, -292], [-290, -246], [-420, -248], [-490, -266], [-512, -160], [-512, -40]],
};

function sideShape(k) {
  const top = SIDE.mr2.map((p, i) => [lerp(p[0], SIDE.d222[i][0], k), lerp(p[1], SIDE.d222[i][1], k)]);
  return { top: catmull(top, false, 8), archR: lerp(92, 112, k), tyreR: lerp(76, 88, k) };
}

// opts: morph 0 (MR2) → 1 (222D); keep: resalta techo, parabrisas y puertas; cut: línea de corte;
// engine: bloque tras los asientos; driver: cabeza del piloto; tail: resalta la cola de pato; lift: zaga levantada.
function drawSide(t, { cx, cy, s = 1, morph = 0, draw = 1, keep = 0, cut = 0, engine = 0, driver = 0, tail = 0, lift = 0, appear = 1 }) {
  const c = ctx;
  const { top, archR, tyreR } = sideShape(morph);
  const rearX = -300, frontX = 330;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  // Revelado de izquierda a derecha.
  c.save();
  c.beginPath();
  // Con la zaga levantada, la carrocería trasera viaja con la pieza y deja ver el esqueleto.
  const x0c = lift > 0 ? -150 : -700;
  c.rect(x0c, -500, (-700 + 1400 * clamp(draw)) - x0c, 700);
  c.clip();
  const outline = () => {
    c.beginPath();
    c.moveTo(top[0][0], top[0][1]);
    for (const p of top) c.lineTo(p[0], p[1]);
    const lx = top.at(-1)[0];
    c.lineTo(lx, -45);
    c.lineTo(rearX - archR, -45);
    c.arc(rearX, -78, archR, Math.PI, 0, false);
    c.lineTo(frontX - archR, -45);
    c.arc(frontX, -78, archR, Math.PI, 0, false);
    c.lineTo(top[0][0], -45);
    c.closePath();
  };
  outline();
  c.fillStyle = COLOR.ink2;
  c.fill();
  c.strokeStyle = keep > 0 ? `rgba(232,233,230,${lerp(0.85, 0.28, keep)})` : COLOR.line;
  c.lineWidth = 3 / s;
  c.setLineDash(keep > 0.5 ? [10 / s, 10 / s] : []);
  c.stroke();
  c.setLineDash([]);
  // Lo que se conserva del coche de calle: parabrisas, techo y puertas.
  const glass = [[226, -172], [60, -282], [-150, -289], [-280, -216]];
  c.strokeStyle = COLOR.paper;
  c.lineWidth = (keep > 0 ? lerp(3, 7, keep) : 2.4) / s;
  c.beginPath(); glass.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  c.globalAlpha = appear * lerp(0.5, 1, keep);
  c.beginPath(); c.moveTo(170, -165); c.lineTo(160, -60); c.lineTo(-160, -58); c.lineTo(-170, -250); c.stroke();
  c.beginPath(); c.moveTo(150, -180); c.lineTo(50, -262); c.lineTo(-140, -268); c.lineTo(-150, -190); c.closePath(); c.stroke();
  c.globalAlpha = appear;
  // Cola de pato.
  if (tail > 0) {
    c.strokeStyle = COLOR.red;
    c.lineWidth = 8 / s;
    trace(c, poly(top.slice(Math.floor(top.length * 0.62))), tail);
  }
  c.restore();

  // Ruedas.
  for (const x of [rearX, frontX]) {
    const a = ease.out(prog(draw, 0.5, 1));
    if (a <= 0) continue;
    c.globalAlpha = appear * a;
    c.fillStyle = COLOR.ink;
    c.beginPath(); c.arc(x, -78, tyreR, 0, Math.PI * 2); c.fill();
    c.strokeStyle = COLOR.line;
    c.lineWidth = 3 / s;
    c.stroke();
    c.beginPath(); c.arc(x, -78, tyreR * 0.55, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = appear;
  }
  // Motor central tras los asientos y la cabeza del piloto.
  if (engine > 0) {
    c.save();
    c.globalAlpha = appear * engine;
    c.fillStyle = `rgba(212,24,43,${0.35 + 0.35 * Math.abs(Math.sin(t * 3))})`;
    c.strokeStyle = COLOR.red;
    c.lineWidth = 3 / s;
    rr(c, -330, -185, 190, 115, 10); c.fill(); c.stroke();
    c.restore();
  }
  if (driver > 0) {
    c.save();
    c.globalAlpha = appear * driver;
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 3 / s;
    c.beginPath(); c.arc(-45, -205, 26, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-60, -180); c.lineTo(-90, -95); c.lineTo(20, -90); c.stroke();
    c.restore();
  }
  // Zaga entera que se levanta en una pieza (bisagra detrás de la cabina).
  if (lift > 0) {
    // Esqueleto tubular y motor que quedan al descubierto.
    c.save();
    c.strokeStyle = COLOR.steel;
    c.lineWidth = 3 / s;
    const tubes = [[-150, -280, -500, -150], [-150, -280, -150, -50], [-500, -150, -500, -50], [-150, -50, -500, -50], [-150, -280, -330, -50], [-330, -215, -500, -150], [-330, -215, -330, -50], [-150, -160, -500, -110]];
    for (const [a, b, d, e] of tubes) { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    c.restore();
    c.save();
    c.translate(-150, -290);
    c.rotate(0.62 * ease.inOut(lift));
    c.fillStyle = COLOR.ink2;
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 3 / s;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(-140, 44); c.lineTo(-270, 42); c.lineTo(-340, 24); c.lineTo(-362, 130); c.lineTo(-362, 245); c.lineTo(-262, 245);
    c.arc(-150, 212, 112, Math.PI, 0, false);
    c.lineTo(8, 245); c.lineTo(8, 60); c.closePath();
    c.fill(); c.stroke();
    c.strokeStyle = COLOR.red;
    c.lineWidth = 6 / s;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-140, 44); c.lineTo(-270, 42); c.lineTo(-340, 24); c.stroke();
    c.restore();
  }
  // Línea de corte por la mitad.
  if (cut > 0 && cut < 1.2) {
    c.save();
    c.strokeStyle = COLOR.red;
    c.lineWidth = 4 / s;
    c.setLineDash([16 / s, 12 / s]);
    const y0 = -340, y1 = 30;
    c.beginPath(); c.moveTo(-20, y0); c.lineTo(-20, lerp(y0, y1, clamp(cut))); c.stroke();
    c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Chasis tubular en 3D real: nodos y tubos proyectados en perspectiva, girando.

const FRAME = (() => {
  const N = {};
  const add = (k, x, y, z) => { N[k] = [x, y, z]; };
  for (const s of [-1, 1]) {
    const sd = s < 0 ? 'L' : 'R';
    for (const [k, x, w] of [['f0', 470, 150], ['f1', 300, 170], ['m0', 140, 175], ['m1', -120, 175], ['r0', -300, 175], ['r1', -470, 160]]) add(k + sd + 'b', x, s * w, 0);
    add('f0' + sd + 't', 450, s * 140, -110); add('f1' + sd + 't', 300, s * 160, -120);
    add('a' + sd, 60, s * 140, -265); add('h' + sd, -120, s * 150, -255);
    add('r0' + sd + 't', -300, s * 165, -130); add('r1' + sd + 't', -470, s * 150, -120);
  }
  const E = [];
  const both = (a, b) => { for (const sd of ['L', 'R']) E.push([a.replace('*', sd), b.replace('*', sd)]); };
  // Largueros inferiores y travesaños.
  ['f0', 'f1', 'm0', 'm1', 'r0', 'r1'].forEach((k, i, arr) => { if (i) both(arr[i - 1] + '*b', k + '*b'); E.push([k + 'Lb', k + 'Rb']); });
  // Subchasis delantero y trasero.
  both('f0*b', 'f0*t'); both('f1*b', 'f1*t'); both('f0*t', 'f1*t'); E.push(['f0Lt', 'f0Rt'], ['f1Lt', 'f1Rt']);
  both('f1*b', 'f0*t');
  both('r0*b', 'r0*t'); both('r1*b', 'r1*t'); both('r0*t', 'r1*t'); E.push(['r1Lt', 'r1Rt'], ['r0Lt', 'r0Rt']);
  both('r0*b', 'r1*t');
  // Jaula: pilares A, arco principal, techo y diagonales.
  both('f1*t', 'a*'); both('m0*b', 'a*'); both('a*', 'h*'); both('h*', 'm1*b'); E.push(['aL', 'aR'], ['hL', 'hR'], ['hL', 'm1Rb']);
  both('h*', 'r0*t'); both('m0*b', 'h*');
  return { N, E, cage: new Set(['aL', 'aR', 'hL', 'hR']) };
})();

function drawFrame3D(t, { cx, cy, s = 1, yaw = 0, pitch = 0.42, draw = 1, appear = 1, highlight = 0 }) {
  const c = ctx;
  const D = 2600, F = 2100;
  const P = {};
  for (const [k, [x, y, z]] of Object.entries(FRAME.N)) {
    const xr = x * Math.cos(yaw) - y * Math.sin(yaw);
    const yr = x * Math.sin(yaw) + y * Math.cos(yaw);
    const zc = z + 130;
    const yy = yr * Math.cos(pitch) - zc * Math.sin(pitch);
    const zz = yr * Math.sin(pitch) + zc * Math.cos(pitch);
    const d = D + yy;
    P[k] = [cx + xr * (F / d) * s, cy + zz * (F / d) * s, d];
  }
  const edges = FRAME.E.map(([a, b]) => ({ a, b, d: (P[a][2] + P[b][2]) / 2 })).sort((u, v) => v.d - u.d);
  edges.forEach((e, i) => {
    const k = clamp(draw * edges.length - i * 0.6);
    if (k <= 0) return;
    const [x0, y0] = P[e.a], [x1, y1] = P[e.b];
    const near = clamp((D + 300 - e.d) / 600);
    const cage = FRAME.cage.has(e.a) && FRAME.cage.has(e.b) || FRAME.cage.has(e.a) || FRAME.cage.has(e.b);
    c.save();
    c.globalAlpha = appear * lerp(0.35, 1, near) * clamp(k);
    c.strokeStyle = cage && highlight > 0 ? COLOR.red : COLOR.paper;
    c.lineWidth = lerp(2.2, 5, near) * s;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(x0, x1, clamp(k)), lerp(y0, y1, clamp(k))); c.stroke();
    c.restore();
  });
  for (const [k, [x, y, d]] of Object.entries(P)) {
    c.globalAlpha = appear * clamp(draw * 2) * lerp(0.4, 1, clamp((D + 300 - d) / 600));
    c.fillStyle = COLOR.paper;
    c.beginPath(); c.arc(x, y, 4.5 * s, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Vista frontal: el ancho del MR2 frente al del 222D.
const FRONT = {
  mr2: [[0, -292], [130, -288], [295, -205], [325, -150], [330, -62], [300, -40], [0, -40]],
  d222: [[0, -292], [130, -288], [300, -222], [420, -182], [446, -62], [405, -36], [0, -36]],
};
function drawFront(t, { cx, cy, s = 1, k = 0, appear = 1 }) {
  const c = ctx;
  const half = FRONT.mr2.map((p, i) => [lerp(p[0], FRONT.d222[i][0], k), lerp(p[1], FRONT.d222[i][1], k)]);
  const pts = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  // Silueta del MR2 como referencia, en trazo discontinuo.
  c.strokeStyle = 'rgba(232,233,230,0.35)';
  c.lineWidth = 2 / s;
  c.setLineDash([10 / s, 10 / s]);
  c.beginPath(); [...FRONT.mr2, ...FRONT.mr2.slice(0, -1).reverse().map(([x, y]) => [-x, y])].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  c.setLineDash([]);
  c.fillStyle = COLOR.ink2;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3 / s;
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
  // Parabrisas y ruedas.
  c.beginPath(); c.moveTo(-120, -280); c.lineTo(120, -280); c.lineTo(220, -200); c.lineTo(-220, -200); c.closePath(); c.stroke();
  const tw = lerp(250, 345, k), tW = lerp(70, 105, k);
  for (const sd of [-1, 1]) { c.fillStyle = COLOR.ink; c.fillRect(sd * tw - tW / 2, -110, tW, 110); c.strokeRect(sd * tw - tW / 2, -110, tW, 110); }
  c.restore();
  dimLine(cx - half[4][0] * s, cx + half[4][0] * s, cy + 60 * s, appear, k > 0.5 ? COLOR.red : COLOR.steel);
}

// ---------------------------------------------------------------------------
// Homologación: 200 coches de calle del Grupo B frente a los 10 del Grupo S.
function drawHomologation(t, s0, { x = 940, y = 260, w = 840, appear = 1, keep = 0 }) {
  const cols = 20, rows = 10, gw = w / cols, gh = 46;
  for (let i = 0; i < 200; i++) {
    const cx = x + (i % cols) * gw, cy = y + Math.floor(i / cols) * gh;
    const a = ease.out(clamp(appear * 3 - i / 120));
    const sel = i % 20 === 0 && i < 200 && Math.floor(i / 20) < 10;
    const fade = sel ? 1 : 1 - 0.85 * keep;
    ctx.save();
    ctx.globalAlpha = a * fade;
    ctx.fillStyle = sel && keep > 0 ? COLOR.red : COLOR.steel;
    ctx.beginPath(); ctx.roundRect(cx, cy, gw - 10, 22, 6); ctx.fill();
    ctx.restore();
  }
}

// Control genérico del reparto de par (interfaz inventada con los colores del canal).
function drawSplit(t, { cx, cy, w = 700, v = 0.5, appear = 1 }) {
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.fillStyle = COLOR.ink2;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - 14, w, 28, 14); ctx.fill();
  ctx.fillStyle = COLOR.red;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - 14, w * v, 28, 14); ctx.fill();
  ctx.fillStyle = COLOR.paper;
  ctx.beginPath(); ctx.arc(cx - w / 2 + w * v, cy, 26, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  label(ctx, 'DELANTE', cx - w / 2, cy + 64, DIM, appear, { size: 22, spacing: 6, weight: 600 });
  label(ctx, 'DETRÁS', cx + w / 2, cy + 64, DIM, appear, { size: 22, spacing: 6, weight: 600, align: 'right' });
}

// Curva genérica de respuesta: con tan poco recorrido, la potencia se dispara.
function drawThrottle(t, s0, { x0 = 1000, x1 = 1800, yb = 820, yt = 300, draw = 1, mark = 0 }) {
  ctx.save();
  ctx.fillStyle = 'rgba(232,233,230,0.22)';
  ctx.fillRect(x0, yb, x1 - x0, 2);
  ctx.fillRect(x0, yt - 20, 2, yb - yt + 20);
  ctx.restore();
  const pts = [];
  for (let i = 0; i <= 120; i++) { const u = i / 120; pts.push([lerp(x0, x1, u), lerp(yb - 6, yt + 20, 1 - Math.exp(-u * 9))]); }
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  trace(ctx, poly(pts), draw);
  label(ctx, 'ACELERADOR', x1, yb + 50, DIM, draw, { size: 22, spacing: 6, weight: 600, align: 'right' });
  label(ctx, 'POTENCIA', x0 + 16, yt - 30, DIM, draw, { size: 22, spacing: 6, weight: 600 });
  if (mark > 0) {
    const xa = x0, xb = lerp(x0, x1, 0.06);
    dimLine(xa, xb, yb + 40, mark, COLOR.yellow);
    label(ctx, 'UN MILÍMETRO', xb + 20, yb + 50, COLOR.yellow, mark, { size: 22, spacing: 6, weight: 700 });
  }
}

// Lona que cubre la foto: tela oscura con borde ondulado que desciende.
function drawTarp(t, p) {
  if (p <= 0) return;
  const yb = lerp(-60, H + 80, ease.inOut(p));
  ctx.save();
  ctx.fillStyle = '#121316';
  ctx.beginPath();
  ctx.moveTo(-20, -20);
  ctx.lineTo(W + 20, -20);
  for (let x = W + 20; x >= -20; x -= 20) ctx.lineTo(x, yb + 26 * noise1(x * 0.01 + 3) + 12 * noise1(x * 0.04 + 9));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,233,230,0.08)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 7; k++) {
    const x = 160 + k * 260 + 40 * noise1(k * 3.3);
    ctx.beginPath(); ctx.moveTo(x, -20); ctx.quadraticCurveTo(x + 50 * noise1(k), yb * 0.5, x + 30 * noise1(k + 4), yb - 20); ctx.stroke();
  }
  ctx.restore();
}

// Restrictor en la boca del compresor: dos cuñas que estrechan la entrada de aire.
function drawRestrictor(cx, cy, s, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = COLOR.red;
  ctx.globalAlpha = k;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-560, sd * 90); ctx.lineTo(-500, sd * 90); ctx.lineTo(-530, sd * 30); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Plantillas de plano. Cada una devuelve draw(t, s0, s1) (s0/s1: inicio y fin del plano).

const span = (t, s0, s1) => prog(t, s0 - 0.3, s1 + 0.3);

// Titular alineado a la rejilla: abajo (sobre suelo o zonas oscuras) o arriba (sobre el cielo).
function titleBlock(t, o, s0) {
  const n = o.title?.length ?? 0;
  const size = o.size ?? 116;
  const lead = size * 1.04;
  const tt = o.tt ?? s0 + 0.35;
  let y0 = o.pos === 'top' ? 330 : 975 - (n - 1) * lead;
  if (o.y0) y0 = o.y0;
  const x = o.x ?? M;
  if (o.tag) tag(t, o.tag, x, y0 - size - 34, o.tagT ?? s0 + 0.1, o.tagColor ?? COLOR.yellow, { align: o.align ?? 'left' });
  if (n) lines(t, o.title, x, y0, lead, size, tt, { colors: o.colors, color: o.color ?? COLOR.paper, maxW: o.maxW ?? GRID.w, align: o.align ?? 'left' });
  if (o.label) label(ctx, o.label, x, y0 + (n - 1) * lead + (o.labelDy ?? 74), o.labelColor ?? DIM, prog(t, o.labelT ?? tt + 0.8, (o.labelT ?? tt + 0.8) + 0.5), { size: 40, spacing: 0, weight: 600, align: o.align ?? 'left' });
}

const kPhoto = (o) => (t, s0, s1) => {
  bg();
  const u = span(t, s0, s1);
  const z = o.z ?? [1.14, 1.04];
  photo(o.img, 0, 0, W, H, { zoom: lerp(z[0], z[1], ease.out(u)), fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, dx: lerp(o.dx?.[0] ?? 0, o.dx?.[1] ?? 0, u) },
    { dark: o.dark ?? 0.35, vig: 0.55, gray: o.gray });
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
};

const kSplit = (o) => (t, s0, s1) => {
  bg(o.bg ?? COLOR.ink);
  const u = span(t, s0, s1);
  const z = o.z ?? [1.12, 1.04];
  const x0 = o.side === 'left' ? 0 : 900, w = W - 900;
  photo(o.img, x0, 0, w, H, { zoom: lerp(z[0], z[1], ease.out(u)), fx: o.fx ?? 0.5, fy: o.fy ?? 0.5 }, { vig: 0.3, gray: o.gray });
  titleBlock(t, { pos: 'top', y0: 560, maxW: 680, x: o.side === 'left' ? w + 100 : M, ...o }, s0);
  o.extra?.(t, s0, s1);
};

const kType = (o) => (t, s0, s1) => {
  bg(o.bg ?? COLOR.ink);
  const u = span(t, s0, s1);
  ctx.save();
  zoomAbout(lerp(1.0, 1.04, ease.inOut(u)));
  const center = o.align === 'center';
  const n = o.title.length;
  const size = o.size ?? 150;
  const lead = size * 1.02;
  const y0 = o.y0 ?? (H / 2 + size * 0.35 - (n - 1) * lead / 2);
  titleBlock(t, { ...o, x: center ? W / 2 : M, y0, size, maxW: o.maxW ?? GRID.w, labelDy: o.stripes ? 140 : 74 }, s0);
  ctx.restore();
  if (o.stripes) stripesH(ctx, y0 + (n - 1) * lead + 48, 12, prog(t, s0 + 0.3, s0 + 1.1), 0, { x0: center ? W / 2 - 360 : M, x1: center ? W / 2 + 360 : M + 520 });
  o.extra?.(t, s0, s1);
};

// Cifra grande con etiqueta y unidad.
const kStat = (o) => (t, s0, s1) => {
  bg(o.bg ?? COLOR.ink);
  o.under?.(t, s0, s1);
  const x = o.x ?? M;
  tag(t, o.tag, x, 360, o.tagT ?? s0 + 0.1, o.tagColor ?? COLOR.yellow);
  const v = o.value(t);
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, o.showT ?? s0 + 0.2, (o.showT ?? s0 + 0.2) + 0.3));
  counter(v, x - 8, 660, o.size ?? 300, o.color ?? COLOR.paper, 'left', o.digits ?? 0);
  ctx.restore();
  if (o.unit) label(ctx, o.unit, x, 760, COLOR.paper, prog(t, o.unitT ?? s0 + 0.5, (o.unitT ?? s0 + 0.5) + 0.5), { size: 56, spacing: 0, weight: 700 });
  if (o.label) label(ctx, o.label, x, 840, DIM, prog(t, o.labelT, o.labelT + 0.5), { size: 40, spacing: 0, weight: 600 });
  o.extra?.(t, s0, s1);
};


// ---------------------------------------------------------------------------
// 3D con perspectiva real en Canvas 2D: una imagen plana se proyecta en franjas finas,
// cada una con su propia escala según su profundidad. Sin librerías, determinista.

const FOCAL = 1700;

// Proyecta `src` como un plano de w×h. map(x) devuelve [X, Z] del punto horizontal x ∈ [-w/2, w/2]
// (X lateral respecto a cx, Z profundidad: 0 = plano de pantalla, positivo = más lejos).
function stripsY(src, w, h, cx, cy, map, { n = 96, shade = 0, alpha = 1, sx0 = 0, sw = src.width, sh = src.height } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const [X0, Z0] = map((u0 - 0.5) * w), [X1, Z1] = map((u1 - 0.5) * w);
    if (FOCAL + Z0 <= 10 || FOCAL + Z1 <= 10) continue;
    const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
    const p0 = cx + X0 * s0, p1 = cx + X1 * s1;
    if (p1 <= p0) continue; // cara de espaldas
    const s = (s0 + s1) / 2;
    ctx.drawImage(src, sx0 + u0 * sw, 0, Math.max(1, (u1 - u0) * sw), sh, p0, cy - (h * s) / 2, p1 - p0 + 0.7, h * s);
  }
  if (shade > 0) {
    // Sombreado de la cara según su giro (se repite la silueta con negro translúcido).
    ctx.globalAlpha = alpha * shade;
    ctx.fillStyle = COLOR.ink;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const [X0, Z0] = map((u0 - 0.5) * w), [X1, Z1] = map((u1 - 0.5) * w);
      const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
      const p0 = cx + X0 * s0, p1 = cx + X1 * s1;
      if (p1 <= p0) continue;
      const s = (s0 + s1) / 2;
      ctx.fillRect(p0, cy - (h * s) / 2, p1 - p0 + 0.7, h * s);
    }
  }
  ctx.restore();
}

// Lo mismo girando alrededor del eje horizontal (franjas por filas).
function stripsX(src, w, h, cx, cy, map, { n = 120, shade = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const v0 = i / n, v1 = (i + 1) / n;
    const [Y0, Z0] = map((v0 - 0.5) * h), [Y1, Z1] = map((v1 - 0.5) * h);
    if (FOCAL + Z0 <= 10 || FOCAL + Z1 <= 10) continue;
    const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
    const p0 = cy + Y0 * s0, p1 = cy + Y1 * s1;
    if (p1 <= p0) continue;
    const s = (s0 + s1) / 2;
    ctx.drawImage(src, 0, v0 * src.height, src.width, Math.max(1, (v1 - v0) * src.height), cx - (w * s) / 2, p0, w * s, p1 - p0 + 0.7);
    if (shade > 0) { ctx.globalAlpha = alpha * shade; ctx.fillStyle = COLOR.ink; ctx.fillRect(cx - (w * s) / 2, p0, w * s, p1 - p0 + 0.7); ctx.globalAlpha = alpha; }
  }
  ctx.restore();
}

// Plano girado `a` radianes sobre su eje vertical, desplazado en profundidad.
const planeY = (src, a, { w = W, h = H, cx = W / 2, cy = H / 2, z = 0, x = 0, ...o } = {}) =>
  stripsY(src, w, h, cx, cy, (u) => [x + u * Math.cos(a), z + u * Math.sin(a)], o);
// Plano inclinado `a` radianes sobre su eje horizontal (positivo: la parte de arriba se aleja).
const planeX = (src, a, { w = W, h = H, cx = W / 2, cy = H / 2, z = 0, y = 0, ...o } = {}) =>
  stripsX(src, w, h, cx, cy, (v) => [y + v * Math.cos(a), z - v * Math.sin(a)], o);

// Transición de cubo: el plano saliente gira como la cara de un cubo y entra el siguiente.
function cube(t, t0, A_, B_, vertical = false, dir = 1) {
  const p = ease.inOut(prog(t, t0 - 0.22, t0 + 0.22));
  const a = toLayer('a', A_), b = toLayer('b', B_);
  const half = (vertical ? H : W) / 2;
  const pull = Math.sin(Math.PI * p) * 700;
  const face = (src, phi) => {
    const c = Math.cos(phi), s = Math.sin(phi);
    if (c <= 0.01) return;
    const map = (u) => [u * c - half * s, pull + half - u * s - half * c];
    const shade = (1 - c) * 0.75;
    if (vertical) stripsX(src, W, H, W / 2, H / 2, map, { shade });
    else stripsY(src, W, H, W / 2, H / 2, map, { shade });
  };
  bg();
  const phiA = -dir * p * Math.PI / 2, phiB = dir * (1 - p) * Math.PI / 2;
  // Primero la cara más alejada.
  if (Math.cos(phiA) < Math.cos(phiB)) { face(a, phiA); face(b, phiB); } else { face(b, phiB); face(a, phiA); }
}

// Transición de vuelo: la cámara atraviesa el plano saliente y el siguiente llega desde el fondo.
function fly(t, t0, A_, B_) {
  const p = prog(t, t0 - 0.2, t0 + 0.2);
  const a = toLayer('a', A_), b = toLayer('b', B_);
  bg();
  const pb = ease.out(clamp(p * 1.4 - 0.2));
  const zb = lerp(1400, 0, pb);
  ctx.save();
  ctx.globalAlpha = clamp(p * 2);
  const sb = FOCAL / (FOCAL + zb);
  ctx.drawImage(b, W / 2 - (W * sb) / 2, H / 2 - (H * sb) / 2, W * sb, H * sb);
  ctx.restore();
  const pa = ease.inExpo(clamp(p * 1.25));
  if (pa < 1) {
    // Desenfoque radial: copias escaladas del plano saliente.
    for (let k = 0; k < 6; k++) {
      const sa = 1 + pa * 2.4 * (1 + k * 0.06);
      ctx.save();
      ctx.globalAlpha = (1 - pa) * (k === 0 ? 1 : 0.22);
      ctx.drawImage(a, W / 2 - (W * sa) / 2, H / 2 - (H * sa) / 2, W * sa, H * sa);
      ctx.restore();
    }
  }
}

// Foto como plano 3D a sangre: sobredimensionada para que al girar nunca asomen los bordes.
function photo3D(key, t, s0, s1, { yaw = [-0.07, 0.04], pitch = null, zoom = [1.18, 1.06], fx = 0.5, fy = 0.5, dark = 0.3, gray = false } = {}) {
  const u = ease.inOut(span(t, s0, s1));
  const L = toLayer('p', () => {
    bg();
    photo(key, 0, 0, W, H, { zoom: 1, fx, fy }, { dark, vig: 0.55, gray });
  });
  bg();
  const k = lerp(zoom[0], zoom[1], u);
  const o = 1 + 0.75 * Math.max(Math.abs(yaw[0]), Math.abs(yaw[1]), Math.abs(pitch?.[0] ?? 0), Math.abs(pitch?.[1] ?? 0));
  if (pitch) planeX(L, lerp(pitch[0], pitch[1], u), { w: W * k * o, h: H * k * o });
  else planeY(L, lerp(yaw[0], yaw[1], u), { w: W * k * o, h: H * k * o });
}

// ---------------------------------------------------------------------------
// Componentes de la caja de cambios. Todo en coordenadas de pantalla y dependiente de `t`.

const BRASS = COLOR.brass, HYD = COLOR.hyd, POWER = COLOR.power;
const STEEL_F = '#2A2D33', STEEL_L = '#B9BDC2';

function strokePath(pts, p, color, width = 3, dash = null) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  trace(ctx, poly(pts), p);
  ctx.restore();
}
const mixColor = (a, b, k) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(k)))).join(',')})`;
};
function arrow(x0, y0, x1, y1, color, w = 6, head = 18) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.8, y1 - Math.sin(a) * head * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * head, y1 - Math.sin(a - 0.45) * head); ctx.lineTo(x1 - Math.cos(a + 0.45) * head, y1 - Math.sin(a + 0.45) * head); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// --- Piñón visto de frente, con perfil de diente (flancos curvos, punta y fondo redondeados) ---
// z dientes, módulo m (px), ángulo de giro a. El radio primitivo es m·z/2.
function gearPath(z, m) {
  const r = (m * z) / 2, ra = r + m, rf = r - 1.25 * m, step = (Math.PI * 2) / z;
  const pts = [];
  for (let i = 0; i < z; i++) {
    const c = i * step;
    // Fondo, flanco de subida (4 puntos sobre una curva tipo evolvente), punta, flanco de bajada.
    const q = [[rf, -0.5], [rf, -0.36], [lerp(rf, ra, 0.35), -0.3], [lerp(rf, ra, 0.7), -0.24], [ra, -0.17], [ra, 0.17], [lerp(rf, ra, 0.7), 0.24], [lerp(rf, ra, 0.35), 0.3], [rf, 0.36]];
    for (const [rr2, f] of q) pts.push([rr2 * Math.cos(c + f * step), rr2 * Math.sin(c + f * step)]);
  }
  return { pts, r, ra, rf };
}
const gearCache = new Map();
function drawGear(cx, cy, z, m, a, { fill = STEEL_F, stroke = COLOR.paper, width = 2.5, holes = 0, hub = 0.32, glow = null, alpha = 1, mark = false } = {}) {
  const key = z + ':' + m;
  if (!gearCache.has(key)) gearCache.set(key, gearPath(z, m));
  const G = gearCache.get(key);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.beginPath(); G.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  // Aligeramientos y eje: se recortan del relleno.
  const hr = G.rf * hub;
  ctx.moveTo(hr, 0); ctx.arc(0, 0, hr, 0, Math.PI * 2, true);
  for (let k = 0; k < holes; k++) {
    const an = (k / holes) * Math.PI * 2, d = (G.rf + hr) / 2, hrr = (G.rf - hr) * 0.3;
    ctx.moveTo(Math.cos(an) * d + hrr, Math.sin(an) * d); ctx.arc(Math.cos(an) * d, Math.sin(an) * d, hrr, 0, Math.PI * 2, true);
  }
  ctx.fillStyle = glow ?? fill; ctx.fill('evenodd');
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
  // Circunferencia primitiva, discontinua y tenue (como en un plano).
  ctx.save(); ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(232,233,230,0.22)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, G.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  // Chavetero.
  ctx.fillStyle = COLOR.ink; ctx.fillRect(hr - 6, -5, 10, 10);
  if (mark) { ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(G.r - m * 0.2, 0, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  return G;
}
// Ángulo del piñón B que engrana con A: un diente de A frente a un hueco de B, girando en sentido contrario.
function meshAngle(aA, zA, zB, dirAB) { return dirAB + Math.PI - Math.PI / zB - (aA - dirAB) * zA / zB; }

// --- Par de piñones de perfil: dientes rectos frente a helicoidales, con el empuje axial ---
function drawGearSide(t, { cx, cy, w = 260, h = 300, helix = 0, speed = 1, label: lab = null, thrust = 0, appear = 1 }) {
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.beginPath(); ctx.rect(cx - w / 2, cy - h / 2, w, h); ctx.clip();
  ctx.fillStyle = STEEL_F; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  // Dientes: franjas que avanzan con el giro; inclinadas en el helicoidal.
  const pitch = 26, off = (t * speed * 60) % pitch;
  ctx.strokeStyle = 'rgba(232,233,230,0.75)'; ctx.lineWidth = 3;
  const sk = Math.tan(helix) * w;
  for (let y = -h / 2 - pitch - Math.abs(sk); y < h / 2 + pitch + Math.abs(sk); y += pitch) {
    const yy = cy + y + off;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, yy - sk / 2); ctx.lineTo(cx + w / 2, yy + sk / 2); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= appear; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // Eje.
  ctx.fillStyle = STEEL_L; ctx.fillRect(cx - w / 2 - 120, cy - 14, w + 240, 28);
  ctx.restore();
  if (thrust > 0) {
    const L = 170 * ease.out(thrust);
    arrow(cx + w / 2 + 40, cy, cx + w / 2 + 40 + L, cy, COLOR.fire, 8, 26);
    arrow(cx - w / 2 - 40, cy, cx - w / 2 - 40 - L, cy, COLOR.fire, 8, 26);
  }
  if (lab) label(ctx, lab, cx, cy + h / 2 + 60, COLOR.paper, appear, { size: 24, spacing: 7, weight: 700, align: 'center' });
}

// --- Caja de cambios en sección (eje primario, intermediario y secundario) con el camino del par ---
// sel: marcha engranada (1..4) o 0 en punto muerto; collarA/collarB: posición de los manguitos (-1..1).
// kind: 'synchro' (conos de latón) o 'dog' (crabots); rpm: régimen visual del motor.
const BOX = { gearsMain: [[-300, 150], [-120, 130], [120, 108], [300, 88]], gearsLay: [[-300, 66], [-120, 86], [120, 108], [300, 128]] };
function drawGearbox(t, { cx, cy, s = 1, sel = 0, collarA = 0, collarB = 0, kind = 'dog', flow = 1, appear = 1, labels = 0, rpm = 1, glowSync = 0 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  const yM = -150, yL = 160; // ejes secundario (arriba) e intermediario (abajo)
  ctx.save();
  ctx.globalAlpha *= appear;
  // Carcasa en sección.
  ctx.strokeStyle = 'rgba(232,233,230,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(...P(-560, -360), 1120 * s, 680 * s, 30 * s); ctx.stroke();
  // Ejes.
  ctx.fillStyle = STEEL_L;
  ctx.fillRect(...P(-760, yM - 12), 640 * s, 24 * s);   // primario (entrada)
  ctx.fillRect(...P(-460, yM - 12), 1240 * s, 24 * s);  // secundario (salida)
  ctx.fillRect(...P(-560, yL - 12), 1060 * s, 24 * s);  // intermediario
  // Piñones: ancho fijo, alto = diámetro. Los dientes se dibujan como franjas que avanzan según el giro.
  const teeth = (x, y, d, w, sp, col, hi) => {
    const [X, Y] = P(x - w / 2, y - d / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w * s, d * s); ctx.clip();
    ctx.fillStyle = hi ? mixColor('#2A2D33', '#5A1D20', hi) : STEEL_F; ctx.fillRect(X, Y, w * s, d * s);
    ctx.strokeStyle = 'rgba(232,233,230,0.55)'; ctx.lineWidth = 2;
    const pitch = 14 * s, off = ((t * sp * 40 * s) % pitch + pitch) % pitch;
    for (let yy = Y - pitch + off; yy < Y + d * s; yy += pitch) { ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + w * s, yy); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = hi ? 4 : 2.5; ctx.strokeRect(X, Y, w * s, d * s);
  };
  const inSp = rpm, laySp = rpm * 0.62;
  // Toma constante: piñón del primario y su pareja en el intermediario.
  teeth(-470, yM, 120, 70, inSp, COLOR.paper, flow > 0 && sel ? flow : 0);
  teeth(-470, yL, 160, 70, laySp, COLOR.paper, flow > 0 && sel ? flow : 0);
  BOX.gearsMain.forEach(([x, d], i) => {
    const on = sel === i + 1;
    const dl = BOX.gearsLay[i][1];
    teeth(x, yL, dl, 70, laySp, COLOR.paper, on ? flow : 0);
    // Los piñones del secundario giran locos salvo el engranado.
    teeth(x, yM, d, 70, laySp * dl / d, COLOR.paper, on ? flow : 0);
  });
  // Manguitos (crabots o sincronizadores) entre 1-2 y 3-4, con sus horquillas.
  for (const [xc, c, a, b] of [[-210, collarA, 1, 2], [210, collarB, 3, 4]]) {
    const x = xc + c * 40;
    const [X, Y] = P(x - 22, yM - 74);
    ctx.fillStyle = kind === 'dog' ? '#C9CCD0' : BRASS; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2;
    ctx.fillRect(X, Y, 44 * s, 148 * s); ctx.strokeRect(X, Y, 44 * s, 148 * s);
    if (kind === 'dog') { ctx.fillStyle = COLOR.ink; for (const sd of [-1, 1]) for (const yy of [-50, 30]) ctx.fillRect(...P(x + sd * 22 - (sd > 0 ? 0 : 10), yM + yy), 10 * s, 20 * s); }
    if (kind === 'synchro' && glowSync > 0) {
      ctx.save(); ctx.globalAlpha *= glowSync; ctx.fillStyle = COLOR.fire;
      ctx.fillRect(...P(x - 30, yM - 78), 60 * s, 156 * s); ctx.restore();
    }
    // Horquilla y varilla de mando.
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(...P(x, yM - 74)); ctx.lineTo(...P(x, -300)); ctx.lineTo(...P(x + 80, -300)); ctx.stroke();
  }
  // Camino del par: entrada → toma constante → intermediario → marcha elegida → salida.
  if (sel > 0 && flow > 0) {
    const [xg] = BOX.gearsMain[sel - 1];
    const path = [P(-760, yM), P(-470, yM), P(-470, yL), P(xg, yL), P(xg, yM), P(780, yM)];
    ctx.save(); ctx.globalAlpha *= flow;
    ctx.strokeStyle = POWER; ctx.lineWidth = 7; ctx.setLineDash([22, 16]); ctx.lineDashOffset = -t * 220;
    ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  if (labels > 0) {
    const L = [['ENTRADA', -760, yM - 40, 'left'], ['SALIDA', 780, yM - 40, 'right'], ['EJE INTERMEDIARIO', -540, yL + 120, 'left']];
    L.forEach(([str, x, y, al], i) => label(ctx, str, ...P(x, y), DIM, clamp(labels * 2 - i * 0.3), { size: 22, spacing: 6, weight: 700, align: al }));
    BOX.gearsMain.forEach(([x, d], i) => label(ctx, `${i + 1}ª`, ...P(x, yM - d / 2 - 22), sel === i + 1 ? COLOR.red : COLOR.paper, clamp(labels * 2 - 0.6), { size: 26, spacing: 2, weight: 800, align: 'center' }));
  }
}

// --- Sincronizador en sección: el cono de latón frena por fricción hasta igualar velocidades ---
function drawSynchro(t, { cx, cy, s = 1, push = 0, heat = 0, melt = 0, appear = 1 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  ctx.save(); ctx.globalAlpha *= appear;
  // Piñón con su cono macho (derecha) y manguito que empuja el anillo de latón (izquierda).
  ctx.fillStyle = STEEL_F; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(...P(80, -260)); ctx.lineTo(...P(260, -260)); ctx.lineTo(...P(260, 260)); ctx.lineTo(...P(80, 260)); ctx.lineTo(...P(80, 120)); ctx.lineTo(...P(10, 90)); ctx.lineTo(...P(10, -90)); ctx.lineTo(...P(80, -120)); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Anillo de latón (cono hembra) que se desliza hacia el cono.
  const x0 = lerp(-120, -14, ease.inOut(clamp(push)));
  const ring = mixColor('#C9A24A', '#EE7A1E', heat);
  ctx.fillStyle = ring;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(...P(x0, sd * 100)); ctx.lineTo(...P(x0 + 24, sd * 92)); ctx.lineTo(...P(x0 + 24, sd * 150)); ctx.lineTo(...P(x0 - 30, sd * 150)); ctx.lineTo(...P(x0 - 30, sd * 108)); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Manguito.
  const xs = x0 - 90;
  ctx.fillStyle = '#C9CCD0'; ctx.fillRect(...P(xs - 40, -190), 70 * s, 380 * s); ctx.strokeRect(...P(xs - 40, -190), 70 * s, 380 * s);
  // Eje.
  ctx.fillStyle = STEEL_L; ctx.fillRect(...P(-420, -26), 720 * s, 52 * s);
  // Calor en la superficie de fricción.
  if (heat > 0) {
    ctx.strokeStyle = mixColor('#EE7A1E', '#D7262D', heat); ctx.lineWidth = 6;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(...P(x0 + 26, sd * 92)); ctx.lineTo(...P(x0 + 26, sd * 132)); ctx.stroke(); }
  }
  // Gotas de latón fundido.
  if (melt > 0) {
    ctx.fillStyle = mixColor('#EE7A1E', '#D7262D', 0.5);
    for (let k = 0; k < 5; k++) { const dy = (melt * 120 + k * 30) % 160; ctx.beginPath(); ctx.ellipse(...P(x0 - 6 + k * 6, 152 + dy), 4 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

// --- Crabot visto de frente: cuatro salientes macizos con huecos enormes ---
function drawDogRing(cx, cy, r, a, { n = 4, color = '#C9CCD0', slots = false, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, cy); ctx.rotate(a);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.fillStyle = slots ? STEEL_F : color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.stroke();
  for (let k = 0; k < n; k++) {
    const an = (k / n) * Math.PI * 2, w = slots ? 0.42 : 0.24; // las ventanas del piñón son mucho más anchas que los salientes
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, an - w, an + w); ctx.arc(0, 0, r * 0.6, an + w, an - w, true); ctx.closePath();
    ctx.fillStyle = slots ? COLOR.ink : COLOR.paper; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// --- Reja en H con la palanca; el «money shift» de 5ª a 2ª ---
const GATE = { 1: [-160, -150], 2: [-160, 150], 3: [0, -150], 4: [0, 150], 5: [160, -150], R: [160, 150] };
function drawGate(t, { cx, cy, s = 1, path = [], p = 0, wrong = 0, appear = 1 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  ctx.save(); ctx.globalAlpha *= appear;
  ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 46 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...P(-160, 0)); ctx.lineTo(...P(160, 0));
  for (const x of [-160, 0, 160]) { ctx.moveTo(...P(x, -150)); ctx.lineTo(...P(x, 150)); }
  ctx.stroke();
  ctx.restore();
  for (const [k, [x, y]] of Object.entries(GATE)) label(ctx, k, ...P(x, y + (y < 0 ? -50 : 80)), COLOR.paper, appear, { size: 34, spacing: 0, weight: 800, align: 'center' });
  // Pomo de la palanca recorriendo el camino.
  if (path.length) {
    const pts = path.map((k) => (typeof k === 'string' || typeof k === 'number' ? (GATE[k] ?? [0, 0]) : k)).map(([x, y]) => P(x, y));
    const PP = poly(pts);
    strokePath(pts, p, wrong ? COLOR.red : COLOR.yellow, 6, [10, 10]);
    const [kx, ky] = pointAt(PP, clamp(p));
    ctx.save(); ctx.globalAlpha *= appear; ctx.fillStyle = wrong ? COLOR.red : COLOR.paper;
    ctx.beginPath(); ctx.arc(kx, ky, 26 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// --- Tambor desmodrómico: cilindro con surcos y su desarrollo plano con las tres horquillas ---
// angle: giro del tambor (rad). Cada marcha está a 60°; cada surco mueve una horquilla.
const DRUM_TRACKS = [
  // posición de cada horquilla (-1, 0, 1) en cada detente: N, 1, 2, 3, 4, 5, 6
  [0, -1, 1, 0, 0, 0, 0],
  [0, 0, 0, -1, 1, 0, 0],
  [0, 0, 0, 0, 0, -1, 1],
];
function trackY(k, ang) { // ang en detentes (0 = punto muerto, 1 = 1ª…)
  const i = Math.floor(ang), f = ang - i;
  const a = DRUM_TRACKS[k][clamp(i, 0, 6)], b = DRUM_TRACKS[k][clamp(i + 1, 0, 6)];
  const e = f < 0.3 ? 0 : f > 0.7 ? 1 : (f - 0.3) / 0.4;
  return lerp(a, b, e * e * (3 - 2 * e));
}
function drawDrum(t, { cx, cy, s = 1, pos = 0, appear = 1, flat = 1, forks = 1 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  const L = 560, R = 120;
  ctx.save(); ctx.globalAlpha *= appear;
  // Cilindro (vista lateral con sombreado por bandas) y sus surcos visibles en la cara frontal.
  ctx.fillStyle = '#3A3E45'; ctx.fillRect(...P(-L / 2, -R), L * s, 2 * R * s);
  for (let k = 0; k < 8; k++) { ctx.fillStyle = `rgba(232,233,230,${0.04 + 0.05 * Math.sin((k / 8) * Math.PI)})`; ctx.fillRect(...P(-L / 2, -R + (k / 8) * 2 * R), L * s, (2 * R / 8) * s); }
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; ctx.strokeRect(...P(-L / 2, -R), L * s, 2 * R * s);
  // Tapas del cilindro en perspectiva.
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(...P(sd * L / 2, 0), 26 * s, R * s, 0, 0, Math.PI * 2); ctx.fillStyle = sd < 0 ? '#2A2D33' : '#4A4E55'; ctx.fill(); ctx.stroke(); }
  // Surcos: la parte del surco que mira a la cámara (un detente por cada 60° de giro visible).
  [-160, 0, 160].forEach((x0, k) => {
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const v = (i / 60) * 2 - 1;                 // posición vertical en la cara visible (-1 arriba, 1 abajo)
      const a = pos + Math.asin(v) / (Math.PI / 3); // detente que pasa por esa altura
      const x = x0 + trackY(k, a) * 50, y = v * R;
      if (Math.abs(v) > 0.98) continue;
      i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y));
    }
    ctx.stroke();
    // Tetón de la horquilla en el surco (a media altura) y la horquilla.
    const xp = x0 + trackY(k, pos) * 50;
    ctx.fillStyle = COLOR.red; ctx.beginPath(); ctx.arc(...P(xp, 0), 13 * s, 0, Math.PI * 2); ctx.fill();
    if (forks > 0) {
      ctx.strokeStyle = COLOR.red; ctx.lineWidth = 6; ctx.globalAlpha = appear * forks;
      ctx.beginPath(); ctx.moveTo(...P(xp, 0)); ctx.lineTo(...P(xp, -R - 120)); ctx.moveTo(...P(xp - 40, -R - 160)); ctx.lineTo(...P(xp - 40, -R - 120)); ctx.lineTo(...P(xp + 40, -R - 120)); ctx.lineTo(...P(xp + 40, -R - 160)); ctx.stroke();
      ctx.globalAlpha = appear;
    }
  });
  ctx.restore();
  // Desarrollo plano del tambor: tres pistas con los detentes de N a 6ª y la posición actual.
  if (flat > 0) {
    const x0 = cx - 380 * s, y0 = cy + 230 * s, w = 760 * s, h = 210 * s;
    ctx.save(); ctx.globalAlpha *= appear * flat;
    const names = ['N', '1', '2', '3', '4', '5', '6'];
    names.forEach((n, i) => {
      const x = x0 + (i / 6) * w;
      ctx.fillStyle = 'rgba(232,233,230,0.15)'; ctx.fillRect(x - 1, y0, 2, h);
      label(ctx, n, x, y0 + h + 34, Math.round(pos) === i ? COLOR.paper : DIM, flat * appear, { size: 22, spacing: 2, weight: 800, align: 'center' });
    });
    for (let k = 0; k < 3; k++) {
      const yc = y0 + (k + 0.5) * (h / 3);
      const pts = []; for (let i = 0; i <= 120; i++) { const a = (i / 120) * 6; pts.push([x0 + (a / 6) * w, yc + trackY(k, a) * 22 * s]); }
      ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.fillStyle = COLOR.red; ctx.beginPath(); ctx.arc(x0 + (clamp(pos, 0, 6) / 6) * w, yc + trackY(k, pos) * 22 * s, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// --- Cadena de mando: leva → centralita → electroválvula → actuador → tambor ---
function drawActuation(t, { x0 = 860, y = 560, appear = 1, pulse = -1 }) {
  const nodes = [['LEVA', x0], ['ECU', x0 + 230], ['ELECTROVÁLVULA', x0 + 460], ['ACTUADOR', x0 + 690], ['TAMBOR', x0 + 900]];
  ctx.save(); ctx.globalAlpha *= appear;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i][1] + 60, b = nodes[i + 1][1] - 60;
    ctx.strokeStyle = i >= 2 ? HYD : COLOR.yellow; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
    if (pulse >= 0) {
      const ph = clamp((pulse - i) * 1);
      if (ph > 0 && ph < 1) { ctx.fillStyle = i >= 2 ? HYD : COLOR.yellow; ctx.beginPath(); ctx.arc(lerp(a, b, ph), y, 10, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  nodes.forEach(([n, x], i) => {
    const lit = pulse >= 0 && pulse >= i;
    ctx.fillStyle = lit ? (i >= 3 ? 'rgba(127,180,221,0.25)' : 'rgba(233,168,37,0.2)') : COLOR.ink2;
    ctx.strokeStyle = lit ? (i >= 3 ? HYD : COLOR.yellow) : COLOR.paper; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 60, y - 44, 120, 88, 16); ctx.fill(); ctx.stroke();
    label(ctx, n, x, y + 84, lit ? COLOR.paper : DIM, appear, { size: n.length > 10 ? 16 : 20, spacing: 4, weight: 700, align: 'center' });
  });
  ctx.restore();
}

// --- Señales de un cambio con corte de encendido (0 a 120 ms) ---
function drawShiftTrace(t, { x0 = 860, y0 = 230, w = 920, h = 620, draw = 1, appear = 1 }) {
  const ms = (v) => x0 + (v / 120) * w;
  const rows = [['ACELERADOR', COLOR.paper], ['PAR EN LA RUEDA', COLOR.red], ['PRESIÓN DEL ACTUADOR', HYD], ['MARCHA', COLOR.yellow]];
  const rh = h / rows.length;
  const f = [
    () => 0.95,
    (v) => (v > 20 && v < 55 ? 0.15 : v >= 55 && v < 70 ? lerp(0.15, 0.92, (v - 55) / 15) : 0.88 - (v > 70 ? 0.06 : 0)),
    (v) => (v < 22 ? 0.05 : v < 40 ? lerp(0.05, 0.95, (v - 22) / 18) : v < 58 ? 0.95 : Math.max(0.05, 0.95 - (v - 58) / 10)),
    (v) => (v < 44 ? 0.3 : v < 50 ? lerp(0.3, 0.8, (v - 44) / 6) : 0.8),
  ];
  ctx.save(); ctx.globalAlpha *= appear;
  // Ventana del corte de encendido (30–40 ms).
  ctx.fillStyle = 'rgba(215,38,45,0.12)'; ctx.fillRect(ms(20), y0 - 20, ms(55) - ms(20), h + 20);
  rows.forEach(([n, col], i) => {
    const yb = y0 + (i + 1) * rh - 18;
    ctx.fillStyle = 'rgba(232,233,230,0.15)'; ctx.fillRect(x0, yb, w, 1.5);
    const pts = []; for (let k = 0; k <= 240; k++) { const v = (k / 240) * 120; pts.push([ms(v), yb - f[i](v) * (rh - 40)]); }
    strokePath(pts, draw, col, 4);
    label(ctx, n, x0, yb - rh + 34, col, appear, { size: 20, spacing: 6, weight: 700 });
  });
  for (const v of [0, 20, 40, 60, 80, 100, 120]) label(ctx, `${v} ms`, ms(v), y0 + h + 30, DIM, appear, { size: 18, spacing: 1, weight: 600, align: 'center' });
  ctx.restore();
}

// --- Momento de inercia polar: el mismo par hace girar antes al coche con las masas en el centro ---
function drawInertia(t, s0, { cx, cy, appear = 1 }) {
  const tt = Math.max(0, t - s0 - 0.6);
  for (const [x, rr2, name, col] of [[cx - 360, 230, 'MASAS EN LOS EXTREMOS', COLOR.steel], [cx + 360, 80, 'MASAS EN EL CENTRO', COLOR.red]]) {
    const I = 2 * rr2 * rr2;            // dos masas iguales a distancia r del eje
    const ang = 0.5 * (12000 / I) * tt * tt;
    ctx.save(); ctx.globalAlpha *= appear; ctx.translate(x, cy); ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-110, -260, 220, 520, 40); ctx.stroke();
    ctx.fillStyle = col;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(0, sd * rr2, 34, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    label(ctx, name, x, cy + 330, col === COLOR.red ? COLOR.paper : DIM, appear, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
}

// ---------------------------------------------------------------------------
// Utilidades de plano.

const snap = (x) => Math.floor(x / 0.25) * 0.25;

function grayOf(key) {
  if (!layers.gray[key]) {
    const im = A[key];
    const c = makeCanvas(im.width, im.height);
    const g = c.getContext('2d');
    g.filter = 'grayscale(1) contrast(1.06)';
    g.drawImage(im, 0, 0);
    layers.gray[key] = c;
  }
  return layers.gray[key];
}

// Tramos del vídeo de onboards: a cámara lenta se funden dos fotogramas vecinos.
export const CLIP_N = { intro: 150, onA: 180, onB: 240, tyre: 135, aerial: 90, t16: 105 };
function drawSeg(seg, local, { zoom = 1.03, fx = 0.5, fy = 0.5, dark = 0 } = {}) {
  const fr = A.clips?.[seg];
  if (!fr) { bg(); return; }
  const f = clamp(local * CLIP_FPS, 0, CLIP_N[seg] - 1);
  const k = Math.floor(f), a = f - k;
  drawCover(ctx, fr[k], 0, 0, W, H, { zoom, fx, fy });
  if (a > 0.02 && fr[k + 1]) { ctx.save(); ctx.globalAlpha = a; drawCover(ctx, fr[k + 1], 0, 0, W, H, { zoom, fx, fy }); ctx.restore(); }
  if (dark > 0) { ctx.fillStyle = `rgba(11,12,14,${dark})`; ctx.fillRect(0, 0, W, H); }
  vignette(ctx, 0, 0, W, H, 0.5);
}
function scrimB(h = 560, a = 0.8) {
  const g = ctx.createLinearGradient(0, H - h, 0, H);
  g.addColorStop(0, 'rgba(11,12,14,0)');
  g.addColorStop(1, `rgba(11,12,14,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, H - h, W, h);
}
// Plano de archivo: guarda el tramo, su inicio y su velocidad para que la mezcla coloque el sonido real del coche.
const kClip = (o) => { const f = (t, s0, s1) => {
  bg();
  drawSeg(o.seg, (o.from ?? 0) + (t - s0) * (o.speed ?? 1), { zoom: lerp(o.z?.[0] ?? 1.03, o.z?.[1] ?? 1.08, ease.inOut(span(t, s0, s1))), fx: o.fx, fy: o.fy, dark: o.dark ?? 0.06 });
  scrimB();
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
}; f.seg = o.seg; f.from = o.from ?? 0; f.speed = o.speed ?? 1; return f; };
const kPhoto3 = (o) => (t, s0, s1) => {
  photo3D(o.img, t, s0, s1, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, yaw: o.yaw ?? [-0.06, 0.03], zoom: o.zoom ?? [1.12, 1.03], dark: o.dark ?? 0.38, gray: o.gray });
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
};
function side(t, tagStr, title, tt, { y = 230, size = 96, colors, label: lab, labelT, maxW = 700, lead } = {}) {
  if (tagStr) tag(t, tagStr, M, y - size - 10, tt - 0.25);
  lines(t, title, M, y, lead ?? size * 1.05, size, tt, { maxW, colors });
  if (lab) label(ctx, lab, M, y + (title.length - 1) * (lead ?? size * 1.05) + 70, DIM, prog(t, labelT ?? tt + 0.8, (labelT ?? tt + 0.8) + 0.5), { size: 36, spacing: 0, weight: 600 });
}
const ERAS = ['PATRÓN EN H', 'DOG BOX', 'SECUENCIAL', 'LEVAS · WRC', 'RALLY1'];
function drawEras(t, idx, appear, y = 1000) {
  const x0 = M, x1 = W - M;
  ctx.save(); ctx.globalAlpha *= appear;
  ctx.fillStyle = 'rgba(232,233,230,0.25)'; ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.fillStyle = COLOR.red; ctx.fillRect(x0, y - 1, (x1 - x0) * ease.inOut(clamp(appear)) * (idx + 0.5) / ERAS.length, 4);
  ctx.restore();
  ERAS.forEach((e, i) => {
    const x = lerp(x0, x1, (i + 0.5) / ERAS.length);
    ctx.save(); ctx.globalAlpha *= appear; ctx.fillStyle = i === idx ? COLOR.red : i < idx ? COLOR.paper : 'rgba(232,233,230,0.4)';
    ctx.beginPath(); ctx.arc(x, y + 1, i === idx ? 9 : 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    label(ctx, e, x, y - 22, i === idx ? COLOR.paper : DIM, appear, { size: 20, spacing: 6, weight: 700, align: 'center' });
  });
}
const kChapter = (o) => { const f = (t, s0, s1) => {
  bg();
  const u = span(t, s0, s1);
  if (o.img) photo(o.img, 0, 0, W, H, { zoom: lerp(o.z?.[0] ?? 1.12, o.z?.[1] ?? 1.03, ease.out(u)), fx: o.fx ?? 0.5, fy: o.fy ?? 0.5 }, { dark: 0.55, vig: 0.6, gray: o.gray });
  tag(t, o.tag, M, 420, o.tt - 0.2);
  lines(t, o.title, M, 560, 150, 150, o.tt, { colors: o.colors });
  if (o.label) label(ctx, o.label, M, 560 + (o.title.length - 1) * 150 + 90, COLOR.paper, prog(t, o.labelT, o.labelT + 0.5), { size: 44, spacing: 0, weight: 600 });
  drawEras(t, o.era, ease.out(prog(t, s0 + 0.2, s0 + 1.0)));
}; return f; };

// Tren de piñones que engranan de verdad: cada uno gira en proporción inversa a sus dientes.
function gearTrain(t, specs, { w0 = 0.6, appear = 1, m = 14 } = {}) {
  let prev = null;
  const out = [];
  for (const g of specs) {
    let a, x, y;
    if (!prev) { a = t * w0; x = g.x; y = g.y; }
    else {
      const r0 = (m * prev.z) / 2, r1 = (m * g.z) / 2;
      x = prev.x + Math.cos(g.dir) * (r0 + r1); y = prev.y + Math.sin(g.dir) * (r0 + r1);
      a = meshAngle(prev.a, prev.z, g.z, g.dir);
    }
    const cur = { ...g, x, y, a };
    drawGear(x, y, g.z, m, a, { holes: g.holes ?? 0, alpha: appear, mark: g.mark, glow: g.glow });
    out.push(cur); prev = cur;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Planos singulares.

function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 700, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.2))));
  ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h);
  ctx.restore();
  revealText(ctx, 'La evolución de las', W / 2, 770, FONT.display(800, 104), COLOR.paper, prog(t, 0.55, 1.25), { align: 'center', stagger: 0.02 });
  revealText(ctx, 'cajas de cambio', W / 2, 880, FONT.display(800, 104), COLOR.paper, prog(t, 0.7, 1.4), { align: 'center', stagger: 0.02 });
  stripesH(ctx, 925, 10, prog(t, 0.95, 1.65), 0, { x0: W / 2 - 240, x1: W / 2 + 240 });
}

// La entrada: el cambio de marcha de 0:07 a 0:12 del vídeo del cliente.
function sIntro(t, s0) {
  bg();
  drawSeg('intro', (t - s0) * 0.9, { zoom: lerp(1.02, 1.06, ease.inOut(prog(t, s0, s0 + 5.6))), dark: 0.04 });
  scrimB(520, 0.85);
  tag(t, 'EN UN TRAMO DE RALLY', M, 860, V(1) + 0.2);
  lines(t, ['40 cambios por kilómetro'], M, 975, 0, 110, V(1) + 1.9);
}
sIntro.seg = 'intro'; sIntro.from = 0; sIntro.speed = 0.9;

// Embrague, palanca y acelerador: los tres pasos de un cambio manual.
function sSteps(t, s0) {
  bg(); dots(0.04);
  const items = [['EMBRAGUE', V(3) + 1.0], ['PALANCA', V(4) + 0.2], ['ACELERADOR', V(4) + 1.2]];
  items.forEach(([n, tt], i) => {
    const x = 860 + i * 330, a = ease.out(prog(t, tt, tt + 0.5));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
    if (i === 0 || i === 2) { // pedal
      const press = 0.5 + 0.5 * Math.sin((t - tt) * 4);
      ctx.beginPath(); ctx.moveTo(x, 360); ctx.lineTo(x, 520 + press * 30); ctx.stroke();
      ctx.fillStyle = i === 0 ? COLOR.steel : COLOR.red; ctx.beginPath(); ctx.roundRect(x - 50, 520 + press * 30, 100, 150, 14); ctx.fill();
    } else { // palanca en la reja
      ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 80, 520); ctx.lineTo(x + 80, 520); for (const xx of [-80, 0, 80]) { ctx.moveTo(x + xx, 440); ctx.lineTo(x + xx, 600); } ctx.stroke();
      const k = ease.inOut(osc01(t - tt, 0.4));
      ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.arc(x - 80 + 80 * (k > 0.5 ? 1 : 0), lerp(440, 600, k), 20, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    label(ctx, n, x, 760, COLOR.paper, a, { size: 24, spacing: 7, weight: 700, align: 'center' });
  });
  side(t, 'EN UN COCHE DE CALLE, CADA CAMBIO REQUIERE', ['Tres pasos'], V(3) + 0.4, { y: 470, size: 120 });
}
const osc01 = (t, f) => 0.5 - 0.5 * Math.cos(t * f * Math.PI * 2);

// 300 km cronometrados.
function s300(t, s0) {
  bg(); dots(0.04);
  const p = ease.inOut(prog(t, s0 + 0.4, s0 + 3.4));
  const x0 = M, x1 = W - M, y = 640;
  ctx.fillStyle = 'rgba(232,233,230,0.25)'; ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.fillStyle = COLOR.red; ctx.fillRect(x0, y - 2, (x1 - x0) * p, 6);
  for (let k = 0; k <= 30; k++) { const x = lerp(x0, x1, k / 30); ctx.fillStyle = 'rgba(232,233,230,0.5)'; ctx.fillRect(x - 1, y - (k % 5 ? 10 : 22), 2, k % 5 ? 10 : 22); }
  for (const k of [0, 100, 200, 300]) label(ctx, `${k} km`, lerp(x0, x1, k / 300), y + 54, DIM, prog(t, s0 + 0.3, s0 + 0.8), { size: 22, spacing: 2, weight: 700, align: k ? (k === 300 ? 'right' : 'center') : 'left' });
  side(t, 'SI MULTIPLICAMOS POR LOS', ['300 kilómetros', 'cronometrados'], V(6) + 1.6, { y: 340, size: 110, maxW: 1400 });
}

// Una guerra de ingeniería: fricción, par motor y electrónica, con los piñones girando detrás.
function sThree(t, s0) {
  bg(); dots(0.04);
  ctx.save(); ctx.globalAlpha = 0.5;
  gearTrain(t, [{ x: 1150, y: 560, z: 36, holes: 6 }, { z: 18, dir: 0.5, holes: 4 }, { z: 28, dir: -1.0, holes: 5 }], { w0: 0.35, m: 13 });
  ctx.restore();
  tag(t, 'REESCRIBIR LAS LEYES DE', M, 330, V(12) + 0.2);
  [['La fricción', V(12) + 1.4], ['El par motor', V(13) + 0.1], ['La electrónica', V(13) + 1.0]].forEach(([w, tt], i) => lines(t, [w], M, 470 + i * 130, 0, 120, tt, { colors: [i === 2 ? COLOR.yellow : COLOR.paper] }));
}

// Patrón en H: la reja junto a la palanca real.
function sGateIntro(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('palancaH', 0, 0, 760, H, { zoom: lerp(1.15, 1.05, ease.out(u)), fx: 0.5, fy: 0.4 }, { vig: 0.3 });
  const seq = ['1', '2', '3', '4', '5'];
  const tt = Math.max(0, t - s0) * 0.55;
  const i = Math.floor(tt) % 4, f = ease.inOut(tt % 1);
  const path = [GATE[seq[i]], [GATE[seq[i]][0], 0], [GATE[seq[i + 1]][0], 0], GATE[seq[i + 1]]];
  drawGate(t, { cx: 1340, cy: 520, s: 1.1, path, p: f, appear: ease.out(prog(t, s0, s0 + 0.8)) });
  tag(t, 'GRUPO 4 Y PRIMEROS GRUPO B', 860, 150, s0 + 0.2);
  lines(t, ['Patrón en «H»'], 860, 260, 0, 100, V(16) + 3.2);
  label(ctx, 'Como en cualquier coche de calle', 860, 340, DIM, prog(t, V(17) + 0.3, V(17) + 0.8), { size: 36, spacing: 0, weight: 600 });
}

// 300, 400 y hasta 500 caballos.
function sPower(t, s0) {
  bg(); dots(0.04);
  tag(t, 'LOS MOTORES EMPEZARON A ESCUPIR', M, 360, s0 + 0.1);
  [['300', V(18) + 2.4, COLOR.steel], ['400', V(19) + 0.1, COLOR.paper], ['500', V(20) + 0.6, COLOR.red]].forEach(([n, tt, col], i) => slam(t, n, M + i * 520, 640, tt, 250, col));
  label(ctx, 'caballos', M, 740, COLOR.paper, prog(t, V(20) + 1.0, V(20) + 1.5), { size: 56, spacing: 0, weight: 700 });
}

// El primer problema: los engranajes.
function sGearsIntro(t, s0) {
  bg(); dots(0.04);
  gearTrain(t, [{ x: 1100, y: 580, z: 40, holes: 6 }, { z: 22, dir: -0.4, holes: 5, mark: true }, { z: 30, dir: 1.15, holes: 6 }], { w0: 0.5, m: 12, appear: ease.out(prog(t, s0, s0 + 0.8)) });
  side(t, 'EL PRIMER PROBLEMA', ['Los engranajes'], V(22) + 1.0, { y: 300, size: 110, maxW: 700 });
}

// Helicoidales: silenciosos, pero con empuje lateral.
function sHelical(t, s0) {
  bg(); dots(0.04);
  drawGearSide(t, { cx: 1260, cy: 540, w: 300, h: 360, helix: 0.5, speed: 1, thrust: prog(t, V(24) + 1.4, V(24) + 2.2), label: 'DIENTES EN DIAGONAL', appear: ease.out(prog(t, s0, s0 + 0.6)) });
  // La carcasa que sufre: grietas cuando el empuje llega al tope.
  const cr = prog(t, V(24) + 3.4, V(24) + 4.4);
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.45)'; ctx.lineWidth = 6; ctx.strokeRect(940, 300, 640, 480); ctx.restore();
  strokePath([[1580, 470], [1560, 500], [1585, 530], [1562, 570], [1580, 600]], cr, COLOR.red, 4);
  side(t, 'LOS COCHES DE CALLE USAN ENGRANAJES', ['Helicoidales'], V(23) + 1.6, { y: 300, size: 110, maxW: 700 });
  label(ctx, 'Silenciosos, pero con un enorme', M, 400, COLOR.paper, prog(t, V(24) - 0.2, V(24) + 0.3), { size: 36, spacing: 0, weight: 600 });
  label(ctx, 'empuje lateral bajo carga', M, 450, COLOR.fire, prog(t, V(24) + 0.6, V(24) + 1.1), { size: 36, spacing: 0, weight: 700 });
}

// Dientes rectos: sin empuje axial, y el aullido.
function sStraight(t, s0) {
  bg(); dots(0.04);
  drawGearSide(t, { cx: 1000, cy: 470, w: 240, h: 300, helix: 0.5, speed: 1.4, thrust: 1, label: 'HELICOIDAL', appear: 0.55 });
  drawGearSide(t, { cx: 1500, cy: 470, w: 240, h: 300, helix: 0, speed: 1.4, thrust: 0, label: 'DIENTES RECTOS', appear: ease.out(prog(t, s0 + 0.3, s0 + 0.9)) });
  // El aullido agudo: una onda de alta frecuencia.
  const k = prog(t, V(27) + 3.4, V(27) + 4.2);
  if (k > 0) {
    const pts = []; for (let i = 0; i <= 400; i++) { const x = 900 + i * 2.1; pts.push([x, 860 + Math.sin(i * 0.9 + t * 30) * 26 * Math.sin(Math.PI * i / 400)]); }
    strokePath(pts, k, COLOR.yellow, 2.5);
    label(ctx, 'EL AULLIDO AGUDO', 1320, 940, COLOR.yellow, k, { size: 22, spacing: 7, weight: 700, align: 'center' });
  }
  side(t, 'LOS INGENIEROS PASARON A LOS', ['Dientes rectos'], V(25) + 1.4, { y: 300, size: 110, maxW: 700 });
  label(ctx, 'Indestructibles', M, 400, COLOR.paper, prog(t, V(26), V(26) + 0.5), { size: 40, spacing: 0, weight: 700 });
  label(ctx, 'Sin empuje axial', M, 460, COLOR.paper, prog(t, V(27) + 0.2, V(27) + 0.7), { size: 40, spacing: 0, weight: 700 });
}

// La caja por dentro: un cambio con sincronizadores.
function sBoxIntro(t, s0) {
  bg(); dots(0.04);
  const ph = (t - s0) % 6;
  const g = ph < 1.5 ? 1 : ph < 3 ? 2 : ph < 4.5 ? 3 : 4;
  const cA = g === 1 ? -1 : g === 2 ? 1 : 0, cB = g === 3 ? -1 : g === 4 ? 1 : 0;
  drawGearbox(t, { cx: 1160, cy: 560, s: 0.82, sel: g, collarA: cA, collarB: cB, kind: 'synchro', flow: 1, labels: prog(t, s0 + 0.6, s0 + 1.4), rpm: 1 });
  side(t, 'EL SEGUNDO PROBLEMA, Y EL MÁS GRAVE', ['Los sincronizadores'], V(30) + 0.1, { y: 170, size: 90, maxW: 1400 });
}

// El sincronizador: un cono de latón que iguala velocidades por fricción.
function sSynchro(t, s0) {
  bg(); dots(0.04);
  const push = osc01(t - s0, 0.3);
  drawSynchro(t, { cx: 1320, cy: 560, s: 1.15, push, heat: 0.25 * push });
  // Velocidades del motor y de la caja que se igualan.
  const m = ease.inOut(push);
  for (const [i, n, v] of [[0, 'MOTOR', lerp(0.9, 0.62, m)], [1, 'CAJA', lerp(0.35, 0.62, m)]]) {
    const y = 760 + i * 70;
    label(ctx, n, M, y + 8, DIM, 1, { size: 22, spacing: 6, weight: 700 });
    ctx.fillStyle = 'rgba(232,233,230,0.12)'; ctx.fillRect(M + 140, y - 12, 460, 18);
    ctx.fillStyle = i ? COLOR.paper : COLOR.red; ctx.fillRect(M + 140, y - 12, 460 * v, 18);
  }
  side(t, 'UN SINCRONIZADOR ES', ['Un cono de latón'], V(31) + 1.0, { y: 340, size: 100, colors: [COLOR.brass], maxW: 760 });
  label(ctx, 'Iguala velocidades por fricción', M, 430, COLOR.paper, prog(t, V(31) + 2.6, V(31) + 3.1), { size: 36, spacing: 0, weight: 600 });
}
function sMelt(t, s0) {
  bg(); dots(0.04);
  const heat = ease.inOut(prog(t, s0 + 0.4, s0 + 3.0)), melt = prog(t, V(33) + 1.0, V(33) + 4.0);
  drawSynchro(t, { cx: 1320, cy: 560, s: 1.15, push: 0.6 + 0.4 * osc01(t - s0, 1.4), heat, melt });
  side(t, 'CON 500 CABALLOS Y CAMBIOS VIOLENTOS', ['La fricción', 'los derretía'], V(33) + 0.6, { y: 420, size: 110, colors: [COLOR.paper, COLOR.fire], maxW: 760 });
}
// Rascaban, saltaban, destruían.
function sClash(t, s0) {
  bg(); dots(0.04);
  const ph = (t - s0) % 1.6;
  drawGearbox(t, { cx: 1160, cy: 560, s: 0.82, sel: 2, collarA: 0.7 + 0.3 * Math.sin(t * 40) * (ph < 0.3 ? 1 : 0), collarB: 0, kind: 'synchro', flow: 0.6, rpm: 1.3, glowSync: 0.6 + 0.4 * Math.sin(t * 9) });
  if (ph < 0.4) shock(1160 - 210 * 0.82, 560 - 150 * 0.82, ph / 0.4, 150);
  [['Rascaban.', V(34) + 0.3], ['Saltaban.', V(35) + 0.2], ['Destruían la transmisión.', V(37) + 0.1]].forEach(([w, tt], i) => lines(t, [w], M, 160 + i * 100, 0, 80, tt, { colors: [i === 2 ? COLOR.red : COLOR.paper], maxW: 900 }));
}

// Crabots: cuatro salientes de acero macizo.
function sDogFace(t, s0) {
  bg(); dots(0.04);
  drawDogRing(1300, 540, 260, t * 0.6, { n: 4 });
  label(ctx, 'DOGS', 1300 + 290, 540 - 230, COLOR.yellow, prog(t, V(43) + 0.2, V(43) + 0.7), { size: 26, spacing: 8, weight: 800 });
  side(t, 'ANILLOS DE ACOPLAMIENTO CON', ['Salientes de', 'acero macizo'], V(42) + 2.6, { y: 420, size: 110, maxW: 640 });
  label(ctx, 'Llamados «dogs»', M, 640, COLOR.yellow, prog(t, V(43) + 0.1, V(43) + 0.6), { size: 44, spacing: 0, weight: 700 });
}
// Mucho espacio libre: el anillo frente a las ventanas del piñón.
function sDogGap(t, s0) {
  bg(); dots(0.04);
  drawDogRing(1000, 540, 230, -t * 0.4, { slots: true });
  drawDogRing(1560, 540, 230, t * 0.4, { n: 4 });
  label(ctx, 'VENTANAS DEL PIÑÓN', 1000, 840, DIM, 1, { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'CRABOT', 1560, 840, COLOR.paper, 1, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'ENTRE ESTOS SALIENTES HAY', ['Muchísimo', 'espacio libre'], V(44) + 0.6, { y: 420, size: 100, maxW: 560 });
}
// El choque: el crabot entra en las ventanas de golpe.
function sDogSlam(t, s0) {
  bg(); dots(0.04);
  const cyc = (t - s0) % 2.2;
  const slide = cyc < 0.8 ? 0 : cyc < 0.95 ? ease.inExpo((cyc - 0.8) / 0.15) : cyc < 1.8 ? 1 : 1 - ease.inOut((cyc - 1.8) / 0.4);
  const P = (x, y) => [x, y];
  // Vista lateral: piñón (derecha) con sus ventanas y crabot (izquierda) que avanza.
  ctx.fillStyle = STEEL_F; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.fillRect(1300, 280, 260, 520); ctx.strokeRect(1300, 280, 260, 520);
  ctx.fillStyle = COLOR.ink; for (const y of [330, 470, 610]) ctx.fillRect(1300, y, 46, 90);
  const xr = lerp(1080, 1196, slide);
  ctx.fillStyle = '#C9CCD0'; ctx.fillRect(xr - 120, 300, 120, 480); ctx.strokeRect(xr - 120, 300, 120, 480);
  ctx.fillStyle = COLOR.paper; for (const y of [345, 485, 625]) ctx.fillRect(xr, y, 46, 60);
  ctx.fillStyle = STEEL_L; ctx.fillRect(820, 525, 920, 30);
  if (cyc > 0.95 && cyc < 1.4) shock(1300, 540, (cyc - 0.95) / 0.45, 260);
  side(t, 'LOS DIENTES DE ACERO', ['Chocan y se', 'encajan'], V(47) + 0.3, { y: 420, size: 110, maxW: 640 });
  label(ctx, 'De forma brutal y violenta', M, 640, COLOR.red, prog(t, V(47) + 2.4, V(47) + 2.9), { size: 40, spacing: 0, weight: 700 });
}
// Descargar el par: levantar, tirar, pisar.
function sUnload(t, s0) {
  bg(); dots(0.04);
  const x0 = 900, y0 = 300, w = 860, h = 420;
  axes(x0, y0, w, h);
  const torque = (u) => (u < 0.3 ? 0.85 : u < 0.36 ? lerp(0.85, 0.1, (u - 0.3) / 0.06) : u < 0.5 ? 0.1 : u < 0.56 ? lerp(0.1, 0.9, (u - 0.5) / 0.06) : 0.9);
  plot(torque, { x0, y0, w, h, color: COLOR.red, draw: ease.inOut(prog(t, s0 + 0.4, s0 + 3.0)) });
  ctx.fillStyle = 'rgba(232,233,230,0.08)'; ctx.fillRect(x0 + w * 0.3, y0, w * 0.26, h);
  label(ctx, 'PAR', x0 + 14, y0 - 16, DIM, 1, { size: 20, spacing: 6, weight: 700 });
  [['LEVANTAR', V(50) + 1.0, 0.33, 0], ['TIRAR', V(51) + 0.1, 0.43, 1], ['PISAR', V(51) + 1.4, 0.53, 2]].forEach(([n, tt, u, i]) => label(ctx, n, x0 + w * u, y0 + h + 44 + i * 34, COLOR.yellow, prog(t, tt, tt + 0.4), { size: 20, spacing: 5, weight: 800, align: 'center' }));
  side(t, 'SOLO TIENE QUE', ['Descargar el par'], V(50) + 3.6, { y: 300, size: 100, maxW: 700 });
}
function axes(x0, y0, w, h, a = 1) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = 'rgba(232,233,230,0.25)'; ctx.fillRect(x0, y0 + h, w, 2); ctx.fillRect(x0, y0 - 10, 2, h + 10); ctx.restore(); }
function plot(fn, { x0, y0, w, h, color, width = 5, draw = 1, n = 200 }) {
  const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([x0 + w * u, y0 + h - h * fn(u)]); }
  strokePath(pts, draw, color, width);
}
// Barras del tiempo de cambio.
const kTimes = (upto, tt) => (t, s0) => {
  bg(); dots(0.04);
  const rows = [['CAMBIO MANUAL CON EMBRAGUE', '0,4 s', 0.4, COLOR.steel], ['DOG BOX', '0,1 s', 0.1, COLOR.paper], ['LEVAS Y CORTE DE ENCENDIDO', 'MENOS DE 50 ms', 0.05, COLOR.red]];
  rows.slice(0, upto).forEach(([n, v, sec, col], i) => {
    const a = ease.out(prog(t, s0 + 0.2 + i * 0.3, s0 + 0.8 + i * 0.3));
    const y = 380 + i * 170, w = 1500 * sec / 0.4;
    label(ctx, n, M, y - 20, DIM, a, { size: 22, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(M, y, w * ease.out(prog(t, s0 + 0.4 + i * 0.3, s0 + 1.2 + i * 0.3)), 50); ctx.restore();
    label(ctx, v, M + w + 30, y + 40, col, a, { size: 40, spacing: 0, weight: 800 });
  });
  tag(t, 'DURACIÓN DE UN CAMBIO', M, 230, s0 + 0.1);
};

// Equivocarse de carril con fuerzas G.
function sGateG(t, s0) {
  bg(); dots(0.04);
  const g = ease.out(prog(t, V(59) + 0.6, V(59) + 1.4));
  const wob = Math.sin(t * 7) * 18 * g;
  drawGate(t, { cx: 1300, cy: 540, s: 1.1, path: [[160 + wob * 0.3, -150], [160 + wob, 0], [0 + wob, 0]], p: ease.inOut(prog(t, V(60), V(60) + 1.4)) });
  if (g > 0) arrow(1650, 540, 1650 - 200 * g, 540, COLOR.fire, 8, 26);
  label(ctx, 'FUERZA G', 1650, 600, COLOR.fire, g, { size: 22, spacing: 7, weight: 700, align: 'center' });
  side(t, 'EL PATRÓN EN «H» TENÍA', ['Un fallo humano', 'crítico'], V(58) + 0.6, { y: 420, size: 100, maxW: 640 });
  label(ctx, 'Equivocarse de carril', M, 640, COLOR.red, prog(t, V(60) + 0.4, V(60) + 0.9), { size: 40, spacing: 0, weight: 700 });
}
// Money shift: de 5ª a 2ª en vez de a 4ª.
function sMoney(t, s0) {
  bg(); dots(0.04);
  drawGate(t, { cx: 1080, cy: 560, s: 1.0, path: ['5', [160, 0], [0, 0], '4'], p: ease.inOut(prog(t, s0 + 0.6, s0 + 2.0)), appear: 0.35 });
  drawGate(t, { cx: 1080, cy: 560, s: 1.0, path: ['5', [160, 0], [-160, 0], '2'], p: ease.inOut(prog(t, V(61) + 1.2, V(61) + 2.8)), wrong: 1, appear: 1 });
  const rpm = lerp(0.55, 1.25, ease.inExpo(prog(t, V(61) + 2.6, V(62) + 1.2)));
  arcGauge(t, 1610, 560, 190, Math.min(rpm, 1.25), 1.0, ease.out(prog(t, s0 + 0.3, s0 + 0.9)), 10, rpm > 0.9 ? COLOR.red : COLOR.paper);
  label(ctx, 'REVOLUCIONES', 1610, 800, DIM, 1, { size: 22, spacing: 6, weight: 700, align: 'center' });
  if (rpm > 1.15) shock(1610, 560, prog(t, V(62) + 1.0, V(62) + 1.8), 260);
  side(t, 'DE 5ª A 2ª EN LUGAR DE A 4ª', ['Money Shift'], V(61) + 3.4, { y: 300, size: 120, colors: [COLOR.red], maxW: 640 });
  label(ctx, 'Decenas de miles de dólares', M, 380, COLOR.paper, prog(t, V(63) + 0.3, V(63) + 0.8), { size: 36, spacing: 0, weight: 600 });
}
// La palanca secuencial: tirar para subir, empujar para reducir.
function sSeq(t, s0) {
  bg(); dots(0.04);
  const cyc = (t - s0) % 3, k = cyc < 1.5 ? -Math.sin(Math.PI * cyc / 1.5) : Math.sin(Math.PI * (cyc - 1.5) / 1.5);
  const gear = clamp(3 + Math.floor((t - s0) / 1.5) % 2 * 0 + (cyc < 1.5 ? (cyc > 0.75 ? 1 : 0) : 0), 1, 6);
  const px = 1300, py = 760;
  ctx.save(); ctx.translate(px, py); ctx.rotate(k * 0.35);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -380); ctx.stroke();
  ctx.fillStyle = COLOR.red; ctx.beginPath(); ctx.roundRect(-34, -460, 68, 110, 20); ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLOR.ink2; ctx.beginPath(); ctx.arc(px, py, 40, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; ctx.stroke();
  label(ctx, 'TIRAR · SUBE', px - 280, 360, COLOR.paper, prog(t, V(68), V(68) + 0.4), { size: 24, spacing: 6, weight: 800, align: 'center' });
  label(ctx, 'EMPUJAR · REDUCE', px + 300, 360, COLOR.paper, prog(t, V(69), V(69) + 0.4), { size: 24, spacing: 6, weight: 800, align: 'center' });
  const ga = ease.out(prog(t, V(70) + 0.6, V(70) + 1.4));
  if (ga > 0) { arrow(px - 120, 560, px - 120 - 180 * ga, 560, COLOR.fire, 8, 24); label(ctx, 'FUERZAS G', px - 210, 620, COLOR.fire, ga, { size: 22, spacing: 6, weight: 700, align: 'center' }); }
  side(t, 'LA PALANCA DEJÓ DE MOVERSE EN H', ['Atrás y adelante'], V(67) + 2.6, { y: 300, size: 100, maxW: 700 });
}
// El tambor desmodrómico.
function sDrum(t, s0, s1, { zoom = 1, pos = null, flat = 1, tagStr, title, tt, lab, labT } = {}) {
  bg(); dots(0.04);
  const p = pos ?? 0;
  // El punto (1290, 470) del tambor se queda en pantalla en (1300, 500) aunque la cámara se acerque.
  camera(1290 - 340 / zoom, 470 + 40 / zoom, zoom, () => drawDrum(t, { cx: 1290, cy: 470, s: 1.0, pos: p, appear: ease.out(prog(t, s0, s0 + 0.8)), flat }));
  if (zoom > 1.05) scrim(800, 0.88);
  side(t, tagStr, title, tt, { y: 380, size: 100, maxW: 640, label: lab, labelT: labT });
}
const stepPos = (t, t0, every = 1.4, from = 1, to = 5) => { const k = Math.max(0, (t - t0) / every); const i = Math.floor(k), f = k - i; return clamp(from + i + ease.inOut(clamp((f - 0.6) / 0.4)), from, to); };

// Cadena electrohidráulica.
function sChain(t, s0) {
  bg(); dots(0.04);
  const pulse = ((t - s0 - 0.6) % 2.4) * 2.4;
  drawActuation(t, { x0: 860, y: 600, appear: ease.out(prog(t, s0, s0 + 0.6)), pulse: t > s0 + 0.6 ? pulse : -1 });
  side(t, 'PERO LA VERDADERA MAGIA OCURRE EN', ['La centralita', 'electrónica'], V(84) + 1.4, { y: 380, size: 100, maxW: 640 });
}
function sCut(t, s0) {
  bg(); dots(0.04);
  drawShiftTrace(t, { x0: 860, y0: 220, w: 920, h: 620, draw: ease.inOut(prog(t, s0 + 0.4, V(86) + 2.0)) });
  side(t, 'CON EL ACELERADOR A FONDO', ['Corte de', 'encendido'], V(86) + 0.4, { y: 400, size: 110, maxW: 640, colors: [COLOR.paper, COLOR.red] });
  label(ctx, '30 o 40 milisegundos', M, 620, COLOR.paper, prog(t, V(86) + 6.8, V(86) + 7.3), { size: 40, spacing: 0, weight: 700 });
}
// El actuador empuja el tambor con 150 bares.
function sHydraulic(t, s0) {
  bg(); dots(0.04);
  const cyc = (t - s0) % 2.8;
  const push = cyc < 0.5 ? 0 : cyc < 0.62 ? ease.inExpo((cyc - 0.5) / 0.12) : cyc < 1.6 ? 1 : 1 - ease.inOut((cyc - 1.6) / 0.6);
  // Cilindro hidráulico.
  const ax = 960;
  ctx.fillStyle = 'rgba(127,180,221,0.3)'; ctx.fillRect(ax, 610, 260 * (0.3 + 0.7 * push), 120);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; ctx.strokeRect(ax, 600, 360, 140);
  ctx.fillStyle = '#D9DBDE'; ctx.fillRect(ax + 260 * (0.3 + 0.7 * push), 610, 24, 120);
  ctx.fillStyle = STEEL_L; ctx.fillRect(ax + 24 + 260 * (0.3 + 0.7 * push), 660, 200, 20);
  arcGauge(t, ax + 180, 420, 100, 150 * (0.2 + 0.8 * push), 180, 1, 9, HYD);
  label(ctx, '150 bar', ax + 180, 450, HYD, 1, { size: 30, spacing: 1, weight: 800, align: 'center' });
  // Tambor que gira un detente con cada empujón.
  const k = Math.floor((t - s0) / 2.8);
  drawDrum(t, { cx: 1600, cy: 680, s: 0.55, pos: clamp(2 + k + push, 1, 6), flat: 0, forks: 1 });
  if (cyc > 0.62 && cyc < 1.0) shock(1600, 680, (cyc - 0.62) / 0.38, 200);
  side(t, 'EL ACTUADOR HIDRÁULICO EMPUJA EL TAMBOR', ['150 bares'], V(88) + 2.6, { y: 380, size: 120, colors: [HYD], maxW: 600 });
  label(ctx, 'La marcha entra de un golpe violento', M, 480, COLOR.paper, prog(t, V(89) + 0.2, V(89) + 0.7), { size: 34, spacing: 0, weight: 600 });
  label(ctx, 'y el motor vuelve a encenderse', M, 530, COLOR.paper, prog(t, V(90) + 0.2, V(90) + 0.7), { size: 34, spacing: 0, weight: 600 });
}

// La caja como cerebro de la tracción total: planta con caja transversal y diferenciales.
function sPlanBox(t, s0) {
  bg(); dots(0.04);
  const cx = 1250, cy = 560, s = 0.8;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2); ctx.scale(s, s);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3 / s; trace(ctx, body(0.15), 1);
  ctx.globalAlpha = 0.4; trace(ctx, CABIN, 1); ctx.globalAlpha = 1;
  // Motor y caja transversales en una sola carcasa con el diferencial delantero y el central.
  ctx.fillStyle = COLOR.ink2; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3 / s;
  ctx.beginPath(); ctx.roundRect(330, -140, 110, 220, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(233,168,37,0.15)'; ctx.strokeStyle = COLOR.yellow;
  ctx.beginPath(); ctx.roundRect(220, -40, 110, 200, 12); ctx.fill(); ctx.stroke();
  const dA = ease.out(prog(t, V(101) + 0.6, V(101) + 1.2)), dC = ease.out(prog(t, V(101) + 2.2, V(101) + 2.8));
  ctx.fillStyle = COLOR.ink;
  ctx.globalAlpha = dA; ctx.strokeStyle = COLOR.paper; ctx.beginPath(); ctx.arc(290, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = dC; ctx.strokeStyle = COLOR.red; ctx.beginPath(); ctx.arc(250, 110, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  // Par a las cuatro ruedas.
  const fl = prog(t, s0 + 0.8, s0 + 1.6);
  ctx.save(); ctx.globalAlpha = fl; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 7 / s; ctx.setLineDash([22, 18]); ctx.lineDashOffset = -t * 260;
  ctx.beginPath(); ctx.moveTo(290, -226); ctx.lineTo(290, 226); ctx.moveTo(250, 110); ctx.lineTo(-315, 110); ctx.lineTo(-315, 0); ctx.moveTo(-315, -226); ctx.lineTo(-315, 226); ctx.stroke(); ctx.restore();
  for (const [x, y] of [[290, -226], [290, 226], [-315, -226], [-315, 226]]) { ctx.fillStyle = COLOR.ink; ctx.beginPath(); ctx.roundRect(x - 75, y - 30, 150, 60, 14); ctx.fill(); ctx.strokeStyle = COLOR.paper; ctx.stroke(); }
  ctx.restore();
  label(ctx, 'DIFERENCIAL DELANTERO', cx + 260, cy - 240, COLOR.paper, dA, { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'DIFERENCIAL CENTRAL ACTIVO', cx + 260, cy - 170, COLOR.red, dC, { size: 22, spacing: 6, weight: 700 });
  side(t, 'EN EL WRC MODERNO, LA CAJA ES TRANSVERSAL', ['El cerebro de', 'la tracción total'], V(99) + 2.4, { y: 400, size: 96, maxW: 640 });
}
// Más baja y más cerca del piloto: el centro de gravedad.
function sLowCG(t, s0) {
  bg(); dots(0.04);
  const k = ease.inOut(prog(t, V(104) - 0.2, V(105) + 2.0));
  ctx.fillStyle = 'rgba(232,233,230,0.3)'; ctx.fillRect(820, 820, 980, 2);
  // Perfil esquemático: carrocería, piloto y caja que baja y se acerca.
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(860, 760); ctx.lineTo(860, 600); ctx.lineTo(1020, 560); ctx.lineTo(1200, 440); ctx.lineTo(1500, 430); ctx.lineTo(1700, 560); ctx.lineTo(1760, 620); ctx.lineTo(1760, 760); ctx.closePath(); ctx.stroke();
  for (const x of [960, 1640]) { ctx.fillStyle = COLOR.ink; ctx.beginPath(); ctx.arc(x, 760, 60, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(1320, 520, 30, 0, Math.PI * 2); ctx.stroke(); // casco del piloto
  ctx.fillStyle = COLOR.ink2; ctx.strokeStyle = COLOR.paper; ctx.beginPath(); ctx.roundRect(1590, 560, 120, 120, 10); ctx.fill(); ctx.stroke(); // motor
  const bx = lerp(1610, 1460, k), by = lerp(500, 660, k), bw = lerp(110, 90, k), bh = lerp(110, 80, k);
  ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.25 * k);
  ctx.fillStyle = 'rgba(233,168,37,0.2)'; ctx.strokeStyle = COLOR.yellow; ctx.fillRect(-bw / 2, -bh / 2, bw, bh); ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.restore();
  // Centro de gravedad.
  const gx = lerp(1320, 1300, k), gy = lerp(600, 655, k);
  ctx.save(); ctx.translate(gx, gy); ctx.fillStyle = COLOR.red;
  for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 18, q * Math.PI / 2, (q + 1) * Math.PI / 2); ctx.closePath(); if (q % 2 === 0) ctx.fill(); }
  ctx.strokeStyle = COLOR.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  label(ctx, 'CENTRO DE GRAVEDAD', gx, gy + 60, COLOR.red, prog(t, s0 + 0.6, s0 + 1.1), { size: 20, spacing: 6, weight: 700, align: 'center' });
  [['Reubicaron', V(104)], ['Inclinaron', V(105)], ['Miniaturizaron', V(105) + 1.0]].forEach(([w, tt], i) => label(ctx, w, M, 520 + i * 60, COLOR.yellow, prog(t, tt, tt + 0.4), { size: 40, spacing: 0, weight: 700 }));
  side(t, 'LA OBSESIÓN POR EL CENTRO DE GRAVEDAD', ['Lo más bajo', 'y cerca del piloto'], V(105) + 3.0, { y: 300, size: 90, maxW: 640 });
}
function sInertiaShot(t, s0) {
  bg(); dots(0.04);
  drawInertia(t, s0, { cx: 1300, cy: 500, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  side(t, 'ESTO REDUCE EL', ['Momento de', 'inercia polar'], V(106) + 0.4, { y: 400, size: 100, maxW: 560 });
  label(ctx, 'Como una bailarina sobre hielo', M, 640, COLOR.paper, prog(t, V(108) + 4.2, V(108) + 4.7), { size: 36, spacing: 0, weight: 600 });
}
// Rally1: lo que se prohibió.
function sBanned(t, s0) {
  bg(); dots(0.04);
  const items = [['LEVAS ELECTROHIDRÁULICAS', V(114) + 0.6], ['DIFERENCIAL CENTRAL ACTIVO', V(114) + 3.0]];
  items.forEach(([n, tt], i) => {
    const y = 560 + i * 160, a = ease.out(prog(t, tt, tt + 0.5));
    label(ctx, n, 900, y, COLOR.paper, a, { size: 52, spacing: 2, weight: 800 });
    const k = ease.inOut(prog(t, V(114) + 4.6 + i * 0.3, V(114) + 5.2 + i * 0.3));
    ctx.save(); ctx.font = FONT.text(800, 52); ctx.letterSpacing = '2px'; const w = ctx.measureText(n).width; ctx.restore();
    ctx.fillStyle = COLOR.red; ctx.fillRect(890, y - 22, (w + 20) * k, 8);
  });
  side(t, 'RALLY1 · 2022', ['Recortes', 'de costes'], V(113) + 0.4, { y: 420, size: 110, maxW: 560 });
  label(ctx, 'Prohibidos', M, 640, COLOR.red, prog(t, V(114) + 5.0, V(114) + 5.4), { size: 44, spacing: 0, weight: 800 });
}
// Siguen ahí: piñones rectos, crabots y tambor.
function sStill(t, s0) {
  bg(); dots(0.04);
  const a1 = ease.out(prog(t, V(118), V(118) + 0.5)), a2 = ease.out(prog(t, V(119), V(119) + 0.5)), a3 = ease.out(prog(t, V(119) + 2.6, V(119) + 3.1));
  if (a1 > 0) gearTrain(t, [{ x: 420, y: 520, z: 24, holes: 4 }, { z: 16, dir: 0.5, holes: 3 }], { w0: 0.8, m: 12, appear: a1 });
  if (a2 > 0) drawDogRing(960, 540, 170, t * 0.6, { alpha: a2 });
  if (a3 > 0) drawDrum(t, { cx: 1480, cy: 540, s: 0.5, pos: 1 + ((t - s0) * 0.4) % 4, flat: 0, forks: 0, appear: a3 });
  [['ENGRANAJES RECTOS', 450, a1], ['CRABOTS', 960, a2], ['TAMBOR DE PRECISIÓN', 1480, a3]].forEach(([n, x, a]) => label(ctx, n, x, 820, COLOR.paper, a, { size: 22, spacing: 6, weight: 700, align: 'center' }));
  tag(t, 'BAJO ESA APARIENCIA ANALÓGICA', W / 2, 200, s0 + 0.2, COLOR.yellow, { align: 'center' });
  revealText(ctx, 'Siguen ahí', W / 2, 330, FONT.display(800, 110), COLOR.paper, prog(t, V(119) + 3.4, V(119) + 4.0), { align: 'center' });
}
// 100 kW eléctricos: par instantáneo.
function sElectric(t, s0) {
  bg(); dots(0.04);
  const x0 = 900, y0 = 300, w = 860, h = 420;
  axes(x0, y0, w, h);
  plot((u) => (u < 0.55 ? 0.92 : 0.92 * 0.55 / u), { x0, y0, w, h, color: HYD, draw: ease.inOut(prog(t, s0 + 0.4, s0 + 2.2)) });
  plot((u) => 0.15 + 0.7 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.75), { x0, y0, w, h, color: COLOR.steel, width: 3, draw: ease.inOut(prog(t, s0 + 0.8, s0 + 2.6)) });
  label(ctx, 'MOTOR ELÉCTRICO', x0 + 30, y0 + 20, HYD, prog(t, s0 + 1.0, s0 + 1.5), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'MOTOR DE COMBUSTIÓN', x0 + w * 0.6, y0 + h * 0.55, COLOR.steel, prog(t, s0 + 1.6, s0 + 2.1), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'PAR', x0 + 14, y0 - 16, DIM, 1, { size: 20, spacing: 6, weight: 700 });
  label(ctx, 'RÉGIMEN', x0 + w, y0 + h + 44, DIM, 1, { size: 20, spacing: 6, weight: 700, align: 'right' });
  side(t, 'ACOPLADOS A MOTORES ELÉCTRICOS DE', ['100 kW'], V(120) + 1.6, { y: 380, size: 140, colors: [HYD], maxW: 600 });
  label(ctx, 'Par instantáneo a los ejes', M, 480, COLOR.paper, prog(t, V(120) + 3.4, V(120) + 3.9), { size: 36, spacing: 0, weight: 600 });
}
// Nacieron para sobrevivir…
function sRecap(t, s0) {
  bg(); dots(0.04);
  [['Sobrevivir', V(121) + 1.6], ['Ahorrar milésimas', V(122) + 0.7], ['Moldear la conducción al límite', V(122) + 3.6]].forEach(([w, tt], i) => lines(t, [w], M, 360 + i * 150, 0, 120, tt, { colors: [i === 2 ? COLOR.red : COLOR.paper], maxW: 1600 }));
  drawEras(t, 4, ease.out(prog(t, s0 + 0.4, s0 + 1.4)));
}
// Cierre: logotipo y suscripción.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 720, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = la; ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h); ctx.restore();
  pill(t, 'Suscríbete', W / 2, 740, V(126) - 0.2, { press: V(126) + 0.5, color: COLOR.red, size: 42 });
  label(ctx, '¿Qué tecnología te parece más brutal?', W / 2, 880, DIM, prog(t, V(127) + 0.4, V(127) + 0.9), { size: 42, spacing: 0, weight: 600, align: 'center' });
  label(ctx, 'Nos vemos en el próximo análisis', W / 2, 960, COLOR.paper, prog(t, V(127) + 3.4, V(127) + 3.9), { size: 44, spacing: 0, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, sIntro, 'dissolve'],
  [cut(2), sSteps, 'whip'],
  [cut(5), (t, s0) => { bg(); dots(0.04); tag(t, 'CADA CAMBIO TOMA UNOS', M, 380, s0 + 0.1); slam(t, '0,4', M, 660, V(5) + 0.8, 300, COLOR.paper); label(ctx, 'segundos', M, 760, COLOR.paper, prog(t, V(5) + 1.2, V(5) + 1.7), { size: 56, spacing: 0, weight: 700 }); }, 'cut'],
  [cut(6), s300, 'slices'],
  [cut(7), kType({ tag: 'UN PILOTO PERDERÍA', title: ['Más de 10 minutos'], tt: V(7) + 2.6, size: 170, colors: [COLOR.red], label: 'solo cambiando de marcha', labelT: V(7) + 4.0 }), 'cube'],
  [cut(8), kType({ tag: 'EN EL AUTOMOVILISMO, 10 MINUTOS ES', title: ['Una eternidad.'], tt: V(9) + 0.6, size: 190 }), 'dissolve'],
  [cut(10), kClip({ seg: 't16', speed: 0.45, fx: 0.5, fy: 0.5, tag: 'DEL GRUPO B AL WRC', tagT: V(10) + 3.0, title: ['Una guerra', 'de ingeniería'], tt: V(10) + 4.0, size: 130 }), 'whip'],
  [cut(11), sThree, 'dissolve'],
  [cut(14), kPhoto3({ img: 'cajaCorte', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.03], dark: 0.3, tag: 'HOY VAMOS A ABRIR', tagT: V(14) + 0.3, title: ['Las carcasas más', 'extremas del mundo'], tt: V(14) + 1.6, size: 110 }), 'cube'],
  [cut(15), kChapter({ img: 'alpineA110', fx: 0.6, fy: 0.5, era: 0, tag: 'FINALES DE LOS 70 Y PRINCIPIOS DE LOS 80', title: ['La caja en «H»'], tt: V(15) + 1.0 }), 'wipe'],
  [cut(16), sGateIntro, 'dissolve'],
  [cut(18), sPower, 'whip'],
  [cut(21), kType({ tag: 'LA CAJA TRADICIONAL SE CONVIRTIÓ EN', title: ['El eslabón débil'], tt: V(21) + 1.4, size: 170, colors: [COLOR.red] }), 'cut'],
  [cut(22), sGearsIntro, 'cubeV'],
  [cut(23), sHelical, 'slices'],
  [cut(25), sStraight, 'dissolve'],
  [cut(28), sBoxIntro, 'cube'],
  [cut(31), sSynchro, 'dissolve'],
  [cut(32), sMelt, 'cut'],
  [cut(34), sClash, 'whip'],
  [cut(38), kType({ title: ['Había que amputar', 'el problema de raíz'], tt: V(38) + 0.2, size: 140, colors: [COLOR.paper, COLOR.red] }), 'dissolve'],
  [cut(39), kChapter({ img: 'trenEngranajes', fx: 0.5, fy: 0.5, z: [1.3, 1.15], era: 1, tag: 'ELIMINANDO LOS SINCRONIZADORES', title: ['La Dog Box'], tt: V(40) + 1.6, label: 'o caja de crabots', labelT: V(40) + 2.8 }), 'wipe'],
  [cut(41), sDogFace, 'cubeV'],
  [cut(44), sDogGap, 'dissolve'],
  [cut(45), kClip({ seg: 'onB', from: 2.6, speed: 0.6, fx: 0.5, fy: 0.6, tag: 'CUANDO EL PILOTO TIRA DE LA PALANCA', tagT: V(45) + 0.2, title: ['No hay una', 'transición suave'], tt: V(46) + 0.1, size: 120 }), 'whip'],
  [cut(47), sDogSlam, 'cut'],
  [cut(48), kType({ tag: '¿LA VENTAJA?', title: ['Indestructible'], tt: V(49) + 0.5, size: 190, label: 'Sin embrague para subir de marcha', labelT: V(49) + 3.0 }), 'dissolve'],
  [cut(50), sUnload, 'slices'],
  [cut(52), kTimes(2), 'cube'],
  [cut(53), kPhoto3({ img: 'transmision4x4', fx: 0.5, fy: 0.5, yaw: [0.05, -0.02], dark: 0.3, tag: 'UN IMPACTO COLOSAL EN EL TREN MOTRIZ', tagT: V(53) + 0.2, title: ['Ejes de acero forjado'], tt: V(54) + 1.2, size: 120 }), 'dissolve'],
  [cut(55), kPhoto({ img: 'lanciaTrio', fx: 0.5, fy: 0.5, z: [1.12, 1.04], dark: 0.4, tag: 'EN EL GRUPO B Y EL GRUPO A', title: ['Salvó campeonatos'], tt: V(56) + 0.4, size: 150 }), 'slices'],
  [cut(57), sGateG, 'wipe'],
  [cut(61), sMoney, 'cut'],
  [cut(64), kChapter({ img: 'cajaSecuencial', fx: 0.5, fy: 0.5, era: 2, tag: 'A MEDIADOS DE LOS 90', title: ['La caja secuencial'], tt: V(66) - 0.1, label: 'La ingeniería de las motocicletas', labelT: V(65) + 0.4 }), 'wipe'],
  [cut(67), sSeq, 'cubeV'],
  [cut(71), (t, s0, s1) => sDrum(t, s0, s1, { pos: 1 + 0.15 * Math.sin((t - s0) * 0.8), tagStr: 'LA PALANCA ESTÁ CONECTADA A UN', title: ['Tambor', 'desmodrómico'], tt: V(72) + 2.4, lab: 'o barrilete', labT: V(72) + 5.0, flat: 0 }), 'dissolve'],
  [cut(73), (t, s0, s1) => sDrum(t, s0, s1, { zoom: lerp(1.0, 1.6, ease.inOut(prog(t, s0, s0 + 3))), pos: 1 + 0.15 * Math.sin((t - s0) * 0.8), tagStr: 'SURCOS MECANIZADOS CON', title: ['Precisión', 'micrométrica'], tt: V(73) + 1.6, flat: 0 }), 'cut'],
  [cut(74), (t, s0, s1) => sDrum(t, s0, s1, { pos: stepPos(t, s0 + 0.6, 1.5, 1, 5), tagStr: 'AL TIRAR, EL TAMBOR GIRA UNOS GRADOS', title: ['Exactamente a la', 'marcha siguiente'], tt: V(76) + 1.6 }), 'dissolve'],
  [cut(77), kType({ title: ['Imposible saltarse', 'una marcha'], tt: V(77) + 1.0, size: 150, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(78), kChapter({ img: 'peugeot206', fx: 0.4, fy: 0.5, era: 3, tag: 'WORLD RALLY CAR · 1997', title: ['De la mecánica', 'a la mecatrónica'], tt: V(79) + 0.4 }), 'wipe'],
  [cut(80), kType({ tag: 'LOS INGENIEROS SE PREGUNTARON', title: ['¿Y si cambiamos de marcha', 'sin soltar el acelerador?'], tt: V(81) + 0.2, size: 110, colors: [COLOR.paper, COLOR.yellow] }), 'dissolve'],
  [cut(82), kSplit({ img: 'levas', side: 'left', fx: 0.5, fy: 0.5, tag: 'ACTUADORES ELECTROHIDRÁULICOS', title: ['Una pequeña leva', 'en el volante'], tt: V(83) + 0.2, size: 110 }), 'cube'],
  [cut(84), sChain, 'dissolve'],
  [cut(85), sCut, 'slices'],
  [cut(87), sHydraulic, 'cube'],
  [cut(91), kTimes(3), 'dissolve'],
  [cut(92), kClip({ seg: 'onA', from: 0.5, speed: 0.75, fx: 0.5, fy: 0.55, tag: 'EL PILOTO NUNCA LEVANTA EL PIE', tagT: V(92) + 0.2, title: ['Potencia continua', 'e ininterrumpida'], tt: V(93) + 0.4, size: 120 }), 'whip'],
  [cut(95), kPhoto3({ img: 'cajaRender', fx: 0.5, fy: 0.5, yaw: [-0.05, 0.02], dark: 0.35, tag: 'UNA CAJA DE WRC ES', tagT: V(95) + 2.6, title: ['El corazón del', 'equilibrio dinámico'], tt: V(96) + 0.4, size: 110 }), 'wipe'],
  [cut(97), kPhoto({ img: 'cajasExpo', fx: 0.5, fy: 0.5, z: [1.12, 1.04], dark: 0.4, tag: 'XTRAC · RICARDO', title: ['Aluminio y magnesio', 'ultraligero'], tt: V(97) + 3.6, size: 120 }), 'slices'],
  [cut(98), sPlanBox, 'cubeV'],
  [cut(102), sLowCG, 'dissolve'],
  [cut(106), sInertiaShot, 'cube'],
  [cut(109), kClip({ seg: 'aerial', speed: 0.4, fx: 0.5, fy: 0.5, tag: 'LA CAJA DE CAMBIOS DEFINE', tagT: V(109) + 3.4, title: ['La agilidad pura'], tt: V(109) + 4.4, size: 140 }), 'dissolve'],
  [cut(110), kChapter({ img: 'yarisRally1', fx: 0.5, fy: 0.5, era: 4, tag: 'EN EL AUTOMOVILISMO', title: ['El reglamento', 'manda'], tt: V(111) + 0.8 }), 'wipe'],
  [cut(112), sBanned, 'dissolve'],
  [cut(115), kPhoto3({ img: 'cabinaWRC', fx: 0.6, fy: 0.5, yaw: [0.05, -0.02], dark: 0.35, tag: 'UN PASO ATRÁS EN EL TIEMPO', tagT: V(115) + 0.6, title: ['Una inmensa palanca', 'secuencial mecánica'], tt: V(115) + 3.4, size: 110 }), 'slices'],
  [cut(116), sStill, 'dissolve'],
  [cut(120), sElectric, 'cube'],
  [cut(121), sRecap, 'dissolve'],
  [cut(123), kClip({ seg: 'onB', from: 0.0, speed: 0.65, fx: 0.5, fy: 0.55, tag: 'LA PRÓXIMA VEZ QUE ESCUCHES UN CAMBIO DE MARCHA', tagT: V(123) + 0.4, title: ['40 años de pura', 'guerra de ingeniería'], tt: V(124) + 1.2, size: 120 }), 'whip'],
  [cut(125), sChannel, 'wipe'],
];

// Ventanas de uso de cada tramo de archivo: para cargar sus fotogramas y para que la mezcla
// coloque el sonido real del coche (y baje la música) mientras se ven.
export const CLIP_USE = (() => {
  const out = [];
  SHOTS.forEach(([s0, fn], i) => {
    const s1 = SHOTS[i + 1]?.[0] ?? DURATION;
    if (fn.seg) out.push([s0 - 0.6, s1 + 0.6, fn.seg, s0, s1, fn.from ?? 0, fn.speed ?? 1]);
  });
  return out;
})();
// ---------------------------------------------------------------------------
// Montaje.

function toLayer(name, fn) {
  const L = layers[name];
  const prev = ctx;
  ctx = L.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  fn();
  ctx = prev;
  return L;
}

function whip(t, t0, A_, B_, vertical = false) {
  const p = prog(t, t0 - 0.12, t0 + 0.12);
  const e = ease.inOutExpo(p);
  const a = toLayer('a', A_), b = toLayer('b', B_);
  const v = Math.sin(Math.PI * p) * 420;
  const S = vertical ? H : W;
  ctx.save();
  if (vertical) {
    ctx.translate(0, -S * e); smear(ctx, a, 0, v, 24); ctx.translate(0, S); smear(ctx, b, 0, v, 24);
  } else {
    ctx.translate(-S * e, 0); smear(ctx, a, v, 0, 24); ctx.translate(S, 0); smear(ctx, b, v, 0, 24);
  }
  ctx.restore();
}

function slices(t, t0, A_, B_) {
  B_();
  const a = toLayer('a', A_);
  const n = 6, w = W / n;
  for (let i = 0; i < n; i++) {
    const p = ease.inExpo(prog(t, t0 + i * 0.03, t0 + i * 0.03 + 0.34));
    if (p >= 1) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * w, 0, w + 1, H);
    ctx.clip();
    ctx.drawImage(a, 0, -H * 1.05 * p);
    ctx.restore();
  }
}

function dissolve(t, t0, dur, A_, B_) {
  A_();
  const b = toLayer('b', B_);
  ctx.save();
  ctx.globalAlpha = ease.inOut(prog(t, t0, t0 + dur));
  ctx.drawImage(b, 0, 0);
  ctx.restore();
}

const WIN = { whip: [0.12, 0.12], whipV: [0.12, 0.12], wipe: [0.25, 0.25], slices: [0.2, 0.2], dissolve: [0.35, 0.35], cube: [0.22, 0.22], cubeR: [0.22, 0.22], cubeV: [0.22, 0.22], fly: [0.2, 0.2] };

function shotAt(k, t) {
  const [s0, fn] = SHOTS[k];
  const s1 = SHOTS[k + 1]?.[0] ?? DURATION;
  return () => fn(t, s0, s1);
}

function compose(t) {
  let i = 0;
  while (i < SHOTS.length - 1 && t >= SHOTS[i + 1][0]) i++;
  for (const k of [i, i + 1]) {
    if (k <= 0 || k >= SHOTS.length) continue;
    const t0 = SHOTS[k][0];
    const type = SHOTS[k][2] ?? 'cut';
    if (type === 'cut') continue;
    const [b0, b1] = WIN[type];
    if (t >= t0 - b0 && t < t0 + b1) {
      const prev = shotAt(k - 1, t), next = shotAt(k, t);
      if (type === 'whip') return whip(t, t0, prev, next);
      if (type === 'whipV') return whip(t, t0, prev, next, true);
      if (type === 'wipe') return stripeWipe(ctx, prog(t, t0 - b0, t0 + b1), prev, next);
      if (type === 'slices') return slices(t, t0 - b0, prev, next);
      if (type === 'dissolve') return dissolve(t, t0 - b0, b0 + b1, prev, next);
      if (type === 'cube') return cube(t, t0, prev, next, false, 1);
      if (type === 'cubeR') return cube(t, t0, prev, next, false, -1);
      if (type === 'cubeV') return cube(t, t0, prev, next, true, 1);
      if (type === 'fly') return fly(t, t0, prev, next);
    }
  }
  return shotAt(i, t)();
}


// ---------------------------------------------------------------------------
// Golpes de cámara: solo en los momentos en que rompe la música.
// Golpes de cámara suaves solo en los cambios de época.
const SEC = Object.fromEntries(SECTIONS.map((x) => [x.name, x.start]));
export const HITS = [cut(15), cut(39), cut(64), cut(78), cut(110)];
const SHAKES = [];

export function seek(main, t) {
  ctx = main.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, W, H);
  const z = 1 + punch(t, HITS, 0.015, 6.5);
  let sx = 0, sy = 0;
  for (const h of SHAKES) {
    if (t >= h && t < h + 0.7) {
      const k = Math.exp(-(t - h) * 8) * 12;
      sx += noise1((t - h) * 40 + h) * k;
      sy += noise1((t - h) * 40 + h + 77) * k;
    }
  }
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  compose(t);
  ctx.restore();
  const fout = ease.inOut(prog(t, DURATION - 0.8, DURATION));
  if (fout > 0) {
    ctx.fillStyle = `rgba(11,12,14,${fout})`;
    ctx.fillRect(0, 0, W, H);
  }
  grain(ctx, t, 0.06);
}

export function init(assets) {
  A = assets;
  A.clips = A.clips ?? {};
  for (const k of ['type', 'a', 'b', 'p']) layers[k] = makeCanvas();
  layers.gray = {};
}

export const SHOT_STARTS = SHOTS.map((s) => s[0]);
export const SHOT_TRANS = SHOTS.map((s) => [s[0], s[2] ?? 'cut']);
