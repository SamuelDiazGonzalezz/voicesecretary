// Escenas del documental sobre el Toyota MR2 222D. Todo depende solo de `t`.
import { W, H, V, cut, DURATION, CLIP, T222, TS, T750, TYSI } from './timeline.js';
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES,
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
// Utilidades de plano.

const snap = (x) => Math.floor(x / 0.25) * 0.25;

// Versión en blanco y negro de una foto (se genera una vez, siempre igual).
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

// Panel de foto con la misma proyección que las plantillas.
function panel(key, x, y, w, h, u, opts = {}) {
  const z = opts.z ?? [1.1, 1.02];
  return photo(key, x, y, w, h, { zoom: lerp(z[0], z[1], ease.out(u)), fx: opts.fx ?? 0.5, fy: opts.fy ?? 0.5 }, { dark: opts.dark ?? 0, vig: opts.vig ?? 0.3, gray: opts.gray });
}

// ---------------------------------------------------------------------------
// Planos singulares.

// Entrada: logotipo del canal y debajo «Toyota MR2 222D».
function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 760, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.2))));
  ctx.drawImage(lg, W / 2 - w / 2, 420 - h / 2, w, h);
  ctx.restore();
  revealText(ctx, 'Toyota MR2 222D', W / 2, 880, FONT.display(700, 120), COLOR.paper, prog(t, 0.55, 1.25), { align: 'center', stagger: 0.03, spacing: 4 });
  stripesH(ctx, 920, 10, prog(t, 0.85, 1.55), 0, { x0: W / 2 - 240, x1: W / 2 + 240 });
}

// Los reyes de siempre: tres nombres, uno por palabra de la voz.
function sKings(t, s0) {
  bg();
  tag(t, 'SIEMPRE CORONAMOS A LOS MISMOS REYES', M, 380, s0 + 0.15);
  const names = [['Audi', V(3)], ['Lancia', V(4)], ['Peugeot', V(5)]];
  const colW = GRID.w / 3;
  names.forEach(([n, tt], i) => {
    const x = M + i * colW;
    revealText(ctx, n, x, 640, FONT.display(700, 150), COLOR.paper, prog(t, tt - 0.08, tt + 0.5), { stagger: 0.04 });
    ctx.save();
    ctx.globalAlpha = ease.out(prog(t, tt, tt + 0.6));
    ctx.fillStyle = COLOR.faint;
    ctx.fillRect(x, 700, (colW - 60) * ease.out(prog(t, tt, tt + 0.7)), 2);
    ctx.restore();
  });
  // Al girar la frase («Pero…») los reyes se apagan.
  const out = ease.inOut(prog(t, V(6) - 0.6, V(6)));
  if (out > 0) { ctx.fillStyle = `rgba(11,12,14,${out * 0.6})`; ctx.fillRect(0, 0, W, H); }
}

// Extremo. Violento. Oscuro.
function sExtreme(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('museoFrente', 0, 0, W, H, { zoom: lerp(1.18, 1.06, ease.out(u)), fx: 0.55, fy: 0.55 }, { dark: 0.42, vig: 0.6 });
  tag(t, 'UN COCHE TAN', M, 560, s0 + 0.1);
  const words = [['Extremo.', V(8) + 0.5, COLOR.paper], ['Violento.', V(9) + 0.25, COLOR.paper], ['Oscuro.', V(9) + 1.45, COLOR.red]];
  words.forEach(([w, tt, col], i) => lines(t, [w], M, 690 + i * 130, 0, 128, tt, { color: col }));
}

// Bajo llave: una persiana metálica baja sobre el coche.
function sLocked(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('puerta', 0, 0, W, H, { zoom: lerp(1.1, 1.02, ease.out(u)), fx: 0.5, fy: 0.55 }, { dark: 0.3, vig: 0.55 });
  const p = ease.inOut(prog(t, V(10) + 2.6, V(10) + 4.6));
  if (p > 0) {
    const yb = p * H;
    const slat = 54;
    ctx.save();
    for (let y = yb - slat; y > -slat; y -= slat) {
      ctx.fillStyle = '#1A1C20';
      ctx.fillRect(0, y, W, slat - 4);
      ctx.fillStyle = 'rgba(232,233,230,0.07)';
      ctx.fillRect(0, y, W, 3);
    }
    ctx.fillStyle = '#26282D';
    ctx.fillRect(0, yb - 14, W, 14);
    ctx.restore();
  }
  tag(t, 'LA HISTORIA DECIDIÓ ENCERRARLO', M, 820, V(10) + 0.4);
  lines(t, ['Bajo llave'], M, 960, 0, 150, V(10) + 1.6, { colors: [COLOR.paper] });
}

// «222D» en grande, con la foto del coche dentro de las letras.
function s222D(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  tag(t, 'ESTA ES LA HISTORIA DEL ENIGMÁTICO CÓDIGO', W / 2, 300, s0 + 0.1, COLOR.yellow, { align: 'center' });
  const size = 400;
  const font = FONT.display(700, size);
  const p = ease.outExpo(prog(t, T222, T222 + 0.6));
  // Capa de texto: las letras recortan la foto.
  const L = toLayer('type', () => {
    ctx.clearRect(0, 0, W, H);
    revealText(ctx, '222D', W / 2, 700, font, '#fff', p, { align: 'center', stagger: 0.06 });
    ctx.globalCompositeOperation = 'source-in';
    photo('trasera', 0, 0, W, H, { zoom: lerp(1.35, 1.2, ease.out(u)), fx: 0.62, fy: 0.55 }, { dark: 0, vig: 0 });
    ctx.globalCompositeOperation = 'source-over';
  });
  ctx.drawImage(L, 0, 0);
  // Contorno fino para que la cifra se lea sobre las zonas oscuras de la foto.
  if (p > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 * ease.out(prog(t, T222 + 0.3, T222 + 1.0));
    ctx.font = font; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = COLOR.paper;
    ctx.strokeText('222D', W / 2, 700);
    ctx.restore();
  }
  stripesH(ctx, 760, 14, prog(t, T222 + 0.4, T222 + 1.2), 0, { x0: W / 2 - 430, x1: W / 2 + 430 });
  label(ctx, 'El monstruo que nunca dejaron salir de su jaula', W / 2, 880, DIM, prog(t, V(14) + 0.1, V(14) + 0.6), { size: 44, spacing: 0, weight: 600, align: 'center' });
}

// El Celica frente a los 4×4 de motor central: dos plantas a la misma escala.
function sDino(t, s0) {
  bg(); dots();
  const d1 = ease.out(prog(t, s0 + 0.1, s0 + 1.2));
  const d2 = ease.out(prog(t, s0 + 0.5, s0 + 1.6));
  drawPlan(t, { cx: 560, cy: 560, scale: 0.62, rot: -Math.PI / 2, draw: d1, layout: 'audi', drive: 'rwd', power: prog(t, s0 + 1.2, s0 + 2), wing: false, dim: 0 });
  drawPlan(t, { cx: 1360, cy: 560, scale: 0.62, rot: -Math.PI / 2, draw: d2, layout: '205', drive: 'awd', power: prog(t, s0 + 1.6, s0 + 2.4), wing: false, flow: COLOR.red });
  label(ctx, 'CELICA · MOTOR DELANTERO · TRASERA', 560, 940, DIM, prog(t, s0 + 0.9, s0 + 1.4), { size: 24, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'MOTOR CENTRAL · 4×4', 1360, 940, COLOR.paper, prog(t, s0 + 1.3, s0 + 1.8), { size: 24, spacing: 6, weight: 700, align: 'center' });
  // «Dinosaurio pesado y obsoleto»: el Celica se apaga.
  const off = ease.inOut(prog(t, V(25) + 1.4, V(25) + 2.4));
  if (off > 0) {
    ctx.fillStyle = `rgba(11,12,14,${0.55 * off})`;
    ctx.fillRect(160, 120, 800, 860);
    lines(t, ['Un dinosaurio'], 560, 170, 0, 92, V(25) + 1.4, { align: 'center', color: COLOR.red });
  }
}

// Nacería el Grupo S.
function sGroupS(t, s0) {
  bg();
  tag(t, 'NACERÍA EL', W / 2, 370, s0 + 0.1, COLOR.yellow, { align: 'center' });
  const size = 300;
  ctx.save();
  ctx.font = FONT.display(700, size);
  const wG = ctx.measureText('Grupo ').width, wS = ctx.measureText('S').width;
  ctx.restore();
  const x0 = W / 2 - (wG + wS) / 2;
  revealText(ctx, 'Grupo', x0, 650, FONT.display(700, size), COLOR.paper, prog(t, V(29) - 0.15, V(29) + 0.4), { stagger: 0.05 });
  slam(t, 'S', x0 + wG, 650, TS, size, COLOR.red);
  stripesH(ctx, 700, 14, prog(t, TS + 0.15, TS + 0.95), 0, { x0: W / 2 - 420, x1: W / 2 + 420 });
  label(ctx, 'Una categoría futurista que reemplazaría al salvaje Grupo B', W / 2, 840, DIM, prog(t, V(30) + 0.2, V(30) + 0.7), { size: 44, spacing: 0, weight: 600, align: 'center' });
}

// Homologación: 10 coches de calle frente a 200.
function sHomolog(t, s0) {
  bg();
  const t10 = V(31) + 3.6, t200 = V(32) + 0.9;
  tag(t, 'PARA HOMOLOGAR EL MODELO DE CARRERAS', M, 300, s0 + 0.1);
  // Cifra: 10, luego 200.
  const show200 = ease.out(prog(t, t200 - 0.2, t200 + 0.3));
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, t10 - 0.3, t10 + 0.2)) * (1 - show200);
  counter(10, M - 8, 560, 260, COLOR.red);
  ctx.restore();
  label(ctx, 'coches de calle · Grupo S', M, 660, COLOR.paper, prog(t, t10, t10 + 0.5) * (1 - show200), { size: 44, spacing: 0, weight: 700 });
  ctx.save();
  ctx.globalAlpha = show200;
  counter(200, M - 8, 560, 260, COLOR.steel);
  ctx.restore();
  label(ctx, 'coches de calle · Grupo B', M, 660, DIM, show200, { size: 44, spacing: 0, weight: 700 });
  // Rejilla de 200: diez en rojo; las demás aparecen con el Grupo B.
  const x = 1000, y = 280, cols = 20, gw = 39, gh = 56;
  for (let i = 0; i < 200; i++) {
    const r = Math.floor(i / cols), col = i % cols;
    const sel = r === 0 && col < 10;
    const a = sel ? ease.outExpo(prog(t, t10 - 0.4 + col * 0.05, t10 + col * 0.05)) : ease.out(prog(t, t200 - 0.3 + (r * cols + col) * 0.004, t200 + 0.2 + (r * cols + col) * 0.004));
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = sel ? COLOR.red : 'rgba(140,144,150,0.55)';
    ctx.beginPath(); ctx.roundRect(x + col * gw, y + r * gh + (1 - a) * 12, gw - 12, 26, 6); ctx.fill();
    ctx.restore();
  }
}

// Del MR2 de calle al 222D: qué se conservó y qué se inventó.
function sKeep(t, s0, s1) {
  bg(); dots();
  const draw = ease.inOut(prog(t, s0 + 0.1, s0 + 1.5));
  const keep = ease.inOut(prog(t, V(40) + 2.4, V(40) + 3.4));
  const morph = ease.inOut(prog(t, V(42) + 0.2, V(42) + 1.8));
  drawSide(t, { cx: 1100, cy: 900, s: 1.12, morph, draw, keep: keep * (1 - morph * 0.6) });
  tag(t, 'DEL PEQUEÑO Y SIMPÁTICO COCHE DE CALLE', M, 170, s0 + 0.1);
  lines(t, ['Solo quedó la silueta del techo'], M, 290, 0, 96, V(40) + 2.2, { exit: [V(42) - 0.1, V(42) + 0.2] });
  label(ctx, 'el parabrisas y las puertas', M, 370, COLOR.paper, prog(t, V(41) + 0.1, V(41) + 0.6) * (1 - prog(t, V(42) - 0.1, V(42) + 0.2)), { size: 44, spacing: 0, weight: 600 });
  lines(t, ['El resto: pura ingeniería paramilitar'], M, 290, 0, 96, V(42) + 0.4, { colors: [COLOR.paper] });
}

// El corte por la mitad y el chasis tubular.
function sCut(t, s0) {
  bg(); dots();
  const c = ease.inOut(prog(t, V(43) + 0.6, V(43) + 1.5));
  const sep = ease.inOut(prog(t, V(43) + 1.5, V(43) + 2.3)) * 120;
  const cx = 1060, cy = 860, s = 1.12;
  for (const [side, dx] of [[-1, -sep], [1, sep]]) {
    ctx.save();
    ctx.beginPath();
    if (side < 0) ctx.rect(-100, 0, cx - 20 * s + 100, H); else ctx.rect(cx - 20 * s, 0, W, H);
    ctx.clip();
    ctx.translate(dx, 0);
    drawSide(t, { cx, cy, s, morph: 0, draw: 1, cut: c });
    ctx.restore();
  }
  tag(t, 'LOS INGENIEROS', M, 170, s0 + 0.1);
  lines(t, ['Cortaron el MR2 por la mitad'], M, 290, 0, 96, V(43) + 0.3);
}

function sFrame(t, s0, s1) {
  bg(); dots();
  const draw = ease.inOut(prog(t, s0, s0 + 1.8));
  const yaw = 0.42 + 0.07 * (t - s0);
  drawFrame3D(t, { cx: 1230, cy: 520, s: 1.35, yaw, pitch: 0.5, draw, highlight: ease.out(prog(t, V(44), V(44) + 0.6)) });
  tag(t, 'DISEÑADO A MEDIDA', M, 300, s0 + 0.1);
  lines(t, ['Chasis', 'tubular'], M, 430, 124, 124, s0 + 0.25, { maxW: 560 });
  label(ctx, 'Extremadamente rígido', M, 700, COLOR.red, prog(t, V(44) + 0.1, V(44) + 0.6), { size: 48, spacing: 0, weight: 700 });
}

// La anchura: frente del MR2 contra frente del 222D.
function sWidth(t, s0) {
  bg(); dots();
  const k = ease.inOut(prog(t, V(45) + 1.6, V(45) + 3.4));
  drawFront(t, { cx: 1240, cy: 790, s: 1.18, k, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  tag(t, 'CARROCERÍA DE MATERIALES COMPUESTOS', M, 300, s0 + 0.1);
  lines(t, ['Absurdamente', 'ancha'], M, 430, 124, 124, V(45) + 3.4, { maxW: 520, colors: [COLOR.paper, COLOR.red] });
  label(ctx, 'MR2 DE CALLE', 1240, 420, DIM, prog(t, s0 + 0.5, s0 + 1) * (1 - k), { size: 24, spacing: 6, weight: 700, align: 'center' });
  label(ctx, '222D', 1240, 420, COLOR.paper, k, { size: 24, spacing: 6, weight: 700, align: 'center' });
}

// Pasos de rueda y cola de pato, sobre el perfil del 222D.
function sTail(t, s0) {
  bg(); dots();
  const cx = 1060, cy = 880, s = 1.12;
  drawSide(t, { cx, cy, s, morph: 1, draw: 1, tail: ease.inOut(prog(t, V(46) + 5.0, V(46) + 6.2)) });
  callout(t, cx + 330 * s, cy - 190 * s, cx + 230 * s, cy - 400 * s, 'PASOS DE RUEDA', V(46) + 0.5);
  tag(t, 'NEUMÁTICOS DE COMPETICIÓN Y UN ALERÓN INTEGRADO', M, 170, s0 + 0.1);
  lines(t, ['Cola de pato'], M, 290, 0, 110, V(46) + 5.0, { colors: [COLOR.red] });
}

// La zaga se levanta en una pieza.
function sLift(t, s0) {
  bg(); dots();
  drawSide(t, { cx: 1180, cy: 900, s: 1.12, morph: 1, draw: 1, engine: ease.out(prog(t, V(47) + 1.0, V(47) + 1.8)), lift: prog(t, V(47) + 0.2, V(47) + 1.9) });
  tag(t, 'EN UNA SOLA PIEZA', M, 170, s0 + 0.1);
  lines(t, ['La zaga entera se levantaba'], M, 290, 0, 96, V(47) + 0.1);
}

// Negro mate: el color como protagonista.
function sMatte(t, s0, s1) {
  bg('#0E0F11');
  const u = span(t, s0, s1);
  photo('lateral', 0, 0, W, H, { zoom: lerp(1.5, 1.42, ease.out(u)), fx: 0.5, fy: 0.62 }, { dark: 0.25, vig: 0.7, open: ease.inOut(prog(t, s0, s0 + 0.7)) * 0.42 });
  tag(t, 'PINTADO DE UN RIGUROSO', W / 2, 200, s0 + 0.1, COLOR.yellow, { align: 'center' });
  revealText(ctx, 'Negro mate', W / 2, 980, FONT.display(700, 170), COLOR.paper, prog(t, V(49) + 0.8, V(49) + 1.4), { align: 'center', stagger: 0.03 });
}

// Lo apodaron: «Black Monster» o «Darth Vader».
function sNick(t, s0) {
  bg();
  tag(t, 'LO APODARON AL INSTANTE COMO', W / 2, 340, s0 + 0.1, COLOR.yellow, { align: 'center' });
  lines(t, ['«Black Monster»'], W / 2, 600, 0, 200, V(50) + 1.0, { align: 'center', exit: [V(50) + 2.7, V(50) + 3.0] });
  label(ctx, 'o', W / 2, 600 - 60, DIM, prog(t, V(50) + 2.8, V(50) + 3.1) * (1 - prog(t, V(50) + 3.2, V(50) + 3.4)), { size: 60, spacing: 0, weight: 600, align: 'center' });
  lines(t, ['«Darth Vader»'], W / 2, 600, 0, 200, V(50) + 3.2, { align: 'center', colors: [COLOR.red] });
}

// A centímetros de la nuca del piloto.
function sNape(t, s0) {
  bg(); dots();
  const cx = 1180, cy = 900, s = 1.12;
  const eng = ease.out(prog(t, V(55) + 0.2, V(55) + 0.9));
  drawSide(t, { cx, cy, s, morph: 1, draw: 1, engine: eng, driver: ease.out(prog(t, s0 + 0.4, s0 + 1.1)) });
  // Cota entre la cabeza y el motor.
  const dp = ease.out(prog(t, V(55) + 1.2, V(55) + 1.8));
  if (dp > 0) {
    const xh = cx + (-45 - 26) * s, xe = cx + (-140) * s, y = cy - 205 * s;
    dimLine(xe, xh, y, dp, COLOR.yellow);
  }
  tag(t, 'PERO LA VERDADERA LOCURA, EL AUTÉNTICO PELIGRO', M, 170, s0 + 0.1);
  lines(t, ['Palpitaba a centímetros', 'de la nuca del piloto'], M, 290, 100, 96, V(55) + 0.1, { colors: [COLOR.paper, COLOR.red] });
}

// Configuraciones: V6, transversal… y el 503E.
function sConfigs(t, s0) {
  bg(); dots();
  tag(t, 'PROBARON VARIAS CONFIGURACIONES', M, 230, s0 + 0.1);
  const cards = [['V6', V(57) + 0.3], ['TRANSVERSAL', V(57) + 1.4], ['503E', V(58) + 2.0]];
  const cw = 480, gap = 60, y = 360, h = 460;
  const x0 = (W - (cw * 3 + gap * 2)) / 2;
  const strike = ease.inOut(prog(t, V(58) + 1.4, V(58) + 2.0));
  cards.forEach(([name, tt], i) => {
    const a = ease.outExpo(prog(t, tt, tt + 0.5));
    if (a <= 0) return;
    const x = x0 + i * (cw + gap);
    const win = i === 2;
    ctx.save();
    ctx.globalAlpha = a * (win ? 1 : 1 - 0.65 * strike);
    ctx.translate(0, (1 - a) * 30);
    ctx.fillStyle = win ? COLOR.ink2 : 'rgba(23,25,29,0.8)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, h, 18); ctx.fill();
    if (win) { ctx.strokeStyle = COLOR.red; ctx.lineWidth = 4; ctx.stroke(); }
    // Icono del motor.
    ctx.strokeStyle = COLOR.paper;
    ctx.lineWidth = 3;
    const cx = x + cw / 2, cy = y + 190;
    if (i === 0) {
      // V6 visto de frente: dos bancadas a 60° sobre el cigüeñal.
      ctx.beginPath(); ctx.arc(cx, cy + 70, 34, 0, Math.PI * 2); ctx.stroke();
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(cx, cy + 70); ctx.rotate(sd * Math.PI / 6);
        ctx.strokeRect(-38, -190, 76, 140);
        ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -120); ctx.stroke();
        ctx.restore();
      }
    } else if (i === 1) {
      ctx.strokeRect(cx - 120, cy - 110, 240, 220);
      ctx.fillStyle = COLOR.steel;
      ctx.fillRect(cx - 110, cy - 26, 220, 52);
      label(ctx, 'MARCHA', cx, cy - 130, DIM, 1, { size: 18, spacing: 5, weight: 600, align: 'center' });
      ctx.beginPath(); ctx.moveTo(cx, cy - 115); ctx.lineTo(cx - 10, cy - 100); ctx.lineTo(cx + 10, cy - 100); ctx.closePath(); ctx.fillStyle = DIM; ctx.fill();
    } else {
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx - 105 + k * 70, cy, 28, 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeRect(cx - 150, cy - 50, 300, 100);
      ctx.fillStyle = COLOR.red;
      ctx.beginPath(); ctx.arc(cx + 170, cy - 70, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    label(ctx, name, x + cw / 2, y + 400, win ? COLOR.paper : DIM, a * (win ? 1 : 1 - 0.5 * strike), { size: win ? 64 : 40, spacing: win ? 2 : 6, weight: 700, align: 'center' });
    if (!win && strike > 0) {
      ctx.save();
      ctx.strokeStyle = COLOR.red;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x + 100, y + 388); ctx.lineTo(x + 100 + (cw - 200) * strike, y + 388); ctx.stroke();
      ctx.restore();
    }
  });
  label(ctx, 'La especificación más extrema', W / 2, 920, DIM, prog(t, V(58) + 2.2, V(58) + 2.7), { size: 44, spacing: 0, weight: 600, align: 'center' });
}

// El 503E: cuatro cilindros en línea animados y el plano.
function sEngine(t, s0, s1) {
  bg(); dots();
  const u = span(t, s0, s1);
  panel('plano', 1200, 0, 720, H, u, { z: [1.15, 1.05], fy: 0.4, vig: 0.4 });
  drawInline4(t, s0, 580, 760, 0.82, ease.out(prog(t, s0 + 0.3, s0 + 1.0)));
  tag(t, 'BLOQUE 503E', M, 210, s0 + 0.1);
  lines(t, ['4 cilindros turbo'], M, 330, 0, 110, V(59) + 1.6, { maxW: 980 });
  label(ctx, '2,1 litros', M, 420, COLOR.red, prog(t, V(59) + 2.6, V(59) + 3.1), { size: 52, spacing: 0, weight: 700 });
}

// Presiones absurdas: el manómetro.
function sPressure(t, s0) {
  bg(); dots();
  const v = 2.6 * ease.inOut(prog(t, s0 + 0.5, s0 + 2.8)) + 0.04 * noise1(t * 6);
  arcGauge(t, 1360, 560, 300, v, 3, ease.out(prog(t, s0, s0 + 0.5)), 12, COLOR.red);
  label(ctx, 'PRESIÓN DE SOPLADO', 1360, 920, DIM, prog(t, s0 + 0.4, s0 + 0.9), { size: 24, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'CAPAZ DE SOPORTAR', M, 400, s0 + 0.1);
  lines(t, ['Presiones', 'absurdas'], M, 540, 130, 130, V(60) + 0.4, { maxW: 640, colors: [COLOR.paper, COLOR.red] });
}

// Sin restricciones en el turbocompresor.
function sUnrestricted(t, s0) {
  bg(); dots();
  const free = ease.inOut(prog(t, V(65) + 2.5, V(65) + 3.3));
  TURBO_T0 = s0;
  const th = spinAngle(t, s0, (u) => lerp(0.9, 3.2, ease.inOut(prog(u, V(65) + 2.5, V(65) + 3.8))));
  drawTurboSection(t, { cx: 1260, cy: 640, s: 0.62, th, air: lerp(0.35, 1, free), ex: lerp(0.4, 1, free), labels: 0, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  drawRestrictorAt(1260, 640, 0.62, 1 - free, free);
  tag(t, 'PROBARON EL 222D', M, 230, s0 + 0.1);
  lines(t, ['Sin restricciones'], M, 350, 0, 110, V(65) + 2.4, { maxW: 820 });
  label(ctx, 'en el turbocompresor', M, 430, DIM, prog(t, V(65) + 3.4, V(65) + 3.9), { size: 44, spacing: 0, weight: 600 });
}
function drawRestrictorAt(cx, cy, s, k, fly) {
  ctx.save();
  ctx.translate(-fly * 200 * s, 0);
  drawRestrictor(cx, cy, s, k);
  ctx.restore();
  label(ctx, 'RESTRICTOR', cx - 530 * s, cy - 150 * s, COLOR.red, k, { size: 22, spacing: 6, weight: 700, align: 'center' });
}

// Tracción total Xtrac regulable desde el habitáculo.
function sXtrac(t, s0) {
  bg(); dots();
  const v = 0.5 + 0.18 * Math.sin(Math.PI * 2 * ease.inOut(prog(t, V(67) + 2.0, V(67) + 5.0)));
  drawPlan(t, { cx: 1300, cy: 470, scale: 0.6, draw: ease.out(prog(t, s0 + 0.1, s0 + 1.2)), layout: '205', drive: 'awd', power: prog(t, s0 + 0.8, s0 + 1.6), flow: COLOR.red, wing: false });
  drawSplit(t, { cx: 1300, cy: 860, w: 640, v, appear: ease.out(prog(t, V(67) + 1.6, V(67) + 2.1)) });
  tag(t, 'TRACCIÓN TOTAL XTRAC', M, 300, s0 + 0.1);
  lines(t, ['Regulable desde', 'el habitáculo'], M, 430, 116, 110, V(67) + 1.6, { maxW: 640 });
}

// 300 → 750 caballos.
function s750(t, s0) {
  bg(); dots();
  const v = 750 * ease.inOut(prog(t, s0 + 1.0, T750)) ;
  arcGauge(t, 1380, 540, 300, v, 800, ease.out(prog(t, s0, s0 + 0.5)), 16, v > 300 ? COLOR.red : COLOR.paper);
  // Marca del límite de 300 CV.
  const a0 = Math.PI * 0.75 + Math.PI * 1.5 * (300 / 800);
  ctx.save();
  ctx.strokeStyle = COLOR.yellow;
  ctx.lineWidth = 5;
  ctx.globalAlpha = ease.out(prog(t, s0 + 0.3, s0 + 0.8));
  ctx.beginPath(); ctx.moveTo(1380 + Math.cos(a0) * 250, 540 + Math.sin(a0) * 250); ctx.lineTo(1380 + Math.cos(a0) * 345, 540 + Math.sin(a0) * 345); ctx.stroke();
  ctx.restore();
  label(ctx, 'LÍMITE · 300', 1380 + Math.cos(a0) * 380, 540 + Math.sin(a0) * 380, COLOR.yellow, prog(t, s0 + 0.5, s0 + 1.0), { size: 22, spacing: 6, weight: 700, align: 'right' });
  tag(t, 'EN SUS PICOS DE MÁXIMA PRESIÓN', M, 360, s0 + 0.1);
  counter(v, M - 8, 640, 260, v > 300 ? COLOR.red : COLOR.paper);
  label(ctx, 'caballos', M, 740, COLOR.paper, prog(t, s0 + 0.6, s0 + 1.1), { size: 56, spacing: 0, weight: 700 });
}

// 750 kg ÷ 750 CV.
function sRatio(t, s0) {
  bg();
  tag(t, 'RELACIÓN PESO-POTENCIA', W / 2, 330, s0 + 0.1, COLOR.yellow, { align: 'center' });
  const f = FONT.display(700, 150);
  revealText(ctx, '750 kg', W / 2 - 330, 560, f, COLOR.paper, prog(t, s0 + 0.2, s0 + 0.8), { align: 'center' });
  revealText(ctx, '÷', W / 2, 560, f, DIM, prog(t, s0 + 0.5, s0 + 1.0), { align: 'center' });
  revealText(ctx, '750 CV', W / 2 + 330, 560, f, COLOR.paper, prog(t, s0 + 0.7, s0 + 1.3), { align: 'center' });
  stripesH(ctx, 620, 10, prog(t, s0 + 1.2, s0 + 1.9), 0, { x0: W / 2 - 520, x1: W / 2 + 520 });
  revealText(ctx, '1 kg por caballo', W / 2, 790, FONT.display(700, 120), COLOR.red, prog(t, s0 + 1.6, s0 + 2.3), { align: 'center', stagger: 0.02 });
  label(ctx, 'muy superior a la de un Fórmula 1 de la época', W / 2, 900, DIM, prog(t, V(69) + 2.4, V(69) + 2.9), { size: 44, spacing: 0, weight: 600, align: 'center' });
}

// Impredecible. Caprichoso.
function sWild(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('habitaculo', 0, 0, W, H, { zoom: lerp(1.2, 1.06, ease.out(u)), fx: 0.4, fy: 0.5 }, { dark: 0.5, vig: 0.6 });
  tag(t, 'LOS PROPIOS PILOTOS DE PRUEBA ADMITIERON', M, 700, s0 + 0.2);
  lines(t, ['Impredecible.'], M, 830, 0, 130, V(70) + 5.6);
  lines(t, ['Caprichoso.'], M, 960, 0, 130, V(71) - 0.05, { colors: [COLOR.red] });
}

// Un milímetro con el acelerador.
function sMillimeter(t, s0) {
  bg(); dots();
  drawThrottle(t, s0, { x0: 1000, x1: 1780, yb: 860, yt: 260, draw: ease.inOut(prog(t, s0 + 0.3, s0 + 2.2)), mark: ease.out(prog(t, V(72) + 5.0, V(72) + 5.6)) });
  tag(t, 'UNA BESTIA HIPERACTIVA', M, 300, s0 + 0.1);
  lines(t, ['Si te equivocabas', 'un milímetro'], M, 430, 116, 110, V(72) + 4.4, { maxW: 720, colors: [COLOR.paper, COLOR.yellow] });
  label(ctx, 'te catapultaba fuera de la carretera', M, 620, DIM, prog(t, V(72) + 2.4, V(72) + 2.9), { size: 40, spacing: 0, weight: 600 });
}

// Mayo de 1986.
function sCorsica(t, s0) {
  bg();
  revealText(ctx, 'Mayo de 1986', W / 2, 560, FONT.display(700, 190), COLOR.paper, prog(t, V(74) - 0.05, V(74) + 0.9), { align: 'center', stagger: 0.03 });
  ctx.save();
  ctx.fillStyle = COLOR.faint;
  ctx.fillRect(W / 2 - 360 * ease.inOut(prog(t, V(74) + 0.6, V(74) + 1.8)), 640, 720 * ease.inOut(prog(t, V(74) + 0.6, V(74) + 1.8)), 2);
  ctx.restore();
  label(ctx, 'TOUR DE CÓRCEGA', W / 2, 740, COLOR.yellow, prog(t, V(75) + 3.0, V(75) + 3.7), { size: 26, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'Henri Toivonen', W / 2, 820, DIM, prog(t, V(75) + 1.4, V(75) + 2.2), { size: 48, spacing: 0, weight: 600, align: 'center' });
}

// La FIA tacha el Grupo B… y el Grupo S.
function sBan(t, s0) {
  bg();
  tag(t, 'LA FIA, BAJO UNA PRESIÓN MEDIÁTICA BRUTAL', M, 300, s0 + 0.1);
  const rows = [['Grupo B', V(78) + 0.8, V(78) + 2.2, '1987'], ['Grupo S', V(79) + 0.4, V(79) + 2.6, 'antes de nacer']];
  rows.forEach(([n, ta, ts, note], i) => {
    const y = 560 + i * 240;
    revealText(ctx, n, M, y, FONT.display(700, 200), COLOR.paper, prog(t, ta - 0.3, ta + 0.4), { stagger: 0.04 });
    const k = ease.inOut(prog(t, ts, ts + 0.6));
    if (k > 0) {
      ctx.save();
      ctx.font = FONT.display(700, 200);
      const w = ctx.measureText(n).width;
      ctx.fillStyle = COLOR.red;
      ctx.fillRect(M - 10, y - 74, (w + 20) * k, 14);
      ctx.restore();
    }
    label(ctx, note, M + 760, y - 30, i ? COLOR.red : DIM, prog(t, ts + 0.3, ts + 0.8), { size: 48, spacing: 0, weight: 700 });
  });
}

// Bajo una lona en Colonia.
function sTarp(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('coleccion', 0, 0, W, H, { zoom: lerp(1.25, 1.15, ease.out(u)), fx: 0.25, fy: 0.55 }, { dark: 0.35, vig: 0.6, gray: true });
  tag(t, 'MILLONES DE DÓLARES · MILES DE HORAS DE INGENIERÍA', M, 200, s0 + 0.2);
  drawTarp(t, prog(t, V(82) + 5.0, V(82) + 7.2));
  lines(t, ['Bajo una lona'], M, 860, 0, 140, V(82) + 5.6);
  label(ctx, 'En las instalaciones de Toyota en Colonia', M, 950, DIM, prog(t, V(82) + 7.2, V(82) + 7.7), { size: 44, spacing: 0, weight: 600 });
}

// El clip del cliente: el 222D en Goodwood, mientras la voz sigue.
function sClip(t, s0) {
  bg();
  drawClip(t - CLIP.at, { zoom: 1.04, dark: 0.08 });
  scrimBottom(0.7);
  tag(t, 'GOODWOOD', M, 820, s0 + 0.3);
  lines(t, ['Su aullido'], M, 960, 0, 130, V(87) + 0.2);
}
function scrimBottom(a) {
  const g = ctx.createLinearGradient(0, H - 420, 0, H);
  g.addColorStop(0, 'rgba(11,12,14,0)');
  g.addColorStop(1, `rgba(11,12,14,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 420, W, 420);
}

// ¿Habría destronado al 205 T16 o al Delta S4?
function sVersus(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('cenital', 0, 0, 900, H, { zoom: lerp(1.2, 1.08, ease.out(u)), fx: 0.45, fy: 0.5 }, { vig: 0.3 });
  const x = 1000;
  tag(t, '¿HABRÍA SIDO CAPAZ DE DESTRONAR AL…', x, 330, s0 + 0.2);
  lines(t, ['Peugeot 205 T16'], x, 500, 0, 110, V(91) + 4.6, { maxW: 780 });
  label(ctx, 'o al', x, 600, DIM, prog(t, V(91) + 5.6, V(91) + 6.0), { size: 44, spacing: 0, weight: 600 });
  lines(t, ['Lancia Delta S4?'], x, 730, 0, 110, V(91) + 5.9, { maxW: 780, colors: [COLOR.red] });
}

// Cierre: logotipo, me gusta, suscripción y despedida.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 700, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = la;
  ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h);
  ctx.restore();
  label(ctx, 'Déjalo en los comentarios', W / 2, 700, DIM, prog(t, V(92), V(92) + 0.5) * (1 - prog(t, V(93) + 0.3, V(93) + 0.6)), { size: 44, spacing: 0, weight: 600, align: 'center' });
  pill(t, 'Me gusta', W / 2 - 230, 760, V(93) + 0.3, { press: V(93) + 1.0, color: COLOR.ink2, pressed: COLOR.steel, text: COLOR.paper, size: 40 });
  pill(t, 'Suscríbete', W / 2 + 230, 760, V(93) + 1.6, { press: V(93) + 2.4, color: COLOR.red, size: 40 });
  label(ctx, '¡Nos vemos en el próximo tramo!', W / 2, 930, COLOR.paper, prog(t, V(94), V(94) + 0.5), { size: 46, spacing: 0, weight: 600, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [cut(0), kPhoto({ img: 'callesB', fx: 0.45, fy: 0.55, z: [1.16, 1.04], dark: 0.4, tag: 'LA ERA DORADA DE LOS RALLYS', title: ['Los años 80'], tt: V(1) - 0.05, size: 150 }), 'dissolve'],
  [cut(2), sKings, 'whip'],
  [cut(6), kPhoto({ img: 'escondido', fx: 0.5, fy: 0.5, z: [1.2, 1.05], dark: 0.45, tag: 'EN LOS RINCONES MÁS SECRETOS DE EUROPA', tagT: V(6) + 0.3, title: ['Se estaba gestando', 'una máquina'], tt: V(7) + 0.1, size: 120, label: 'que amenazaba con hacerlos pedazos a todos', labelT: V(7) + 2.0 }), 'dissolve'],
  [cut(8), sExtreme, 'cut'],
  [cut(10), sLocked, 'slices'],
  [cut(11), kType({ tag: 'LO BAUTIZARON EN LOS TALLERES COMO EL', title: ['«Darth Vader»'], align: 'center', tt: V(11) + 1.6, size: 220, label: 'de los rallys', labelT: V(11) + 2.6 }), 'cut'],
  [cut(12), kPhoto({ img: 'cenital', fx: 0.5, fy: 0.5, z: [1.14, 1.04], dark: 0.4, tag: 'TOYOTA', title: ['El arma definitiva', 'y secreta'], tt: V(12) + 0.2, size: 120, colors: [COLOR.paper, COLOR.red] }), 'whip'],
  [cut(13), s222D, 'wipe'],
  [cut(15), kType({ tag: 'A MEDIADOS DE LOS AÑOS 80', title: ['Toyota', 'Team Europe'], tt: V(16), size: 170, label: 'Liderado por el genio Ove Andersson', labelT: V(17) + 0.2, stripes: true }), 'dissolve'],
  [cut(18), kType({ tag: 'TTE ERA', title: ['El rey de las pruebas', 'de resistencia'], tt: V(18) + 0.2, size: 140, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(19), kPhoto({ img: 'celica', fx: 0.5, fy: 0.55, z: [1.12, 1.03], dark: 0.35, tag: 'CELICA TWIN-CAM TURBO · TRACCIÓN TRASERA', title: ['Un tanque', 'indestructible'], tt: V(19) + 2.4, size: 120, label: 'Ganando el Rally Safari año tras año', labelT: V(20) + 0.2 }), 'slices'],
  [cut(21), kType({ title: ['Pero había', 'un problema.'], tt: V(21), size: 170, colors: [COLOR.paper, COLOR.red] }), 'cut'],
  [cut(22), kPhoto({ img: 'peugeot', fx: 0.5, fy: 0.5, z: [1.14, 1.04], dark: 0.35, tag: 'EN LAS CARRETERAS HELADAS Y ESTRECHAS DE EUROPA', tagT: V(22) + 0.1, title: ['4×4 con', 'motor central'], tt: V(24) + 1.6, size: 130 }), 'whip'],
  [cut(25), sDino, 'slices'],
  [cut(26), kType({ tag: 'TOYOTA NECESITABA', title: ['Una revolución', 'absoluta.'], tt: V(26) + 0.5, size: 170, colors: [COLOR.paper, COLOR.red] }), 'whipV'],
  [cut(27), kPhoto({ img: 'fia', fx: 0.4, fy: 0.5, z: [1.12, 1.03], dark: 0.5, tag: 'EN 1985', title: ['Un anuncio que cambiaría', 'las reglas del juego'], tt: V(28) + 0.4, size: 110 }), 'dissolve'],
  [cut(29), sGroupS, 'wipe'],
  [cut(31), sHomolog, 'slices'],
  [cut(33), kType({ tag: 'PARA LOS INGENIEROS', title: ['Carta blanca'], align: 'center', tt: V(33) + 0.9, size: 260, label: 'Prototipos cien por cien espaciales', labelT: V(33) + 3.0, stripes: true }), 'whip'],
  [cut(35), kPhoto({ img: 'coleccion', fx: 0.3, fy: 0.55, z: [1.2, 1.06], dark: 0.4, tag: 'LUZ VERDE INMEDIATA AL', tagT: V(36), title: ['Proyecto secreto', '222D'], tt: V(36) + 1.8, size: 130, colors: [COLOR.paper, COLOR.red] }), 'dissolve'],
  [cut(37), kPhoto({ img: 'mr2', fx: 0.55, fy: 0.5, z: [1.1, 1.0], dark: 0.15, tag: 'LA BASE: EL DEPORTIVO MÁS ÁGIL DE LA MARCA', title: ['Toyota MR2'], tt: V(38) + 0.6, size: 140, label: 'Primera generación · motor central', labelT: V(39) }), 'wipe'],
  [cut(40), sKeep, 'dissolve'],
  [cut(43), sCut, 'cut'],
  [snap(V(43) + 2.6), sFrame, 'whipV'],
  [cut(45), sWidth, 'slices'],
  [cut(46), sTail, 'cut'],
  [cut(47), sLift, 'cut'],
  [snap(V(47) + 2.6), kPhoto({ img: 'zaga', fx: 0.5, fy: 0.5, z: [1.12, 1.02], dark: 0.4, title: ['Las entrañas', 'de la bestia'], tt: V(47) + 3.0, size: 120 }), 'dissolve'],
  [cut(48), kPhoto({ img: 'lateral', fx: 0.5, fy: 0.62, z: [1.3, 1.18], dark: 0.35, tag: 'EL RESULTADO VISUAL', title: ['Hostil y', 'agresivo'], tt: V(48) + 1.5, size: 130 }), 'whip'],
  [cut(49), sMatte, 'cut'],
  [cut(50), sNick, 'cut'],
  [cut(51), kPhoto({ img: 'trasera', fx: 0.55, fy: 0.5, z: [1.14, 1.04], dark: 0.35, tag: 'LA ENCARNACIÓN DEL MIEDO', title: ['Un caza furtivo'], tt: V(52) + 0.1, size: 140, label: 'listo para el asfalto', labelT: V(52) + 1.2 }), 'slices'],
  [cut(53), sNape, 'dissolve'],
  [cut(56), sConfigs, 'whip'],
  [cut(59), sEngine, 'wipe'],
  [cut(60), sPressure, 'cut'],
  [snap(V(60) + 3.4), kType({ tag: 'MÁS TARDE REINARÍA EN', title: ['24 Horas de Le Mans', 'IMSA americana'], tt: V(60) + 4.0, size: 140, colors: [COLOR.paper, COLOR.yellow] }), 'whipV'],
  [cut(61), kStat({ tag: 'EN TEORÍA, EL GRUPO S LIMITARÍA LA POTENCIA A', value: (t) => 300 * ease.out(prog(t, V(62) + 2.0, V(62) + 3.2)), unit: 'caballos', unitT: V(62) + 3.0, label: 'por seguridad', labelT: V(62) + 3.8 }), 'slices'],
  [cut(63), kType({ tag: 'PERO LOS INGENIEROS DE TOYOTA', title: ['Mejor que sobre', 'a que falte'], tt: V(64) + 1.0, size: 160 }), 'cut'],
  [cut(65), sUnrestricted, 'whip'],
  [cut(66), kStat({ tag: 'UN CHASIS MINÚSCULO DE ALREDEDOR DE', value: (t) => 750 * ease.out(prog(t, V(66) + 3.4, V(66) + 4.6)), unit: 'kilos', unitT: V(66) + 4.4,
    under: (t, s0) => drawFrame3D(t, { cx: 1340, cy: 560, s: 0.7, yaw: 0.4 + 0.15 * (t - s0), pitch: 0.5, draw: 1, appear: 0.55 * ease.out(prog(t, s0, s0 + 0.8)) }) }), 'dissolve'],
  [cut(67), sXtrac, 'slices'],
  [cut(68), s750, 'cut'],
  [cut(69), sRatio, 'whip'],
  [cut(70), sWild, 'dissolve'],
  [cut(72), sMillimeter, 'slices'],
  [cut(73), kType({ tag: 'PERO EL MUNDO', title: ['Nunca tuvo', 'la oportunidad'], tt: V(73) + 0.6, size: 170, label: 'de verlo competir ni domarlo', labelT: V(73) + 2.4 }), 'dissolve'],
  [cut(74), sCorsica, 'dissolve'],
  [cut(76), sBan, 'dissolve'],
  [cut(80), kPhoto({ img: 'escondido', fx: 0.5, fy: 0.5, z: [1.08, 1.0], dark: 0.45, gray: true, tag: 'DE LA NOCHE A LA MAÑANA', title: ['Huérfano'], tt: V(81) + 1.4, size: 170, label: 'el proyecto 222D', labelT: V(81) + 0.4 }), 'dissolve'],
  [cut(82), sTarp, 'cut'],
  [cut(83), kPhoto({ img: 'lateral', fx: 0.5, fy: 0.6, z: [1.06, 1.0], dark: 0.35, tag: 'SOBREVIVIERON MUY POCOS CHASIS', title: ['«El fantasma negro»'], tt: V(84) + 1.6, size: 130, label: 'Un prototipo blanco y el mítico', labelT: V(84) + 0.2 }), 'dissolve'],
  [cut(85), kPhoto({ img: 'museoFrente', fx: 0.5, fy: 0.5, z: [1.08, 1.0], dark: 0.35, tag: 'HOY EN DÍA', title: ['En los museos', 'de Toyota'], tt: V(86) + 0.6, size: 120 }), 'dissolve'],
  [CLIP.at, sClip, 'wipe'],
  [cut(88), kType({ tag: 'EL TOYOTA MR2 222D NO ES SOLO UN PROTOTIPO', title: ['El mayor «y si…»'], align: 'center', tt: TYSI, size: 200, label: 'de la historia del automovilismo mundial', labelT: V(89) + 1.8, stripes: true }), 'dissolve'],
  [cut(90), kPhoto({ img: 'puerta', fx: 0.5, fy: 0.6, z: [1.3, 1.2], dark: 0.45, tag: 'EL REY INDISCUTIBLE', title: ['De una era que nunca', 'llegó a existir'], tt: V(90) + 0.8, size: 110 }), 'slices'],
  [cut(91), sVersus, 'whip'],
  [cut(92), sChannel, 'wipe'],
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

const WIN = { whip: [0.12, 0.12], whipV: [0.12, 0.12], wipe: [0.25, 0.25], slices: [0.2, 0.2], dissolve: [0.35, 0.35] };

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
    }
  }
  return shotAt(i, t)();
}


// ---------------------------------------------------------------------------
// Golpes de cámara: solo en los cuatro momentos en que rompe la música.
export const HITS = [T222, TS, T750, TYSI];
const SHAKES = [T750];

export function seek(main, t) {
  ctx = main.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, W, H);
  const z = 1 + punch(t, HITS, 0.025, 6.5);
  let sx = 0, sy = 0;
  for (const h of SHAKES) {
    if (t >= h && t < h + 0.7) {
      const k = Math.exp(-(t - h) * 8) * 14;
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
  for (const k of ['type', 'a', 'b']) layers[k] = makeCanvas();
  layers.gray = {};
}

export const SHOT_STARTS = SHOTS.map((s) => s[0]);
export const SHOT_TRANS = SHOTS.map((s) => [s[0], s[2] ?? 'cut']);
