// Escenas del documental sobre las centralitas en el rally. Todo depende solo de `t`.
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
// ---------------------------------------------------------------------------
// Utilidades de plano.

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
const at = (i, d = 0) => V(i) + d;
// Amplía alrededor de (x, y) y lo coloca en (Fx, Fy) de la pantalla.
function focus(x, y, z, Fx, Fy, fn) { ctx.save(); ctx.translate(Fx, Fy); ctx.scale(z, z); ctx.translate(-x, -y); fn(); ctx.restore(); }

// Tramos del vídeo: a cámara lenta se funden dos fotogramas vecinos.
export const CLIP_N = { c037: 360, escort: 195, quattro: 270, noche: 255, impreza: 180, puma: 180, c3: 240 };
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
  drawSeg(o.seg, (o.from ?? 0) + (t - s0) * (o.speed ?? 1), { zoom: lerp(o.z?.[0] ?? 1.03, o.z?.[1] ?? 1.08, ease.inOut(span(t, s0, s1))), fx: o.fx ?? 0.5, fy: o.fy ?? 0.4, dark: o.dark ?? 0.08 });
  scrimB();
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
}; f.seg = o.seg; f.from = o.from ?? 0; f.speed = o.speed ?? 1; return f; };
const kPhoto3 = (o) => (t, s0, s1) => {
  photo3D(o.img, t, s0, s1, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, yaw: o.yaw ?? [-0.06, 0.03], zoom: o.zoom ?? [1.12, 1.03], dark: o.dark ?? 0.38, gray: o.gray });
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
};
function side(t, tagStr, title, tt, { y = 230, size = 96, colors, label: lab, labelT, maxW = 700, lead, labColor = DIM } = {}) {
  if (tagStr) tag(t, tagStr, M, y - size - 10, tt - 0.25);
  lines(t, title, M, y, lead ?? size * 1.05, size, tt, { maxW, colors });
  if (lab) label(ctx, lab, M, y + (title.length - 1) * (lead ?? size * 1.05) + 70, labColor, prog(t, labelT ?? tt + 0.8, (labelT ?? tt + 0.8) + 0.5), { size: 36, spacing: 0, weight: 600 });
}
const ERAS = ['AÑOS 60', 'AÑOS 70', 'AÑOS 80', 'AÑOS 90', '1997', '2022'];
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
const kChapter = (o) => (t, s0, s1) => {
  bg();
  const u = span(t, s0, s1);
  if (o.img) photo(o.img, 0, 0, W, H, { zoom: lerp(o.z?.[0] ?? 1.12, o.z?.[1] ?? 1.03, ease.out(u)), fx: o.fx ?? 0.5, fy: o.fy ?? 0.5 }, { dark: 0.55, vig: 0.6, gray: o.gray });
  tag(t, o.tag, M, 420, o.tagT ?? o.tt - 0.2);
  lines(t, o.title, M, 560, 150, 150, o.tt, { colors: o.colors });
  if (o.label) label(ctx, o.label, M, 560 + (o.title.length - 1) * 150 + 90, COLOR.paper, prog(t, o.labelT, o.labelT + 0.5), { size: 44, spacing: 0, weight: 600 });
  if (o.era != null) drawEras(t, o.era, ease.out(prog(t, s0 + 0.2, s0 + 1.0)));
};
// Rótulo técnico pequeño con línea guía hacia un punto.
function pin(t, x, y, lx, ly, str, t0, color = COLOR.paper, align = null) {
  const p = ease.outExpo(prog(t, t0, t0 + 0.5));
  if (p <= 0) return;
  ctx.save(); ctx.globalAlpha *= p; ctx.strokeStyle = 'rgba(232,233,230,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, lx, p), lerp(y, ly, p)); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const al = align ?? (lx < x ? 'right' : 'left');
  label(ctx, str, lx + (al === 'right' ? -12 : al === 'left' ? 12 : 0), ly + 8, color, prog(t, t0 + 0.2, t0 + 0.6), { size: 24, spacing: 6, weight: 700, align: al });
}
// Barra de magnitud con nombre y valor.
function meter(t, x, y, w, v, appear, name, color, { valueStr = null, h = 22 } = {}) {
  if (appear <= 0) return;
  ctx.save(); ctx.globalAlpha *= appear;
  ctx.fillStyle = 'rgba(232,233,230,0.14)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(v), h);
  ctx.restore();
  label(ctx, name, x, y - 16, DIM, appear, { size: 22, spacing: 6, weight: 700 });
  if (valueStr) label(ctx, valueStr, x + w, y - 16, COLOR.paper, appear, { size: 22, spacing: 2, weight: 700, align: 'right' });
}
const spinRot = (t, t0, rps0, rps1 = rps0, d = 1) => {
  // giro con régimen que pasa linealmente de rps0 a rps1 en d segundos (integral exacta).
  const u = Math.max(0, t - t0), k = Math.min(u, d);
  const a = rps0 * k + (rps1 - rps0) * k * k / (2 * d) + rps1 * Math.max(0, u - d);
  return a * Math.PI * 2;
};


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
// ---------------------------------------------------------------------------
// Apertura.

function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 720, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.2))));
  ctx.drawImage(lg, W / 2 - w / 2, 410 - h / 2, w, h);
  ctx.restore();
  revealText(ctx, 'Las centralitas en el rally', W / 2, 860, FONT.display(800, 112), COLOR.paper, prog(t, 0.55, 1.3), { align: 'center', stagger: 0.016 });
  stripesH(ctx, 910, 10, prog(t, 0.95, 1.65), 0, { x0: W / 2 - 260, x1: W / 2 + 260 });
}

// Hasta 1.000 veces por segundo: cuatro canales de cálculo con sus pulsos.
function sRate(t, s0) {
  bg(); dots(0.03);
  tag(t, 'LA CENTRALITA DE UN COCHE DEL WRC CALCULA', M, 200, at(3) - 0.2);
  const rows = [['INYECCIÓN', at(3) + 2.2, COLOR.yellow], ['ENCENDIDO', at(4), COLOR.fire], ['PRESIÓN DEL TURBO', at(5) + 0.1, COLOR.blue], ['REPARTO DE PAR', at(5) + 1.6, COLOR.paper]];
  const x0 = M, x1 = W - M, y0 = 330;
  rows.forEach(([name, t0, col], i) => {
    const y = y0 + i * 120;
    const a = ease.out(prog(t, t0, t0 + 0.5));
    if (a <= 0) return;
    label(ctx, name, x0, y + 8, COLOR.paper, a, { size: 26, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(232,233,230,0.14)'; ctx.fillRect(560, y, x1 - 560, 2);
    // Pulsos que avanzan a ritmo fijo: cada uno es un cálculo.
    const speed = 380, gap = 34;
    for (let k = 0; k < 40; k++) {
      const x = 560 + ((k * gap + (t - t0) * speed) % (x1 - 560));
      const rise = ease.outExpo(prog(t, t0 + k * 0.02, t0 + k * 0.02 + 0.4));
      ctx.fillStyle = col; ctx.fillRect(x, y - 26 * rise, 6, 26 * rise);
    }
    ctx.restore();
  });
  const cnt = prog(t, at(5) + 2.8, at(5) + 4.0);
  if (cnt > 0) {
    ctx.save(); ctx.globalAlpha = ease.out(prog(t, at(5) + 2.8, at(5) + 3.1));
    ctx.font = FONT.display(800, 150); ctx.fillStyle = COLOR.paper; ctx.textAlign = 'left';
    ctx.fillText(fmt(1000 * ease.out(cnt)), M, 940); ctx.restore();
    label(ctx, 'veces por segundo', M + 420, 930, COLOR.yellow, prog(t, at(5) + 3.2, at(5) + 3.7), { size: 48, spacing: 0, weight: 700 });
  }
}

// Si el motor es el músculo, la ECU es el sistema nervioso central.
function sNervous(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1290, cy: 560, s: 1.05 };
  const nv = ease.inOut(prog(t, at(7) + 1.8, at(7) + 4.2));
  drawCarECU(t, { ...o, appear: ease.out(prog(t, s0, s0 + 0.6)), nerves: nv, sensors: [1, 1, 1, 1], ecuGlow: prog(t, at(7), at(7) + 1), power: 0 });
  const [mx, my] = carToScreen(o, 195, -25);
  pin(t, mx, my, mx + 60, 160, 'EL MÚSCULO', at(6) + 0.5, COLOR.paper);
  side(t, null, ['ECU'], at(7) + 0.2, { y: 400, size: 200 });
  label(ctx, 'Engine Control Unit', M, 480, DIM, prog(t, at(7) + 1.0, at(7) + 1.5), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'El sistema nervioso', M, 640, COLOR.paper, prog(t, at(7) + 2.8, at(7) + 3.3), { size: 56, spacing: 0, weight: 700 });
  label(ctx, 'central', M, 710, COLOR.yellow, prog(t, at(7) + 3.3, at(7) + 3.8), { size: 56, spacing: 0, weight: 700 });
}

// Abrir la carcasa: la ECU en 3D gira, la tapa sube y la placa sale.
function sOpenECU(t, s0, s1) {
  bg(); dots(0.03);
  const u = prog(t, s0, s1);
  const open = ease.inOut(prog(t, at(13) + 1.2, at(13) + 3.4));
  const lift = ease.inOut(prog(t, at(13) + 2.6, at(13) + 4.6));
  const f = drawECU3D(t, { cx: 1290, cy: 760, s: 1.1, yaw: lerp(-0.85, -0.38, ease.inOut(u)), pitch: lerp(0.5, 0.72, ease.inOut(u)), open, lift, pulse: prog(t, at(13) + 4.6, at(13) + 5.4), appear: ease.out(prog(t, s0, s0 + 0.6)) });
  ecuLabels(t, f, [['mcu', 1440, 600, 'MICROCONTROLADOR'], ['flash', 820, 520, 'MEMORIA FLASH'], ['can1', 820, 700, 'TRANSCEPTORES CAN'], ['drv3', 1440, 720, 'ETAPAS DE POTENCIA']], at(13) + 5.0, 0.45);
  side(t, 'HOY VAMOS A', ['Abrir', 'la carcasa'], at(13) + 0.2, { y: 300, size: 110, maxW: 560 });
  label(ctx, 'Del carburador', M, 560, DIM, prog(t, at(13) + 6.4, at(13) + 6.9), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'a la mecatrónica de los Rally1', M, 612, COLOR.paper, prog(t, at(13) + 7.6, at(13) + 8.1), { size: 40, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Años 60 y 70: carburadores.

function sCarb(t, s0) {
  bg(); dots(0.03);
  const ap = ease.out(prog(t, s0, s0 + 0.6));
  drawCarb(t, { cx: 1270, cy: 440, s: 0.8, appear: ap, air: 1, fuel: ease.out(prog(t, at(18) + 1.5, at(18) + 2.5)), labels: prog(t, at(18) + 0.3, at(19) + 4.2), atm: prog(t, at(18) + 2.2, at(18) + 3.2) });
  label(ctx, 'PRESIÓN ATMOSFÉRICA', 1270 - 360 * 0.8, 440 + 140 * 0.8, COLOR.blue, prog(t, at(18) + 2.6, at(18) + 3.1), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'LA MEZCLA DE AIRE Y GASOLINA', ['Dependía de', 'la física'], at(18) + 0.1, { y: 760, size: 84, maxW: 560 });
  label(ctx, 'Presión, chiclés y depresión', M, 920, DIM, prog(t, at(19) + 2.4, at(19) + 2.9), { size: 36, spacing: 0, weight: 600 });
}

// Montecarlo: el puerto de montaña.
function sAltitude(t, s0) {
  bg(); dots(0.03);
  const a = ease.out(prog(t, s0 + 0.1, s0 + 0.7));
  const x0 = 760, x1 = W - M, yb = 700, ytop = 300;
  const prof = (u) => yb - (ytop - yb) * -1 * (0.08 + 0.92 * (u + 0.06 * Math.sin(u * 14) * u));
  const climb = ease.inOut(prog(t, at(22) + 0.4, at(24) + 3.6));
  // Perfil del puerto.
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.moveTo(x0, yb);
  for (let i = 0; i <= 120; i++) { const u = i / 120; ctx.lineTo(lerp(x0, x1, u), prof(u)); }
  ctx.lineTo(x1, yb); ctx.closePath(); ctx.fillStyle = 'rgba(232,233,230,0.06)'; ctx.fill();
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120; if (i) ctx.lineTo(lerp(x0, x1, u), prof(u)); else ctx.moveTo(x0, prof(0)); } ctx.stroke();
  ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 6;
  ctx.beginPath(); for (let i = 0; i <= 120 * climb; i++) { const u = i / 120; if (i) ctx.lineTo(lerp(x0, x1, u), prof(u)); else ctx.moveTo(x0, prof(0)); } ctx.stroke();
  const cxp = lerp(x0, x1, climb), cyp = prof(climb);
  ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  label(ctx, 'ALTITUD', x1, ytop - 40, DIM, a, { size: 22, spacing: 6, weight: 700, align: 'right' });
  // Muestra de aire: menos moléculas por volumen al subir.
  const dens = 1 - 0.45 * climb;
  const R = rng(9);
  const bx = x0, by = 790, bw = 260, bh = 200;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(23) - 0.3, at(23) + 0.3));
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = COLOR.blue;
  for (let i = 0; i < 70; i++) { const x = bx + 10 + R() * (bw - 20), y = by + 10 + R() * (bh - 20); if (R() < dens) { ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + i) * 3, y + Math.cos(t * 2.3 + i) * 3, 5, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  label(ctx, 'DENSIDAD DEL AIRE', bx, by - 18, COLOR.blue, prog(t, at(23) - 0.3, at(23) + 0.3), { size: 22, spacing: 6, weight: 700 });
  const am = ease.out(prog(t, at(24) - 0.2, at(24) + 0.4));
  meter(t, 1120, 860, 330, 0.4 + 0.55 * climb, am, 'MEZCLA MÁS RICA', COLOR.fire);
  meter(t, 1500, 860, 280, 1 - 0.35 * prog(t, at(24) + 2.0, at(24) + 4.0), ease.out(prog(t, at(24) + 1.8, at(24) + 2.3)), 'POTENCIA', COLOR.yellow);
  side(t, 'SI SUBÍAS UN PUERTO DE MONTAÑA', ['Rally de', 'Montecarlo'], at(22) + 0.2, { y: 400, size: 96, maxW: 560 });
  label(ctx, 'El coche perdía', M, 640, DIM, prog(t, at(24) + 2.4, at(24) + 2.9), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'docenas de caballos', M, 700, COLOR.red, prog(t, at(24) + 2.8, at(24) + 3.3), { size: 52, spacing: 0, weight: 700 });
}

// De aspirada por vacío a inyectada a presión.
function sSuckPress(t, s0) {
  bg(); dots(0.03);
  const L = ease.out(prog(t, s0 + 0.1, s0 + 0.7)), Rr = ease.out(prog(t, at(27) + 2.4, at(27) + 3.0));
  // Izquierda: surtidor que aspira por la depresión.
  ctx.save(); ctx.globalAlpha *= L;
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(180, 380); ctx.quadraticCurveTo(480, 470, 780, 380); ctx.moveTo(180, 700); ctx.quadraticCurveTo(480, 610, 780, 700); ctx.stroke();
  ctx.fillStyle = '#8C9096'; ctx.fillRect(468, 600, 24, 120);
  ctx.restore();
  for (let k = -1; k <= 1; k++) flowLine(poly([[200, 540 + k * 50], [480, 540 + k * 30], [760, 540 + k * 50]]), t, { color: COLOR.blue, width: 5, amount: L, speed: 1.2, offset: k * 20 });
  arrowPath([[480, 820], [480, 640]], ease.out(prog(t, s0 + 0.8, s0 + 1.6)), COLOR.yellow, 6, 18);
  const R = rng(2);
  ctx.save();
  for (let i = 0; i < 20; i++) { const ph = (t * 0.6 + R()) % 1; ctx.globalAlpha = L * (1 - ph); ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(480 + ph * 260, 590 - ph * 40 + (R() - 0.5) * 30 * ph, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  label(ctx, 'ASPIRADA POR VACÍO', 480, 300, COLOR.paper, L, { size: 26, spacing: 6, weight: 700, align: 'center' });
  // Derecha: inyector a presión.
  ctx.save(); ctx.globalAlpha *= Rr;
  ctx.translate(1440, 420); ctx.rotate(Math.PI / 2);
  rr(ctx, -150, -26, 150, 52, 10); ctx.fillStyle = COLOR.paper; ctx.fill(); ctx.fillStyle = COLOR.yellow; ctx.fillRect(-150, -26, 36, 52);
  const R2 = rng(Math.floor(t * 30));
  for (let k = 0; k < 60; k++) { const d = 10 + R2() * 360, a = (R2() - 0.5) * 0.45; ctx.globalAlpha = Rr * (1 - d / 380); ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 4.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  arcGauge(t, 1440, 250, 70, 0.8 * Rr, 1, Rr, 8, COLOR.yellow);
  label(ctx, 'INYECTADA A PRESIÓN', 1440, 900, COLOR.paper, Rr, { size: 26, spacing: 6, weight: 700, align: 'center' });
  ctx.save(); ctx.globalAlpha *= Rr * 0.5; ctx.fillStyle = COLOR.paper; ctx.fillRect(W / 2 - 1, 260, 2, 600); ctx.restore();
}

// La ROM soldada a mano en el parque de asistencia.
function sSolder(t, s0) {
  bg(); dots(0.03);
  const out = prog(t, at(32) + 0.6, at(32) + 2.0), inn = prog(t, at(32) + 2.0, at(32) + 3.4), sold = prog(t, at(32) + 3.6, at(32) + 6.8);
  drawAnalogBoard(t, { cx: 1290, cy: 600, s: 1.1, appear: ease.out(prog(t, s0, s0 + 0.6)), out, inn, solder: sold, iron: ease.out(prog(t, at(32) + 3.2, at(32) + 3.7)) * (1 - prog(t, at(32) + 6.8, at(32) + 7.2)), highlight: prog(t, at(31) + 1.4, at(31) + 2.0) * (1 - prog(t, at(32) + 0.4, at(32) + 0.8)) });
  side(t, 'PARA CAMBIAR EL MAPA DE ENCENDIDO', ['Soldar', 'una ROM nueva'], at(31) + 0.1, { y: 380, size: 100, maxW: 560 });
  label(ctx, 'en pleno parque', M, 640, DIM, prog(t, at(32) + 4.6, at(32) + 5.1), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'de asistencia', M, 692, DIM, prog(t, at(32) + 4.8, at(32) + 5.3), { size: 40, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Grupo A: brida restrictora, turbo lag y anti-lag.

function sRestrictor(t, s0) {
  bg(); dots(0.03);
  const a = ease.out(prog(t, s0, s0 + 0.6));
  const choke = ease.inOut(prog(t, at(34) + 3.6, at(34) + 5.4));
  const y = 560, x0 = 700, x1 = 1640, xr = 1050;
  // Conducto que se estrecha en la brida.
  const half = (x) => lerp(150, lerp(150, 52, choke), Math.exp(-(((x - xr) / 70) ** 2)));
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = COLOR.line; ctx.lineWidth = 3;
  for (const sg of [-1, 1]) { ctx.beginPath(); for (let i = 0; i <= 100; i++) { const x = lerp(x0, x1 - 200, i / 100); if (i) ctx.lineTo(x, y + sg * half(x)); else ctx.moveTo(x, y + sg * half(x)); } ctx.stroke(); }
  ctx.fillStyle = COLOR.yellow;
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(xr - 40, y + sg * 160); ctx.lineTo(xr + 40, y + sg * 160); ctx.lineTo(xr + 6, y + sg * (half(xr) + 2)); ctx.lineTo(xr - 6, y + sg * (half(xr) + 2)); ctx.closePath(); ctx.globalAlpha = a * choke; ctx.fill(); }
  ctx.restore();
  for (let k = -3; k <= 3; k++) {
    const pts = []; for (let i = 0; i <= 60; i++) { const x = lerp(x0, x1 - 220, i / 60); pts.push([x, y + (k / 3.6) * (half(x) - 14)]); }
    flowLine(poly(pts), t, { color: COLOR.blue, width: 4, amount: a, speed: lerp(1.3, 0.6, choke), offset: k * 11 });
  }
  const th = spinRot(t, s0, 4, lerp(4, 2.4, choke), 2);
  drawWheel(th, 0.4, x1 - 60, y, 120, a, { housing: true, blades: 12 });
  label(ctx, 'COMPRESOR', x1 - 60, y + 230, COLOR.paper, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'BRIDA RESTRICTORA', xr, y - 200, COLOR.yellow, prog(t, at(34) + 3.8, at(34) + 4.3), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'BLOQUES DE 2 LITROS CON TURBOCOMPRESOR', ['Una brida', 'que ahogaba', 'el aire'], at(34) + 3.4, { y: 330, size: 96, maxW: 520 });
}

// El turbo lag: el piloto suelta, los gases caen, el turbo se para y vuelve tarde.
function sLag(t, s0) {
  bg(); dots(0.03);
  const tLift = at(36) + 0.8, tBack = at(39) + 0.2;
  const thr = (tt) => (tt < tLift ? 1 : tt < tBack ? 0 : 1);
  const boostAt = (tt) => {
    if (tt < tLift) return 1;
    if (tt < tBack) return Math.exp(-(tt - tLift) * 0.9);
    const b0 = Math.exp(-(tBack - tLift) * 0.9), d = tt - tBack;
    return d < 1.6 ? b0 * Math.exp(-d * 0.5) : lerp(b0 * Math.exp(-0.8), 1, ease.inOut(clamp((d - 1.6) / 1.2)));
  };
  const ex = 0.2 + 0.8 * boostAt(t);
  const th = spinAngle(t, s0, (u) => 0.2 + 3.2 * boostAt(u));
  drawTurboSection(t, { cx: 1240, cy: 430, s: 0.62, th, air: ex, ex, labels: 0 });
  // Gráfica: acelerador y presión del turbo frente al tiempo.
  const gx = 760, gy = 700, gw = 1020, gh = 220, T0 = s0, T1 = s0 + 14;
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TIEMPO' });
  const sweep = prog(t, T0, T1);
  trace2(gx, gy, gw, gh, (u) => thr(lerp(T0, T1, u)) * 0.92, sweep, COLOR.paper, 3);
  trace2(gx, gy, gw, gh, (u) => boostAt(lerp(T0, T1, u)) * 0.8, sweep, COLOR.yellow, 5);
  label(ctx, 'ACELERADOR', gx + 12, gy - 6, COLOR.paper, prog(t, s0 + 0.6, s0 + 1.1), { size: 20, spacing: 6, weight: 700 });
  label(ctx, 'PRESIÓN DEL TURBO', gx + 220, gy - 6, COLOR.yellow, prog(t, s0 + 0.8, s0 + 1.3), { size: 20, spacing: 6, weight: 700 });
  // Vacío de potencia.
  const xb = gx + gw * (tBack - T0) / (T1 - T0), xe = gx + gw * (tBack + 2.2 - T0) / (T1 - T0);
  const v = ease.out(prog(t, at(40) + 0.3, at(40) + 0.9));
  if (v > 0) { ctx.save(); ctx.globalAlpha *= v * 0.35; ctx.fillStyle = COLOR.red; ctx.fillRect(xb, gy, xe - xb, gh); ctx.restore(); }
  label(ctx, 'VACÍO DE POTENCIA', (xb + xe) / 2, gy - 16, COLOR.red, v, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'EL GRAN PROBLEMA TÉCNICO', ['Turbo lag'], s0 + 0.3, { y: 330, size: 130, maxW: 560 });
  const steps = [['Suelta el acelerador', at(36) + 0.6], ['Los gases caen', at(37)], ['El turbo se detiene', at(38)], ['Vuelve a acelerar…', at(39)]];
  steps.forEach(([s, t0], i) => label(ctx, s, M, 480 + i * 56, i === 3 ? COLOR.paper : DIM, prog(t, t0, t0 + 0.5), { size: 36, spacing: 0, weight: 600 }));
}

// El anti-lag, por partes. Estado común: el pedal se levanta en at(44)+0.6; el encendido se corta en at(46)+1.6.
const ALS_T0 = () => at(43);
function alsState(t) {
  const lift = prog(t, at(44) + 0.6, at(44) + 1.1);
  const cutI = prog(t, at(46) + 1.6, at(46) + 2.0);
  const injOn = 1;
  const thr = lerp(1, 0.22, lift);
  const als = ease.out(prog(t, at(46) + 4.0, at(46) + 5.5));
  return { lift, cutI, injOn, thr, als };
}
function alsPanel(t, x, y, appear, st) {
  if (appear <= 0) return;
  const rows = [['ENCENDIDO', st.cutI > 0.5 ? 'CORTADO' : 'ACTIVO', st.cutI > 0.5 ? COLOR.red : COLOR.paper],
    ['INYECCIÓN', 'ACTIVA', COLOR.yellow], ['MARIPOSA', st.lift > 0.5 ? 'LIGERAMENTE ABIERTA' : 'ABIERTA', COLOR.blue]];
  rows.forEach(([k, v, col], i) => {
    const yy = y + i * 52;
    label(ctx, k, x, yy, DIM, appear, { size: 22, spacing: 6, weight: 700 });
    label(ctx, v, x + 250, yy, col, appear, { size: 22, spacing: 6, weight: 800 });
  });
}
function sALS1(t, s0) {
  bg(); dots(0.03);
  const st = alsState(t);
  const crank = engineAngle(t, s0, 1.2);
  const th = spinRot(t, s0, 3.2, 3.2, 1);
  drawCylinder(t, { cx: 1010, cy: 700, s: 0.72, appear: ease.out(prog(t, s0, s0 + 0.6)), crank, spark: 1, inj: 1, thr: st.thr, exhaust: lerp(1, 0.35, st.lift), th, dth: 0.5, labels: prog(t, s0 + 0.4, s0 + 2.0) });
  drawPedal(260, 640, 1 - st.lift, { appear: ease.out(prog(t, at(44), at(44) + 0.5)), s: 0.7, floor: true });
  label(ctx, 'ACELERADOR', 260, 590, DIM, prog(t, at(44), at(44) + 0.5), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'LOS INGENIEROS PROGRAMARON LA CENTRALITA', ['Al levantar', 'el pie'], at(43) + 0.2, { y: 210, size: 80, maxW: 620 });
  label(ctx, 'ocurría una magia diabólica', M, 960, COLOR.fire, prog(t, at(45) + 0.4, at(45) + 0.9), { size: 44, spacing: 0, weight: 700 });
}
function sALS2(t, s0) {
  bg(); dots(0.03);
  const st = alsState(t);
  const crank = engineAngle(t, s0 - 10, 1.2);
  const th = spinRot(t, s0, 2.2, 2.6, 4);
  drawCylinder(t, { cx: 1010, cy: 700, s: 0.72, crank, spark: 1 - st.cutI, inj: 1, thr: st.thr, exhaust: 0.4, als: st.als * 0.6, th, dth: 0.4, labels: 1 });
  alsPanel(t, M, 820, ease.out(prog(t, at(46) + 0.8, at(46) + 1.4)), st);
  side(t, 'LA ECU ORDENABA', ['Cortar el encendido,', 'seguir inyectando'], at(46) + 0.2, { y: 210, size: 76, maxW: 680, colors: [COLOR.red, COLOR.yellow] });
  label(ctx, 'y mantener la mariposa ligeramente abierta', M, 1000, DIM, prog(t, at(46) + 6.4, at(46) + 6.9), { size: 34, spacing: 0, weight: 600 });
}
function sALS3(t, s0) {
  bg(); dots(0.03);
  const crank = engineAngle(t, s0 - 20, 1.2);
  const th = spinRot(t, s0, 2.8, 3.6, 3);
  // Detonaciones antes de la turbina: instantes fijos con semilla.
  const R = rng(17), hits = []; let tt = at(47) + 3.6; while (tt < at(48) + 2) { hits.push(tt); tt += 0.35 + R() * 0.55; }
  let k = 0, hx = 0;
  for (const h of hits) { if (t >= h && t < h + 0.45) { k = Math.max(k, 1 - (t - h) / 0.45); hx = h; } }
  const zoom = lerp(1, 1.35, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2)));
  focus(1300, 400, zoom, lerp(1100, 1180, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2))), lerp(560, 600, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2))), () => {
    drawCylinder(t, { cx: 900, cy: 640, s: 0.78, crank, spark: 0, inj: 1, thr: 0.22, exhaust: 0.4, als: 1, th, dth: 0.5, hot: 0.6 + 0.4 * ease.out(prog(t, at(47) + 1.2, at(47) + 2.6)), labels: 0 });
    const bx = 900 + 760 * 0.78, by = 640 - 330 * 0.78;
    burst(bx, by, 70 * k + 10 * k, k, hx);
    shock(bx, by, k > 0 ? 1 - k : 0, 220);
  });
  scrim(860, 0.88);
  side(t, 'ESA GASOLINA SIN QUEMAR', ['Detonaba antes', 'de la turbina'], at(47) + 3.8, { y: 330, size: 90, maxW: 620, colors: [COLOR.paper, COLOR.fire] });
  label(ctx, 'Más de 800 grados', M, 560, COLOR.fire, prog(t, at(47) + 2.2, at(47) + 2.7), { size: 48, spacing: 0, weight: 700 });
  label(ctx, 'en los colectores de escape', M, 616, DIM, prog(t, at(47) + 2.5, at(47) + 3.0), { size: 36, spacing: 0, weight: 600 });
}
function sALS4(t, s0) {
  bg(); dots(0.03);
  const th = spinRot(t, s0, 6, 6, 1);
  drawWheel(th, 1.2, 1380, 560, 270, ease.out(prog(t, s0, s0 + 0.6)), { housing: true, hot: 0.5, blades: 12 });
  const R = rng(23); let tt = s0 + 0.4, k = 0;
  while (tt < s0 + 9) { if (t >= tt && t < tt + 0.4) k = Math.max(k, 1 - (t - tt) / 0.4); tt += 0.4 + R() * 0.6; }
  shock(1380, 560, k > 0 ? 1 - k : 0, 520);
  tag(t, 'LA ONDA EXPANSIVA MANTENÍA EL TURBO A', M, 260, at(48) + 0.3);
  const c = ease.out(prog(t, at(48) + 2.2, at(48) + 3.4));
  if (c > 0) { ctx.save(); ctx.globalAlpha = clamp(c * 3); ctx.font = FONT.display(800, 150); ctx.fillStyle = COLOR.paper; ctx.fillText(fmt(100000 * c), M, 450); ctx.restore(); }
  label(ctx, 'revoluciones por minuto', M, 530, COLOR.yellow, prog(t, at(48) + 3.0, at(48) + 3.5), { size: 44, spacing: 0, weight: 700 });
  label(ctx, 'incluso con el coche frenando', M, 640, DIM, prog(t, at(48) + 5.0, at(48) + 5.5), { size: 40, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// World Rally Car: el cerebro de todo el vehículo.

function sBrainCar(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const d = [prog(t, at(55) + 1.4, at(55) + 1.9), prog(t, at(56), at(56) + 0.4), prog(t, at(56) + 0.5, at(56) + 0.9)];
  drawCarECU(t, { ...o, appear: ease.out(prog(t, s0, s0 + 0.6)), nerves: 0, power: prog(t, at(54) + 4.0, at(54) + 5.0), ecuGlow: prog(t, at(54) + 3.0, at(54) + 4.0), diffs: d });
  [[300, 'DELANTERO'], [0, 'CENTRAL'], [-300, 'TRASERO']].forEach(([x, s], i) => { const [sx, sy] = carToScreen(o, x, 0); pin(t, sx, sy + 40, sx, 900, s, [at(55) + 1.4, at(56), at(56) + 0.5][i], COLOR.fire, 'center'); });
  side(t, 'LAS CENTRALITAS DEJARON DE SER MERAS CONTROLADORAS DEL MOTOR', ['El cerebro', 'de todo', 'el vehículo'], at(54) + 2.6, { y: 330, size: 96, maxW: 520 });
}

function sSensorsWRC(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const sn = [prog(t, at(57), at(57) + 0.6), prog(t, at(58), at(58) + 0.6), prog(t, at(59), at(59) + 0.6), prog(t, at(59) + 1.6, at(59) + 2.2)];
  const slipK = prog(t, at(60) + 0.4, at(60) + 1.0);
  const slip = [0.18, 0.22, 0.12, 0.15].map((v, i) => v + 0.08 * Math.sin(t * 2.4 + i * 1.7));
  drawCarECU(t, { ...o, nerves: 1, sensors: sn, power: 0.7, ecuGlow: slipK });
  slipBars(t, o, slip, slipK);
  const names = [['VELOCIDAD DE RUEDA', 300, -226, at(57) + 0.3], ['ACELERÓMETRO DE TRES EJES', -20, 70, at(58) + 0.2], ['ÁNGULO DEL VOLANTE', 150, -110, at(59) + 0.2], ['PRESIÓN DE FRENADA', 230, -170, at(59) + 1.8]];
  const lab = [[1780, 200, 'right'], [870, 960, 'left'], [870, 200, 'left'], [1780, 960, 'right']];
  names.forEach(([s, x, y, t0], i) => { const [sx, sy] = carToScreen(o, x, y); pin(t, sx, sy, lab[i][0], lab[i][1], s, t0, COLOR.blue, lab[i][2]); });
  side(t, 'MEDIANTE SENSORES', ['La ECU calculaba', 'el deslizamiento'], at(57) + 0.1, { y: 330, size: 80, maxW: 560 });
  label(ctx, 'de cada neumático, en tiempo real', M, 520, DIM, prog(t, at(60) + 1.4, at(60) + 1.9), { size: 34, spacing: 0, weight: 600 });
}

function sFrontSlip(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const k = ease.out(prog(t, at(61) + 0.6, at(61) + 1.4));
  drawCarECU(t, { ...o, nerves: 1, sensors: [1, 1, 1, 1], power: 0.8, split: lerp(0.5, 0.25, k), slip: [k, k, 0, 0], ecuGlow: k });
  slipBars(t, o, [0.2 + 0.7 * k, 0.2 + 0.68 * k, 0.15, 0.17], 1);
  side(t, 'EN UNA CURVA DE GRAVA', ['El eje delantero', 'pierde tracción'], at(61) + 0.1, { y: 330, size: 80, maxW: 600, colors: [COLOR.paper, COLOR.red] });
}

function sClutch(t, s0) {
  bg(); dots(0.03);
  const t0 = at(62) + 5.0;
  const oil = ease.out(prog(t, t0, t0 + 0.6)), press = prog(t, t0 + 0.3, t0 + 1.2), tq = prog(t, t0 + 1.0, t0 + 1.6);
  drawClutchPack(t, { cx: 1180, cy: 560, s: 0.92, appear: ease.out(prog(t, s0, s0 + 0.6)), press, oil, torque: tq, labels: prog(t, s0 + 0.5, s0 + 2.5) });
  label(ctx, 'AL EJE TRASERO', 1180 + 600 * 0.92, 560 - 60, COLOR.yellow, tq, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'DEL DIFERENCIAL CENTRAL', ['Embragues', 'multidisco'], at(62) + 2.9, { y: 300, size: 96, maxW: 560 });
  // Cronómetro del cierre: menos de 10 ms.
  const ms = 9.6 * ease.out(prog(t, t0, t0 + 1.2));
  if (t > t0 - 0.2) {
    ctx.save(); ctx.globalAlpha = ease.out(prog(t, t0 - 0.2, t0 + 0.2));
    ctx.font = FONT.display(800, 130); ctx.fillStyle = COLOR.paper; ctx.fillText(ms.toFixed(1).replace('.', ','), M, 720); ctx.restore();
    label(ctx, 'MILISEGUNDOS', M, 780, COLOR.yellow, prog(t, t0, t0 + 0.4), { size: 26, spacing: 7, weight: 700 });
    label(ctx, 'menos de 10 para transferir par atrás', M, 850, DIM, prog(t, t0 + 1.4, t0 + 1.9), { size: 34, spacing: 0, weight: 600 });
  }
}

// El coche rota de forma neutra: trayectoria real frente a la del subviraje.
function sNeutral(t, s0) {
  bg(); dots(0.03);
  const cxr = 1300, cyr = 1150, R0 = 640;
  const u = ease.inOut(prog(t, s0 + 0.2, s0 + 3.4)) * 0.7;
  const arc = (r, a0, a1) => { ctx.beginPath(); for (let i = 0; i <= 80; i++) { const a = lerp(a0, a1, i / 80); if (i) ctx.lineTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); else ctx.moveTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); } ctx.stroke(); };
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.18)'; ctx.lineWidth = 140; arc(R0, Math.PI * 1.05, Math.PI * 1.95); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(215,38,45,0.6)'; ctx.lineWidth = 4; ctx.setLineDash([14, 12]); ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const a = lerp(Math.PI * 1.05, Math.PI * 1.75, i / 80), r = R0 + 260 * ((i / 80) ** 2); if (i) ctx.lineTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); else ctx.moveTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); }
  ctx.stroke(); ctx.restore();
  label(ctx, 'SUBVIRAJE', 1880 - 40, 260, COLOR.red, prog(t, s0 + 0.6, s0 + 1.1), { size: 22, spacing: 6, weight: 700, align: 'right' });
  ctx.save(); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 5; arc(R0, Math.PI * 1.05, lerp(Math.PI * 1.05, Math.PI * 1.95, u)); ctx.restore();
  const a = lerp(Math.PI * 1.05, Math.PI * 1.95, u);
  drawCarECU(t, { cx: cxr + Math.cos(a) * R0, cy: cyr + Math.sin(a) * R0, s: 0.3, rot: a + Math.PI / 2, power: 1, split: 0.62, nerves: 0 });
  side(t, 'TRANSFERIR PAR AL EJE TRASERO', ['El coche rota', 'de forma neutra'], at(63) + 0.1, { y: 330, size: 84, maxW: 620 });
}

// Telemetría por radioenlace: el tramo en el bosque y el box.
function sRadio(t, s0) {
  bg(); dots(0.03);
  const road = poly(catmull([[760, 860], [900, 700], [860, 560], [1020, 420], [1220, 470], [1300, 330], [1480, 260]], false, 14));
  const a = ease.out(prog(t, s0, s0 + 0.6));
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(232,233,230,0.3)'; ctx.lineWidth = 26; trace(ctx, road, 1); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; trace(ctx, road, 1); ctx.restore();
  const u = (prog(t, s0 + 0.4, s0 + 9) * 0.92) % 1;
  const [x, y] = pointAt(road, u);
  ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
  label(ctx, '180 KM/H', x + 30, y - 24, COLOR.yellow, prog(t, at(68) + 0.4, at(68) + 0.9), { size: 22, spacing: 6, weight: 700 });
  // Ondas de radio del coche al box.
  const bxp = 1720, byp = 820;
  ctx.save();
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.8 + k / 4) % 1;
    ctx.globalAlpha = a * (1 - ph) * 0.8; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 20 + ph * 140, -0.6, 0.9); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 120;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bxp, byp - 40); ctx.stroke(); ctx.restore();
  node(t, bxp, byp, 160, 90, 'BOX', null, a, COLOR.blue);
  side(t, 'APARECIÓ LA TELEMETRÍA POR RADIOENLACE', ['Sin esperar', 'al final', 'del tramo'], at(66) + 0.4, { y: 330, size: 90, maxW: 560 });
  label(ctx, 'ni descargar los datos por cable', M, 690, DIM, prog(t, at(66) + 3.6, at(66) + 4.1), { size: 34, spacing: 0, weight: 600 });
}

// Interfaz genérica de telemetría con los colores del canal.
function sTeleUI(t, s0) {
  bg();
  const a = ease.out(prog(t, s0, s0 + 0.6));
  const x0 = M, x1 = W - M, y0 = 320;
  const tr = [
    ['RÉGIMEN DEL MOTOR', COLOR.paper, (u) => 0.55 + 0.3 * Math.sin(u * 23) * Math.sin(u * 5.1) + 0.1 * Math.sin(u * 71)],
    ['PRESIÓN DE ACEITE', COLOR.yellow, (u) => 0.6 + 0.12 * Math.sin(u * 17) + 0.05 * Math.sin(u * 53)],
    ['SISTEMA ELÉCTRICO', COLOR.blue, (u) => 0.5 + 0.04 * Math.sin(u * 40) - (u > 0.72 && u < 0.76 ? 0.35 : 0)],
  ];
  const sweep = prog(t, s0 + 0.5, s1Of(s0, 'ui'));
  tr.forEach(([name, col, fn], i) => {
    const y = y0 + i * 200;
    const ap = ease.out(prog(t, [at(67) + 1.0, at(68) + 0.2, at(68) + 1.4][i], [at(67) + 1.5, at(68) + 0.7, at(68) + 1.9][i]));
    if (ap <= 0) return;
    ctx.save(); ctx.globalAlpha *= a * ap; ctx.fillStyle = COLOR.ink2; rr(ctx, x0, y, x1 - x0, 160, 12); ctx.fill(); ctx.restore();
    label(ctx, name, x0 + 30, y + 44, col, ap, { size: 22, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= ap; trace2(x0 + 30, y + 60, x1 - x0 - 60, 80, fn, sweep, col, 3); ctx.restore();
  });
  // Fallo eléctrico detectado.
  const fx = x0 + 30 + (x1 - x0 - 60) * 0.74;
  const fa = ease.out(prog(t, at(68) + 4.2, at(68) + 4.6)) * (sweep > 0.74 ? 1 : 0);
  if (fa > 0) { ctx.save(); ctx.globalAlpha *= fa; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 3; ctx.strokeRect(fx - 50, y0 + 400 + 40, 100, 120); ctx.restore(); label(ctx, 'FALLO ELÉCTRICO', fx + 70, y0 + 400 + 48, COLOR.red, fa, { size: 20, spacing: 6, weight: 800 }); }
  tag(t, 'MONITORIZAR EN DIRECTO', M, 160, at(67) - 0.1);
  lines(t, ['Los parámetros vitales del motor'], M, 250, 80, 76, at(67) + 0.2, { maxW: GRID.w });
}
const S1 = {};
function s1Of(s0, key) { return S1[key] ?? s0 + 10; }

// Sensor de picado: la vibración delata la detonación y la ECU retrasa el encendido.
function sKnock(t, s0) {
  bg(); dots(0.03);
  const knockOn = prog(t, at(69) + 2.2, at(69) + 2.6) * (1 - prog(t, at(70) + 4.0, at(70) + 5.0));
  const crank = engineAngle(t, s0, 1.0);
  const st = drawCylinder(t, { cx: 1080, cy: 560, s: 0.75, appear: ease.out(prog(t, s0, s0 + 0.6)), crank, spark: 1, inj: 1, thr: 1, turbo: false, ducts: false, direct: true, knock: knockOn, labels: 0 });
  // Sensor de picado atornillado al bloque.
  const kx = 1080 + 160 * 0.75, ky = 560 + 120 * 0.75;
  ctx.save(); ctx.fillStyle = COLOR.blue; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(kx + Math.cos(a) * 22, ky + Math.sin(a) * 22); } ctx.closePath(); ctx.fill(); ctx.restore();
  pin(t, kx, ky, kx + 120, ky + 180, 'SENSOR DE PICADO', at(69) + 0.4, COLOR.blue, 'left');
  // Señal de vibración con ráfagas cuando hay picado.
  const gx = 1330, gy = 300, gw = 450, gh = 160;
  label(ctx, 'VIBRACIÓN', gx, gy - 20, DIM, prog(t, at(69) + 1.0, at(69) + 1.5), { size: 20, spacing: 6, weight: 700 });
  const sig = (u) => { const tt = t - 1.5 + u * 1.5; const base = 0.5 + 0.05 * Math.sin(tt * 90); const kk = knockOn * Math.max(0, Math.sin(tt * 6.3)) ** 8; return base + kk * 0.4 * Math.sin(tt * 420); };
  trace2(gx, gy, gw, gh, sig, prog(t, at(69) + 1.0, at(69) + 1.8), knockOn > 0.3 ? COLOR.red : COLOR.blue, 2.5);
  // Avance del encendido: la chispa se aleja del punto muerto superior.
  const dx = 1555, dy = 720, dr = 140;
  const ap = ease.out(prog(t, at(70) + 1.2, at(70) + 1.8));
  if (ap > 0) {
    ctx.save(); ctx.globalAlpha *= ap; ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COLOR.paper; ctx.fillRect(dx - 2, dy - dr - 24, 4, 34);
    const adv = lerp(0.55, 0.3, ease.inOut(prog(t, at(70) + 2.6, at(70) + 4.0)));
    const ang = -Math.PI / 2 - adv;
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(dx, dy, dr, ang, -Math.PI / 2); ctx.stroke();
    ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(dx + Math.cos(ang) * dr, dy + Math.sin(ang) * dr, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    label(ctx, 'PMS', dx, dy - dr - 40, COLOR.paper, ap, { size: 22, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'AVANCE DEL ENCENDIDO', dx, dy + dr + 56, COLOR.yellow, ap, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
  side(t, 'COMBUSTIBLE DE MALA CALIDAD', ['Picado', 'de biela'], at(69) + 0.1, { y: 330, size: 100, maxW: 520, colors: [COLOR.paper, COLOR.red] });
  label(ctx, 'La ECU corrige el avance', M, 600, COLOR.paper, prog(t, at(70) + 1.0, at(70) + 1.5), { size: 42, spacing: 0, weight: 700 });
  label(ctx, 'antes de que el piloto lo note', M, 660, DIM, prog(t, at(70) + 6.4, at(70) + 6.9), { size: 36, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Rally1: una centralita para todos, el ecosistema CAN y el despliegue de energía.

function sOneECU(t, s0) {
  bg(); dots(0.03);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ap = ease.outExpo(prog(t, at(74) + 0.6 + i * 0.18, at(74) + 1.4 + i * 0.18));
    const x = lerp(330, 1590, i / (n - 1));
    drawECU3D(t, { cx: x, cy: 720, s: 0.5, yaw: -0.6 + 0.04 * Math.sin(t * 0.7 + i), pitch: 0.6, appear: ap });
  }
  const x = W / 2;
  label(ctx, 'EL MISMO HARDWARE PARA TODOS LOS EQUIPOS', x, 990, DIM, prog(t, at(74) + 4.2, at(74) + 4.7), { size: 22, spacing: 7, weight: 700, align: 'center' });
  tag(t, 'SE PROHIBIÓ EL SOFTWARE LIBRE', x, 230, at(74) + 0.2, COLOR.red, { align: 'center' });
  lines(t, ['Una centralita estándar única'], x, 360, 100, 100, at(74) + 2.2, { align: 'center', maxW: GRID.w });
}

function sEngineNode(t, s0) {
  bg(); dots(0.03);
  const crank = engineAngle(t, s0, 1.2);
  drawCylinder(t, { cx: 1110, cy: 740, s: 0.66, appear: ease.out(prog(t, at(80) - 0.4, at(80) + 0.3)), crank, direct: true, restrictor: prog(t, at(80) + 3.0, at(80) + 3.6), turbo: true, th: spinRot(t, s0, 3, 3, 1), dth: 0.5, labels: 0 });
  pin(t, 1110 - 100 * 0.66, 740 - 200 * 0.66, 1400, 330, 'INYECCIÓN DIRECTA', at(80) + 2.0, COLOR.yellow, 'left');
  pin(t, 1110 - 620 * 0.66, 740 - 330 * 0.66, 700, 960, 'BRIDA DE ADMISIÓN', at(80) + 3.2, COLOR.yellow, 'left');
  side(t, 'LA ECU ACTUAL GESTIONA UN ECOSISTEMA MECATRÓNICO', ['Motor térmico', 'de 1.6 litros'], at(78) + 0.2, { y: 330, size: 90, maxW: 600 });
  label(ctx, 'por un lado', M, 520, DIM, prog(t, at(79), at(79) + 0.5), { size: 36, spacing: 0, weight: 600 });
}

function sCAN(t, s0) {
  bg(); dots(0.03);
  const y = 640;
  const ecuA = prog(t, s0 + 0.1, s0 + 0.6), busA = prog(t, at(82) + 0.6, at(82) + 2.0), pcuA = prog(t, at(82) + 3.2, at(82) + 3.8), mguA = prog(t, at(83) + 1.0, at(83) + 1.6), batA = prog(t, at(83) + 2.6, at(83) + 3.2);
  canBus(t, 260, 1700, y, busA, [[420, y - 150], [1100, y - 150], [1560, y + 150]], prog(t, at(82) + 2.0, at(82) + 2.6));
  node(t, 420, y - 210, 260, 120, 'ECU', 'MOTOR TÉRMICO', ecuA, COLOR.yellow, 1);
  node(t, 1100, y - 210, 460, 120, 'PCU', 'UNIDAD DE CONTROL DE ENERGÍA', pcuA, COLOR.blue);
  node(t, 1560, y + 210, 280, 120, 'MGU', '100 KW', mguA, COLOR.paper);
  label(ctx, 'BUS CAN DE ALTA VELOCIDAD', 260, y + 80, DIM, busA, { size: 22, spacing: 7, weight: 700 });
  label(ctx, 'SISTEMA HÍBRIDO DE COMPACT DYNAMICS', 1100, y - 300, DIM, pcuA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  // Unión PCU–MGU (alta tensión) y batería.
  if (mguA > 0) { ctx.save(); ctx.globalAlpha *= mguA; ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(1330, y - 210); ctx.lineTo(1560, y - 210); ctx.lineTo(1560, y + 150); ctx.stroke(); ctx.restore(); }
  drawBattery(t, { cx: 1100, cy: y + 260, s: 0.5, appear: ease.out(batA), temp: 0.3 });
  label(ctx, 'BATERÍA', 1100, y + 370, DIM, batA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'POR OTRO LADO, SE COMUNICA CON', M, 150, at(82) - 0.2);
  lines(t, ['El sistema híbrido'], M, 240, 80, 80, at(82) + 0.2, { maxW: GRID.w });
}

// Despliegue de energía a lo largo del tramo: +134 CV a la salida de las curvas lentas y regeneración al frenar.
function sDeploy(t, s0) {
  bg(); dots(0.03);
  const gx = M, gy = 380, gw = W - 2 * M, gh = 300;
  const spd = (u) => 0.75 - 0.55 * Math.exp(-(((u - 0.3) / 0.05) ** 2)) - 0.45 * Math.exp(-(((u - 0.72) / 0.05) ** 2)) + 0.08 * Math.sin(u * 20);
  const sweep = prog(t, s0 + 0.4, s0 + 15);
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'DISTANCIA EN EL TRAMO', yl: 'VELOCIDAD' });
  // Zonas: frenada (antes de la curva) y salida (después).
  const zones = [[0.22, 0.29, 'brake'], [0.31, 0.42, 'boost'], [0.64, 0.71, 'brake'], [0.73, 0.84, 'boost']];
  zones.forEach(([u0, u1, k]) => {
    const vis = clamp((sweep - u0) / (u1 - u0));
    if (vis <= 0) return;
    const show = k === 'boost' ? prog(t, at(85) + 2.6, at(85) + 3.2) : prog(t, at(86) + 3.4, at(86) + 4.0);
    ctx.save(); ctx.globalAlpha *= 0.3 * show; ctx.fillStyle = k === 'boost' ? COLOR.yellow : COLOR.blue; ctx.fillRect(gx + u0 * gw, gy, (u1 - u0) * gw * vis, gh); ctx.restore();
  });
  trace2(gx, gy, gw, gh, spd, sweep, COLOR.paper, 4);
  label(ctx, '+134 CV ELÉCTRICOS', gx + 0.365 * gw, gy - 20, COLOR.yellow, prog(t, at(85) + 3.0, at(85) + 3.5), { size: 22, spacing: 6, weight: 800, align: 'center' });
  label(ctx, 'REGENERACIÓN', gx + 0.255 * gw, gy + gh + 50, COLOR.blue, prog(t, at(86) + 3.8, at(86) + 4.3), { size: 22, spacing: 6, weight: 800, align: 'center' });
  // Energía de la batería: baja al desplegar, sube al regenerar.
  const soc = (u) => { let e = 0.7; for (const [u0, u1, k] of zones) { const f = clamp((u - u0) / (u1 - u0)); e += (k === 'boost' ? -0.3 : 0.22) * f; } return e; };
  const by = 860;
  label(ctx, 'ENERGÍA EN LA BATERÍA', gx, by - 20, DIM, prog(t, at(86) + 4.6, at(86) + 5.1), { size: 20, spacing: 6, weight: 700 });
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(86) + 4.6, at(86) + 5.1));
  trace2(gx, by, gw, 120, soc, sweep, COLOR.blue, 4); ctx.restore();
  tag(t, 'LA CENTRALITA SABE EXACTAMENTE EN QUÉ MILISEGUNDO', M, 160, at(85) + 0.1);
  lines(t, ['Desplegar o regenerar'], M, 260, 80, 84, at(85) + 0.4, { maxW: GRID.w });
}

function sBattery(t, s0) {
  bg(); dots(0.03);
  const heat = 0.25 + 0.5 * ease.inOut(prog(t, s0 + 0.4, at(87) + 3.0)) - 0.08 * prog(t, at(87) + 3.4, at(87) + 5.0);
  drawBattery(t, { cx: 1300, cy: 520, s: 1.05, appear: ease.out(prog(t, s0, s0 + 0.6)), temp: heat });
  // Termómetro con su límite.
  const tx = 1300 - 360, ty = 800, tw = 720;
  const ap = ease.out(prog(t, at(87) + 1.0, at(87) + 1.5));
  meter(t, tx, ty, tw, heat / 0.85, ap, 'TEMPERATURA', heat > 0.65 ? COLOR.fire : COLOR.yellow);
  ctx.save(); ctx.globalAlpha *= ap; ctx.fillStyle = COLOR.red; ctx.fillRect(tx + tw * 0.88, ty - 14, 4, 50); ctx.restore();
  label(ctx, 'LÍMITE TÉRMICO', tx + tw * 0.88, ty + 76, COLOR.red, ap, { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'ASEGURANDO QUE LA BATERÍA', ['3,9 kWh'], at(87) + 0.4, { y: 400, size: 140, maxW: 520 });
  label(ctx, 'no supere sus límites', M, 520, COLOR.paper, prog(t, at(87) + 2.2, at(87) + 2.7), { size: 40, spacing: 0, weight: 700 });
  label(ctx, 'térmicos de seguridad', M, 576, COLOR.paper, prog(t, at(87) + 2.6, at(87) + 3.1), { size: 40, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Sensores, mapas 3D y launch control.

function sSensorArmy(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  drawCarECU(t, { ...o, appear: 1, nerves: 0, power: 0, ecuGlow: 0.6, engine: 1 });
  const R = rng(44);
  for (let i = 0; i < 46; i++) {
    const x = lerp(-470, 470, R()), y = lerp(-220, 220, R());
    const t0 = s0 + 0.3 + i * 0.07;
    const k = ease.outExpo(prog(t, t0, t0 + 0.4));
    if (k <= 0) continue;
    const [sx, sy] = carToScreen(o, x, y);
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = i % 5 === 0 ? COLOR.yellow : COLOR.blue;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(127,180,221,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 8 + 14 * (1 - k), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const chips = [['VIBRACIONES EXTREMAS', at(89) + 2.6], ['BARRO', at(90)], ['MÁS DE MIL GRADOS', at(90) + 0.9]];
  chips.forEach(([s, t0], i) => label(ctx, s, M, 560 + i * 60, i === 2 ? COLOR.fire : COLOR.paper, prog(t, t0, t0 + 0.5), { size: 30, spacing: 6, weight: 800 }));
  side(t, 'SENSORES AERONÁUTICOS', ['Un ejército', 'de sensores'], s0 + 0.3, { y: 330, size: 96, maxW: 560 });
}

function sMapIntro(t, s0) {
  bg(); dots(0.03);
  const u = prog(t, s0, s0 + 8);
  drawSurface(t, { cx: 1250, cy: 750, s: 1.2, yaw: lerp(-0.95, -0.7, ease.inOut(u)), pitch: 0.5, build: prog(t, at(91) + 1.2, at(91) + 4.0), rise: ease.inOut(prog(t, at(91) + 2.0, at(91) + 4.6)), axes: 0 });
  tag(t, 'EN EL CORAZÓN DEL SOFTWARE', M, 240, at(91) - 0.1);
  lines(t, ['Mapas', 'tridimensionales'], M, 370, 100, 100, at(91) + 0.3, { maxW: 640 });
  label(ctx, 'Look-Up Tables', M, 560, COLOR.yellow, prog(t, at(91) + 3.6, at(91) + 4.1), { size: 48, spacing: 0, weight: 700 });
}

function sMap3D(t, s0) {
  bg(); dots(0.03);
  const u = prog(t, s0, at(95));
  const res = drawSurface(t, { cx: 1250, cy: 740, s: 1.15, yaw: lerp(-0.75, -0.6, ease.inOut(u)), pitch: lerp(0.5, 0.56, ease.inOut(u)), build: 1, rise: 1, axes: prog(t, at(93) + 1.2, at(93) + 2.0) });
  const f = res.f, L = f.L, Hh = f.Hh;
  const ex = f(L / 2 + 80, -L / 2, 0), ey = f(-L / 2, L / 2 + 80, 0), ez = f(-L / 2, -L / 2, Hh + 110);
  const ax = [['X · RÉGIMEN DEL MOTOR (RPM)', ex, at(93) + 3.0, 'right', 0, 50], ['Y · CARGA (MAP)', ey, at(94) + 0.4, 'left', 20, 8], ['Z · AVANCE ANTES DEL PMS', ez, at(94) + 4.6, 'center', 0, -18]];
  ax.forEach(([s, p, t0, al, dx, dy]) => label(ctx, s, p[0] + dx, p[1] + dy, COLOR.paper, prog(t, t0, t0 + 0.5), { size: 22, spacing: 6, weight: 800, align: al }));
  side(t, 'POR EJEMPLO', ['El mapa', 'de avance', 'de encendido'], at(93) - 0.2, { y: 330, size: 86, maxW: 520 });
  label(ctx, 'una malla 3D', M, 640, COLOR.yellow, prog(t, at(93) + 1.4, at(93) + 1.9), { size: 44, spacing: 0, weight: 700 });
}

function sInterp(t, s0) {
  bg(); dots(0.03);
  const pt = [0.35 + 0.25 * Math.sin((t - s0) * 0.9), 0.4 + 0.2 * Math.sin((t - s0) * 0.6 + 1)];
  const z = ease.inOut(prog(t, s0, s0 + 1.6));
  focus(1250, 600, lerp(1, 1.5, z), lerp(1250, 1300, z), lerp(600, 580, z), () => {
    drawSurface(t, { cx: 1250, cy: 740, s: 1.15, yaw: -0.6, pitch: 0.56, build: 1, rise: 1, axes: 0, pt, cell: prog(t, s0 + 1.2, s0 + 1.8) });
  });
  scrim(820, 0.9);
  tag(t, 'LA CENTRALITA INTERPOLA', M, 330, at(95) + 0.4);
  lines(t, ['Millones', 'de puntos', 'por segundo'], M, 450, 96, 96, at(95) + 1.2, { maxW: 560 });
}

function sLaunch(t, s0) {
  bg(); dots(0.03);
  const tFull = at(98) + 1.4, tLock = at(99) + 0.4;
  const rpm = t < tFull ? 0.12 : t < tLock ? lerp(0.12, 0.62, ease.out(prog(t, tFull, tLock))) : 0.62 + 0.015 * Math.sin(t * 40);
  arcGauge(t, 1340, 520, 260, rpm, 1, ease.out(prog(t, s0, s0 + 0.6)), 10, COLOR.yellow);
  // Régimen óptimo de par: marca fija.
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5, am = a0 + span * 0.62;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, tLock - 0.2, tLock + 0.3)); ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(1340 + Math.cos(am) * 220, 520 + Math.sin(am) * 220); ctx.lineTo(1340 + Math.cos(am) * 310, 520 + Math.sin(am) * 310); ctx.stroke(); ctx.restore();
  label(ctx, 'RÉGIMEN ÓPTIMO DE PAR', 1340, 900, COLOR.fire, prog(t, tLock, tLock + 0.5), { size: 22, spacing: 6, weight: 800, align: 'center' });
  // Cortes de inyección aleatorios (con semilla) por cilindro.
  const cutsA = ease.out(prog(t, at(100) + 0.6, at(100) + 1.2));
  if (cutsA > 0) {
    const step = Math.floor((t - at(100)) * 12), R = rng(1000 + step);
    for (let i = 0; i < 4; i++) {
      const x = 1700, y = 340 + i * 90, cutNow = R() < 0.35;
      ctx.save(); ctx.globalAlpha *= cutsA; rr(ctx, x - 50, y - 30, 100, 60, 8); ctx.fillStyle = cutNow ? COLOR.red : COLOR.yellow; ctx.fill(); ctx.restore();
      label(ctx, String(i + 1), x, y + 10, COLOR.ink, cutsA, { size: 26, spacing: 0, weight: 800, align: 'center' });
    }
    label(ctx, 'CORTES DE INYECCIÓN', 1700, 270, DIM, cutsA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  }
  // Pedales.
  const ped = [['EMBRAGUE', at(98) + 0.5], ['ACELERADOR A FONDO', at(98) + 1.4]];
  ped.forEach(([s, t0], i) => { const k = ease.out(prog(t, t0, t0 + 0.4)); meter(t, M, 700 + i * 110, 480, k, ease.out(prog(t, at(98), at(98) + 0.5)), s, i ? COLOR.yellow : COLOR.paper); });
  side(t, 'CONTROL DE SALIDA', ['Launch', 'Control'], at(97) + 0.2, { y: 330, size: 120, maxW: 560 });
  label(ctx, 'para que las ruedas no patinen en la gravilla', M, 960, DIM, prog(t, at(100) + 3.6, at(100) + 4.1), { size: 32, spacing: 0, weight: 600 });
}

function sCrypto(t, s0) {
  bg(); dots(0.03);
  const scr = ease.inOut(prog(t, at(101) + 4.4, at(101) + 6.4));
  drawSurface(t, { cx: 1290, cy: 780, s: 1.0, yaw: -0.6 + 0.1 * prog(t, s0, s0 + 10), pitch: 0.56, build: 1, rise: lerp(1, 0.15, scr), scramble: scr, shade: 1 - scr });
  // Candado.
  const lk = ease.outExpo(prog(t, at(101) + 6.2, at(101) + 6.9));
  if (lk > 0) {
    const x = 1290, y = 400;
    ctx.save(); ctx.globalAlpha *= lk; ctx.translate(x, y); ctx.scale(lerp(1.3, 1, lk), lerp(1.3, 1, lk));
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(0, -60, 56, Math.PI, 0); ctx.stroke();
    rr(ctx, -90, -60, 180, 150, 18); ctx.fillStyle = COLOR.yellow; ctx.fill();
    ctx.fillStyle = COLOR.ink; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-7, 0, 14, 44);
    ctx.restore();
  }
  side(t, 'Y TODO ESTO PROTEGIDO POR', ['Redundancia', 'y cifrado'], at(101) + 0.2, { y: 330, size: 100, maxW: 560 });
  label(ctx, 'para que nadie espíe', M, 600, DIM, prog(t, at(101) + 5.6, at(101) + 6.1), { size: 38, spacing: 0, weight: 600 });
  label(ctx, 'los mapas de inyección', M, 652, DIM, prog(t, at(101) + 5.9, at(101) + 6.4), { size: 38, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Combustibles sostenibles y bucle cerrado.

function sFuelProps(t, s0) {
  bg(); dots(0.03);
  const rows = [['DENSIDAD', 0.62, 0.58], ['PUNTO DE VAPORIZACIÓN', 0.55, 0.63]];
  const x0 = 820, w = 900;
  label(ctx, 'GASOLINA DE PETRÓLEO', x0, 330, '#8C9096', prog(t, at(103) + 0.6, at(103) + 1.1), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'BIOCOMBUSTIBLE AVANZADO', x0 + 440, 330, COLOR.yellow, prog(t, at(104) + 0.4, at(104) + 0.9), { size: 22, spacing: 6, weight: 700 });
  rows.forEach(([n, a, b], i) => {
    const y = 470 + i * 220;
    const ap = ease.out(prog(t, at(105) - 0.4 + i * 0.8, at(105) + 0.2 + i * 0.8));
    label(ctx, n, x0, y - 30, COLOR.paper, ap, { size: 24, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= ap;
    ctx.fillStyle = '#8C9096'; ctx.fillRect(x0, y, w * a * ease.out(prog(t, at(105) + i * 0.8, at(105) + 0.8 + i * 0.8)), 34);
    ctx.fillStyle = COLOR.yellow; ctx.fillRect(x0, y + 50, w * b * ease.out(prog(t, at(105) + 0.3 + i * 0.8, at(105) + 1.1 + i * 0.8)), 34);
    ctx.restore();
  });
  side(t, 'A DIFERENCIA DE LA GASOLINA TRADICIONAL', ['Propiedades', 'ligeramente', 'diferentes'], at(103) + 0.2, { y: 330, size: 90, maxW: 560 });
}

function sLoop(t, s0) {
  bg(); dots(0.03);
  const cx = 1300, cy = 560, R = 330;
  const nodes = [['INYECTOR', -Math.PI / 2], ['COMBUSTIÓN', -Math.PI / 2 + 1.26], ['ESCAPE', -Math.PI / 2 + 2.51], ['SONDA LAMBDA', -Math.PI / 2 + 3.77], ['ECU', -Math.PI / 2 + 5.03]];
  const a = ease.inOut(prog(t, s0 + 0.2, s0 + 2.2));
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a); ctx.stroke(); ctx.restore();
  // Pulsos recorriendo el bucle.
  if (a >= 1) for (let k = 0; k < 3; k++) { const ph = -Math.PI / 2 + ((t * 0.6 + k / 3) % 1) * Math.PI * 2; ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(cx + Math.cos(ph) * R, cy + Math.sin(ph) * R, 9, 0, Math.PI * 2); ctx.fill(); }
  nodes.forEach(([n, ang], i) => {
    const k = prog(t, s0 + 0.4 + i * 0.35, s0 + 0.9 + i * 0.35);
    node(t, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, n === 'SONDA LAMBDA' ? 270 : 230, 80, n, null, k, n === 'ECU' ? COLOR.yellow : n === 'SONDA LAMBDA' ? COLOR.blue : COLOR.paper, n === 'ECU' ? 1 : 0);
  });
  side(t, 'RECALIBRADA CON ALGORITMOS ADAPTATIVOS', ['Bucle', 'cerrado'], at(106) + 0.3, { y: 330, size: 130, maxW: 520 });
  label(ctx, 'closed-loop control', M, 520, COLOR.yellow, prog(t, at(106) + 4.4, at(106) + 4.9), { size: 44, spacing: 0, weight: 700 });
}

function sLambda(t, s0) {
  bg(); dots(0.03);
  const gx = 760, gy = 330, gw = 1020, gh = 420;
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TIEMPO', yl: 'OXÍGENO EN EL ESCAPE' });
  const lam = (u) => 0.5 + 0.32 * Math.exp(-u * 4.2) * Math.sin(u * 32) + 0.02 * Math.sin(u * 90) * Math.exp(-u * 2);
  const y1 = gy + gh * 0.5;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(108) + 9.6, at(108) + 10.2)); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(gx, y1); ctx.lineTo(gx + gw, y1); ctx.stroke(); ctx.restore();
  label(ctx, 'RELACIÓN ESTEQUIOMÉTRICA', gx + gw, y1 - 16, COLOR.yellow, prog(t, at(108) + 9.6, at(108) + 10.2), { size: 20, spacing: 6, weight: 800, align: 'right' });
  trace2(gx, gy, gw, gh, lam, prog(t, at(108) + 0.4, at(108) + 9.4), COLOR.blue, 4);
  side(t, 'SONDAS LAMBDA DE BANDA ANCHA', ['La ECU mide', 'el oxígeno', 'residual'], at(107) + 0.2, { y: 330, size: 86, maxW: 560 });
  label(ctx, 'en tiempo real', M, 640, DIM, prog(t, at(108) + 1.6, at(108) + 2.1), { size: 40, spacing: 0, weight: 600 });
}

function sDuty(t, s0) {
  bg(); dots(0.03);
  const gx = 760, gw = 1020;
  const duty = (u) => 0.32 + 0.14 * ease.inOut(clamp((u - 0.4) / 0.3));
  label(ctx, 'MANDO DEL INYECTOR', gx, 330, DIM, prog(t, s0 + 0.2, s0 + 0.7), { size: 22, spacing: 6, weight: 700 });
  pwm(gx, 380, gw, 160, 9, duty, prog(t, s0 + 0.3, s0 + 3.0), COLOR.yellow);
  // Cota del tiempo de apertura en el último pulso.
  const ap = prog(t, s0 + 3.2, s0 + 3.8);
  const per = gw / 9, xs = gx + per * 8, xe = xs + per * duty(0.95);
  dimLine(xs, xe, 600, ap, COLOR.yellow, null);
  label(ctx, 'TIEMPO DE APERTURA', (xs + xe) / 2 - 40, 680, COLOR.yellow, ap, { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'AJUSTA DINÁMICAMENTE', ['El duty cycle'], at(108) + 5.6, { y: 400, size: 96, maxW: 600 });
  label(ctx, 'Cada caballo disponible', M, 780, COLOR.paper, prog(t, at(109) + 0.8, at(109) + 1.3), { size: 48, spacing: 0, weight: 700 });
  label(ctx, 'sin importar el combustible', M, 840, DIM, prog(t, at(109) + 2.2, at(109) + 2.7), { size: 38, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Cierre.

function sCode(t, s0, s1) {
  bg(); dots(0.03);
  const u = prog(t, s0, s1);
  drawECU3D(t, { cx: 1300, cy: 760, s: 1.1, yaw: lerp(-0.3, -0.75, ease.inOut(u)), pitch: 0.64, open: 1, lift: 1, pulse: 1, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  side(t, 'EL AUTOMOVILISMO MODERNO', ['Se escribe', 'con código'], at(111) + 0.1, { y: 330, size: 110, maxW: 560 });
  label(ctx, 'Algoritmos de control predictivo', M, 560, DIM, prog(t, at(112) + 0.2, at(112) + 0.7), { size: 36, spacing: 0, weight: 600 });
  label(ctx, 'y microprocesadores', M, 610, DIM, prog(t, at(112) + 2.0, at(112) + 2.5), { size: 36, spacing: 0, weight: 600 });
}

function sRecap(t, s0) {
  bg();
  const a = ease.out(prog(t, s0, s0 + 0.6)), b = ease.out(prog(t, at(113) + 3.6, at(113) + 4.2));
  const y = 170, w = 760, h = 480;
  photo('motronic', M, y, w, h, { zoom: 1.08, fx: 0.5, fy: 0.5 }, { dark: 0.15, vig: 0.3, open: a });
  photo('marelli', W - M - w, y, w, h, { zoom: 1.08, fx: 0.5, fy: 0.5 }, { dark: 0.1, vig: 0.3, open: b });
  arrowPath([[M + w + 40, y + h / 2], [W - M - w - 40, y + h / 2]], ease.out(prog(t, at(113) + 3.0, at(113) + 3.8)), COLOR.yellow, 6, 20);
  label(ctx, 'CAJAS ANALÓGICAS', M, y + h + 70, COLOR.paper, a, { size: 26, spacing: 6, weight: 800 });
  label(ctx, 'Chips soldados a mano', M, y + h + 124, DIM, prog(t, at(113) + 1.0, at(113) + 1.5), { size: 34, spacing: 0, weight: 600 });
  label(ctx, 'CENTRALITAS MECATRÓNICAS', W - M - w, y + h + 70, COLOR.yellow, b, { size: 26, spacing: 6, weight: 800 });
  label(ctx, 'Potencia térmica e híbrida', W - M - w, y + h + 124, DIM, prog(t, at(113) + 5.6, at(113) + 6.1), { size: 34, spacing: 0, weight: 600 });
}

function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 720, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = la; ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h); ctx.restore();
  pill(t, 'Suscríbete', W / 2, 740, at(116) - 0.3, { press: at(116) + 0.4, color: COLOR.red, size: 42 });
  label(ctx, '¿Qué otro componente del rally quieres que exploremos?', W / 2, 880, DIM, prog(t, at(118) + 0.2, at(118) + 0.7), { size: 40, spacing: 0, weight: 600, align: 'center' });
  label(ctx, 'Nos vemos en el próximo tramo', W / 2, 960, COLOR.paper, prog(t, at(119), at(119) + 0.5), { size: 44, spacing: 0, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, kClip({ seg: 'c037', from: 0.0, speed: 1, z: [1.0, 1.06], tag: 'UN MOTOR DE 500 CABALLOS Y UN SISTEMA HÍBRIDO', tagT: at(1) + 2.0, title: ['Inútil sin una mente', 'que lo gobierne'], tt: at(1) + 5.2, size: 110 }), 'dissolve'],
  [cut(2), sRate, 'whip'],
  [cut(6), sNervous, 'cube'],
  [cut(8), kPhoto3({ img: 'yarisRally1', fx: 0.5, fy: 0.45, yaw: [0.06, -0.02], dark: 0.4, tag: 'EL AGARRE CAMBIA CADA METRO', tagT: at(9) + 0.2, title: ['Asfalto, barro', 'o hielo'], tt: at(9) + 2.4, size: 120 }), 'wipe'],
  [cut(11), kPhoto3({ img: 'piloto', fx: 0.5, fy: 0.4, yaw: [-0.05, 0.03], dark: 0.5, tag: 'EL PILOTO YA NO PILOTA SOLO CONTRA EL CRONO', tagT: at(11) + 0.2, title: ['Contra algoritmos', 'matemáticos'], tt: at(12) + 0.4, size: 116, label: 'que deciden cómo entregar cada vatio al suelo', labelT: at(12) + 2.6 }), 'cube'],
  [cut(13), sOpenECU, 'slices'],
  [cut(14), kChapter({ img: 'stratosNieve', fx: 0.5, fy: 0.5, era: 1, tag: 'PARA ENTENDER LA REVOLUCIÓN ELECTRÓNICA', tagT: at(14) + 0.2, title: ['De dónde venimos'], tt: at(15) + 0.2 }), 'wipe'],
  [cut(16), kPhoto3({ img: 'weber', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.03], dark: 0.55, tag: 'EN LAS DÉCADAS DE', tagT: at(16) + 0.1, title: ['1960 y 1970'], tt: at(16) + 0.9, size: 150 }), 'cube'],
  [cut(17), kClip({ seg: 'escort', from: 1.0, speed: 1, tag: 'LOS MOTORES DE RALLY SE ALIMENTABAN CON', tagT: at(17) + 0.2, title: ['Carburadores', 'mecánicos'], tt: at(17) + 1.6, size: 120 }), 'whip'],
  [cut(18), sCarb, 'dissolve'],
  [cut(20), kPhoto3({ img: 'carburadores', fx: 0.5, fy: 0.45, yaw: [0.05, -0.02], dark: 0.5, tag: 'TEMPERAMENTALES', tagT: at(20) + 1.0, title: ['100% mecánicos'], tt: at(20) + 0.3, size: 140, label: 'Ciegos ante la altitud o la temperatura exterior', labelT: at(21) + 1.6 }), 'cube'],
  [cut(22), sAltitude, 'slices'],
  [cut(25), kClip({ seg: 'quattro', from: 0.0, speed: 0.97, tag: 'FINALES DE LOS 70 · PRINCIPIOS DE LOS 80', tagT: at(25) + 0.2, title: ['Inyección', 'electrónica'], tt: at(26) + 0.4, size: 120, label: 'Bosch K-Jetronic en los primeros Audi Quattro', labelT: at(26) + 3.0, extra: (t, s0) => drawEras(t, 2, ease.out(prog(t, s0 + 0.2, s0 + 1.0)) * (1 - prog(t, at(26) + 5, at(26) + 6)), 70) }), 'wipe'],
  [cut(27), sSuckPress, 'whip'],
  [cut(28), kPhoto3({ img: 'motronic', fx: 0.55, fy: 0.5, yaw: [-0.05, 0.03], dark: 0.45, tag: 'AQUELLAS PRIMERAS CENTRALITAS ERAN', tagT: at(28) + 0.2, title: ['Cajas analógicas'], tt: at(29) + 0.8, size: 130, label: 'Transistores básicos y circuitos impresos rígidos', labelT: at(29) + 2.6 }), 'cube'],
  [cut(30), kType({ title: ['No se podían', 'reprogramar'], colors: [COLOR.paper, COLOR.red], tt: at(30) + 0.1, size: 150, label: 'en tiempo real', labelT: at(30) + 1.8 }), 'cut'],
  [cut(31), sSolder, 'slices'],
  [cut(33), kChapter({ img: 'celicaGrupoA', fx: 0.5, fy: 0.5, era: 3, tag: 'ADIÓS AL GRUPO B · FINALES DE LOS 80 Y 90', tagT: at(33) + 0.2, title: ['Grupo A'], tt: at(33) + 2.4 }), 'wipe'],
  [cut(34), sRestrictor, 'cube'],
  [cut(35), sLag, 'dissolve'],
  [cut(41), kPhoto3({ img: 'antilagNoche', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], dark: 0.35, tag: 'EL SOFTWARE DE LA ECU DIO LUGAR AL SISTEMA', tagT: at(41) + 2.2, title: ['Anti-Lag'], tt: at(42) + 0.3, size: 180, label: 'ELS (Exhaust Gas Recirculation System)', labelT: at(42) + 2.0 }), 'slices'],
  [cut(43), sALS1, 'cube'],
  [cut(46), sALS2, 'dissolve'],
  [cut(47), sALS3, 'cut'],
  [cut(48), sALS4, 'whip'],
  [cut(49), kClip({ seg: 'noche', from: 0.0, speed: 0.92, dark: 0.0, tag: 'EL RESULTADO', tagT: at(49) + 0.2, title: ['El famoso', 'petardeo'], tt: at(49) + 2.0, size: 130, label: 'y una respuesta de par instantánea', labelT: at(49) + 5.2 }), 'whip'],
  [cut(50), kType({ title: ['Ya no solo medía datos:', 'creaba explosiones'], colors: [COLOR.paper, COLOR.fire], tt: at(50) + 0.1, size: 120, label: 'controladas dentro del escape', labelT: at(51) + 1.0 }), 'cut'],
  [cut(52), kClip({ seg: 'impreza', from: 0.0, speed: 0.95, tag: 'WORLD RALLY CAR', tagT: at(52) + 0.3, title: ['1997'], tt: at(52) + 2.8, size: 170, extra: (t, s0) => drawEras(t, 4, ease.out(prog(t, s0 + 0.2, s0 + 1.0)), 70) }), 'wipe'],
  [cut(53), kPhoto3({ img: 'impreza97', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.02], dark: 0.4, title: ['La electrónica', 'desata su potencial'], tt: at(53) + 0.1, size: 110 }), 'cube'],
  [cut(54), sBrainCar, 'slices'],
  [cut(57), sSensorsWRC, 'dissolve'],
  [cut(61), sFrontSlip, 'cut'],
  [cut(62), kSplit({ img: 'diferencial', side: 'right', fx: 0.5, fy: 0.5, z: [1.08, 1.0], tag: 'UNA ORDEN HIDRÁULICA', tagT: at(62) + 0.1, title: ['Al diferencial', 'central'], tt: at(62) + 0.5, size: 100 }), 'cubeV'],
  [at(62) + 2.6, sClutch, 'dissolve'],
  [cut(63), sNeutral, 'dissolve'],
  [cut(64), kPhoto3({ img: 'telemetria', fx: 0.5, fy: 0.45, yaw: [0.05, -0.02], dark: 0.45, tag: 'ADEMÁS, APARECIÓ LA', tagT: at(64) + 0.1, title: ['Telemetría', 'por radioenlace'], tt: at(65) + 0.1, size: 120 }), 'wipe'],
  [cut(66), sRadio, 'cube'],
  [cut(67), sTeleUI, 'slices'],
  [cut(69), sKnock, 'dissolve'],
  [cut(71), kClip({ seg: 'puma', from: 0.0, speed: 1, tag: 'DE 2022 EN ADELANTE', tagT: at(71) + 2.6, title: ['Rally1 híbridos'], tt: at(71) + 0.6, size: 150, extra: (t, s0) => drawEras(t, 5, ease.out(prog(t, s0 + 0.2, s0 + 1.0)), 70) }), 'wipe'],
  [cut(73), kType({ tag: 'LA FIA INTRODUJO', tagT: at(73) + 0.1, title: ['Un cambio', 'regulatorio radical'], tt: at(73) + 0.6, size: 140, label: 'por contención de costes', labelT: at(73) + 3.0 }), 'whip'],
  [cut(74), sOneECU, 'cube'],
  [cut(75), kSplit({ img: 'marelli', side: 'right', fx: 0.5, fy: 0.5, z: [1.08, 1.0], tag: 'PROVEEDOR HOMOLOGADO', tagT: at(75) + 0.2, title: ['Especificaciones', 'Magneti Marelli'], tt: at(75) + 2.4, size: 92 }), 'slices'],
  [cut(76), kPhoto3({ img: 'placaECU', fx: 0.55, fy: 0.5, yaw: [-0.05, 0.03], dark: 0.5, tag: 'MISMO HARDWARE, MISMA UNIDAD CENTRAL', tagT: at(76) + 0.2, title: ['La guerra', 'del software'], tt: at(77) + 0.3, size: 130, label: 'Software privativo y calibración de los mapas de gestión', labelT: at(77) + 2.6 }), 'cube'],
  [cut(78), sEngineNode, 'dissolve'],
  [cut(82), sCAN, 'cube'],
  [cut(84), kPhoto3({ img: 'rally1Noche', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], dark: 0.45, tag: 'ESTRATEGIA DE DESPLIEGUE DE ENERGÍA', tagT: at(84) + 0.2, title: ['Power', 'deployment'], tt: at(84) + 2.8, size: 140 }), 'wipe'],
  [cut(85), sDeploy, 'slices'],
  [cut(87), sBattery, 'cube'],
  [cut(88), kChapter({ img: 'boschMS74', fx: 0.5, fy: 0.5, tag: 'DECISIONES EN MILISEGUNDOS', tagT: at(88) + 0.2, title: ['Los sensores'], tt: at(88) + 1.2 }), 'wipe'],
  [cut(89), sSensorArmy, 'dissolve'],
  [cut(91), sMapIntro, 'cube'],
  [cut(93), sMap3D, 'dissolve'],
  [cut(95), sInterp, 'cut'],
  [cut(97), sLaunch, 'slices'],
  [cut(101), sCrypto, 'cube'],
  [cut(102), kChapter({ img: 'combustible', fx: 0.5, fy: 0.5, tag: 'EL RETO MÁS RECIENTE', tagT: at(102) + 0.3, title: ['Combustibles', '100% sostenibles'], tt: at(102) + 4.0, label: 'Sintéticos y obligatorios por la FIA', labelT: at(102) + 6.6 }), 'wipe'],
  [cut(103), sFuelProps, 'cube'],
  [cut(106), sLoop, 'dissolve'],
  [cut(107), sLambda, 'cube'],
  [at(108) + 5.0, sDuty, 'dissolve'],
  [cut(110), kClip({ seg: 'c3', from: 0.0, speed: 1, tag: 'EL AUTOMOVILISMO MODERNO YA NO SE ESCRIBE SOLO CON', tagT: at(110) + 0.2, title: ['Llave inglesa', 'y grasa de motor'], tt: at(110) + 1.6, size: 116 }), 'whip'],
  [cut(111), sCode, 'slices'],
  [cut(113), sRecap, 'dissolve'],
  [cut(114), kPhoto3({ img: 'antilagNoche', fx: 0.35, fy: 0.5, yaw: [-0.06, 0.03], zoom: [1.3, 1.16], dark: 0.45, tag: 'LA CENTRALITA ES', tagT: at(114) + 0.1, title: ['El cerebro', 'invisible'], tt: at(114) + 0.6, size: 140, label: 'que permite al piloto desafiar los límites de la física', labelT: at(114) + 3.4 }), 'cube'],
  [cut(115), sChannel, 'wipe'],
];
S1.ui = cut(69);

// Ventanas de uso de cada tramo de vídeo: para cargar sus fotogramas y para que la mezcla
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
export const HITS = [cut(14), cut(33), cut(52), cut(71), cut(88), cut(102)];
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
