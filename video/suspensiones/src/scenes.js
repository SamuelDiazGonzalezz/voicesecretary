// Escenas del documental sobre la evolución de las suspensiones. Todo depende solo de `t`.
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
// Componentes de suspensión. Coordenadas de pantalla salvo que se diga lo contrario; todo depende de `t`.

const OIL = COLOR.oil, GAS = COLOR.gas;
const SPRUNG = COLOR.paper, UNSPRUNG = COLOR.red;

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
const oilColor = (heat) => mixColor('#C98A1C', '#8E2A1A', heat);

// Muelle helicoidal visto de lado entre dos puntos (se comprime al acercarlos).
function coil(x0, y0, x1, y1, { turns = 8, r = 34, color = COLOR.paper, width = 5, alpha = 1 } = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const n = turns * 24;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  // Mitad trasera de cada espira, más tenue; delantera, entera.
  for (const back of [true, false]) {
    ctx.strokeStyle = back ? 'rgba(232,233,230,0.25)' : color;
    ctx.lineWidth = back ? width * 0.6 : width;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = u * turns * Math.PI * 2;
      const front = Math.cos(a) > 0;
      const x = x0 + dx * u + nx * Math.sin(a) * r, y = y0 + dy * u + ny * Math.sin(a) * r;
      if (front !== back) { if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y); } else pen = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Tubo en sección con paredes rayadas (para cuerpos de amortiguador y depósitos).
function wallRect(x, y, w, h, th = 12) {
  ctx.save();
  ctx.fillStyle = '#2A2D33';
  ctx.fillRect(x, y, th, h); ctx.fillRect(x + w - th, y, th, h);
  ctx.strokeStyle = 'rgba(232,233,230,0.18)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let yy = y - th; yy < y + h; yy += 10) {
    for (const xx of [x, x + w - th]) { ctx.moveTo(xx, Math.max(y, yy + th)); ctx.lineTo(xx + th, Math.max(y, yy)); }
  }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Amortiguador monotubo en sección.
// stroke: 0 extendido → 1 comprimido. vel: velocidad del vástago (signo = sentido del flujo).
// heat 0..1 colorea el aceite; cav 0..1 burbujas de cavitación; res: depósito remoto con pistón flotante y nitrógeno;
// hbs: tope hidráulico (copa cerrada con agujeros y pistón secundario); shims: láminas que se doblan con el flujo.
function drawDamper(t, o) {
  const { cx, y0, s = 1, stroke = 0.4, vel = 0, heat = 0, cav = 0, res = 0, gas = 0, hbs = 0, shims = 0, appear = 1, labels = 0, rodRed = 0 } = o;
  const L = 520, w = 120;
  ctx.save();
  ctx.translate(cx, y0);
  ctx.scale(s, s);
  ctx.globalAlpha *= appear;
  const yP = lerp(150, 400, stroke);           // posición del pistón
  const cupTop = L - 120;                      // copa del tope hidráulico
  // Aceite.
  ctx.fillStyle = oilColor(heat);
  ctx.globalAlpha *= 0.85;
  ctx.fillRect(-w / 2 + 12, 30, w - 24, L - 42);
  ctx.globalAlpha /= 0.85;
  // Burbujas de cavitación: aparecen junto al pistón, en la cara de baja presión, y suben.
  if (cav > 0) {
    const r = rng(77);
    for (let i = 0; i < 70; i++) {
      const bx = (r() - 0.5) * (w - 34), ph = r(), sp = 30 + 50 * r();
      const by = yP + 30 + ((r() * 160 - (t * sp) % 160 + 160) % 160) - (vel < 0 ? 200 : 0);
      const br = (1.5 + 4 * r()) * clamp(cav * 1.6 - i / 70);
      if (br <= 0.2 || by < 34 || by > L - 14) continue;
      ctx.strokeStyle = `rgba(255,236,200,${0.75})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Tope hidráulico: copa cerrada con agujeros minúsculos en la pared.
  if (hbs > 0) {
    ctx.save();
    ctx.globalAlpha *= hbs;
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-34, cupTop); ctx.lineTo(-34, L - 12); ctx.lineTo(34, L - 12); ctx.lineTo(34, cupTop); ctx.stroke();
    ctx.fillStyle = COLOR.ink;
    for (let k = 0; k < 5; k++) { ctx.fillRect(-36, cupTop + 16 + k * 18, 4, 4); ctx.fillRect(32, cupTop + 16 + k * 18, 4, 4); }
    ctx.restore();
  }
  // Vástago (con pistón secundario si hay tope hidráulico).
  ctx.fillStyle = rodRed ? mixColor('#B9BDC2', '#D7262D', rodRed) : '#B9BDC2';
  ctx.fillRect(-13, -230, 26, yP + 230);
  if (hbs > 0) {
    ctx.save(); ctx.globalAlpha *= hbs;
    ctx.fillRect(-8, yP, 16, 64);
    ctx.fillStyle = COLOR.yellow; ctx.fillRect(-30, yP + 60, 60, 22);
    // Chorros de aceite por los agujeros cuando el pistón secundario entra en la copa.
    const inCup = clamp((yP + 82 - cupTop) / 40);
    if (inCup > 0 && vel > 0) {
      ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) {
        const yy = cupTop + 18 + k * 18;
        if (yy < yP + 82) continue;
        ctx.globalAlpha = hbs * inCup * (0.5 + 0.5 * Math.sin(t * 40 + k));
        ctx.beginPath(); ctx.moveTo(sd * 36, yy + 2); ctx.lineTo(sd * (36 + 14), yy + 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Pistón principal con orificios y láminas.
  ctx.fillStyle = '#D9DBDE';
  ctx.fillRect(-w / 2 + 13, yP - 18, w - 26, 36);
  ctx.fillStyle = COLOR.ink;
  for (const hx of [-30, 22]) ctx.fillRect(hx, yP - 18, 8, 36);
  if (shims > 0) {
    // Pila de láminas: se doblan hacia abajo con el flujo (ordenador analógico de fluidos).
    const bend = clamp(Math.abs(vel)) * 14 * shims;
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const half = 46 - k * 7, yy = yP + 22 + k * 4;
      ctx.beginPath(); ctx.moveTo(-half, yy + bend * (1 - k * 0.15)); ctx.quadraticCurveTo(0, yy - 2, half, yy + bend * (1 - k * 0.15)); ctx.stroke();
    }
  }
  // Flujo a través de los orificios.
  if (Math.abs(vel) > 0.02) {
    const dir = vel > 0 ? -1 : 1; // al comprimir, el aceite pasa de abajo a arriba
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2.5;
    for (const hx of [-26, 26]) for (let k = 0; k < 3; k++) {
      const ph = ((t * 3 * Math.abs(vel) + k / 3) % 1);
      const yy = yP + dir * (-30 + ph * 60);
      ctx.globalAlpha = appear * (1 - Math.abs(ph - 0.5) * 2) * clamp(Math.abs(vel) * 3);
      ctx.beginPath(); ctx.moveTo(hx, yy); ctx.lineTo(hx + 5, yy - dir * 9); ctx.lineTo(hx - 5, yy - dir * 9); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = appear;
  }
  // Cuerpo, tapa con retén y anclajes.
  wallRect(-w / 2, 30, w, L - 30, 12);
  ctx.fillStyle = '#3A3E45'; ctx.fillRect(-w / 2, 18, w, 22);
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2, 18, w, 22);
  ctx.beginPath(); ctx.arc(0, L + 30, 24, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, L + 30, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, L); ctx.lineTo(-14, L + 10); ctx.moveTo(14, L); ctx.lineTo(14, L + 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -252, 24, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -252, 9, 0, Math.PI * 2); ctx.stroke();
  // Depósito remoto: latiguillo trenzado y cilindro con pistón flotante y nitrógeno.
  if (res > 0) {
    const rx = 260, rTop = 90, rLen = 360, rw = 100;
    ctx.save();
    ctx.globalAlpha *= res;
    const hose = catmull([[w / 2, L - 40], [w / 2 + 50, L - 40], [rx - 60, L + 60], [rx, L + 40], [rx, rTop + rLen]], false, 12);
    // Malla trenzada: dos hélices cruzadas sobre el tubo.
    const HP = poly(hose);
    const draw = clamp(res * 1.5);
    ctx.strokeStyle = '#6D7178'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    trace(ctx, HP, draw);
    ctx.strokeStyle = 'rgba(232,233,230,0.55)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < HP.len * draw; k += 9) {
      const [x, y, an] = pointAt(HP, k / HP.len);
      const nx = -Math.sin(an) * 10, ny = Math.cos(an) * 10;
      ctx.beginPath(); ctx.moveTo(x - nx + Math.cos(an) * 5, y - ny + Math.sin(an) * 5); ctx.lineTo(x + nx - Math.cos(an) * 5, y + ny - Math.sin(an) * 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - nx - Math.cos(an) * 5, y - ny - Math.sin(an) * 5); ctx.lineTo(x + nx + Math.cos(an) * 5, y + ny + Math.sin(an) * 5); ctx.stroke();
    }
    // El volumen que desplaza el vástago al entrar empuja el pistón flotante hacia arriba.
    const yF = lerp(rTop + 170, rTop + 110, stroke);
    ctx.fillStyle = oilColor(heat); ctx.globalAlpha = res * 0.85;
    ctx.fillRect(rx - rw / 2 + 10, yF, rw - 20, rTop + rLen - yF);
    ctx.globalAlpha = res;
    if (gas > 0) {
      ctx.fillStyle = `rgba(127,180,221,${0.25 + 0.35 * gas})`;
      ctx.fillRect(rx - rw / 2 + 10, rTop + 10, rw - 20, yF - rTop - 10);
      // Moléculas de gas apretadas: más densas cuanto más sube el pistón.
      ctx.fillStyle = 'rgba(232,233,230,0.6)';
      const r2 = rng(9);
      for (let i = 0; i < 26; i++) {
        const gx = rx - rw / 2 + 16 + r2() * (rw - 32), gy = rTop + 16 + r2() * (yF - rTop - 26) + Math.sin(t * 3 + i) * 2;
        ctx.beginPath(); ctx.arc(gx, gy, 2.2 * gas, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#D9DBDE'; ctx.fillRect(rx - rw / 2 + 10, yF - 10, rw - 20, 20);
    ctx.fillStyle = '#1A1C20'; ctx.fillRect(rx - rw / 2 + 10, yF - 3, rw - 20, 6);
    wallRect(rx - rw / 2, rTop, rw, rLen, 10);
    ctx.restore();
    if (labels > 0) {
      const P = (x, y) => [cx + x * s, y0 + y * s];
      const L2 = [['NITRÓGENO', rx + 90, rTop + 40, GAS], ['PISTÓN FLOTANTE', rx + 90, yF + 6, COLOR.paper], ['ACEITE', rx + 90, rTop + 300, OIL], ['LATIGUILLO TRENZADO', rx + 60, L + 110, DIM]];
      L2.forEach(([str, x, y, col], i) => { const [px, py] = P(x, y); label(ctx, str, px, py, col, clamp(labels * 2 - i * 0.3), { size: 22, spacing: 6, weight: 700 }); });
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rueda vista de frente (neumático y llanta) con su caída.
function wheelFront(x, y, r, wd, ang = 0, { color = COLOR.paper, fill = COLOR.ink } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = fill; ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-wd / 2, -r, wd, 2 * r, 18); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 2;
  for (const yy of [-r * 0.62, r * 0.62]) { ctx.beginPath(); ctx.moveTo(-wd / 2 + 8, yy); ctx.lineTo(wd / 2 - 8, yy); ctx.stroke(); }
  ctx.restore();
}
// Rueda vista de lado, con radios y giro.
function wheelSide(x, y, r, rot = 0, { color = COLOR.paper, spokes = 6, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.fillStyle = COLOR.ink; ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  ctx.rotate(rot);
  ctx.lineWidth = 2.5;
  for (let k = 0; k < spokes; k++) { const a = (k / spokes) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16); ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Intersección de dos circunferencias (la solución exterior del cuadrilátero articulado).
function circ2(a, ra, b, rb, pick = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  const l = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l));
  const mx = a[0] + (dx * l) / d, my = a[1] + (dy * l) / d;
  return [mx + pick * (h * dy) / d, my - pick * (h * dx) / d];
}

// --- Dobles triángulos (vista frontal, rueda derecha), con cinemática real del cuadrilátero ---
// travel: desplazamiento vertical de la rueda (px, positivo = sube). Devuelve la caída calculada.
function drawWishbone(t, { cx, cy, s = 1, travel = 0, appear = 1, labels = 0, gForce = 0, hot = 0 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  const Li = [0, 60], Ui = [80, -120];                       // pivotes en el chasis
  const aL = 300, aU = 215, king = 191;                      // brazo superior más corto: gana caída negativa al comprimir
  const th = Math.asin(clamp(-travel / aL, -0.8, 0.8));       // ángulo del brazo inferior
  const Lo = [Li[0] + aL * Math.cos(th), Li[1] + aL * Math.sin(th)];
  const c1 = circ2(Ui, aU, Lo, king, 1), c2 = circ2(Ui, aU, Lo, king, -1);
  const Uo = c1[1] < c2[1] ? c1 : c2; // la rótula superior, por encima de la inferior
  const du = [Uo[0] - Lo[0], Uo[1] - Lo[1]], dl = Math.hypot(...du), d = [du[0] / dl, du[1] / dl];
  const camber = Math.atan2(d[0], -d[1]);
  const wc = [(Lo[0] + Uo[0]) / 2 - d[1] * 110, (Lo[1] + Uo[1]) / 2 + d[0] * 110];
  ctx.save();
  ctx.globalAlpha *= appear;
  // Chasis tubular (sección).
  ctx.strokeStyle = 'rgba(232,233,230,0.4)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(...P(-120, 120)); ctx.lineTo(...P(-20, 90)); ctx.lineTo(...P(30, -150)); ctx.lineTo(...P(-120, -200)); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...P(-20, 90)); ctx.lineTo(...P(-120, -200)); ctx.stroke();
  // Rueda.
  wheelFront(...P(wc[0], wc[1]), 190 * s, 120 * s, camber);
  // Muelle y amortiguador del brazo inferior a la torreta.
  const sm = [Li[0] + 0.62 * (Lo[0] - Li[0]), Li[1] + 0.62 * (Lo[1] - Li[1])];
  coil(...P(sm[0], sm[1]), ...P(-10, -230), { turns: 7, r: 22 * s, color: hot ? COLOR.fire : COLOR.yellow, width: 4 });
  // Brazos (triángulos vistos de frente: dos líneas convergentes) y mangueta.
  ctx.lineCap = 'round';
  for (const [a, b, col] of [[Li, Lo, COLOR.paper], [Ui, Uo, COLOR.paper]]) {
    ctx.strokeStyle = col; ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(...P(a[0], a[1] - 8)); ctx.lineTo(...P(b[0], b[1])); ctx.lineTo(...P(a[0], a[1] + 8)); ctx.stroke();
  }
  ctx.strokeStyle = COLOR.red; ctx.lineWidth = 12 * s;
  ctx.beginPath(); ctx.moveTo(...P(...Lo)); ctx.lineTo(...P(...Uo)); ctx.stroke();
  ctx.fillStyle = COLOR.ink; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  for (const q of [Li, Ui, Lo, Uo]) { ctx.beginPath(); ctx.arc(...P(...q), 10 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // Fuerza G lateral sobre el contacto del neumático.
  if (gForce > 0) {
    const [gx, gy] = P(wc[0] + 40, wc[1] + 190);
    ctx.strokeStyle = COLOR.fire; ctx.fillStyle = COLOR.fire; ctx.lineWidth = 8;
    const len = 220 * ease.out(gForce);
    ctx.beginPath(); ctx.moveTo(gx + len, gy); ctx.lineTo(gx + 20, gy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 30, gy - 16); ctx.lineTo(gx + 30, gy + 16); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (labels > 0) {
    const L2 = [['TRIÁNGULO SUPERIOR', ...P((Ui[0] + Uo[0]) / 2, (Ui[1] + Uo[1]) / 2 - 40)], ['TRIÁNGULO INFERIOR', ...P((Li[0] + Lo[0]) / 2, (Li[1] + Lo[1]) / 2 + 60)], ['MANGUETA', ...P(Uo[0] + 40, (Uo[1] + Lo[1]) / 2)]];
    L2.forEach(([str, x, y], i) => label(ctx, str, x, y, i === 2 ? COLOR.red : DIM, clamp(labels * 2 - i * 0.4), { size: 22, spacing: 6, weight: 700, align: i === 2 ? 'left' : 'center' }));
  }
  return camber;
}

// --- MacPherson (vista frontal): brazo inferior y columna telescópica hasta la copela. inverted: tubo grueso arriba ---
function drawStrut(t, { cx, cy, s = 1, travel = 0, appear = 1, inverted = false, labels = 0, bendF = 0, heavyHi = 0 }) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  const Li = [0, 120], aL = 280, T = [190, -330];
  const th = Math.asin(clamp(-travel / aL, -0.8, 0.8));
  const Lo = [Li[0] + aL * Math.cos(th), Li[1] + aL * Math.sin(th)];
  const ax = T[0] - Lo[0], ay = T[1] - Lo[1], AL = Math.hypot(ax, ay), ux = ax / AL, uy = ay / AL;
  const wc = [Lo[0] + 120, Lo[1] - 60];
  ctx.save();
  ctx.globalAlpha *= appear;
  // Carrocería (torreta y travesaño).
  ctx.strokeStyle = 'rgba(232,233,230,0.4)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(...P(-160, 150)); ctx.lineTo(...P(-30, 150)); ctx.lineTo(...P(-30, -260)); ctx.lineTo(...P(250, -360)); ctx.stroke();
  wheelFront(...P(wc[0], wc[1]), 190 * s, 120 * s, Math.atan2(ux, -uy) * 0.15);
  // Flexión lateral (exagerada) en el tramo central de la columna.
  const bend = bendF * (inverted ? 0.15 : 1) * 26;
  const along = (k) => [Lo[0] + ax * k + -uy * bend * Math.sin(Math.PI * k), Lo[1] + ay * k + ux * bend * Math.sin(Math.PI * k)];
  const tubeK = inverted ? [0.42, 1] : [0, 0.6];
  const rodK = inverted ? [0, 0.42] : [0.6, 1];
  const seg = (k0, k1, wdt, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = wdt * s; ctx.lineCap = 'butt';
    ctx.beginPath(); for (let i = 0; i <= 20; i++) { const q = along(lerp(k0, k1, i / 20)); i ? ctx.lineTo(...P(...q)) : ctx.moveTo(...P(...q)); } ctx.stroke();
  };
  // Lo que se mueve con la rueda es masa no suspendida (rojo); lo anclado al chasis, suspendida.
  const heavyCol = inverted ? mixColor('#B9BDC2', '#E8E9E6', heavyHi) : mixColor('#B9BDC2', '#D7262D', heavyHi);
  const lightCol = inverted ? mixColor('#9EA2A8', '#D7262D', heavyHi) : '#9EA2A8';
  seg(...tubeK, 58, heavyCol);
  seg(...rodK, 22, lightCol);
  // Muelle concéntrico entre plato inferior y copela.
  const sp0 = along(0.5), sp1 = along(0.93);
  coil(...P(...sp0), ...P(...sp1), { turns: 6, r: 46 * s, color: COLOR.yellow, width: 4 });
  // Brazo inferior y rótulas.
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...P(...Li)); ctx.lineTo(...P(...Lo)); ctx.stroke();
  ctx.fillStyle = COLOR.ink; ctx.lineWidth = 3;
  for (const q of [Li, Lo, T]) { ctx.beginPath(); ctx.arc(...P(...q), 11 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (labels > 0) {
    const mid = (k) => P(...along(k));
    const [ta, tb] = inverted ? [mid(0.75), mid(0.2)] : [mid(0.3), mid(0.8)];
    label(ctx, inverted ? 'TUBO GRUESO · AL CHASIS' : 'TUBO GRUESO · ABAJO', ta[0] - 60, ta[1], COLOR.paper, labels, { size: 22, spacing: 6, weight: 700, align: 'right' });
    label(ctx, inverted ? 'PARTE LIGERA · CON LA RUEDA' : 'VARILLA FINA · ARRIBA', tb[0] - 50, tb[1], inverted ? COLOR.red : DIM, labels, { size: 22, spacing: 6, weight: 700, align: 'right' });
  }
}

// --- Ballestas y eje rígido ---
function drawLeaf(t, { cx, cy, s = 1, defl = 0, appear = 1 }) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.globalAlpha *= appear;
  // Hojas apiladas, de la maestra (larga) a las cortas; la flecha baja al cargar.
  for (let k = 0; k < 6; k++) {
    const half = 420 - k * 62, y = k * 13;
    const sag = lerp(-60, 10, defl) * (1 - k * 0.08);
    ctx.strokeStyle = k ? 'rgba(232,233,230,0.75)' : COLOR.paper; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-half, y - sag * (half / 420) ** 2 * 0 + (sag * -1) * 0);
    for (let i = 0; i <= 24; i++) { const x = lerp(-half, half, i / 24); const yy = y + sag * (1 - (x / 420) ** 2); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }
  // Ojo delantero al soporte, gemela trasera y abarcones del eje.
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-430, 0, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-430, -16); ctx.lineTo(-450, -90); ctx.lineTo(-400, -90); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(430, 0, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(430, 0); ctx.lineTo(450, -70); ctx.stroke();
  const ay = lerp(-60, 10, defl) + 40;
  ctx.fillStyle = COLOR.ink; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, ay + 30, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  for (const x of [-28, 28]) { ctx.beginPath(); ctx.moveTo(x, ay - 70); ctx.lineTo(x, ay + 70); ctx.stroke(); }
  ctx.restore();
}
// Eje rígido visto desde atrás: si una rueda sube, la otra se inclina con ella.
function drawRigidAxle(t, { cx, cy, s = 1, lift = 0, appear = 1 }) {
  const half = 360;
  const xl = cx - half * s, xr = cx + half * s, yL = cy - lift * s, yR = cy;
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.strokeStyle = COLOR.red; ctx.lineWidth = 16 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(xl, yL); ctx.lineTo(xr, yR); ctx.stroke();
  ctx.fillStyle = COLOR.ink; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc((xl + xr) / 2, (yL + yR) / 2, 54 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const ang = Math.atan2(yR - yL, xr - xl);
  wheelFront(xl - 40 * s, yL, 170 * s, 110 * s, ang);
  wheelFront(xr + 40 * s, yR, 170 * s, 110 * s, ang);
  ctx.restore();
  // Suelo con el bache bajo la rueda izquierda.
  ctx.save();
  ctx.fillStyle = 'rgba(232,233,230,0.3)';
  ctx.fillRect(cx - 700 * s, cy + 172 * s, 1400 * s, 2);
  ctx.fillStyle = 'rgba(232,233,230,0.12)';
  ctx.beginPath(); ctx.ellipse(xl - 40 * s, cy + 172 * s, 110 * s, lift * s + 2, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
  return ang;
}

// ---------------------------------------------------------------------------
// Recorrido de suspensión por época: una rueda que sube y baja con su cota, y la regla comparativa.
const ERAS_TRAVEL = [['AÑOS 70', 15, '10–15 cm'], ['WRC · 1997', 25, 'MÁS DE 25 cm'], ['HOY · RALLY1', 30, 'MÁS DE 30 cm']];
function drawTravel(t, s0, { era = 0, appear = 1 }) {
  const px = 17; // px por cm
  const cm = ERAS_TRAVEL[era][1];
  const cx = 720, cy = 620;
  const u = 0.5 + 0.5 * Math.sin((t - s0) * 2.2);
  const dy = (u - 0.5) * cm * px;
  ctx.save();
  ctx.globalAlpha *= appear;
  // Silueta del paso de rueda (fijo) y la rueda que se mueve.
  ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy - 20, 330, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  wheelSide(cx, cy + dy, 220, (t - s0) * 0.8);
  ctx.restore();
  // Cota del recorrido total.
  const yTop = cy - cm * px / 2, yBot = cy + cm * px / 2;
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.strokeStyle = COLOR.yellow; ctx.fillStyle = COLOR.yellow; ctx.lineWidth = 3;
  const xd = cx + 320;
  ctx.beginPath(); ctx.moveTo(xd - 20, yTop); ctx.lineTo(xd + 20, yTop); ctx.moveTo(xd - 20, yBot); ctx.lineTo(xd + 20, yBot); ctx.moveTo(xd, yTop); ctx.lineTo(xd, yBot); ctx.stroke();
  ctx.beginPath(); ctx.arc(xd, cy + dy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(233,168,37,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy + dy); ctx.lineTo(xd, cy + dy); ctx.stroke();
  ctx.restore();
  // Regla comparativa de las tres épocas.
  ERAS_TRAVEL.forEach(([name, v, str], i) => {
    const a = i <= era ? appear : 0;
    if (a <= 0) return;
    const x = 1280 + i * 190, h = v * px;
    ctx.save();
    ctx.globalAlpha *= a * (i === era ? 1 : 0.4);
    ctx.fillStyle = i === era ? COLOR.yellow : COLOR.steel;
    ctx.fillRect(x, 900 - h * ease.out(clamp(appear)), 110, h * ease.out(clamp(appear)));
    ctx.restore();
    label(ctx, name, x + 55, 950, i === era ? COLOR.paper : DIM, a, { size: 20, spacing: 5, weight: 700, align: 'center' });
    label(ctx, str, x + 55, 985, i === era ? COLOR.yellow : DIM, a, { size: 20, spacing: 2, weight: 700, align: 'center' });
  });
}

// ---------------------------------------------------------------------------
// Modelo de cuarto de coche: masa suspendida, masa no suspendida, muelle, amortiguador y neumático.
// Simulación determinista (Euler semiimplícito a 1 kHz) con resultados en caché.
const simCache = new Map();
function quarterSim(key, { ms = 1, mu = 0.2, ks = 60, cs = 6, kt = 700, road, T = 10, rebound = 1 }) {
  if (simCache.has(key)) return simCache.get(key);
  const dt = 1 / 1000, n = Math.round(T / dt);
  const xs = new Float32Array(n), xu = new Float32Array(n), fc = new Float32Array(n);
  let s = 0, u = 0, vs = 0, vu = 0;
  for (let i = 0; i < n; i++) {
    const tt = i * dt, r = road(tt);
    const rel = u - s, relv = vu - vs;
    // Amortiguación asimétrica: «rebound» < 1 deja que la rueda se extienda deprisa (válvula abierta).
    const c = relv < 0 ? cs * rebound : cs;
    // Fuerzas medidas desde el equilibrio estático: el neumático solo empuja (si se descarga del todo, la rueda despega).
    const g = 9.8;
    const fs = ks * rel + c * relv;
    const ft = Math.max(0, kt * (r - u) + (ms + mu) * g);
    vs += (fs / ms) * dt;
    vu += ((-fs - ms * g + ft - mu * g) / mu) * dt;
    s += vs * dt; u += vu * dt;
    xs[i] = s; xu[i] = u; fc[i] = ft;
  }
  const out = { xs, xu, fc, dt, n, road };
  simCache.set(key, out);
  return out;
}
const simAt = (S, tt) => { const i = clamp(Math.floor(tt / S.dt), 0, S.n - 1); return [S.xs[i], S.xu[i], S.fc[i]]; };

function drawQuarter(t, { x, y, S, tt, scale = 900, appear = 1, muHeavy = false, label2 = null, roadW = 520 }) {
  const [xs, xu] = simAt(S, tt);
  const yRoad = y + 300, yU = y + 180 - xu * scale, yS = y - 40 - xs * scale;
  ctx.save();
  ctx.globalAlpha *= appear;
  // Carretera que pasa bajo la rueda.
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const dx = (i / 80 - 0.5) * roadW; const r = S.road(Math.max(0, tt + dx / 400)); i ? ctx.lineTo(x + dx, yRoad - r * scale) : ctx.moveTo(x + dx, yRoad - r * scale); }
  ctx.stroke();
  const r0 = S.road(tt);
  // Neumático (muelle duro) entre rueda y carretera.
  coil(x, yU + 40, x, Math.min(yRoad - r0 * scale, yU + 110), { turns: 3, r: 16, color: COLOR.steel, width: 3 });
  // Masa no suspendida.
  const muW = muHeavy ? 200 : 140, muH = muHeavy ? 80 : 50;
  ctx.fillStyle = COLOR.red; ctx.globalAlpha = appear * 0.9;
  ctx.fillRect(x - muW / 2, yU - muH / 2, muW, muH);
  ctx.globalAlpha = appear;
  // Muelle y amortiguador entre masas.
  coil(x - 40, yS + 50, x - 40, yU - muH / 2, { turns: 5, r: 20, color: COLOR.yellow, width: 4 });
  ctx.fillStyle = '#9EA2A8'; ctx.fillRect(x + 30, yS + 50, 22, (yU - muH / 2 - yS - 50) * 0.55);
  ctx.fillStyle = '#B9BDC2'; ctx.fillRect(x + 26, yS + 50 + (yU - muH / 2 - yS - 50) * 0.45, 30, (yU - muH / 2 - yS - 50) * 0.55);
  // Masa suspendida (la carrocería).
  ctx.strokeStyle = SPRUNG; ctx.lineWidth = 3; ctx.fillStyle = COLOR.ink2;
  ctx.fillRect(x - 160, yS - 60, 320, 110); ctx.strokeRect(x - 160, yS - 60, 320, 110);
  ctx.restore();
  if (label2) label(ctx, label2, x, y + 380, DIM, appear, { size: 22, spacing: 6, weight: 700, align: 'center' });
}

// Gráfica sencilla de una serie temporal ya calculada.
function plotSeries(fn, { x0, y0, w, h, t0, t1, vmin, vmax, color, width = 4, draw = 1, n = 200 }) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n; const v = fn(lerp(t0, t1, u)); pts.push([x0 + w * u, y0 + h - h * clamp((v - vmin) / (vmax - vmin), -0.1, 1.1)]); }
  strokePath(pts, draw, color, width);
}
function axes(x0, y0, w, h, appear = 1) {
  ctx.save(); ctx.globalAlpha *= appear; ctx.fillStyle = 'rgba(232,233,230,0.25)';
  ctx.fillRect(x0, y0 + h, w, 2); ctx.fillRect(x0, y0 - 10, 2, h + 10); ctx.restore();
}

// ---------------------------------------------------------------------------
// Coche de rally moderno de perfil (frente a la derecha): un compacto de cinco puertas como los WRC actuales.
// Origen en el suelo, a mitad de batalla. Ruedas de radio 92 con el centro a 92 del suelo.
const LEN = 0.9; // el cliente lo pidió un poco menos largo
const CAR = { r: 92, wy: -92, fx: 345 * LEN, rx: -335 * LEN };
// Proporciones de un WRC compacto: unas 6 veces el diámetro de la rueda de largo y 2 de alto.
const BODY = [
  [520, -52], [538, -96], [536, -130], [508, -164], [372, -186], [235, -200],     // paragolpes, morro y capó
  [86, -306], [-30, -324], [-280, -326], [-392, -316],                             // parabrisas y techo
  [-448, -288], [-488, -210], [-504, -164], [-514, -110], [-510, -52],             // portón casi vertical y paragolpes
];
function drawRallyCar(t, { cx, cy, s = 1, pitch = 0, droop = 0, rot = 0, appear = 1, battery = 0, aeroCut = 0, gearbox = 0, wing = 1 }) {
  const { r, wy, fx, rx } = CAR;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(pitch); ctx.scale(s * LEN, s);
  ctx.globalAlpha *= appear;
  ctx.lineJoin = 'round';
  // Carrocería con pasos de rueda ensanchados (dibujada en coordenadas sin acortar).
  const top = catmull(BODY, false, 6);
  const arch = r + 22;
  const fxB = fx / LEN, rxB = rx / LEN;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    // Pasos de rueda: arco por encima de cada rueda, de borde a borde del faldón (y = -52).
    const a0 = Math.asin((-52 - wy) / arch);
    ctx.lineTo(rxB - arch * Math.cos(a0), -52);
    ctx.arc(rxB, wy, arch, Math.PI - a0, 2 * Math.PI + a0);
    ctx.lineTo(fxB - arch * Math.cos(a0), -52);
    ctx.arc(fxB, wy, arch, Math.PI - a0, 2 * Math.PI + a0);
    ctx.closePath();
  };
  path(); ctx.fillStyle = COLOR.ink2; ctx.fill(); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3 / s; ctx.stroke();
  // Ventanillas, pilar B y línea de la puerta.
  ctx.lineWidth = 2.4 / s;
  ctx.beginPath(); ctx.moveTo(220, -206); ctx.lineTo(80, -296); ctx.lineTo(-270, -310); ctx.lineTo(-372, -302); ctx.lineTo(-420, -222); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-90, -308); ctx.lineTo(-94, -214); ctx.stroke();
  ctx.globalAlpha *= 0.5;
  ctx.beginPath(); ctx.moveTo(222, -200); ctx.lineTo(214, -62); ctx.moveTo(-94, -214); ctx.lineTo(-98, -62); ctx.moveTo(-420, -218); ctx.lineTo(-424, -150); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(508, -150); ctx.lineTo(372, -170); ctx.stroke(); // línea del capó
  ctx.globalAlpha /= 0.5;
  // Alerón de techo y faldón delantero (se recortan con la normativa Rally1).
  if (wing > 0) {
    ctx.save(); ctx.globalAlpha *= wing * (1 - 0.7 * aeroCut);
    if (aeroCut > 0) ctx.setLineDash([10, 8]);
    ctx.strokeStyle = aeroCut > 0 ? COLOR.steel : COLOR.paper; ctx.lineWidth = 5 / s;
    ctx.beginPath(); ctx.moveTo(-540, -356); ctx.lineTo(-370, -350); ctx.stroke();
    ctx.lineWidth = 3 / s;
    ctx.beginPath(); ctx.moveTo(-528, -356); ctx.lineTo(-526, -300); ctx.lineTo(-452, -284); ctx.moveTo(-410, -352); ctx.lineTo(-396, -322); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(526, -54); ctx.lineTo(556, -44); ctx.stroke();
    ctx.restore();
  }
  if (battery > 0) {
    ctx.save(); ctx.globalAlpha *= battery;
    ctx.fillStyle = 'rgba(127,180,221,0.35)'; ctx.strokeStyle = COLOR.gas; ctx.lineWidth = 3 / s;
    ctx.fillRect(-300, -210, 190, 100); ctx.strokeRect(-300, -210, 190, 100);
    for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-300 + k * 38, -204); ctx.lineTo(-300 + k * 38, -116); ctx.stroke(); }
    ctx.restore();
  }
  if (gearbox > 0) {
    ctx.save(); ctx.globalAlpha *= gearbox;
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 3 / s;
    ctx.strokeRect(110, -150, 100, 66);
    for (const [gx, gy, rr2] of [[140, -117, 20], [184, -117, 13]]) { ctx.beginPath(); ctx.arc(gx, gy, rr2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  // Ruedas: cuelgan (droop > 0) o se comprimen (droop < 0) respecto a la carrocería.
  for (const x of [rx, fx]) {
    const lx = x * s, ly = (wy + droop * 55) * s;
    const wx = cx + lx * Math.cos(pitch) - ly * Math.sin(pitch), wyy = cy + lx * Math.sin(pitch) + ly * Math.cos(pitch);
    wheelSide(wx, wyy, r * s, rot, { alpha: appear });
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

// Tramos del vídeo de saltos: a cámara lenta se funden dos fotogramas vecinos para que el movimiento no salte.
export const CLIP_N = { intro: 130, ford: 70, vw: 65, c3: 70, crest: 75, land: 70, fly: 70 };
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
const kClip = (o) => { const f = (t, s0, s1) => {
  bg();
  drawSeg(o.seg, (o.from ?? 0) + (t - s0) * (o.speed ?? 1), { zoom: lerp(o.z?.[0] ?? 1.03, o.z?.[1] ?? 1.08, ease.inOut(span(t, s0, s1))), fx: o.fx, fy: o.fy, dark: o.dark ?? 0.06 });
  scrimB();
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
}; f.seg = o.seg; return f; };
const kPhoto3 = (o) => (t, s0, s1) => {
  photo3D(o.img, t, s0, s1, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, yaw: o.yaw ?? [-0.06, 0.03], zoom: o.zoom ?? [1.12, 1.03], dark: o.dark ?? 0.38, gray: o.gray });
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
};
// Titular en la columna izquierda de los planos de esquema.
function side(t, tagStr, title, tt, { y = 230, size = 96, colors, label: lab, labelT, maxW = 700, lead } = {}) {
  if (tagStr) tag(t, tagStr, M, y - size - 10, tt - 0.25);
  lines(t, title, M, y, lead ?? size * 1.05, size, tt, { maxW, colors });
  if (lab) label(ctx, lab, M, y + (title.length - 1) * (lead ?? size * 1.05) + 70, DIM, prog(t, labelT ?? tt + 0.8, (labelT ?? tt + 0.8) + 0.5), { size: 36, spacing: 0, weight: 600 });
}
// Oscilación suave de 0 a 1 (para recorridos y carreras del vástago) y su derivada normalizada.
const osc = (t, f = 1, ph = 0) => 0.5 + 0.5 * Math.sin(t * f * Math.PI * 2 + ph);
const oscV = (t, f = 1, ph = 0) => Math.cos(t * f * Math.PI * 2 + ph);

// La línea de épocas: se repite en cada capítulo y marca dónde estamos.
const ERAS = ['AÑOS 70', 'GRUPO B', 'GRUPO A', 'WRC · 1997', 'HOY'];
function drawEras(t, idx, appear, y = 1000) {
  const x0 = M, x1 = W - M;
  ctx.save();
  ctx.globalAlpha *= appear;
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
// Capítulo: foto o tramo de archivo oscurecido, época y titular.
const kChapter = (o) => { const f = (t, s0, s1) => {
  bg();
  const u = span(t, s0, s1);
  if (o.seg) drawSeg(o.seg, (t - s0) * (o.speed ?? 0.5), { zoom: lerp(1.04, 1.1, ease.inOut(u)), dark: 0.55 });
  else if (o.img) photo(o.img, 0, 0, W, H, { zoom: lerp(o.z?.[0] ?? 1.12, o.z?.[1] ?? 1.03, ease.out(u)), fx: o.fx ?? 0.5, fy: o.fy ?? 0.5 }, { dark: 0.55, vig: 0.6, gray: o.gray });
  tag(t, o.tag, M, 420, o.tt - 0.2);
  lines(t, o.title, M, 560, 150, 150, o.tt, { colors: o.colors });
  if (o.label) label(ctx, o.label, M, 560 + (o.title.length - 1) * 150 + 90, COLOR.paper, prog(t, o.labelT, o.labelT + 0.5), { size: 44, spacing: 0, weight: 600 });
  drawEras(t, o.era, ease.out(prog(t, s0 + 0.2, s0 + 1.0)));
}; f.seg = o.seg; return f; };

// ---------------------------------------------------------------------------
// Planos singulares.

// Entrada: logotipo y debajo el título.
function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 760, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.2))));
  ctx.drawImage(lg, W / 2 - w / 2, 410 - h / 2, w, h);
  ctx.restore();
  revealText(ctx, 'La evolución de las suspensiones', W / 2, 870, FONT.display(800, 96), COLOR.paper, prog(t, 0.55, 1.3), { align: 'center', stagger: 0.02 });
  stripesH(ctx, 910, 10, prog(t, 0.85, 1.55), 0, { x0: W / 2 - 260, x1: W / 2 + 260 });
}

// El salto de la entrada (0:28,4 a 0:33,6 del vídeo del cliente), con la voz encima.
function sIntro(t, s0) {
  bg();
  drawSeg('intro', (t - s0) * 0.72, { zoom: lerp(1.02, 1.08, ease.inOut(prog(t, s0, s0 + 7.2))), dark: 0.04 });
  scrimB(520, 0.85);
  [['Caballos de fuerza', V(1) + 1.4], ['Turbos', V(2) + 0.15], ['Aerodinámica', V(2) + 1.3]].forEach(([w, tt], i) => {
    label(ctx, w, M + i * 520, 990, COLOR.paper, prog(t, tt, tt + 0.5), { size: 52, spacing: 0, weight: 700 });
  });
}

// La potencia no sirve de nada si los neumáticos no tocan el suelo.
function sContact(t, s0) {
  bg(); dots(0.05);
  const lift = ease.inOut(prog(t, V(6) + 3.4, V(6) + 4.2)) * 90;
  const cx = 1300, gy = 860, r = 250;
  ctx.fillStyle = 'rgba(232,233,230,0.35)'; ctx.fillRect(800, gy, 900, 2);
  wheelSide(cx, gy - r - lift, r, (t - s0) * 2.5);
  // Huella de contacto y fuerza de tracción.
  const k = 1 - clamp(lift / 30);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = COLOR.red; ctx.fillRect(cx - 70, gy - 6, 140, 8);
  const len = 260 * ease.out(prog(t, s0 + 0.6, s0 + 1.2)) * k;
  ctx.strokeStyle = COLOR.red; ctx.fillStyle = COLOR.red; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(cx, gy + 40); ctx.lineTo(cx + len, gy + 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + len + 26, gy + 40); ctx.lineTo(cx + len, gy + 24); ctx.lineTo(cx + len, gy + 56); ctx.closePath(); ctx.fill();
  ctx.restore();
  label(ctx, 'TRACCIÓN', cx + 140, gy + 100, COLOR.red, prog(t, s0 + 1.0, s0 + 1.4) * k, { size: 24, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'SIN CONTACTO, CERO', cx, gy + 100, DIM, prog(t, V(6) + 4.0, V(6) + 4.4), { size: 24, spacing: 7, weight: 700, align: 'center' });
  side(t, 'LA POTENCIA NO SIRVE DE NADA SI', ['Los neumáticos', 'no tocan el suelo'], V(6) + 2.4, { y: 420, size: 100 });
}

// Volar 50 metros a 160 km/h y aterrizar sobre piedras: la parábola, con la carrocería nivelada.
function sJumpArc(t, s0) {
  bg(); dots(0.04);
  const ground = (x) => (x < 420 ? 780 - (x - 120) * 0.25 : x < 1450 ? 1100 : 760 + (x - 1450) * 0.1);
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 855); ctx.lineTo(120, 780); ctx.lineTo(420, 705); ctx.lineTo(470, 760); ctx.lineTo(1380, 800); ctx.lineTo(1450, 760); ctx.lineTo(1920, 808); ctx.stroke();
  // Piedras del camino en la zona de aterrizaje.
  const r = rng(5);
  ctx.fillStyle = 'rgba(232,233,230,0.25)';
  for (let i = 0; i < 26; i++) { const x = 1300 + r() * 600, y = 760 + (x - 1450) * 0.1 + 6; ctx.beginPath(); ctx.ellipse(x, y, 6 + r() * 10, 4 + r() * 5, 0, Math.PI, 0); ctx.fill(); }
  // Trayectoria: despegue en la cresta (420, 705), aterrizaje en (1500, 765).
  const P = (u) => [lerp(420, 1500, u), lerp(705, 765, u) - 4 * 230 * u * (1 - u)];
  const pts = Array.from({ length: 60 }, (_, i) => P(i / 59));
  strokePath(pts, ease.inOut(prog(t, s0 + 0.3, s0 + 1.4)), 'rgba(127,180,221,0.7)', 3, [10, 10]);
  const fl = prog(t, s0 + 1.2, s0 + 3.6);
  const u = ease.inOut(fl);
  const pre = prog(t, s0, s0 + 1.2);
  const [x, y] = fl > 0 ? P(u) : [lerp(140, 420, pre), lerp(775, 705, pre)];
  const land = prog(t, s0 + 3.6, s0 + 4.4);
  const droop = fl > 0 && fl < 1 ? Math.min(1, fl * 6) : land > 0 ? -0.9 * Math.sin(Math.PI * land) : 0;
  drawRallyCar(t, { cx: x, cy: y, s: 0.62, pitch: 0, droop, rot: t * 6 });
  dimLine(420, 1500, 940, prog(t, s0 + 1.6, s0 + 2.2), COLOR.yellow);
  label(ctx, '50 m', 960, 1000, COLOR.yellow, prog(t, s0 + 1.8, s0 + 2.3), { size: 40, spacing: 2, weight: 700, align: 'center' });
  label(ctx, '160 km/h', 380, 640, COLOR.paper, prog(t, s0 + 0.8, s0 + 1.3), { size: 40, spacing: 2, weight: 700, align: 'right' });
  side(t, null, ['Sin desintegrarse'], V(7) + 5.4, { y: 200, size: 96 });
  label(ctx, 'No es magia', M, 280, DIM, prog(t, V(7) + 7.4, V(7) + 7.9), { size: 40, spacing: 0, weight: 600 });
}

// Las entrañas del chasis: el despiece del Delta S4 del cliente.
function sCutaway(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  const map = photo('s4Despiece', 0, 0, W, H, { zoom: lerp(1.05, 1.16, ease.inOut(u)), fx: 0.45, fy: 0.55 }, { dark: 0.25, vig: 0.5 });
  if (map) {
    const im = A.s4Despiece;
    const [ax, ay] = map(im.width * 0.165, im.height * 0.6);
    const [bx, by] = map(im.width * 0.67, im.height * 0.58);
    callout(t, ax, ay, ax + 60, ay - 300, 'SUSPENSIÓN DELANTERA', V(9) + 2.6, COLOR.yellow);
    callout(t, bx, by, bx + 120, by - 330, 'SUSPENSIÓN TRASERA', V(9) + 3.4, COLOR.yellow);
  }
  scrimB(480, 0.85);
  tag(t, 'HOY VAMOS A VIAJAR A', M, 860, V(9) + 0.1);
  lines(t, ['Las entrañas del chasis'], M, 975, 0, 110, V(9) + 1.3);
}

// La evolución de la suspensión: el mapa del viaje por épocas.
function sMapEras(t, s0) {
  bg(); dots(0.04);
  tag(t, 'EL VERDADERO CORAZÓN DE UN COCHE DE RALLY', W / 2, 420, s0 + 0.1, COLOR.yellow, { align: 'center' });
  revealText(ctx, 'La evolución de la suspensión', W / 2, 580, FONT.display(800, 120), COLOR.paper, prog(t, V(10) - 0.05, V(10) + 0.7), { align: 'center', stagger: 0.02 });
  drawEras(t, -1, ease.out(prog(t, V(10) + 0.6, V(10) + 1.6)), 760);
}

// Ejes rígidos y ballestas.
function sLeaf(t, s0) {
  bg(); dots(0.04);
  const lift = 60 * osc(t - s0, 0.45, -Math.PI / 2);
  drawRigidAxle(t, { cx: 540, cy: 640, s: 0.85, lift, appear: ease.out(prog(t, s0, s0 + 0.8)) });
  drawLeaf(t, { cx: 1400, cy: 660, s: 0.95, defl: osc(t - s0, 0.45, -Math.PI / 2), appear: ease.out(prog(t, V(19) + 2.8, V(19) + 3.6)) });
  label(ctx, 'EJE RÍGIDO · VISTA TRASERA', 540, 1000, DIM, prog(t, V(19) + 1.6, V(19) + 2.1), { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'BALLESTAS · VISTA LATERAL', 1400, 1000, DIM, prog(t, V(19) + 3.4, V(19) + 3.9), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'MUCHOS COCHES AÚN UTILIZABAN', ['Ejes rígidos y ballestas'], V(19) + 1.0, { y: 200, size: 90, maxW: 1400 });
  label(ctx, 'Una tecnología heredada de los carros de caballos', M, 280, COLOR.paper, prog(t, V(20) + 0.3, V(20) + 0.8), { size: 40, spacing: 0, weight: 600 });
}

// Recorrido de suspensión por época.
const kTravel = (era, tagStr, title, tt) => (t, s0) => {
  bg(); dots(0.04);
  drawTravel(t, s0, { era, appear: ease.out(prog(t, s0 + 0.1, s0 + 0.9)) });
  side(t, tagStr, title, tt(), { y: 200, size: 90, maxW: 1500 });
};

// Amortiguador en sección: tubo con aceite, pistón con orificios y vástago.
function sDamper(t, s0) {
  bg(); dots(0.04);
  const f = 0.6;
  drawDamper(t, { cx: 1250, y0: 330, s: 1.15, stroke: 0.15 + 0.7 * osc(t - s0, f), vel: oscV(t - s0, f), appear: ease.out(prog(t, s0, s0 + 0.8)) });
  side(t, 'LOS AMORTIGUADORES ERAN', ['Simples tubos', 'llenos de aceite'], V(25) + 1.2, { y: 470, size: 100 });
}

// Calentamiento, ebullición y cavitación.
function sCavitation(t, s0) {
  bg(); dots(0.04);
  const heat = ease.inOut(prog(t, V(26) + 0.6, V(27) + 0.6));
  const cav = ease.out(prog(t, V(28) + 0.8, V(28) + 3.2));
  const f = 0.6 + 0.6 * heat;
  drawDamper(t, { cx: 1250, y0: 330, s: 1.15, stroke: 0.15 + 0.7 * osc(t - s0, f), vel: oscV(t - s0, f), heat, cav });
  // Termómetro del aceite.
  const tx = 1580, ty0 = 360, th = 540;
  ctx.fillStyle = 'rgba(232,233,230,0.12)'; ctx.fillRect(tx, ty0, 18, th);
  ctx.fillStyle = mixColor('#C98A1C', '#D7262D', heat); ctx.fillRect(tx, ty0 + th * (1 - (0.15 + 0.85 * heat)), 18, th * (0.15 + 0.85 * heat));
  label(ctx, 'TEMPERATURA', tx + 9, ty0 + th + 40, DIM, 1, { size: 20, spacing: 5, weight: 700, align: 'center' });
  side(t, 'CUANDO EL ACEITE SE CALENTABA', ['Hervía'], V(27) - 0.1, { y: 420, size: 120, colors: [COLOR.fire] });
  lines(t, ['Cavitación'], M, 600, 0, 120, V(28) + 3.0, { colors: [COLOR.paper] });
  label(ctx, 'Y perdía todas sus propiedades', M, 690, DIM, prog(t, V(28) + 4.6, V(28) + 5.1), { size: 40, spacing: 0, weight: 600 });
}

// Sobre los muelles puros: una masa que rebota sin control.
function sBounce(t, s0) {
  bg(); dots(0.04);
  const w0 = 2 * Math.PI * 0.9, z = 0.04;
  const x = (tt) => (tt < 0 ? 0 : Math.exp(-z * w0 * tt) * Math.cos(w0 * Math.sqrt(1 - z * z) * tt));
  const tt = t - s0 - 0.6;
  const yb = 520 - 110 * x(tt);
  ctx.fillStyle = 'rgba(232,233,230,0.35)'; ctx.fillRect(1000, 820, 420, 2);
  coil(1210, yb + 60, 1210, 818, { turns: 7, r: 40, color: COLOR.yellow, width: 5 });
  ctx.fillStyle = COLOR.ink2; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.fillRect(1080, yb - 60, 260, 120); ctx.strokeRect(1080, yb - 60, 260, 120);
  label(ctx, 'SIN AMORTIGUACIÓN', 1210, 880, DIM, prog(t, s0 + 0.6, s0 + 1.0), { size: 22, spacing: 6, weight: 700, align: 'center' });
  axes(1480, 380, 340, 280, prog(t, s0 + 0.2, s0 + 0.8));
  plotSeries((q) => x(q), { x0: 1480, y0: 380, w: 340, h: 280, t0: 0, t1: Math.max(0.01, tt), vmin: -1.2, vmax: 1.2, color: COLOR.yellow, width: 3, n: 160 });
  side(t, 'EN LOS TRAMOS LARGOS', ['Sobre los', 'muelles puros'], V(30) + 1.4, { y: 420, size: 110 });
  label(ctx, 'Rebotando sin control', M, 640, COLOR.fire, prog(t, V(31) + 0.1, V(31) + 0.6), { size: 48, spacing: 0, weight: 700 });
}

// De 250 a 500 caballos y tracción total.
function sPower(t, s0) {
  bg(); dots(0.04);
  const v = lerp(250, 500, ease.inOut(prog(t, V(34) + 1.4, V(34) + 3.0)));
  tag(t, 'LOS COCHES PASARON DE', M, 360, s0 + 0.1);
  ctx.save(); ctx.globalAlpha = ease.out(prog(t, s0 + 0.2, s0 + 0.6)); counter(v, M - 8, 620, 260, v > 499 ? COLOR.red : COLOR.paper); ctx.restore();
  label(ctx, 'caballos', M, 720, COLOR.paper, prog(t, s0 + 0.5, s0 + 1.0), { size: 56, spacing: 0, weight: 700 });
  drawPlan(t, { cx: 1360, cy: 560, scale: 0.72, rot: -Math.PI / 2, draw: ease.inOut(prog(t, V(34) + 3.2, V(34) + 4.4)), layout: 'audi', drive: 'awd', power: prog(t, V(34) + 4.2, V(34) + 5.0), flow: COLOR.red, wing: false });
  label(ctx, 'Tracción a las cuatro ruedas', M, 820, COLOR.paper, prog(t, V(34) + 4.6, V(34) + 5.1), { size: 44, spacing: 0, weight: 600 });
}

// Se rompía en pedazos.
function sBreak(t, s0) {
  bg(); dots(0.04);
  const f = 1.6;
  drawDamper(t, { cx: 1250, y0: 330, s: 1.15, stroke: 0.15 + 0.75 * osc(t - s0, f), vel: oscV(t - s0, f), heat: 1, cav: 1 });
  // Grietas en el cuerpo del amortiguador.
  const p = ease.out(prog(t, V(37) + 1.2, V(37) + 2.0));
  const cr = [[1190, 600], [1230, 640], [1205, 680], [1258, 720], [1225, 770], [1268, 810]];
  strokePath(cr, p, COLOR.red, 4);
  side(t, 'LA SUSPENSIÓN TRADICIONAL', ['Se rompía', 'en pedazos'], V(37) + 0.4, { y: 470, size: 110, colors: [COLOR.paper, COLOR.red] });
}

// El calor destrozaba el aceite en minutos.
function sHeat(t, s0) {
  bg(); dots(0.04);
  const x0 = 900, y0 = 280, w = 860, h = 500;
  axes(x0, y0, w, h, prog(t, s0, s0 + 0.6));
  const temp = (u) => 1 - Math.exp(-u * 2.6);
  const boil = 0.72;
  ctx.save(); ctx.setLineDash([12, 10]); ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 2.5; ctx.globalAlpha = prog(t, s0 + 0.5, s0 + 1.0);
  ctx.beginPath(); ctx.moveTo(x0, y0 + h - h * boil); ctx.lineTo(x0 + w, y0 + h - h * boil); ctx.stroke(); ctx.restore();
  label(ctx, 'EBULLICIÓN', x0 + w, y0 + h - h * boil - 16, COLOR.fire, prog(t, s0 + 0.7, s0 + 1.2), { size: 22, spacing: 6, weight: 700, align: 'right' });
  plotSeries(temp, { x0, y0, w, h, t0: 0, t1: 1, vmin: 0, vmax: 1, color: COLOR.red, width: 5, draw: ease.inOut(prog(t, s0 + 0.8, V(39) + 3.4)) });
  label(ctx, 'MINUTOS', x0 + w, y0 + h + 44, DIM, prog(t, s0 + 0.3, s0 + 0.8), { size: 22, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'TEMPERATURA DEL ACEITE', x0 + 16, y0 - 20, DIM, prog(t, s0 + 0.3, s0 + 0.8), { size: 22, spacing: 6, weight: 700 });
  side(t, 'EL CALOR DE LAS FRICCIONES INTERNAS', ['Destrozaba el aceite', 'en minutos'], V(39) + 1.6, { y: 470, size: 90 });
}

// Si uno se sobrecalentaba, ponían dos.
function sDouble(t, s0) {
  bg(); dots(0.04);
  const f = 1.1;
  const st = 0.15 + 0.7 * osc(t - s0, f), v = oscV(t - s0, f);
  drawDamper(t, { cx: 960, y0: 330, s: 0.95, stroke: st, vel: v, heat: 1, cav: 0.8, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  drawDamper(t, { cx: 1420, y0: 330, s: 0.95, stroke: st, vel: v, heat: 0.4, appear: ease.out(prog(t, V(44) - 0.2, V(44) + 0.4)) });
  drawDamper(t, { cx: 1660, y0: 330, s: 0.95, stroke: st, vel: v, heat: 0.4, appear: ease.out(prog(t, V(44) - 0.1, V(44) + 0.5)) });
  label(ctx, 'UNO', 960, 1010, DIM, prog(t, s0 + 0.4, s0 + 0.8), { size: 24, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'DOS POR RUEDA', 1540, 1010, COLOR.paper, prog(t, V(44) + 0.3, V(44) + 0.7), { size: 24, spacing: 7, weight: 700, align: 'center' });
  side(t, 'SI UN AMORTIGUADOR SE SOBRECALENTABA', ['Ponían dos'], V(44) + 0.1, { y: 470, size: 120, colors: [COLOR.yellow] });
}

// Dobles triángulos: la geometría cambió.
function sWishbone(t, s0) {
  bg(); dots(0.04);
  const tr = 80 * Math.sin((t - s0) * 1.6);
  const camber = drawWishbone(t, { cx: 960, cy: 560, s: 1.0, travel: tr, appear: ease.out(prog(t, s0, s0 + 0.8)), labels: prog(t, V(47) + 2.6, V(47) + 3.8) });
  label(ctx, `CAÍDA ${(camber * 180 / Math.PI).toFixed(1).replace('.', ',')}°`, 1740, 980, COLOR.yellow, prog(t, V(47) + 3.6, V(47) + 4.2), { size: 22, spacing: 4, weight: 700, align: 'right' });
  side(t, 'LA GEOMETRÍA CAMBIÓ', ['Dobles', 'triángulos'], V(47) + 1.6, { y: 300, size: 100, maxW: 600 });
}
function sLateral(t, s0) {
  bg(); dots(0.04);
  const tr = 60 + 30 * Math.sin((t - s0) * 2.2);
  drawWishbone(t, { cx: 960, cy: 560, s: 1.0, travel: tr, gForce: prog(t, s0 + 0.4, s0 + 1.2), hot: 0 });
  side(t, 'ESTRUCTURAS TUBULARES DE TITANIO', ['Fuerzas G', 'laterales'], s0 + 0.6, { y: 300, size: 100, colors: [COLOR.paper, COLOR.fire], maxW: 600 });
  label(ctx, 'que ahora permitía la tracción total', M, 470, DIM, prog(t, s0 + 1.6, s0 + 2.1), { size: 36, spacing: 0, weight: 600 });
}

// MacPherson: el estándar mundial.
function sMacPherson(t, s0) {
  bg(); dots(0.04);
  drawStrut(t, { cx: 1180, cy: 640, s: 1.15, travel: 80 * Math.sin((t - s0) * 1.6), appear: ease.out(prog(t, s0, s0 + 0.8)) });
  side(t, 'EL ESQUEMA', ['MacPherson'], V(53) + 0.9, { y: 300, size: 120 });
  label(ctx, 'Se convirtió en el estándar mundial', M, 380, COLOR.paper, prog(t, V(53) + 2.2, V(53) + 2.7), { size: 40, spacing: 0, weight: 600 });
}

// La era de los fluidos: la cámara entra en el amortiguador.
function sFluids(t, s0, s1) {
  bg(); dots(0.04);
  const z = lerp(0.62, 1.15, ease.inOut(prog(t, s0 + 0.3, s1)));
  camera(1250, 560, z, () => drawDamper(t, { cx: 1250, y0: 300, s: 0.86, stroke: 0.15 + 0.7 * osc(t - s0, 0.6), vel: oscV(t - s0, 0.6) }));
  scrim(820, 0.9);
  side(t, 'LO QUE CAMBIÓ FUE EL INTERIOR', ['La era de', 'los fluidos'], V(55) + 0.2, { y: 470, size: 110, colors: [COLOR.paper, COLOR.oil] });
}

// Depósito remoto: cilindro externo y latiguillo trenzado.
function sReservoir(t, s0) {
  bg(); dots(0.04);
  const f = 0.55;
  drawDamper(t, { cx: 1080, y0: 330, s: 1.1, stroke: 0.15 + 0.7 * osc(t - s0, f), vel: oscV(t - s0, f), res: ease.inOut(prog(t, s0 + 0.4, V(58) + 3.4)) });
  side(t, 'PARTE DEL VOLUMEN INTERNO, FUERA', ['Un cilindro externo'], V(58) + 2.4, { y: 300, size: 96, maxW: 760 });
  label(ctx, 'conectado por un latiguillo trenzado', M, 380, COLOR.paper, prog(t, V(58) + 4.6, V(58) + 5.1), { size: 40, spacing: 0, weight: 600 });
}
function sNitrogen(t, s0, s1) {
  bg(); dots(0.04);
  const f = 0.55;
  const z = lerp(1.0, 1.45, ease.inOut(prog(t, s0, s0 + 1.6)));
  camera(lerp(1100, 1308, ease.inOut(prog(t, s0, s0 + 1.6))), lerp(560, 470, ease.inOut(prog(t, s0, s0 + 1.6))), z, () =>
    drawDamper(t, { cx: 1100, y0: 280, s: 0.8, stroke: 0.15 + 0.7 * osc(t - s0, f), vel: oscV(t - s0, f), res: 1, gas: ease.out(prog(t, V(60) + 0.4, V(60) + 1.4)), labels: prog(t, V(60) + 1.2, V(61) + 1.2) }));
  scrim(760, 0.9);
  side(t, 'DENTRO DE ESE CILINDRO', ['Nitrógeno', 'a alta presión'], V(60) + 0.4, { y: 420, size: 100, colors: [COLOR.gas, COLOR.paper], maxW: 560 });
  label(ctx, 'Separado del aceite por un pistón', M, 640, COLOR.paper, prog(t, V(61) + 0.2, V(61) + 0.7), { size: 36, spacing: 0, weight: 600 });
}
// Con presión, el aceite no hierve.
function sNoBoil(t, s0) {
  bg(); dots(0.04);
  const f = 1.1;
  const st = 0.15 + 0.7 * osc(t - s0, f), v = oscV(t - s0, f);
  drawDamper(t, { cx: 860, y0: 330, s: 0.9, stroke: st, vel: v, heat: 1, cav: 1 });
  drawDamper(t, { cx: 1340, y0: 330, s: 0.9, stroke: st, vel: v, heat: 1, cav: 0, res: 1, gas: 1 });
  label(ctx, 'SIN PRESIÓN', 860, 1010, DIM, prog(t, s0 + 0.4, s0 + 0.8), { size: 24, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'CON NITRÓGENO', 1460, 1010, COLOR.gas, prog(t, s0 + 0.6, s0 + 1.0), { size: 24, spacing: 7, weight: 700, align: 'center' });
  side(t, 'ESTE GAS PRESURIZABA EL SISTEMA', ['El aceite', 'no hierve'], V(63) + 0.2, { y: 300, size: 100, maxW: 560 });
  label(ctx, 'Sin importar la temperatura', M, 470, COLOR.paper, prog(t, V(64) + 0.2, V(64) + 0.7), { size: 36, spacing: 0, weight: 600 });
}
// Kilómetro 41.
function sKm41(t, s0) {
  bg(); dots(0.04);
  const x0 = 860, y0 = 300, w = 900, h = 460;
  axes(x0, y0, w, h, prog(t, s0, s0 + 0.6));
  const before = (km) => (km < 6 ? 1 : Math.max(0.2, 1 - (km - 6) * 0.06));
  plotSeries(before, { x0, y0, w, h, t0: 0, t1: 45, vmin: 0, vmax: 1.2, color: COLOR.steel, width: 3, draw: ease.inOut(prog(t, s0 + 0.5, s0 + 2.5)) });
  plotSeries(() => 1, { x0, y0, w, h, t0: 0, t1: 45, vmin: 0, vmax: 1.2, color: COLOR.gas, width: 5, draw: ease.inOut(prog(t, V(66) + 0.5, V(67) + 1.0)) });
  const x41 = x0 + w * 41 / 45;
  const k = prog(t, V(67) + 0.6, V(67) + 1.2);
  ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.arc(x41, y0 + h - h / 1.2, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x41 - 1, y0 + h - h / 1.2, 2, h / 1.2); ctx.restore();
  label(ctx, 'KM 41', x41, y0 + h + 44, COLOR.paper, k, { size: 24, spacing: 4, weight: 700, align: 'center' });
  label(ctx, 'AMORTIGUACIÓN', x0 + 16, y0 - 20, DIM, prog(t, s0 + 0.3, s0 + 0.8), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'SIN PRESIÓN', x0 + w * 0.42, y0 + h * 0.62, COLOR.steel, prog(t, s0 + 2.0, s0 + 2.5), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'CON NITRÓGENO', x0 + w * 0.42, y0 + h - h / 1.2 - 24, COLOR.gas, prog(t, V(67), V(67) + 0.5), { size: 22, spacing: 6, weight: 700 });
  side(t, 'COLIN McRAE · GRECIA', ['Igual que', 'en la salida'], V(68) + 1.2, { y: 420, size: 100, maxW: 600 });
}

// La masa no suspendida: el modelo de cuarto de coche.
const bumps = (tt) => { const ph = tt % 1.6; return ph > 0.4 && ph < 0.6 ? 0.06 * Math.sin(Math.PI * (ph - 0.4) / 0.2) : 0; };
function sQuarter(t, s0) {
  bg(); dots(0.04);
  const S = quarterSim('light', { mu: 0.18, road: bumps, T: 30 });
  drawQuarter(t, { x: 1250, y: 420, S, tt: (t - s0) % 30, appear: ease.out(prog(t, s0, s0 + 0.8)) });
  label(ctx, 'MASA SUSPENDIDA', 1450, 330, COLOR.paper, prog(t, V(73), V(73) + 0.5), { size: 24, spacing: 6, weight: 700 });
  label(ctx, 'MASA NO SUSPENDIDA', 1360, 620, COLOR.red, prog(t, V(73) + 0.4, V(73) + 0.9), { size: 24, spacing: 6, weight: 700 });
  side(t, 'EL MAYOR ENEMIGO DE LA DINÁMICA', ['La masa', 'no suspendida'], V(73) - 0.05, { y: 420, size: 110, colors: [COLOR.paper, COLOR.red], maxW: 640 });
}
function sQuarter2(t, s0) {
  bg(); dots(0.04);
  const tt = (t - s0) % 30;
  const SH = quarterSim('heavy', { mu: 0.55, road: bumps, T: 30 }), SL = quarterSim('light', { mu: 0.18, road: bumps, T: 30 });
  drawQuarter(t, { x: 820, y: 260, S: SH, tt, muHeavy: true, label2: 'RUEDA PESADA', roadW: 440 });
  drawQuarter(t, { x: 1420, y: 260, S: SL, tt, label2: 'RUEDA LIGERA', roadW: 440 });
  // Fuerza de contacto: la rueda pesada llega a despegarse (cero).
  for (const [S, x, col] of [[SH, 620, COLOR.steel], [SL, 1220, COLOR.yellow]]) {
    axes(x, 760, 400, 150, 1);
    plotSeries((q) => simAt(S, q)[2], { x0: x, y0: 760, w: 400, h: 150, t0: Math.max(0, tt - 3.2), t1: tt, vmin: 0, vmax: 36, color: col, width: 3, n: 240 });
  }
  label(ctx, 'AGARRE', 620, 740, DIM, 1, { size: 20, spacing: 6, weight: 700 });
  side(t, 'LA REGLA DE ORO', ['Lo más ligero', 'posible'], V(74) + 4.0, { y: 160, size: 80, maxW: 1200, lead: 84 });
}

// MacPherson invertido: el cambio de orientación.
function drawColumn(t, { cx, cy, rot = 0, s = 1, inverted = false }) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#B9BDC2'; ctx.fillRect(-36, 20, 72, 260);
  ctx.fillStyle = '#9EA2A8'; ctx.fillRect(-13, -280, 26, 320);
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = 2.5; ctx.strokeRect(-36, 20, 72, 260); ctx.strokeRect(-13, -280, 26, 300);
  ctx.beginPath(); ctx.arc(0, -300, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 302, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function sFlip(t, s0) {
  bg(); dots(0.04);
  const k = ease.inOut(prog(t, V(79) + 0.1, V(79) + 1.2));
  drawColumn(t, { cx: 1300, cy: 540, rot: Math.PI * k, s: 1.1 });
  const before = 1 - k, after = k;
  label(ctx, 'VARILLA FINA · ARRIBA', 1400, 260, DIM, prog(t, V(78) + 2.0, V(78) + 2.5) * (1 - after * 2), { size: 24, spacing: 6, weight: 700 });
  label(ctx, 'TUBO GRUESO · ABAJO', 1400, 760, COLOR.paper, prog(t, V(78) + 1.0, V(78) + 1.5) * (1 - after * 2), { size: 24, spacing: 6, weight: 700 });
  label(ctx, 'TUBO GRUESO · ARRIBA', 1400, 360, COLOR.paper, clamp(after * 2 - 1), { size: 24, spacing: 6, weight: 700 });
  label(ctx, 'VARILLA FINA · ABAJO', 1400, 860, DIM, clamp(after * 2 - 1), { size: 24, spacing: 6, weight: 700 });
  side(t, 'EN LUGAR DE PONER EL TUBO GRUESO ABAJO', ['Le dieron', 'la vuelta'], V(79) + 0.1, { y: 470, size: 120 });
}
function sInverted(t, s0) {
  bg(); dots(0.04);
  drawStrut(t, { cx: 1180, cy: 640, s: 1.15, inverted: true, travel: 80 * Math.sin((t - s0) * 2.2), heavyHi: ease.out(prog(t, s0 + 0.6, s0 + 1.4)), labels: prog(t, V(80) + 0.6, V(80) + 1.2) });
  side(t, 'MACPHERSON INVERTIDO', ['Lo pesado, al chasis'], V(82) + 0.3, { y: 880, size: 80, maxW: 640 });
  label(ctx, 'Lo ligero sube y baja con la rueda', M, 950, COLOR.red, prog(t, V(83) + 0.4, V(83) + 0.9), { size: 40, spacing: 0, weight: 600 });
}
// Rigidez frente a las fuerzas laterales.
function sBend(t, s0) {
  bg(); dots(0.04);
  const bf = osc(t - s0, 0.5, -Math.PI / 2) * ease.out(prog(t, s0 + 0.6, s0 + 1.2));
  drawStrut(t, { cx: 640, cy: 640, s: 0.95, bendF: bf });
  drawStrut(t, { cx: 1260, cy: 640, s: 0.95, inverted: true, bendF: bf });
  for (const x of [640 + 120 * 0.95 + 230, 1260 + 120 * 0.95 + 230]) {
    ctx.save(); ctx.globalAlpha = bf; ctx.strokeStyle = COLOR.fire; ctx.fillStyle = COLOR.fire; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x + 160, 800); ctx.lineTo(x + 20, 800); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, 800); ctx.lineTo(x + 26, 784); ctx.lineTo(x + 26, 816); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  label(ctx, 'CONVENCIONAL', 760, 1010, DIM, prog(t, s0 + 0.4, s0 + 0.8), { size: 24, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'INVERTIDO', 1380, 1010, COLOR.paper, prog(t, s0 + 0.5, s0 + 0.9), { size: 24, spacing: 7, weight: 700, align: 'center' });
  side(t, 'APORTÓ UNA', ['Rigidez estructural monstruosa'], V(85) + 1.4, { y: 170, size: 80, maxW: 1600 });
}

// Sobre los agujeros: la carrocería flota plana y las ruedas buscan el fondo.
function sPothole(t, s0) {
  bg(); dots(0.04);
  const v = 420;
  const road = (x) => { const ph = ((x + (t - s0) * v) % 700 + 700) % 700; return ph > 300 && ph < 460 ? 70 * Math.sin(Math.PI * (ph - 300) / 160) : 0; };
  const gy = 820;
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = gy + road(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  const cx = 1100, s = 0.9, body = gy;
  // Carrocería nivelada (línea de referencia) y ruedas que bajan al bache.
  ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(127,180,221,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(600, body - 360 * s); ctx.lineTo(1650, body - 360 * s); ctx.stroke(); ctx.restore();
  drawRallyCar(t, { cx, cy: body, s, wing: 1, droop: 0, rot: (t - s0) * 5, appear: 0.999 });
  for (const wx of [cx + CAR.rx * s, cx + CAR.fx * s]) {
    const d = road(wx);
    if (d > 2) { ctx.fillStyle = COLOR.ink; ctx.beginPath(); ctx.arc(wx, gy + CAR.wy * s, CAR.r * s + 2, 0, Math.PI * 2); ctx.fill(); wheelSide(wx, gy + CAR.wy * s + d, CAR.r * s, (t - s0) * 5, { color: COLOR.red }); }
  }
  label(ctx, 'CARROCERÍA NIVELADA', 1650, body - 360 * s - 18, COLOR.gas, prog(t, s0 + 0.6, s0 + 1.0), { size: 22, spacing: 6, weight: 700, align: 'right' });
  side(t, 'CUANDO PASA SOBRE AGUJEROS', ['La carrocería', 'flota plana'], V(92) + 0.4, { y: 300, size: 100, maxW: 700 });
  label(ctx, 'Las ruedas buscan el fondo del bache', M, 470, COLOR.red, prog(t, V(92) + 2.6, V(92) + 3.1), { size: 36, spacing: 0, weight: 600 });
}

// El tope de goma de antes: golpe seco y rebote.
function forceRubber(x) { return x < 0.8 ? x * 0.5 : 0.4 + (x - 0.8) * 0.5 + Math.pow((x - 0.8) / 0.2, 4) * 3.2; }
function forceHydro(x) { return x < 0.8 ? x * 0.5 : 0.4 + (x - 0.8) * 0.5 + Math.pow((x - 0.8) / 0.2, 1.6) * 1.1; }
function sRubber(t, s0) {
  bg(); dots(0.04);
  const cyc = ((t - s0 - 0.5) % 2.4 + 2.4) % 2.4;
  const st = cyc < 0.7 ? ease.inQuad(cyc / 0.7) : cyc < 1.0 ? 1 - 0.55 * Math.sin(Math.PI * (cyc - 0.7) / 0.6) : 0.45 * (1 - (cyc - 1.0) / 1.4);
  drawDamper(t, { cx: 1000, y0: 330, s: 1.1, stroke: st, vel: cyc < 0.7 ? 1 : -1 });
  // Taco de goma bajo la tapa.
  ctx.save(); ctx.fillStyle = '#4A4E55'; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2;
  const by = 330 + 1.1 * 40;
  ctx.beginPath(); ctx.roundRect(1000 - 1.1 * 40, by, 1.1 * 80, 1.1 * 54, 10); ctx.fill(); ctx.stroke(); ctx.restore();
  const hit = cyc > 0.62 && cyc < 0.9 ? 1 - Math.abs(cyc - 0.72) / 0.18 : 0;
  if (hit > 0) shock(1000, by + 20, clamp((cyc - 0.62) / 0.3), 160);
  label(ctx, 'TACO DE GOMA', 1060, by + 30, COLOR.paper, prog(t, s0 + 0.6, s0 + 1.0), { size: 22, spacing: 6, weight: 700 });
  // Fuerza contra recorrido: el pico al final.
  axes(1260, 380, 500, 420, prog(t, s0, s0 + 0.6));
  plotSeries(forceRubber, { x0: 1260, y0: 380, w: 500, h: 420, t0: 0, t1: 1, vmin: 0, vmax: 3.8, color: COLOR.red, width: 5, draw: ease.inOut(prog(t, s0 + 0.6, s0 + 2.0)) });
  label(ctx, 'RECORRIDO', 1760, 850, DIM, 1, { size: 20, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'FUERZA', 1276, 360, DIM, 1, { size: 20, spacing: 6, weight: 700 });
  side(t, 'EN EL PASADO, AL LÍMITE DEL RECORRIDO', ['Un taco', 'de goma'], V(97) + 0.2, { y: 420, size: 100, maxW: 560 });
  label(ctx, 'El impacto, a la columna', M, 640, COLOR.red, prog(t, V(98) + 1.6, V(98) + 2.1), { size: 36, spacing: 0, weight: 700 });
  label(ctx, 'vertebral del piloto', M, 690, COLOR.red, prog(t, V(98) + 1.8, V(98) + 2.3), { size: 36, spacing: 0, weight: 700 });
}
// Topes hidráulicos: un amortiguador dentro del amortiguador.
function sHbs(t, s0, s1) {
  bg(); dots(0.04);
  const z = lerp(0.9, 1.5, ease.inOut(prog(t, s0 + 0.6, s0 + 2.6)));
  camera(1250, lerp(560, 760, ease.inOut(prog(t, s0 + 0.6, s0 + 2.6))), z, () =>
    drawDamper(t, { cx: 1250, y0: 300, s: 0.86, stroke: 0.4 + 0.3 * osc(t - s0, 0.5), vel: oscV(t - s0, 0.5), hbs: ease.out(prog(t, s0 + 0.4, s0 + 1.2)) }));
  scrim(760, 0.9);
  side(t, 'AMORTIGUADORES DENTRO DEL AMORTIGUADOR', ['Topes', 'hidráulicos'], V(101) + 0.1, { y: 470, size: 120, colors: [COLOR.paper, COLOR.yellow], maxW: 600 });
}
function sHbsWork(t, s0) {
  bg(); dots(0.04);
  const cyc = ((t - s0 - 0.3) % 3 + 3) % 3;
  const st = cyc < 1.4 ? ease.inOut(cyc / 1.4) : 1 - ease.inOut((cyc - 1.4) / 1.6);
  const vel = cyc < 1.4 ? 1 : -1;
  camera(1000, 760, 1.25, () => drawDamper(t, { cx: 1000, y0: 300, s: 0.86, stroke: st, vel, hbs: 1 }));
  // Cota de los últimos 3 o 4 centímetros.
  ctx.save(); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 3; ctx.globalAlpha = prog(t, V(102) + 1.0, V(102) + 1.5);
  ctx.beginPath(); ctx.moveTo(1150, 640); ctx.lineTo(1150, 760); ctx.moveTo(1135, 640); ctx.lineTo(1165, 640); ctx.moveTo(1135, 760); ctx.lineTo(1165, 760); ctx.stroke(); ctx.restore();
  label(ctx, '3–4 cm', 1180, 710, COLOR.yellow, prog(t, V(102) + 1.2, V(102) + 1.7), { size: 30, spacing: 2, weight: 700 });
  axes(1320, 380, 460, 420, 1);
  plotSeries(forceRubber, { x0: 1320, y0: 380, w: 460, h: 420, t0: 0, t1: 1, vmin: 0, vmax: 3.8, color: 'rgba(215,38,45,0.5)', width: 3 });
  plotSeries(forceHydro, { x0: 1320, y0: 380, w: 460, h: 420, t0: 0, t1: 1, vmin: 0, vmax: 3.8, color: COLOR.yellow, width: 5, draw: ease.inOut(prog(t, V(104) - 0.4, V(104) + 1.2)) });
  label(ctx, 'GOMA', 1760, 420, COLOR.red, 0.8, { size: 20, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'HIDRÁULICO', 1760, 640, COLOR.yellow, prog(t, V(104), V(104) + 0.5), { size: 20, spacing: 6, weight: 700, align: 'right' });
  side(t, 'UN PISTÓN SECUNDARIO EN UN CILINDRO CERRADO', ['Frenado', 'progresivo'], V(104) + 0.2, { y: 420, size: 100, maxW: 520 });
}
// Absorbe una tonelada de energía y la disipa como calor.
function sEnergy(t, s0) {
  bg(); dots(0.04);
  const x0 = 900, y0 = 300, w = 860, h = 460;
  axes(x0, y0, w, h, 1);
  const fill = ease.inOut(prog(t, s0 + 0.4, s0 + 2.4));
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0 + h);
  for (let i = 0; i <= 120; i++) { const u = i / 120 * fill; ctx.lineTo(x0 + w * u, y0 + h - h * forceHydro(u) / 3.8); }
  ctx.lineTo(x0 + w * fill, y0 + h); ctx.closePath();
  ctx.fillStyle = mixColor('#E9A825', '#EE7A1E', fill); ctx.globalAlpha = 0.45; ctx.fill(); ctx.restore();
  plotSeries(forceHydro, { x0, y0, w, h, t0: 0, t1: 1, vmin: 0, vmax: 3.8, color: COLOR.yellow, width: 5 });
  label(ctx, 'ENERGÍA ABSORBIDA', x0 + w * 0.55, y0 + h - 40, COLOR.ink, fill, { size: 24, spacing: 6, weight: 800, align: 'center' });
  side(t, 'ABSORBE', ['Una tonelada', 'de energía'], V(105) + 0.4, { y: 420, size: 110, maxW: 680 });
  label(ctx, 'en milisegundos, y la disipa como calor', M, 620, COLOR.fire, prog(t, V(105) + 2.2, V(105) + 2.7), { size: 36, spacing: 0, weight: 600 });
}
// Control de rebote: válvulas que detectan si la rueda está en el aire.
function sValve(t, s0) {
  bg(); dots(0.04);
  const air = osc(t - s0, 0.35, -Math.PI / 2);
  drawRallyCar(t, { cx: 1250, cy: 760 - 140 * air, s: 0.85, droop: air, rot: (t - s0) * 4 });
  ctx.fillStyle = 'rgba(232,233,230,0.35)'; ctx.fillRect(700, 760, 1100, 2);
  // Estado de la válvula de rebote (símbolo genérico).
  const open = air > 0.55;
  const vx = 1250, vy = 230;
  ctx.save(); ctx.strokeStyle = open ? COLOR.gas : COLOR.steel; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(vx, vy, 46, 0, Math.PI * 2); ctx.stroke();
  ctx.translate(vx, vy); ctx.rotate(open ? Math.PI / 2 : 0);
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke(); ctx.restore();
  label(ctx, open ? 'VÁLVULA ABIERTA · RUEDA EN EL AIRE' : 'VÁLVULA CERRADA', vx + 80, vy + 10, open ? COLOR.gas : DIM, 1, { size: 22, spacing: 6, weight: 700 });
  side(t, 'AL MISMO TIEMPO', ['Control', 'de rebote'], V(107) + 0.4, { y: 420, size: 110, maxW: 560 });
  label(ctx, 'Válvulas que detectan si la rueda', M, 640, COLOR.paper, prog(t, V(107) + 2.6, V(107) + 3.1), { size: 36, spacing: 0, weight: 600 });
  label(ctx, 'está en el aire', M, 690, COLOR.paper, prog(t, V(107) + 2.8, V(107) + 3.3), { size: 36, spacing: 0, weight: 600 });
}
// El agujero: sin válvula, la rueda tarda; con válvula, toca el fondo.
const hole = (tt) => { const ph = tt % 2.0; return ph > 0.6 && ph < 0.9 ? -0.1 * Math.sin(Math.PI * (ph - 0.6) / 0.3) : 0; };
function sHole(t, s0) {
  bg(); dots(0.04);
  const tt = (t - s0) % 30;
  const SA = quarterSim('holeSlow', { mu: 0.2, road: hole, T: 30, rebound: 1, cs: 14 }), SB = quarterSim('holeFast', { mu: 0.2, road: hole, T: 30, rebound: 0.05, cs: 14 });
  drawQuarter(t, { x: 820, y: 260, S: SA, tt, label2: 'SIN VÁLVULA', roadW: 440 });
  drawQuarter(t, { x: 1420, y: 260, S: SB, tt, label2: 'CON VÁLVULA', roadW: 440 });
  for (const [S, x, col] of [[SA, 620, COLOR.steel], [SB, 1220, COLOR.gas]]) {
    axes(x, 760, 400, 150, 1);
    plotSeries((q) => simAt(S, q)[2], { x0: x, y0: 760, w: 400, h: 150, t0: Math.max(0, tt - 3.2), t1: tt, vmin: 0, vmax: 36, color: col, width: 3, n: 240 });
  }
  label(ctx, 'AGARRE', 620, 740, DIM, 1, { size: 20, spacing: 6, weight: 700 });
  side(t, 'SI HAY UN AGUJERO', ['Nunca pierde tracción'], V(109) + 4.6, { y: 160, size: 80, maxW: 1400 });
}

// Rally1: más peso, menos aerodinámica, caja más simple.
function sRally1(t, s0) {
  bg(); dots(0.04);
  drawRallyCar(t, { cx: 1180, cy: 860, s: 1.0, battery: ease.out(prog(t, V(114) + 0.4, V(114) + 1.0)), aeroCut: ease.inOut(prog(t, V(115) + 0.4, V(115) + 1.2)), gearbox: ease.out(prog(t, V(115) + 2.6, V(115) + 3.2)), droop: -0.25 * ease.out(prog(t, V(114) + 0.8, V(114) + 1.4)) });
  const rows = [['+100 kg · BATERÍAS', V(114) + 0.8, COLOR.gas], ['AERODINÁMICA RECORTADA', V(115) + 0.8, COLOR.steel], ['CAJA DE CAMBIOS MÁS SIMPLE', V(115) + 3.0, COLOR.yellow]];
  rows.forEach(([s, tt, col], i) => label(ctx, s, M, 520 + i * 70, col, prog(t, tt, tt + 0.5), { size: 30, spacing: 6, weight: 700 }));
  side(t, 'HOY, CON LOS HÍBRIDOS RALLY1', ['Mayor que nunca'], s0 + 0.4, { y: 300, size: 100, maxW: 700 });
}
// Quién carga con todo: la suspensión.
function sLoad(t, s0) {
  bg(); dots(0.04);
  const comp = ease.out(prog(t, V(118) - 0.2, V(118) + 0.6));
  drawRallyCar(t, { cx: 1180, cy: 900, s: 1.0, battery: 1, droop: -0.6 * comp });
  for (const wx of [1180 + CAR.rx, 1180 + CAR.fx]) {
    ctx.save(); ctx.globalAlpha = prog(t, s0 + 0.6, s0 + 1.2); ctx.strokeStyle = COLOR.red; ctx.fillStyle = COLOR.red; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(wx, 330); ctx.lineTo(wx, 470); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, 500); ctx.lineTo(wx - 16, 470); ctx.lineTo(wx + 16, 470); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  side(t, '¿QUIÉN CARGA CON TODO ESE ESTRÉS?', ['La suspensión'], V(118) - 0.05, { y: 200, size: 110, colors: [COLOR.red], maxW: 1200 });
}
// Ordenadores analógicos de fluidos, calibrados para cada piloto, rally y clima.
function sShims(t, s0) {
  bg(); dots(0.04);
  const f = 0.9;
  camera(1000, 560, 1.7, () => drawDamper(t, { cx: 1000, y0: 300, s: 0.86, stroke: 0.42 + 0.06 * Math.sin((t - s0) * f * 6.28), vel: oscV(t - s0, f) * 1.2, shims: 1 }));
  scrim(760, 0.92);
  // Panel genérico de ajuste: tres filas con sus clics.
  const px = 1320, py = 300;
  ctx.save(); ctx.globalAlpha = ease.out(prog(t, V(121), V(121) + 0.5)); ctx.fillStyle = 'rgba(23,25,29,0.92)'; ctx.beginPath(); ctx.roundRect(px, py, 480, 420, 20); ctx.fill(); ctx.restore();
  [['PILOTO', V(121) + 0.6], ['RALLY', V(122) + 0.1], ['CLIMA', V(122) + 0.8]].forEach(([n, tt], i) => {
    const a = prog(t, tt, tt + 0.4);
    label(ctx, n, px + 40, py + 90 + i * 120, COLOR.paper, a, { size: 24, spacing: 7, weight: 700 });
    const clicks = Math.round(lerp(4, [7, 3, 9][i], ease.inOut(prog(t, tt, tt + 1.0))));
    for (let k = 0; k < 12; k++) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = k < clicks ? COLOR.yellow : 'rgba(232,233,230,0.18)'; ctx.fillRect(px + 40 + k * 34, py + 110 + i * 120, 24, 10); ctx.restore(); }
  });
  side(t, 'LOS AMORTIGUADORES ACTUALES SON', ['Ordenadores', 'analógicos', 'de fluidos'], V(120) + 1.6, { y: 340, size: 96, colors: [COLOR.paper, COLOR.paper, COLOR.oil], maxW: 560 });
  label(ctx, 'Calibrados al milímetro', M, 680, COLOR.yellow, prog(t, V(121) + 0.1, V(121) + 0.6), { size: 36, spacing: 0, weight: 700 });
}
// Escondido detrás de las llantas.
function sRim(t, s0) {
  bg(); dots(0.04);
  const cx = 1180, cy = 560, r = 330;
  const xr = ease.inOut(prog(t, V(126) + 0.4, V(126) + 1.6));
  // El conjunto muelle-amortiguador detrás de la llanta.
  ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * xr;
  coil(cx + 40, cy - 330, cx + 40, cy - 60, { turns: 6, r: 50, color: COLOR.yellow, width: 5 });
  ctx.fillStyle = '#B9BDC2'; ctx.fillRect(cx + 10, cy - 60, 60, 260);
  ctx.restore();
  // Neumático y llanta de radios, que gira despacio y se vuelve translúcida.
  ctx.save();
  ctx.fillStyle = COLOR.ink; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, r + 90, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.translate(cx, cy); ctx.rotate((t - s0) * 0.35);
  ctx.globalAlpha = 1 - 0.75 * xr;
  ctx.fillStyle = '#2A2D33';
  for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate((k / 6) * Math.PI * 2); ctx.beginPath(); ctx.moveTo(-26, 60); ctx.lineTo(-40, r - 10); ctx.lineTo(40, r - 10); ctx.lineTo(26, 60); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  side(t, 'EL VERDADERO MILAGRO DE LA INGENIERÍA', ['Escondido detrás', 'de las llantas'], V(126) + 0.3, { y: 470, size: 100, maxW: 620 });
}

// Cierre: logotipo y suscripción.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 740, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = la; ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h); ctx.restore();
  pill(t, 'Suscríbete', W / 2 - 230, 740, V(128) - 0.2, { press: V(128) + 0.4, color: COLOR.red, size: 40 });
  pill(t, 'Me gusta', W / 2 + 230, 740, V(129) - 0.2, { press: V(129) + 0.6, color: COLOR.ink2, pressed: COLOR.steel, text: COLOR.paper, size: 40 });
  label(ctx, '¿De qué otra tecnología quieres que hablemos?', W / 2, 880, DIM, prog(t, V(130), V(130) + 0.5), { size: 42, spacing: 0, weight: 600, align: 'center' });
  label(ctx, '¡Hasta la próxima!', W / 2, 960, COLOR.paper, prog(t, V(131), V(131) + 0.5), { size: 46, spacing: 0, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, sIntro, 'dissolve'],
  [cut(3), kType({ tag: 'EN LOS RALLYS HAY UNA REGLA NO ESCRITA', title: ['Una ley física', 'inquebrantable'], tt: V(5) + 0.1, size: 150 }), 'whip'],
  [cut(6), sContact, 'cube'],
  [cut(7), kClip({ seg: 'ford', speed: 0.45, fx: 0.5, fy: 0.45, tag: 'UN WORLD RALLY CAR', tagT: V(7) + 0.3, title: ['Volar 50 metros', 'a 160 km/h'], tt: V(7) + 1.4, size: 110 }), 'dissolve'],
  [snap(V(7) + 4.6), sJumpArc, 'fly'],
  [cut(8), kPhoto3({ img: 'asistenciaCitroen', fx: 0.4, fy: 0.45, yaw: [0.05, -0.02], tag: 'EL RESULTADO DE', tagT: V(8) + 0.1, title: ['Décadas de ingeniería', 'extrema'], tt: V(8) + 0.9, size: 120, colors: [COLOR.paper, COLOR.red] }), 'slices'],
  [cut(9), sCutaway, 'dissolve'],
  [cut(10), sMapEras, 'wipe'],
  [cut(11), kChapter({ img: 'stratos1975', fx: 0.5, fy: 0.5, era: 0, tag: 'VIAJEMOS A', title: ['Los años 70'], tt: V(11) + 0.6, label: 'Los coches apenas sobrevivían', labelT: V(16) + 0.4 }), 'cubeV'],
  [cut(17), kType({ tag: 'EN ESTA ÉPOCA, LAS SUSPENSIONES ERAN', title: ['Increíblemente', 'primitivas'], tt: V(18) + 0.5, size: 160 }), 'dissolve'],
  [cut(19), sLeaf, 'slices'],
  [cut(21), kTravel(0, 'EL RECORRIDO: LO QUE LA RUEDA PUEDE SUBIR Y BAJAR', ['Apenas 10 o 15 centímetros'], () => V(24) + 0.6), 'cube'],
  [cut(25), sDamper, 'dissolve'],
  [cut(26), sCavitation, 'cut'],
  [cut(29), sBounce, 'whip'],
  [cut(32), kType({ title: ['Luchar contra el coche', 'y contra el cronómetro'], tt: V(32) + 1.4, size: 130, colors: [COLOR.paper, COLOR.red] }), 'dissolve'],
  [cut(33), kChapter({ img: 'asistenciaS4', fx: 0.5, fy: 0.4, era: 1, tag: 'LLEGARON LOS AÑOS 80', title: ['La bomba', 'del Grupo B'], tt: V(33) + 1.6, colors: [COLOR.paper, COLOR.red] }), 'wipe'],
  [cut(34), sPower, 'cubeV'],
  [cut(35), kClip({ seg: 'vw', speed: 0.42, fx: 0.5, fy: 0.45, tag: 'DE REPENTE, LAS VELOCIDADES Y', tagT: V(35) + 0.3, title: ['Los saltos', 'se multiplicaron'], tt: V(36) + 1.6, size: 120 }), 'whip'],
  [cut(37), sBreak, 'cut'],
  [cut(38), kPhoto({ img: 'asistenciaLancia', fx: 0.5, fy: 0.45, z: [1.12, 1.04], dark: 0.4, title: ['Los ingenieros', 'estaban desesperados'], tt: V(38) + 0.2, size: 110 }), 'dissolve'],
  [cut(39), sHeat, 'slices'],
  [cut(40), kType({ title: ['¿La solución del Grupo B?'], tt: V(40) + 0.1, size: 130 }), 'cut'],
  [cut(41), kType({ title: ['Multiplicar', 'el hardware'], tt: V(41) + 0.05, size: 170, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(42), kSplit({ img: 'suspensionS4', side: 'left', fx: 0.5, fy: 0.5, tag: 'LANCIA DELTA S4 · AUDI QUATTRO', title: ['Doble amortiguador', 'por rueda'], tt: V(42) + 3.4, size: 110 }), 'cube'],
  [cut(43), sDouble, 'dissolve'],
  [cut(45), sWishbone, 'slices'],
  [snap(V(47) + 5.0), sLateral, 'cut'],
  [cut(48), kType({ tag: 'SEGUIR AÑADIENDO PESO NO ERA LA SOLUCIÓN', title: ['Se necesitaba', 'más ciencia'], tt: V(49) + 0.1, size: 160 }), 'dissolve'],
  [cut(50), kChapter({ img: 'amortiguadorRueda', fx: 0.5, fy: 0.5, era: 2, tag: 'LOS AÑOS 90', title: ['Grupo A'], tt: V(51) + 0.1, label: 'Coches basados en chasis de calle', labelT: V(52) + 0.3 }), 'wipe'],
  [cut(53), sMacPherson, 'cubeV'],
  [cut(54), sFluids, 'dissolve'],
  [cut(56), kPhoto3({ img: 'amortiguadoresRojos', fx: 0.45, fy: 0.45, yaw: [-0.05, 0.02], tag: 'CONTRA LA CAVITACIÓN Y EL CALENTAMIENTO', tagT: V(56) + 0.4, title: ['El depósito remoto'], tt: V(57) + 1.4, size: 130 }), 'slices'],
  [cut(58), sReservoir, 'dissolve'],
  [cut(59), sNitrogen, 'cut'],
  [cut(62), sNoBoil, 'slices'],
  [cut(65), sKm41, 'dissolve'],
  [cut(69), kChapter({ seg: 'crest', speed: 0.5, era: 3, tag: '1997', title: ['World Rally Cars'], tt: V(69) + 1.0, label: 'El reglamento se abrió', labelT: V(70) + 0.2 }), 'wipe'],
  [cut(71), kTravel(1, 'LOS RECORRIDOS DE SUSPENSIÓN SE ESTIRARON', ['Más allá de los 25 centímetros'], () => V(71) + 2.0), 'cube'],
  [cut(72), sQuarter, 'dissolve'],
  [cut(74), sQuarter2, 'slices'],
  [cut(76), kType({ tag: 'PARA LOGRARLO, INVENTARON EL', title: ['MacPherson', 'invertido'], tt: V(77) + 0.3, size: 170, colors: [COLOR.paper, COLOR.red], stripes: true }), 'whip'],
  [cut(78), sFlip, 'dissolve'],
  [cut(80), sInverted, 'cube'],
  [cut(84), kPhoto3({ img: 'amortiguadoresMorados', fx: 0.5, fy: 0.45, yaw: [0.05, -0.02], tag: 'LA RUEDA REACCIONABA', tagT: V(84) + 0.4, title: ['En milisegundos'], tt: V(84) + 1.8, size: 140 }), 'slices'],
  [cut(85), sBend, 'dissolve'],
  [cut(86), kChapter({ seg: 'fly', speed: 0.45, era: 4, tag: 'SI MIRAS UN RALLY HOY', title: ['Algo antinatural'], tt: V(87) + 0.3 }), 'wipe'],
  [cut(88), kClip({ seg: 'land', speed: 0.45, fx: 0.5, fy: 0.5, tag: 'CUANDO UN WRC SALTA', tagT: V(88) + 0.2, title: ['Vuela nivelado.', 'Aterriza sin rebotar.'], tt: V(89) + 0.2, size: 110 }), 'cut'],
  [cut(91), sPothole, 'cubeV'],
  [cut(93), kType({ title: ['¿Cómo es posible?'], align: 'center', tt: V(93) + 0.05, size: 170 }), 'cut'],
  [cut(94), kType({ tag: 'BIENVENIDOS A LA MAGIA DE', title: ['Las válvulas de frecuencia', 'y los topes hidráulicos'], tt: V(94) + 1.2, size: 120, colors: [COLOR.gas, COLOR.yellow] }), 'dissolve'],
  [cut(95), sRubber, 'slices'],
  [cut(99), sHbs, 'cube'],
  [cut(102), sHbsWork, 'dissolve'],
  [cut(105), sEnergy, 'cut'],
  [cut(106), sValve, 'slices'],
  [cut(108), sHole, 'dissolve'],
  [cut(111), kChapter({ img: 'asistenciaCitroen', fx: 0.6, fy: 0.5, gray: true, era: 4, tag: 'HOY', title: ['Los híbridos', 'Rally1'], tt: V(112) + 0.6, label: 'El desafío es mayor que nunca', labelT: V(113) + 0.2 }), 'wipe'],
  [cut(114), sRally1, 'cubeV'],
  [cut(116), sLoad, 'dissolve'],
  [cut(119), kTravel(2, 'LOS RECORRIDOS SUPERAN HOY', ['Los 30 centímetros'], () => V(119) + 1.6), 'cube'],
  [cut(120), sShims, 'dissolve'],
  [cut(123), kClip({ seg: 'c3', speed: 0.42, fx: 0.5, fy: 0.45, tag: 'PUEDES PONERLE A UN COCHE', tagT: V(123) + 0.2, title: ['Mil caballos de fuerza'], tt: V(123) + 1.2, size: 120 }), 'whip'],
  [snap(V(125) + 0.4), kClip({ seg: 'land', from: 1.2, speed: 0.4, fx: 0.5, fy: 0.5, tag: 'UN WRC PUEDE', tagT: V(125) + 0.6, title: ['Desafiar las leyes', 'de la física'], tt: V(125) + 1.6, size: 120 }), 'dissolve'],
  [cut(126), sRim, 'dissolve'],
  [cut(127), sChannel, 'wipe'],
];

// Ventanas de uso de cada tramo de archivo, para cargar sus fotogramas solo cuando hacen falta.
export const CLIP_USE = (() => {
  const segOf = new Map([[sIntro, 'intro']]);
  const out = [];
  SHOTS.forEach(([s0, fn], i) => {
    const s1 = SHOTS[i + 1]?.[0] ?? DURATION;
    const seg = segOf.get(fn) ?? fn.seg;
    if (seg) out.push([s0 - 0.6, s1 + 0.6, seg]);
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
export const HITS = [cut(33), cut(69), cut(86)];
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
