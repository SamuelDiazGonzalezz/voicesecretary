// Promo vertical del canal EVO HERITAGE. Todo depende solo de `t`.
import { W, H, V, cut, DURATION, CLIP, SECTIONS } from './timeline.js';
const SECTIONS_AT = Object.fromEntries(SECTIONS.map((s) => [s.name, s.start]));
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES,
} from './lib.js';

let A; // imágenes cargadas
let ctx;
const layers = {};
const M = GRID.m;
const DIM = 'rgba(236,239,242,0.7)';

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
// Utilidades de plano.

const span = (t, s0, s1) => prog(t, s0 - 0.3, s1 + 0.3);
const snap = (x) => Math.floor(x / 0.25) * 0.25;

function grayOf(key) {
  if (!layers.gray[key]) {
    const im = A[key];
    const c = makeCanvas(im.width, im.height);
    const g = c.getContext('2d');
    g.filter = 'grayscale(1) contrast(1.05)';
    g.drawImage(im, 0, 0);
    layers.gray[key] = c;
  }
  return layers.gray[key];
}

// Sombra inferior neutra para que el texto se lea sobre la foto.
function scrimB(h = 1000, a = 0.88) {
  const g = ctx.createLinearGradient(0, H - h, 0, H);
  g.addColorStop(0, 'rgba(11,13,16,0)');
  g.addColorStop(1, `rgba(11,13,16,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, H - h, W, h);
}

// Titular vertical: etiqueta y líneas, alineado a la rejilla izquierda.
function head2(t, o) {
  const size = o.size ?? 190;
  const lead = size * 0.98;
  const n = o.title.length;
  const y0 = o.y0 ?? 1700 - (n - 1) * lead;
  if (o.tag) tag(t, o.tag, o.x ?? M, y0 - size - 30, o.tagT ?? o.tt - 0.15, o.tagColor ?? COLOR.yellow, { align: o.align ?? 'left', size: 30 });
  lines(t, o.title, o.x ?? M, y0, lead, size, o.tt, { colors: o.colors, weight: o.weight ?? 900, maxW: o.maxW ?? GRID.w, align: o.align ?? 'left', exit: o.exit, step: 0.08 });
  if (o.stripe) stripesH(ctx, y0 + (n - 1) * lead + 46, 12, prog(t, o.tt + 0.2, o.tt + 0.9), 0, { x0: o.x ?? M, x1: (o.x ?? M) + 420 });
}

// Fotograma del clip del Evo VI según su tiempo local (determinista).
const clipFrame = (local) => A.clip[clamp(Math.floor(local * CLIP.fps), 0, A.clip.length - 1)];

// ---------------------------------------------------------------------------
// Planos.

// Gancho: las llamas del 205 T16.
function sHook(t, s0, s1) {
  photo3D('llamas', t, s0, s1, { fx: 0.3, fy: 0.5, yaw: [-0.1, 0.02], zoom: [1.16, 1.04], dark: 0.15 });
  scrimB(900, 0.8);
  head2(t, { title: ['Fuego por', 'el escape.'], tt: V(0) - 0.05, size: 210, colors: [COLOR.paper, COLOR.fire] });
}

// Coches imposibles: el clip del Evo VI en un panel que gira en el espacio.
function sClip(t, s0, s1) {
  const u = span(t, s0, s1);
  const fr = clipFrame(t - s0);
  bg();
  ctx.save();
  ctx.filter = 'blur(26px)';
  drawCover(ctx, fr, -60, -60, W + 120, H + 120, { zoom: 1.1 });
  ctx.restore();
  ctx.fillStyle = 'rgba(11,13,16,0.62)';
  ctx.fillRect(0, 0, W, H);
  const yaw = lerp(0.42, 0.16, ease.out(u));
  planeY(fr, yaw, { w: 1000, h: 562, cy: 820, z: lerp(260, 0, ease.out(u)) });
  head2(t, { title: ['Coches', 'imposibles.'], tt: V(1) - 0.05, size: 210, y0: 1450 });
}

// Una era que nunca volverá: la parrilla del Grupo B.
function sEra(t, s0, s1) {
  photo3D('callesB', t, s0, s1, { fx: 0.3, fy: 0.6, yaw: [0.09, -0.02], zoom: [1.12, 1.02], dark: 0.25 });
  scrimB(1000, 0.85);
  head2(t, { title: ['Una era que', 'nunca volverá.'], tt: V(2) + 0.05, size: 170 });
}

// «Esto es Evo Heritage»: el logotipo gira y se asienta; franjas de la marca detrás.
function sIdent(t, s0) {
  bg();
  // Franjas del logotipo cruzando el cuadro en diagonal.
  ctx.save();
  ctx.translate(W / 2, 900);
  ctx.rotate(-0.42);
  ctx.translate(-W / 2, -900);
  stripesH(ctx, 900, 70, prog(t, s0, s0 + 0.55), 0, { x0: -700, x1: W + 700 });
  ctx.restore();
  ctx.fillStyle = 'rgba(11,13,16,0.35)';
  ctx.fillRect(0, 0, W, H);
  const lg = A.logo;
  const k = ease.outExpo(prog(t, s0 + 0.05, s0 + 1.1));
  const w = 900, h = w * (lg.height / lg.width);
  planeY(lg, lerp(1.25, 0, k), { w, h, cy: 860, z: lerp(900, 0, k), alpha: clamp(k * 3), n: 80 });
  tag(t, 'ESTO ES', W / 2, 1320, V(3) - 0.1, COLOR.yellow, { align: 'center', size: 32 });
  revealText(ctx, 'EvoHeritage', W / 2, 1500, FONT.display(900, 190), COLOR.paper, prog(t, V(3) + 0.45, V(3) + 1.1), { align: 'center', stagger: 0.035 });
}

// Aquí revivimos la historia del rally.
function sStory(t, s0, s1) {
  photo3D('curva', t, s0, s1, { fx: 0.45, fy: 0.45, pitch: [0.09, -0.02], zoom: [1.1, 1.0], dark: 0.3 });
  scrimB(1000, 0.85);
  head2(t, { tag: 'AQUÍ REVIVIMOS', title: ['La historia', 'del rally'], tt: V(4) + 0.6, size: 210, colors: [COLOR.paper, COLOR.red], stripe: true });
}

// Las cuatro leyendas: foto en 3D, grupo y nombre, cada una con su palabra.
const kLegend = (o) => (t, s0, s1) => {
  photo3D(o.img, t, s0, s1, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, yaw: o.yaw ?? [-0.08, 0.03], zoom: o.zoom ?? [1.08, 1.0], dark: 0.18 });
  scrimB(950, 0.88);
  head2(t, { tag: o.tag, title: o.title, tt: o.tt, size: 200, colors: [COLOR.paper, o.accent ?? COLOR.paper] });
};

// El monstruo que nunca llegó a correr.
function sMonster(t, s0, s1) {
  photo3D('mr2trasera', t, s0, s1, { fx: 0.62, fy: 0.5, yaw: [0.06, -0.04], zoom: [1.06, 1.0], dark: 0.3 });
  scrimB(1100, 0.9);
  head2(t, { title: ['El monstruo', 'que nunca llegó', 'a correr'], tt: V(9) + 0.2, size: 160, colors: [COLOR.paper, COLOR.paper, COLOR.red] });
}

// Pero no solo te contamos su historia.
function sNotOnly(t, s0) {
  bg();
  tag(t, 'PERO NO SOLO TE CONTAMOS', M, 820, V(10), COLOR.yellow, { size: 32 });
  lines(t, ['Su historia.'], M, 1010, 0, 220, V(10) + 1.0, { weight: 900 });
  // Al llegar «Te explicamos…» la palabra se tacha con las franjas de la marca.
  stripesH(ctx, 935, 14, prog(t, V(10) + 1.7, V(10) + 2.2), 0, { x0: M - 10, x1: M + 900 });
}

// Te explicamos su ingeniería: la palabra se levanta del plano de la lámina.
function sEngineering(t, s0) {
  const L = toLayer('p', () => {
    bg(); dots(0.12);
    tag(t, 'TE EXPLICAMOS SU', W / 2, 780, s0 + 0.1, COLOR.yellow, { align: 'center', size: 34 });
    revealText(ctx, 'Ingeniería', W / 2, 1010, FONT.display(900, 230), COLOR.paper, prog(t, V(11) + 0.5, V(11) + 1.0), { align: 'center', stagger: 0.03 });
    ctx.save(); ctx.font = FONT.display(900, 230); const w = ctx.measureText('Ingeniería').width; ctx.restore();
    dimLine(W / 2 - w / 2, W / 2 + w / 2, 1110, prog(t, V(11) + 0.9, V(11) + 1.4), COLOR.yellow);
  });
  bg();
  planeX(L, lerp(0.9, 0, ease.outExpo(prog(t, s0, s0 + 1.2))), { w: W * 1.1, h: H * 1.1, z: lerp(300, 0, ease.out(prog(t, s0, s0 + 1.2))) });
}

// Cuatro esquemas de ingeniería, uno por palabra.
function techTitle(t, tagStr, word, tt) {
  tag(t, tagStr, M, 250, tt - 0.25, COLOR.yellow, { size: 30 });
  lines(t, [word], M, 430, 0, 190, tt - 0.15, { weight: 900 });
}

function sTurbo(t, s0, s1) {
  const th = spinAngle(t, s0 - 1, () => 3.2);
  const L = toLayer('p', () => {
    bg(); dots(0.1);
    drawTurboSection(t, { cx: 520, cy: 1060, s: 0.54, th, air: 1, ex: 1, hot: 1, labels: 0, appear: 1 });
    // Detonaciones a la salida del escape, a semicorcheas.
    for (let k = 0; k < 8; k++) {
      const tk = s0 + 0.05 + k * 0.125;
      const p = prog(t, tk, tk + 0.12);
      if (p > 0 && p < 1) burst(990, 1060, 90 * (1 - p) + 40, 1 - p, 7 + k);
    }
  });
  bg();
  planeY(L, lerp(0.38, 0.12, ease.out(span(t, s0, s1))), { w: W * 1.05, h: H * 1.05 });
  techTitle(t, 'EL SECRETO DE LOS PETARDEOS', 'Anti-lag', V(12));
}

function sAwd(t, s0, s1) {
  const L = toLayer('p', () => {
    bg(); dots(0.1);
    drawPlan(t, { cx: 540, cy: 1000, scale: 0.95, rot: -Math.PI / 2, draw: 1, layout: 'audi', drive: 'awd', power: ease.out(prog(t, s0 - 0.1, s0 + 0.5)), flow: COLOR.yellow });
  });
  bg();
  planeX(L, lerp(0.72, 0.5, ease.out(span(t, s0, s1))), { w: W * 1.1, h: H * 1.1, cy: 1120, z: 60 });
  techTitle(t, 'AUDI SPORT QUATTRO S1', 'Tracción total', V(13));
}

function sMid(t, s0, s1) {
  const L = toLayer('p', () => {
    bg(); dots(0.1);
    drawPlan(t, { cx: 540, cy: 1000, scale: 0.95, rot: -Math.PI / 2, draw: 1, layout: '205', drive: 'awd', engineRot: ease.inOut(prog(t, s0 + 0.1, s0 + 0.8)),
      hot: 0.5 + 0.5 * Math.abs(Math.sin((t - s0) * 9)), power: 1, flow: COLOR.red });
  });
  bg();
  planeX(L, lerp(0.5, 0.7, ease.out(span(t, s0, s1))), { w: W * 1.1, h: H * 1.1, cy: 1120, z: 60 });
  techTitle(t, 'PEUGEOT 205 TURBO 16', 'Motor central', V(14));
}

function sChassis(t, s0, s1) {
  bg(); dots(0.1);
  drawFrame3D(t, { cx: 540, cy: 1150, s: 1.12, yaw: 0.25 + 0.45 * (t - s0), pitch: 0.55, draw: ease.out(prog(t, s0 - 0.2, s0 + 0.6)), highlight: prog(t, s0 + 0.4, s0 + 0.8) });
  techTitle(t, 'TOYOTA MR2 222D', 'Chasis tubular', V(15));
}

// Documentales: carrusel de tarjetas genéricas con los colores del canal.
const CARDS = [
  { img: 'mr2trasera', fx: 0.6, title: 'Toyota MR2 222D', dur: '5:48' },
  { img: null, title: 'Así funciona el Anti-lag', dur: '4:42' },
  { img: 't16nieve', fx: 0.5, title: 'Peugeot 205 Turbo 16', dur: '5:43' },
  { img: 'quattroHero', fx: 0.55, title: 'Audi Sport Quattro S1', dur: '2:31' },
];
const CW = 900, CH = 700;
function drawCard(i, t, s0) {
  const c = CARDS[i];
  const L = layers['c' + i];
  const prev = ctx;
  ctx = L.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, CW, CH, 28); ctx.clip();
  ctx.fillStyle = COLOR.ink2; ctx.fillRect(0, 0, CW, CH);
  const th = 506;
  if (c.img) drawCover(ctx, A[c.img], 0, 0, CW, th, { fx: c.fx, fy: 0.5 });
  else drawCover(ctx, clipFrame(((t - s0) * 1.0) % 6.5), 0, 0, CW, th, {});
  ctx.fillStyle = COLOR.red; ctx.fillRect(0, th, CW, 8);
  ctx.restore();
  label(ctx, 'DOCUMENTAL', 36, th + 66, COLOR.yellow, 1, { size: 24, spacing: 6, weight: 700 });
  label(ctx, c.dur, CW - 36, th + 66, DIM, 1, { size: 26, spacing: 2, weight: 600, align: 'right' });
  ctx.save(); ctx.font = FONT.display(800, 72); ctx.fillStyle = COLOR.paper; ctx.fillText(c.title, 36, th + 156); ctx.restore();
  ctx = prev;
  return L;
}
function sCards(t, s0, s1) {
  bg();
  const u = ease.inOut(prog(t, s0 + 0.1, s1 + 0.1));
  const theta = lerp(0.95, -Math.PI * 1.55, u);
  const R = 660;
  const order = CARDS.map((_, i) => {
    const phi = theta + i * Math.PI / 2;
    return { i, phi, d: R * (1 - Math.cos(phi)) };
  }).sort((a, b) => b.d - a.d);
  for (const { i, phi } of order) {
    if (Math.cos(phi) <= 0.05) continue;
    const L = drawCard(i, t, s0);
    stripsY(L, CW, CH, W / 2, 1120, (x) => [R * Math.sin(phi) + x * Math.cos(phi), 300 + R * (1 - Math.cos(phi)) + x * Math.sin(phi)],
      { n: 64, shade: (1 - Math.cos(phi)) * 0.8, alpha: ease.out(prog(t, s0, s0 + 0.4)) });
  }
  tag(t, 'LOS COCHES DE RALLY MÁS LEGENDARIOS', W / 2, 360, V(16) + 0.8, COLOR.yellow, { align: 'center', size: 30 });
  revealText(ctx, 'Documentales', W / 2, 560, FONT.display(900, 190), COLOR.paper, prog(t, V(16) - 0.05, V(16) + 0.5), { align: 'center', stagger: 0.03 });
}

// Esta comunidad es de todos ustedes: el muro con todas las fotos del canal, visto desde el aire.
const WALL = ['lancia037', 'quattroS1', 't16arbol', 'mr2frente', 'llamas', 'bosque', 'curva', 'callesB', 't16nieve', 'quattroHero', 'polvo', 'mr2trasera', 'quattroCutaway', 't16despiece', 'lancia037'];
function wallLayer() {
  if (!layers.wallDone) {
    const g = layers.w.getContext('2d');
    g.fillStyle = COLOR.ink; g.fillRect(0, 0, W, H);
    const cols = 3, rows = 5, gap = 14, tw = (W - gap * (cols + 1)) / cols, th = (H - gap * (rows + 1)) / rows;
    WALL.forEach((k, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      drawCover(g, A[k], gap + c * (tw + gap), gap + r * (th + gap), tw, th, { fx: 0.5, fy: 0.5 });
    });
    layers.wallDone = true;
  }
  return layers.w;
}
function sWall(t, s0, s1) {
  bg();
  const u = ease.inOut(span(t, s0, s1));
  planeX(wallLayer(), lerp(0.62, 0.42, u), { w: W * 1.5, h: H * 1.5, cy: lerp(980, 900, u), z: lerp(-300, 450, u), shade: 0 });
  ctx.fillStyle = 'rgba(11,13,16,0.4)';
  ctx.fillRect(0, 0, W, H);
  scrimB(1100, 0.92);
  head2(t, { title: ['Esta comunidad', 'es de todos', 'ustedes'], tt: V(17) + 0.05, size: 170, colors: [COLOR.paper, COLOR.paper, COLOR.yellow] });
}

// Porque el rally es de todos: la afición dentro de las letras.
function sAll(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('polvo', 0, 0, W, H, { zoom: lerp(1.5, 1.35, ease.out(u)), fx: 0.5, fy: 0.55 }, { dark: 0.88, vig: 0.6 });
  const p = ease.outExpo(prog(t, s0, s0 + 0.5));
  const z = lerp(1.25, 1, p);
  const L = toLayer('type', () => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    zoomAbout(z, W / 2, 900);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = FONT.display(900, 300);
    ctx.globalAlpha = clamp(p * 4);
    ctx.fillText('El rally', W / 2, 820);
    ctx.font = FONT.display(900, fitSize(ctx, 'es de todos', (px) => FONT.display(900, px), 980, 250));
    ctx.fillText('es de todos', W / 2, 1080);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-in';
    drawCover(ctx, A.polvo, 0, 0, W, H, { zoom: lerp(1.15, 1.05, ease.out(u)), fx: 0.5, fy: 0.5 });
    ctx.globalCompositeOperation = 'source-over';
  });
  ctx.drawImage(L, 0, 0);
  stripesH(ctx, 1180, 16, prog(t, s0 + 0.25, s0 + 1.0), 0, { x0: W / 2 - 330, x1: W / 2 + 330 });
  tag(t, 'PORQUE', W / 2, 600, s0 + 0.05, COLOR.yellow, { align: 'center', size: 34 });
}

// Cierre: logotipo, nombre, cuenta y suscripción.
function sEnd(t, s0, s1) {
  const L = toLayer('p', () => {
    bg();
    const lg = A.logo;
    const k = ease.outExpo(prog(t, s0 + 0.05, s0 + 0.9));
    const w = 860, h = w * (lg.height / lg.width);
    ctx.save();
    ctx.globalAlpha = clamp(k * 2);
    zoomAbout(lerp(1.2, 1, k), W / 2, 700);
    ctx.drawImage(lg, W / 2 - w / 2, 700 - h / 2, w, h);
    ctx.restore();
    revealText(ctx, 'EvoHeritage', W / 2, 1150, FONT.display(900, 170), COLOR.paper, prog(t, s0 + 0.3, s0 + 0.9), { align: 'center', stagger: 0.03 });
    label(ctx, '@EvoHeritageRally', W / 2, 1240, DIM, prog(t, s0 + 0.6, s0 + 1.1), { size: 40, spacing: 1, weight: 600, align: 'center' });
    pill(t, 'Suscríbete', W / 2, 1420, s0 + 0.25, { press: V(19) + 0.35, color: COLOR.red, pressed: COLOR.fire, size: 52 });
    label(ctx, '¡Nos vemos en el próximo tramo!', W / 2, 1640, COLOR.paper, prog(t, V(20) + 0.05, V(20) + 0.6), { size: 46, spacing: 0, weight: 600, align: 'center' });
  });
  bg();
  planeY(L, 0.05 * Math.sin((t - s0) * 0.9), { w: W * 1.04, h: H * 1.04, n: 72 });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sHook],
  [cut(1), sClip, 'fly'],
  [cut(2), sEra, 'cube'],
  [SECTIONS_AT.drop1, sIdent, 'fly'],
  [cut(4), sStory, 'cubeV'],
  [cut(5), kLegend({ img: 'lancia037', fx: 0.5, fy: 0.5, tag: 'GRUPO B', title: ['Lancia', '037'], tt: V(5) + 0.05, accent: COLOR.red }), 'wipe'],
  [cut(6), kLegend({ img: 'quattroS1', fx: 0.48, fy: 0.5, yaw: [0.09, -0.03], tag: 'GRUPO B', title: ['Audi Sport', 'Quattro S1'], tt: V(6) + 0.05, accent: COLOR.yellow }), 'cube'],
  [cut(7), kLegend({ img: 't16arbol', fx: 0.5, fy: 0.5, zoom: [1.06, 1.0], tag: 'GRUPO B', title: ['Peugeot', '205 Turbo 16'], tt: V(7) + 0.05, accent: COLOR.fire }), 'cubeV'],
  [cut(8), kLegend({ img: 'mr2frente', fx: 0.5, fy: 0.55, yaw: [0.08, -0.03], tag: 'GRUPO S', title: ['Toyota', 'MR2 222D'], tt: V(8) + 0.05, accent: COLOR.red }), 'cubeR'],
  [cut(9), sMonster, 'dissolve'],
  [cut(10), sNotOnly, 'fly'],
  [cut(11), sEngineering, 'cubeV'],
  [SECTIONS_AT.drop2, sTurbo, 'wipe'],
  [snap(V(13) - 0.1), sAwd, 'cube'],
  [snap(V(14) - 0.1), sMid, 'cubeV'],
  [snap(V(15) - 0.1), sChassis, 'cubeR'],
  [cut(16), sCards, 'fly'],
  [SECTIONS_AT.soft, sWall, 'cubeV'],
  [SECTIONS_AT.climax, sAll, 'cut'],
  [SECTIONS_AT.outro, sEnd, 'wipe'],
];
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
// Golpes de cámara: en las rupturas de la música y en cada leyenda.
export const HITS = [SECTIONS_AT.drop1, cut(5), cut(6), cut(7), cut(8), SECTIONS_AT.drop2, SECTIONS_AT.climax, SECTIONS_AT.outro];
const SHAKES = [SECTIONS_AT.drop1, SECTIONS_AT.drop2, SECTIONS_AT.climax];

export function seek(main, t) {
  ctx = main.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, W, H);
  const z = 1 + punch(t, HITS, 0.03, 6.5);
  let sx = 0, sy = 0;
  for (const h of SHAKES) {
    if (t >= h && t < h + 0.7) {
      const k = Math.exp(-(t - h) * 8) * 18;
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
    ctx.fillStyle = `rgba(11,13,16,${fout})`;
    ctx.fillRect(0, 0, W, H);
  }
  grain(ctx, t, 0.06);
}

export function init(assets) {
  A = assets;
  for (const k of ['type', 'a', 'b', 'p', 'w']) layers[k] = makeCanvas();
  for (let i = 0; i < 4; i++) layers['c' + i] = makeCanvas(CW, CH);
  layers.gray = {};
}

export const SHOT_STARTS = SHOTS.map((s) => s[0]);
export const SHOT_TRANS = SHOTS.map((s) => [s[0], s[2] ?? 'cut']);
