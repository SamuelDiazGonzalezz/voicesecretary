// Escenas del documental sobre la evolución de los frenos en los rallys. Todo depende solo de `t`.
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

// Tramos del onboard: a cámara lenta se funden dos fotogramas vecinos.
export const CLIP_N = { onA: 210, onE: 196, grupoB: 406, onB: 270, onD: 450 };
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
const ERAS = ['AÑOS 60', 'AÑOS 70', 'AÑOS 80', 'AÑOS 90', 'AÑOS 2000', 'HOY'];
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
  revealText(ctx, 'La evolución de los frenos', W / 2, 860, FONT.display(800, 112), COLOR.paper, prog(t, 0.55, 1.3), { align: 'center', stagger: 0.016 });
  stripesH(ctx, 910, 10, prog(t, 0.95, 1.65), 0, { x0: W / 2 - 260, x1: W / 2 + 260 });
}

// La energía solo se transforma: una barra de movimiento (azul) que se vuelve calor (naranja).
function sEnergy(t, s0) {
  bg(); dots(0.035);
  revealText(ctx, 'La energía no se crea ni se destruye', W / 2, 470, FONT.display(700, 84), COLOR.paper, prog(t, at(1), at(1) + 0.9), { align: 'center', stagger: 0.012 });
  revealText(ctx, 'solo se transforma', W / 2, 590, FONT.display(800, 104), COLOR.fire, prog(t, at(2) - 0.1, at(2) + 0.6), { align: 'center', stagger: 0.02 });
  const p = ease.inOut(prog(t, at(2), at(2) + 1.6));
  const x0 = W / 2 - 420, w = 840, y = 700;
  const a = ease.out(prog(t, s0 + 0.2, s0 + 0.9));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = COLOR.blue; ctx.fillRect(x0, y, w * (1 - p), 14);
  ctx.fillStyle = COLOR.fire; ctx.fillRect(x0 + w * (1 - p), y, w * p, 14);
  ctx.restore();
  label(ctx, 'MOVIMIENTO', x0, y + 56, COLOR.blue, a * (1 - p * 0.6), { size: 22, spacing: 7, weight: 700 });
  label(ctx, 'CALOR', x0 + w, y + 56, COLOR.fire, prog(t, at(2) + 0.4, at(2) + 0.9), { size: 22, spacing: 7, weight: 700, align: 'right' });
}

// 1.200 kilos a 190 km/h sobre la foto del 205.
const sMass = kPhoto3({
  img: 'peugeot205', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], dark: 0.45, tag: 'UN COCHE DE RALLY LLEVA ENCIMA', tagT: at(4) - 0.2, title: ['Una energía', 'cinética brutal'], tt: at(4) + 1.3, size: 120,
  extra: (t) => {
    const a1 = ease.out(prog(t, at(3) + 1.6, at(3) + 2.1)), a2 = ease.out(prog(t, at(3) + 4.0, at(3) + 4.5));
    ctx.save(); ctx.globalAlpha = a1; ctx.font = FONT.display(800, 120); ctx.fillStyle = COLOR.paper; ctx.textAlign = 'right';
    ctx.fillText(fmt(1200 * ease.out(prog(t, at(3) + 1.6, at(3) + 2.6))), W - M, 300); ctx.restore();
    label(ctx, 'KILOS', W - M, 350, COLOR.yellow, a1, { size: 26, spacing: 7, weight: 700, align: 'right' });
    ctx.save(); ctx.globalAlpha = a2; ctx.font = FONT.display(800, 120); ctx.fillStyle = COLOR.paper; ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(190 * ease.out(prog(t, at(3) + 4.0, at(3) + 5.0)))), W - M, 500); ctx.restore();
    label(ctx, 'KM/H', W - M, 550, COLOR.yellow, a2, { size: 26, spacing: 7, weight: 700, align: 'right' });
  },
});

// Detenerse en menos de 60 metros antes del barranco (vista cenital).
function sStop(t, s0) {
  bg(); dots(0.035);
  tag(t, 'PARA DETENER ESA MASA EN MENOS DE', M, 210, s0 + 0.1);
  slam(t, '60 metros', M, 360, at(5) + 1.4, 150, COLOR.paper);
  const y = 720, x0 = 300, x1 = 1520;
  const a = ease.out(prog(t, s0 + 0.2, s0 + 0.8));
  // Carretera y barranco.
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#1A1C20'; ctx.fillRect(-20, y - 110, x1 + 20, 220);
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([40, 30]);
  ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  hatch(ctx, () => { ctx.beginPath(); ctx.rect(x1 + 30, y - 260, W - x1, 520); }, 18, 0.22 * a);
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1 + 30, y - 260); ctx.lineTo(x1 + 30, y + 260); ctx.stroke(); ctx.restore();
  label(ctx, 'BARRANCO', x1 + 70, y - 200, COLOR.red, prog(t, at(5) + 2.4, at(5) + 2.9), { size: 22, spacing: 7, weight: 700 });
  // Coche: deceleración constante hasta pararse justo antes del borde.
  const tb = at(5) + 0.4, dur = 2.6, u = clamp((t - tb) / dur);
  const x = lerp(-300, x1 - 150, 1 - (1 - u) * (1 - u));
  drawAWD(t, { cx: x, cy: y, s: 0.24, power: 0, appear: a });
  if (u > 0 && u < 1) { ctx.save(); ctx.globalAlpha = (1 - u) * 0.6; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 140 - k * 20, y - 60 + k * 40); ctx.lineTo(x - 260 - k * 30, y - 60 + k * 40); ctx.stroke(); } ctx.restore(); }
  dimLine(x0, x1, y + 180, ease.out(prog(t, at(5) + 1.2, at(5) + 1.9)), COLOR.yellow, '60 M');
  label(ctx, 'INICIO DE LA FRENADA', x0, y - 140, DIM, prog(t, at(5) + 1.2, at(5) + 1.7), { size: 20, spacing: 6, weight: 700, align: 'center' });
}

// Milagro termodinámico: la velocidad cae y el disco se pone incandescente en menos de dos segundos.
function sHeat(t, s0) {
  bg(); dots(0.03);
  const tb = at(7) + 1.4, u = ease.inOut(prog(t, tb, tb + 2.0));
  const rot = spinRot(t, s0, 2.4, 2.4, 1) - (t > tb ? spinRot(t, tb, 0, 2.4, 2.0) : 0);
  const heat = 0.88 * u;
  drawDiscFront(1300, 560, 330, { rot, heat, holes: 'drilled' });
  drawCaliperFront(1300, 560, 330, -0.8, { n: 3, span: 0.46 });
  side(t, 'UN MILAGRO TERMODINÁMICO', ['Velocidad', 'en puro calor'], at(6) + 1.6, { y: 330, size: 110, colors: [COLOR.paper, COLOR.fire] });
  const a = ease.out(prog(t, at(7) + 0.6, at(7) + 1.1));
  meter(t, M, 690, 560, 1 - u, a, 'VELOCIDAD', COLOR.blue, { valueStr: `${Math.round(190 * (1 - u))} KM/H` });
  meter(t, M, 800, 560, u, a, 'CALOR', COLOR.fire);
  label(ctx, 'en menos de dos segundos', M, 900, COLOR.paper, prog(t, at(7) + 3.2, at(7) + 3.7), { size: 40, spacing: 0, weight: 700 });
}

// 500 caballos para acelerar frente a más de 2.000 para detenerlo.
function sPower(t, s0) {
  bg(); dots(0.03);
  const x0 = 560, y1 = 480, y2 = 720, k = 0.55; // px por caballo
  const a1 = ease.out(prog(t, at(8) + 1.6, at(8) + 2.2)), a2 = ease.out(prog(t, at(9) + 1.6, at(9) + 2.2));
  const w1 = 500 * k * ease.inOut(prog(t, at(8) + 1.6, at(8) + 2.8)), w2 = 2000 * k * ease.inOut(prog(t, at(9) + 1.8, at(9) + 3.4));
  ctx.fillStyle = COLOR.yellow; ctx.fillRect(x0, y1 - 40, w1, 80);
  ctx.fillStyle = COLOR.red; ctx.fillRect(x0, y2 - 40, w2, 80);
  label(ctx, 'MOTOR', x0 - 30, y1 + 10, COLOR.paper, a1, { size: 24, spacing: 7, weight: 700, align: 'right' });
  label(ctx, 'PARA ACELERAR', x0 - 30, y1 + 44, DIM, a1, { size: 18, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'FRENOS', x0 - 30, y2 + 10, COLOR.paper, a2, { size: 24, spacing: 7, weight: 700, align: 'right' });
  label(ctx, 'POTENCIA NEGATIVA', x0 - 30, y2 + 44, DIM, a2, { size: 18, spacing: 6, weight: 700, align: 'right' });
  slam(t, '500', x0 + w1 + 30, y1 + 34, at(8) + 2.6, 96, COLOR.paper);
  label(ctx, 'CABALLOS', x0 + w1 + 34, y1 + 80, COLOR.yellow, prog(t, at(8) + 2.8, at(8) + 3.2), { size: 22, spacing: 6, weight: 700 });
  slam(t, 'más de 2.000', x0 + 30, y2 + 200, at(9) + 3.2, 110, COLOR.paper);
  label(ctx, 'CABALLOS PARA DETENERLO', x0 + 34, y2 + 250, COLOR.red, prog(t, at(9) + 3.4, at(9) + 3.8), { size: 22, spacing: 6, weight: 700 });
  tag(t, 'SI EL MOTOR DE UN WRC GENERA UNOS 500 CABALLOS', M, 220, s0 + 0.1);
}

// Desmontar las pinzas: vista explosionada de la sección y tres temas.
function sExplode(t, s0, s1) {
  bg(); dots(0.03);
  const ex = 0.32 * ease.inOut(prog(t, at(13) + 0.2, at(13) + 1.6));
  const boil = prog(t, at(14) + 0.6, at(14) + 2.0);
  camera(W / 2, H / 2, 1, () => drawSection(t, { cx: 1360, cy: 740, s: 1.12, explode: ex, labels: prog(t, at(13) + 1.4, at(13) + 3), boil: boil * (1 - ex * 0.5), fluidHeat: boil * 0.7, heat: 0.15 }));
  tag(t, 'HOY VAMOS A', M, 300, s0 + 0.1);
  const items = [['Desmontar las pinzas', at(13) + 0.2], ['Hervir el líquido', at(14) + 0.5], ['Analizar la metalurgia', at(14) + 1.9]];
  items.forEach(([s, tt], i) => {
    label(ctx, `0${i + 1}`, M, 420 + i * 120, COLOR.yellow, prog(t, tt, tt + 0.4), { size: 28, spacing: 2, weight: 800 });
    revealText(ctx, s, M + 70, 422 + i * 120, FONT.display(700, 60), COLOR.paper, prog(t, tt, tt + 0.7), { stagger: 0.02 });
  });
}

// ---------------------------------------------------------------------------
// Años 60: el tambor.

function sDrumTrap(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.35);
  const apply = 0.5 + 0.5 * Math.sin(Math.max(0, t - at(20)) * 2.2 - Math.PI / 2);
  const trapped = ease.inOut(prog(t, at(20) + 1.0, at(20) + 4.0));
  drawDrum(t, { cx: 1310, cy: 560, R: 300, rot, apply: t > at(20) ? apply : 0, heat: 0.35 * trapped, trapped, labels: prog(t, s0 + 0.4, s0 + 1.5) });
  // Aire de fuera que choca contra el tambor cerrado.
  const air = ease.out(prog(t, at(20) + 2.4, at(20) + 3.0));
  if (air > 0) {
    for (let i = 0; i < 5; i++) {
      const y = 330 + i * 115, ph = ((t * 0.9 + i * 0.23) % 1);
      const x = lerp(860, 960 - Math.abs(y - 560) * 0.05, ease.out(ph));
      ctx.save(); ctx.globalAlpha = air * (1 - ph * 0.7); ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 90, y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    }
    label(ctx, 'EL AIRE APENAS ENTRA', 900, 1000, COLOR.blue, air, { size: 22, spacing: 7, weight: 700, align: 'center' });
  }
  side(t, 'UN TAMBOR ES UNA', ['Trampa', 'térmica'], at(19) + 0.9, { y: 450, size: 150, colors: [COLOR.paper, COLOR.fire], label: 'Las zapatas rozan por dentro de un cilindro cerrado', labelT: at(20) + 0.8, maxW: 620 });
}

// Col de Turini: la carretera baja, la temperatura sube.
function sTurini(t, s0) {
  bg(); dots(0.03);
  side(t, 'EN EL DESCENSO DEL', ['Col de Turini'], at(21) + 2.0, { y: 300, size: 120 });
  const x = 820, y = 420, w = 960, h = 420;
  const p = prog(t, at(21) + 0.4, at(22) + 3.6);
  axes(x, y, w, h, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'MINUTOS DE BAJADA' });
  const alt = (u) => 0.92 - 0.8 * u + 0.04 * Math.sin(u * 40);
  const temp = (u) => 0.08 + 0.84 * (1 - Math.exp(-u * 2.6)) / (1 - Math.exp(-2.6));
  plot(x, y, w, h, alt, p, COLOR.paper, 4);
  const tp = plot(x, y, w, h, temp, p, COLOR.fire, 6);
  label(ctx, 'ALTITUD', x + 20, y + h * (1 - alt(0)) - 22, COLOR.paper, prog(t, at(21) + 0.6, at(21) + 1.1), { size: 22, spacing: 6, weight: 700 });
  if (tp) label(ctx, 'TEMPERATURA', tp[0] - 10, tp[1] - 26, COLOR.fire, prog(t, at(21) + 1.5, at(21) + 2.0), { size: 22, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'Se disparaba en minutos', M, 420, DIM, prog(t, at(22) + 0.6, at(22) + 1.1), { size: 40, spacing: 0, weight: 600 });
}

// El tambor se dilata y se aleja de las zapatas.
function sDrumGrow(t, s0) {
  bg(); dots(0.03);
  const dil = ease.inOut(prog(t, at(22) + 3.2, at(23) + 0.6));
  const rot = spinRot(t, s0, 0.3);
  drawDrum(t, { cx: 1290, cy: 560, R: 300, rot, apply: 1, dilate: dil, heat: 0.45 + 0.4 * dil, trapped: 0.8 });
  // Holgura entre forro y tambor, en rojo.
  if (dil > 0.05) {
    ctx.save(); ctx.globalAlpha = dil; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(1290, 560, 300 * 0.885 + 300 * 0.03, -2.6, -0.55); ctx.stroke(); ctx.restore();
    pin(t, 1290 + Math.cos(-1.2) * 300 * 1.05, 560 + Math.sin(-1.2) * 300 * 1.05, 1660, 190, 'HOLGURA', at(23) + 0.2, COLOR.red);
  }
  // Flechas de dilatación hacia fuera.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const r0 = 300 * (1 + 0.085 * dil) + 70;
    arrowPath([[1290 + Math.cos(a) * r0, 560 + Math.sin(a) * r0], [1290 + Math.cos(a) * (r0 + 50), 560 + Math.sin(a) * (r0 + 50)]], dil, COLOR.fire, 4, 14);
  }
  side(t, 'EL TAMBOR SE DILATABA FÍSICAMENTE', ['Alejándose de', 'las zapatas'], at(23) - 0.1, { y: 470, size: 120, maxW: 650 });
}

// El piloto pisaba el pedal y no ocurría absolutamente nada.
function sNothing(t, s0) {
  bg(); dots(0.03);
  const tr = ease.inOut(prog(t, at(24) + 0.6, at(24) + 1.5));
  drawPedal(1260, 170, 0.15 + 0.6 * tr, { s: 1.45 });
  tag(t, 'EL PILOTO PISABA EL PEDAL', M, 380, s0 + 0.1);
  lines(t, ['Y no ocurría', 'absolutamente nada'], M, 520, 130, 120, at(24) + 1.8, { maxW: 760, colors: [COLOR.paper, COLOR.red] });
  meter(t, M, 800, 600, 0.02, ease.out(prog(t, at(24) + 0.8, at(24) + 1.3)), 'DECELERACIÓN', COLOR.red);
}

// ---------------------------------------------------------------------------
// Años 70: disco macizo y fading.

function sDiscAir(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 1.4);
  drawDiscFront(1300, 560, 320, { rot, heat: 0.5 });
  drawCaliperFront(1300, 560, 320, -0.8, { n: 1, span: 0.4 });
  // Calor que sale del disco al aire libre en todas direcciones.
  const air = ease.out(prog(t, at(28) + 0.2, at(28) + 1.2));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const ph = (t * 0.6 + i * 0.37) % 1;
    const r0 = 350 + ph * 120;
    ctx.save(); ctx.globalAlpha = air * (1 - ph);
    ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(1300 + Math.cos(a) * r0, 560 + Math.sin(a) * r0); ctx.lineTo(1300 + Math.cos(a) * (r0 + 46), 560 + Math.sin(a) * (r0 + 46)); ctx.stroke();
    ctx.restore();
  }
  side(t, 'AL ESTAR EXPUESTOS AL AIRE', ['Disipaban mejor', 'el calor'], at(29) - 0.2, { y: 470, size: 110, maxW: 680, colors: [COLOR.paper, COLOR.fire], label: 'Los discos macizos, el nuevo estándar', labelT: at(29) + 1.0 });
}

const sFadeTitle = kType({ tag: 'EL MAYOR ENEMIGO DE LA FRENADA', tagT: at(31) + 0.6, title: ['Brake Fade'], tt: at(32) + 0.1, size: 210, colors: [COLOR.red], label: 'o fatiga térmica, que atacaba por dos frentes', labelT: at(32) + 1.4 });

// Fade de las pastillas: las resinas se vaporizan y forman un colchón de gas.
function sPadFade(t, s0) {
  bg(); dots(0.03);
  const z = lerp(1.0, 1.55, ease.inOut(prog(t, at(36), at(37) + 1)));
  const heat = 0.3 + 0.6 * ease.inOut(prog(t, at(36), at(36) + 1.6));
  const gas = ease.inOut(prog(t, at(37) + 1.2, at(38) + 1.4));
  const zz = lerp(1, 2.1, (z - 1) / 0.55);
  focus(1348, 446, zz, lerp(1348, 1380, (zz - 1) / 1.1), lerp(446, 540, (zz - 1) / 1.1), () => {
    drawSection(t, { cx: 1300, cy: 640, s: 0.9, clamp: 1, heat, gas, labels: prog(t, s0 + 0.5, s0 + 1.6) * (1 - prog(t, at(36), at(36) + 0.5)) });
  });
  scrim(880, 0.92);
  if (gas > 0.3) pin(t, 1380 + (1331 - 1348) * zz, 540, 1480, 250, 'COLCHÓN DE GAS', at(38) + 0.2, COLOR.paper);
  side(t, 'PRIMERO', ['El fade de', 'las pastillas'], at(35) - 0.1, { y: 430, size: 110, maxW: 640, label: 'Un colchón microscópico de gas', labelT: at(38) + 1.2 });
}

// El pedal seguía duro, pero el coche no frenaba.
function sPadHard(t, s0) {
  bg(); dots(0.03);
  drawPedal(1380, 220, 0.18 + 0.12 * ease.inOut(prog(t, at(39) + 0.1, at(39) + 0.6)), { s: 1.05 });
  label(ctx, 'PEDAL DURO', 1520, 210, COLOR.paper, prog(t, at(39) + 0.6, at(39) + 1.0), { size: 22, spacing: 7, weight: 700 });
  lines(t, ['El pedal seguía duro,', 'pero el coche no frenaba'], M, 470, 120, 100, at(39) - 0.1, { maxW: 860, colors: [COLOR.paper, COLOR.red], step: 1.3 });
  meter(t, M, 760, 600, 0.06, ease.out(prog(t, at(40), at(40) + 0.5)), 'DECELERACIÓN', COLOR.red);
}

// Fade del líquido: el calor viaja del disco al líquido.
function sHeatPath(t, s0) {
  bg(); dots(0.03);
  const hp = prog(t, at(43), at(44) + 3.2);
  const fh = ease.inOut(prog(t, at(44) + 2.0, at(44) + 4.4));
  drawSection(t, { cx: 1340, cy: 760, s: 1.15, clamp: 1, heat: 0.85, fluidHeat: fh, heatPath: hp, labels: prog(t, s0 + 0.4, s0 + 1.5) });
  side(t, 'SEGUNDO', ['El fade del', 'líquido'], at(42) - 0.1, { y: 430, size: 120, maxW: 600 });
  const steps = [['Disco', at(43)], ['Pastilla', at(43) + 0.8], ['Pistones', at(44) + 0.6], ['Líquido de frenos', at(44) + 2.4]];
  steps.forEach(([s, tt], i) => label(ctx, (i ? '→ ' : '') + s, M, 650 + i * 60, i === 3 ? COLOR.fire : COLOR.paper, prog(t, tt, tt + 0.4), { size: 36, spacing: 0, weight: 700 }));
}

function sBoil(t, s0) {
  bg(); dots(0.03);
  const boil = ease.inOut(prog(t, at(45) + 0.3, at(46) + 0.8));
  focus(1480, 465, 2.0, 1360, 560, () => drawSection(t, { cx: 1280, cy: 680, s: 1.0, clamp: 1, heat: 0.9, fluidHeat: 0.9, boil }));
  scrim(860, 0.92);
  side(t, 'CUANDO EL LÍQUIDO HERVÍA', ['Burbujas', 'de gas'], at(46) - 0.1, { y: 470, size: 140, maxW: 600 });
}

// Líquido (incompresible) frente a gas (compresible): el pedal se hunde.
function sCompress(t, s0) {
  bg(); dots(0.03);
  side(t, 'A DIFERENCIA DE LOS LÍQUIDOS', ['Los gases sí se', 'pueden comprimir'], at(49) - 0.4, { y: 330, size: 100, maxW: 660, label: 'El pedal se hundía hasta el fondo', labelT: at(50) + 0.4, labColor: COLOR.red });
  const rig = (y, gas, label0, t0) => {
    const a = ease.out(prog(t, t0, t0 + 0.5));
    if (a <= 0) return;
    const push = ease.inOut(prog(t, at(50) - 0.4, at(50) + 1.4));
    const inX = lerp(0, 230, push);
    const outX = gas ? lerp(0, 30, push) : lerp(0, 230, push) * 0.5;
    const x0 = 960, x1 = 1780;
    ctx.save(); ctx.globalAlpha = a;
    // Tubo con líquido.
    ctx.strokeStyle = 'rgba(232,233,230,0.6)'; ctx.lineWidth = 3;
    ctx.fillStyle = gas ? fluidCol(0.8) : COLOR.blue;
    ctx.fillRect(x0 + 70 + inX, y - 40, x1 - x0 - 140 - inX - outX, 80);
    ctx.strokeRect(x0, y - 44, x1 - x0, 88);
    // Burbujas que se aplastan.
    if (gas) {
      const R = rng(7);
      for (let i = 0; i < 9; i++) {
        const bx = lerp(x0 + 200, x1 - 200, R()), by = y + (R() - 0.5) * 50;
        const rr0 = 14 + R() * 10, sq = 1 - 0.75 * push;
        const cx2 = lerp(bx, x1 - 140 - (x1 - bx) * sq * 0.2, push * 0.6);
        ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.ellipse(cx2, by, rr0 * sq, rr0 * (0.8 + 0.2 * sq), 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Pistones de entrada (pedal) y salida (pinza).
    ctx.fillStyle = '#8E939A';
    ctx.fillRect(x0 + inX, y - 40, 70, 80);
    ctx.fillRect(x1 - 70 - outX, y - 40, 70, 80);
    ctx.restore();
    label(ctx, label0, x0, y - 74, gas ? COLOR.fire : COLOR.blue, a, { size: 22, spacing: 7, weight: 700 });
    label(ctx, 'PEDAL', x0 + 35 + inX, y + 84, DIM, a, { size: 20, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'PINZA', x1 - 35 - outX, y + 84, DIM, a, { size: 20, spacing: 6, weight: 700, align: 'center' });
  };
  rig(430, false, 'LÍQUIDO', at(48) - 0.2);
  rig(760, true, 'LÍQUIDO CON BURBUJAS DE GAS', at(49));
}

// ---------------------------------------------------------------------------
// Años 80: Grupo B.

function sCrack(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.6, 0.15, 3);
  const heat = 0.85 - 0.55 * ease.inOut(prog(t, at(55) + 0.2, at(55) + 1.6));
  const crack = ease.out(prog(t, at(55) + 1.0, at(55) + 3.0));
  drawDiscFront(1300, 560, 340, { rot, heat, crack });
  side(t, 'POR EL CHOQUE TÉRMICO', ['Los discos macizos', 'se rajaban'], at(55) + 0.2, { y: 470, size: 100, maxW: 700, colors: [COLOR.paper, COLOR.red] });
}

// Disco ventilado: aletas internas como una bomba centrífuga.
function sVented(t, s0) {
  bg(); dots(0.03);
  const vent = ease.inOut(prog(t, at(58) + 0.4, at(59) + 0.8));
  const air = ease.out(prog(t, at(60), at(60) + 0.8));
  drawSection(t, { cx: 1110, cy: 700, s: 0.95, clamp: 0.6, heat: 0.45, vented: vent, air, labels: 0 });
  label(ctx, 'SECCIÓN', 1110, 1030, DIM, prog(t, s0 + 0.5, s0 + 1), { size: 20, spacing: 7, weight: 700, align: 'center' });
  const rot = spinRot(t, s0, 0.5);
  drawDiscFront(1640, 560, 200, { rot, heat: 0.4, holes: vent > 0.5 ? 'drilled' : 'none', vanes: vent });
  // Aire de dentro a fuera, girando con el disco.
  if (air > 0) {
    for (let i = 0; i < 8; i++) {
      const a0 = rot + (i / 8) * Math.PI * 2;
      const pts = []; for (let k = 0; k <= 10; k++) { const f = k / 10; const r = lerp(90, 290, f); const a = a0 - f * 0.5; pts.push([1640 + Math.cos(a) * r, 560 + Math.sin(a) * r]); }
      ctx.save(); ctx.globalAlpha = air * 0.9;
      const g = ctx.createRadialGradient(1640, 560, 90, 1640, 560, 290);
      g.addColorStop(0, COLOR.blue); g.addColorStop(1, COLOR.fire);
      ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([18, 16]); ctx.lineDashOffset = -t * 150;
      ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.stroke(); ctx.restore();
    }
  }
  label(ctx, 'VISTA FRONTAL', 1640, 1030, DIM, prog(t, s0 + 0.5, s0 + 1), { size: 20, spacing: 7, weight: 700, align: 'center' });
  side(t, 'PRIMERO', ['Discos ventilados', 'y perforados'], at(58) - 0.1, { y: 300, size: 76, maxW: 600 });
  label(ctx, 'Dos caras de hierro fundido', M, 470, DIM, prog(t, at(59), at(59) + 0.5), { size: 34, spacing: 0, weight: 600 });
  label(ctx, 'separadas por aletas internas', M, 520, DIM, prog(t, at(59) + 0.8, at(59) + 1.3), { size: 34, spacing: 0, weight: 600 });
  label(ctx, 'Una bomba centrífuga', M, 640, COLOR.paper, prog(t, at(59) + 3.6, at(59) + 4.1), { size: 44, spacing: 0, weight: 700 });
  label(ctx, 'AIRE FRÍO DESDE EL BUJE', M, 730, COLOR.blue, prog(t, at(60) + 0.5, at(60) + 1.0), { size: 22, spacing: 7, weight: 700 });
  label(ctx, 'SALE POR EL BORDE EXTERIOR', M, 780, COLOR.fire, prog(t, at(60) + 2.6, at(60) + 3.1), { size: 22, spacing: 7, weight: 700 });
}

// Pinza fija de 4 pistones: presión uniforme.
function sCaliper4(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.25);
  const cx = 1330, cy = 600, R = 360;
  drawDiscFront(cx, cy, R, { rot, heat: 0.3, holes: 'drilled', vanes: 1 });
  const ga = ease.out(prog(t, at(62) + 1.2, at(62) + 1.8));
  drawCaliperFront(cx, cy, R, -1.15, { n: 2, span: 0.52, ghost: ga });
  // Presión uniforme sobre la pastilla.
  const pr = ease.out(prog(t, at(63) + 0.2, at(63) + 1.0));
  if (pr > 0) {
    for (let i = 0; i < 7; i++) {
      const a = -1.15 + lerp(-0.4, 0.4, i / 6), rm = R * 0.85;
      const x = cx + Math.cos(a) * rm, y = cy + Math.sin(a) * rm;
      ctx.save(); ctx.globalAlpha = pr; ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(x, y, 7 + 2 * Math.sin(t * 6 + i), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    label(ctx, 'PRESIÓN UNIFORME', cx + 120, cy - R - 60, COLOR.yellow, pr, { size: 22, spacing: 7, weight: 700 });
  }
  side(t, 'SEGUNDO', ['Pinzas fijas', 'de 4 pistones'], at(62) - 0.1, { y: 380, size: 110, maxW: 640, label: 'Aluminio · AP Racing y Brembo', labelT: at(62) + 3.4 });
}

// Turbofan: extractores activos.
function sTurbofan(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.9);
  const ex = ease.out(prog(t, at(70), at(70) + 1.4));
  drawTurbofan(t, { cx: 1340, cy: 560, R: 260, rot, extract: ex, heat: 0.75 });
  label(ctx, 'BAJA PRESIÓN', 1340, 570, COLOR.ink, prog(t, at(71) + 0.4, at(71) + 0.9), { size: 22, spacing: 6, weight: 800, align: 'center' });
  const hot = ease.out(prog(t, at(71) + 3.5, at(71) + 4.0));
  if (hot > 0) { ctx.save(); ctx.globalAlpha = hot; ctx.font = FONT.display(800, 96); ctx.fillStyle = COLOR.fire; ctx.textAlign = 'left'; ctx.fillText('700°', 1640, 230); ctx.restore(); }
  side(t, 'EN UN TRAMO REVIRADO CON CURVAS LENTAS', ['Extractores', 'activos'], at(69) + 0.2, { y: 460, size: 130, maxW: 640, label: 'Succionaban el aire del paso de rueda', labelT: at(71) + 1.6 });
}

// ---------------------------------------------------------------------------
// Asfalto y tierra.

function wheelMorph(t, cx, cy, u, { rot = 0, labels = 1, k = 0.95 } = {}) {
  const rimIn = lerp(18, 15, u), disc = lerp(380, 300, u);
  const g = drawWheelScale(t, { cx, cy, k, rimIn, disc, rot, discHeat: 0.25, labels: 0 });
  dimLine(cx - g.rD, cx + g.rD, cy + g.rT + 70, labels, COLOR.yellow, `DISCO ${Math.round(disc)} MM`);
  label(ctx, `LLANTA ${Math.round(rimIn)}″`, cx, cy - g.rT - 40, COLOR.paper, labels, { size: 24, spacing: 6, weight: 700, align: 'center' });
}
function sTarmac(t, s0) {
  bg(); dots(0.03);
  wheelMorph(t, 1330, 520, 0, { rot: spinRot(t, s0, 0.2), labels: ease.out(prog(t, at(81) + 1.4, at(81) + 2.0)), k: 0.9 });
  const pist = ease.out(prog(t, at(81) + 4.0, at(81) + 4.6));
  if (pist > 0) label(ctx, 'PINZA DE 6 PISTONES', W - M, 150, COLOR.red, pist, { size: 22, spacing: 6, weight: 700, align: 'right' });
  side(t, 'EN LOS RALLYS DE ASFALTO', ['Llantas de', '18 pulgadas'], at(80) + 0.2, { y: 380, size: 110, maxW: 620, label: 'Discos gigantescos de hasta 380 mm', labelT: at(81) + 1.6 });
  meter(t, M, 760, 520, 0.95 * ease.inOut(prog(t, at(82), at(82) + 1.2)), ease.out(prog(t, at(82), at(82) + 0.4)), 'AGARRE', COLOR.yellow, { valueStr: 'DESCOMUNAL' });
}
function sGravel(t, s0) {
  bg(); dots(0.03);
  const u = ease.inOut(prog(t, at(86) + 0.8, at(87) + 0.4));
  wheelMorph(t, 1330, 520, u, { rot: spinRot(t, s0, 0.2), k: 0.9 });
  side(t, 'LOS EQUIPOS DESMONTAN TODO', ['Frenos mucho', 'más pequeños'], at(86) + 1.0, { y: 420, size: 110, maxW: 620, label: 'De unos 300 milímetros', labelT: at(87) + 0.3 });
}
// Perfil alto en tierra: la llanta baja a 15″ y un disco grande no cabe.
function sSidewall(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.2);
  const a = ease.out(prog(t, s0 + 0.2, s0 + 0.8));
  const g1 = drawWheelScale(t, { cx: 1000, cy: 520, k: 0.75, rimIn: 18, disc: 380, tyreD: 650, rot, appear: a * 0.55, labels: 0 });
  const g2 = drawWheelScale(t, { cx: 1520, cy: 520, k: 0.75, rimIn: 15, disc: 300, tyreD: 650, rot, appear: a, labels: 0 });
  dimV(1520 + g2.rT + 40, 520 - g2.rT, 520 - g2.rRim, ease.out(prog(t, at(91) + 1.4, at(91) + 2.0)), 'FLANCO ALTO', 'right');
  label(ctx, 'ASFALTO · 18″', 1000, 520 + g1.rT + 70, DIM, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'TIERRA · 15″', 1520, 520 + g2.rT + 70, COLOR.paper, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  // El disco de 380 no entra en la llanta de 15″.
  const nc = ease.out(prog(t, at(93) + 0.1, at(93) + 0.6));
  if (nc > 0) {
    ctx.save(); ctx.globalAlpha = nc; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 5; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.arc(1520, 520, 190 * 0.75, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    label(ctx, 'DISCO DE 380 MM', 1520, 520 + g2.rT + 120, COLOR.red, nc, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
  side(t, 'PRIMERO', ['Un perfil alto', 'y flexible'], at(91) + 0.2, { y: 300, size: 90, maxW: 560, label: 'Llanta de 15 pulgadas', labelT: at(92) + 1.2 });
  label(ctx, 'Un disco grande', M, 640, COLOR.red, prog(t, at(93), at(93) + 0.5), { size: 56, spacing: 0, weight: 800 });
  label(ctx, 'simplemente no cabe', M, 710, COLOR.red, prog(t, at(93) + 0.4, at(93) + 0.9), { size: 56, spacing: 0, weight: 800 });
}

// La adherencia manda: el freno puede más que el agarre en grava.
function sGrip(t, s0) {
  bg(); dots(0.03);
  const x = 880, y = 330, w = 900, h = 520;
  axes(x, y, w, h, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'PRESIÓN EN EL PEDAL', yl: 'FUERZA DE FRENADA' });
  const p = prog(t, at(98), at(99) + 2.2);
  const lim = 0.38;
  plot(x, y, w, h, (u) => 0.95 * u, p, COLOR.paper, 4, { dash: [12, 10] });
  plot(x, y, w, h, (u) => Math.min(0.95 * u, lim) * (u > lim / 0.95 + 0.06 ? 0.82 : 1), p, COLOR.yellow, 6);
  refLine(x, y + h * (1 - lim), x + w, y + h * (1 - lim), prog(t, at(99), at(99) + 0.8), COLOR.yellow, 'AGARRE DEL NEUMÁTICO EN GRAVA', { align: 'right', dx: 0, dy: -16 });
  label(ctx, 'POTENCIA DE LA PINZA', x + w * 0.62, y + h * (1 - 0.62) - 24, COLOR.paper, prog(t, at(98) + 1.6, at(98) + 2.1), { size: 22, spacing: 6, weight: 700, align: 'right' });
  const lk = prog(t, at(99) + 1.6, at(99) + 2.1);
  if (lk > 0) { pin(t, x + w * (lim / 0.95 + 0.06), y + h * (1 - lim), x + w * 0.62, y + h * 0.82, 'RUEDAS BLOQUEADAS', at(99) + 1.6, COLOR.red); }
  side(t, 'SEGUNDO, Y MÁS IMPORTANTE', ['La adherencia'], at(96) - 0.1, { y: 400, size: 110, maxW: 620, label: 'Sobre grava suelta, el límite lo pone el neumático', labelT: at(98) + 0.4 });
}
// El trineo sin dirección: ruedas giradas, bloqueadas, el coche sigue recto.
function sSled(t, s0) {
  bg(); dots(0.03);
  const u = clamp((t - s0) / 4.5);
  const x = lerp(760, 1240, 1 - (1 - u) * (1 - u));
  ctx.save(); ctx.globalAlpha = ease.out(prog(t, s0, s0 + 0.5));
  ctx.strokeStyle = 'rgba(232,233,230,0.25)'; ctx.lineWidth = 10; ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.moveTo(300, 560 - 54); ctx.lineTo(x, 560 - 54); ctx.moveTo(300, 560 + 54); ctx.lineTo(x, 560 + 54); ctx.stroke();
  ctx.restore();
  drawAWD(t, { cx: x, cy: 560, s: 0.32, power: 0, rearLock: 1 });
  // Ruedas delanteras giradas (dirección) y bloqueadas.
  ctx.save(); ctx.translate(x, 560); ctx.scale(0.32, 0.32);
  for (const yy of [-226, 226]) { ctx.save(); ctx.translate(300, yy); ctx.rotate(-0.45); rr(ctx, -75, -30, 150, 60, 14); ctx.fillStyle = COLOR.red; ctx.fill(); ctx.restore(); }
  ctx.restore();
  arrowPath([[x + 160, 560], [x + 360, 560]], ease.out(prog(t, s0 + 0.6, s0 + 1.2)), COLOR.paper, 5, 18);
  arrowPath([[x + 120, 520], [x + 260, 420]], ease.out(prog(t, at(101) + 0.8, at(101) + 1.4)), 'rgba(232,233,230,0.35)', 4, 16);
  label(ctx, 'DIRECCIÓN', x + 270, 400, DIM, prog(t, at(101) + 1.0, at(101) + 1.5), { size: 20, spacing: 6, weight: 700 });
  tag(t, 'SI PONES UN FRENO DEMASIADO AGRESIVO', M, 220, s0 + 0.1);
  lines(t, ['Un trineo', 'sin dirección'], M, 820, 130, 130, at(101) + 1.2, { colors: [COLOR.paper, COLOR.red] });
}
// Masa no suspendida: la rueda ligera copia el terreno.
function sUnsprung(t, s0) {
  bg(); dots(0.03);
  const road = (x) => 840 + 26 * Math.sin(x * 0.011) + 16 * Math.sin(x * 0.027 + 1);
  const off = (t - s0) * 420;
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.6)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 820; x <= W - 60; x += 6) { const y = road(x + off) + 34; if (x === 820) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
  const wheel = (x, heavy, name) => {
    const target = road(x + off);
    const lag = heavy ? road(x + off - 120) * 0.5 + target * 0.5 : target;
    const wy = lag - 60;
    const bodyY = 520 + 6 * Math.sin(t * 2);
    ctx.save(); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 4; spring(x, bodyY + 30, x, wy - 66, 8, 16); ctx.restore();
    ctx.fillStyle = 'rgba(232,233,230,0.12)'; ctx.fillRect(x - 160, bodyY - 60, 320, 90);
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; ctx.strokeRect(x - 160, bodyY - 60, 320, 90);
    label(ctx, 'MASA SUSPENDIDA', x, bodyY - 80, DIM, 1, { size: 18, spacing: 6, weight: 700, align: 'center' });
    ctx.beginPath(); ctx.arc(x, wy, 90, 0, Math.PI * 2); ctx.fillStyle = '#17181B'; ctx.fill(); ctx.strokeStyle = COLOR.paper; ctx.stroke();
    drawDiscFront(x, wy, heavy ? 60 : 46, { heat: 0.2 });
    ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = heavy ? COLOR.red : COLOR.yellow; ctx.fillRect(x - 40, wy + 108, 80 * (heavy ? 1 : 0.7), 10); ctx.restore();
    label(ctx, name, x, wy + 160, heavy ? COLOR.red : COLOR.yellow, 1, { size: 20, spacing: 6, weight: 700, align: 'center' });
  };
  const a = ease.out(prog(t, s0 + 0.2, s0 + 0.8));
  ctx.save(); ctx.globalAlpha = a;
  wheel(1080, true, 'DISCO GRANDE');
  wheel(1580, false, 'DISCO PEQUEÑO');
  ctx.restore();
  side(t, 'ADEMÁS, UN DISCO MÁS PEQUEÑO PESA MENOS', ['Menos masa', 'no suspendida'], at(104) - 0.2, { y: 380, size: 100, maxW: 600, label: 'La suspensión reacciona más rápido', labelT: at(104) + 2.4 });
}

// ---------------------------------------------------------------------------
// Años 90: carbono-carbono.

function sCarbon(t, s0) {
  bg(); dots(0.03);
  const x = 880, y = 300, w = 900, h = 520;
  axes(x, y, w, h, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TEMPERATURA', yl: 'CAPACIDAD DE FRENADA' });
  const T = (deg) => deg / 1400; // u del eje x
  const carbon = (u) => { const d = u * 1400; return d < 400 ? 0.12 + 0.18 * (d / 400) : Math.min(0.9, 0.3 + 0.6 * clamp((d - 400) / 150)); };
  const p = prog(t, at(107), at(107) + 2.5);
  plot(x, y, w, h, carbon, p, COLOR.paper, 6);
  label(ctx, 'CARBONO-CARBONO', x + w - 10, y + h * (1 - 0.9) - 24, COLOR.paper, prog(t, at(107) + 2, at(107) + 2.5), { size: 22, spacing: 6, weight: 700, align: 'right' });
  refLine(x + w * T(1200), y + h, x + w * T(1200), y + 40, prog(t, at(107) + 1.6, at(107) + 2.4), DIM, '1.200°', { dx: -40, dy: -10 });
  refLine(x + w * T(400), y + h, x + w * T(400), y + 40, prog(t, at(110) + 1.0, at(110) + 1.8), COLOR.yellow, '400°', { dx: -30, dy: -10 });
  // Zona fría (rally) y zona caliente (circuito).
  const cold = ease.out(prog(t, at(110) + 2.0, at(110) + 2.6));
  if (cold > 0) { ctx.save(); ctx.globalAlpha = cold * 0.16; ctx.fillStyle = COLOR.blue; ctx.fillRect(x + 2, y, w * T(400) - 2, h); ctx.restore(); label(ctx, 'FRÍO', x + w * T(200), y + h - 30, COLOR.blue, cold, { size: 22, spacing: 6, weight: 700, align: 'center' }); }
  const circ = ease.out(prog(t, at(111) + 0.3, at(111) + 1.0));
  if (circ > 0) { ctx.save(); ctx.globalAlpha = circ * 0.12; ctx.fillStyle = COLOR.fire; ctx.fillRect(x + w * T(400), y, w * T(800), h); ctx.restore(); label(ctx, 'CIRCUITO: SIEMPRE CALIENTES', x + w * T(800), y + h - 30, COLOR.fire, circ, { size: 22, spacing: 6, weight: 700, align: 'center' }); }
  side(t, 'EL CARBONO NECESITA ESTAR A', ['Más de', '400 grados'], at(110) + 0.4, { y: 420, size: 120, maxW: 600, colors: [COLOR.paper, COLOR.yellow] });
  if (t < at(110)) {
    tag(t, 'ULTRALIGEROS', M, 320, at(107) + 0.2);
    label(ctx, 'Parecían el santo grial', M, 440, COLOR.paper, prog(t, at(108), at(108) + 0.5), { size: 56, spacing: 0, weight: 800 });
    label(ctx, 'pero en los rallys fueron un desastre', M, 510, COLOR.red, prog(t, at(109), at(109) + 0.5), { size: 40, spacing: 0, weight: 700 });
  }
}
// Temperatura del disco a lo largo del tramo: cae bajo 400° y la primera curva no frena.
function sColdCorner(t, s0) {
  bg(); dots(0.03);
  const x = 880, y = 300, w = 900, h = 480;
  axes(x, y, w, h, prog(t, s0 + 0.2, s0 + 0.9), { xl: 'TRAMO', yl: 'TEMPERATURA DEL DISCO' });
  const f = (u) => u < 0.2 ? 0.7 : u < 0.75 ? 0.7 - 0.55 * ease.inOut((u - 0.2) / 0.55) : 0.15 + 0.4 * ease.out((u - 0.75) / 0.25) * 0;
  plot(x, y, w, h, f, prog(t, s0 + 0.3, at(116) + 1.0), COLOR.fire, 6);
  refLine(x, y + h * (1 - 0.36), x + w, y + h * (1 - 0.36), prog(t, s0 + 0.6, s0 + 1.2), COLOR.yellow, '400°', { align: 'right', dx: 0, dy: -14 });
  const cx = x + w * 0.8;
  const c = ease.out(prog(t, at(116) + 0.4, at(116) + 0.9));
  if (c > 0) { ctx.save(); ctx.globalAlpha = c; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke(); ctx.restore(); label(ctx, 'PRIMERA CURVA', cx + 14, y + 20, COLOR.red, c, { size: 22, spacing: 6, weight: 700 }); }
  label(ctx, 'RECTA LARGA BAJO LA LLUVIA', x + w * 0.47, y + h + 50, COLOR.blue, prog(t, s0 + 0.8, s0 + 1.3), { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'AL LLEGAR A LA PRIMERA CURVA', ['El coche no', 'deceleraba'], at(117) + 0.4, { y: 420, size: 120, maxW: 600, colors: [COLOR.paper, COLOR.red] });
}
// Prohibidos: del carbono al hierro fundido.
function sBanned(t, s0) {
  bg(); dots(0.03);
  const rot = spinRot(t, s0, 0.25);
  const iron = ease.inOut(prog(t, at(120) + 0.4, at(120) + 1.6));
  drawDiscFront(1330, 560, 330, { rot, carbon: true, holes: 'drilled', alpha: 1 - iron });
  drawDiscFront(1330, 560, 330, { rot, holes: 'drilled', vanes: 1, alpha: iron });
  const st = ease.outExpo(prog(t, at(119) + 1.0, at(119) + 1.4));
  if (st > 0 && iron < 1) {
    ctx.save(); ctx.globalAlpha = st * (1 - iron); ctx.translate(1330, 560); ctx.rotate(-0.18); ctx.scale(lerp(1.4, 1, st), lerp(1.4, 1, st));
    ctx.strokeStyle = COLOR.red; ctx.lineWidth = 8; rr(ctx, -300, -70, 600, 140, 12); ctx.stroke();
    ctx.font = FONT.display(900, 92); ctx.fillStyle = COLOR.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PROHIBIDOS', 0, 6);
    ctx.restore();
  }
  tag(t, 'SUMADO A SU COSTE ASTRONÓMICO', M, 330, s0 + 0.1);
  lines(t, ['La FIA los', 'prohibió'], M, 470, 125, 120, at(119) + 0.2, { maxW: 600 });
  label(ctx, 'Obligando a usar discos de hierro fundido', M, 720, COLOR.paper, prog(t, at(120) + 0.6, at(120) + 1.1), { size: 36, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Años 2000: pinzas refrigeradas por agua.

function sWaterLoop(t, s0) {
  bg(); dots(0.03);
  const flow = ease.out(prog(t, at(127) - 0.2, at(127) + 0.6));
  const a = (t0) => ease.out(prog(t, t0, t0 + 0.6));
  // Sección de la pinza con canales a la derecha.
  drawSection(t, { cx: 1340, cy: 700, s: 0.82, clamp: 1, heat: 0.8, padHeat: 0.7, fluidHeat: 0.15 * (1 - flow), water: a(at(126) + 4.6) });
  // Circuito: depósito → bomba → pinza → radiador → depósito.
  const tank = [300, 470], pump = [560, 470], cal = [1100, 360], rad = [560, 800];
  const loop = poly([[tank[0] + 90, tank[1]], [pump[0] - 60, pump[1]], [pump[0] + 60, pump[1]], [900, pump[1]], [900, 330], [1135, 330], [1135, 440], [1135, 440]]);
  const back = poly([[1545, 330], [1640, 330], [1640, 900], [rad[0] + 120, 900], [rad[0] + 120, rad[1]], [rad[0] - 120, rad[1]], [tank[0], rad[1]], [tank[0], tank[1] + 70]]);
  ctx.save(); ctx.globalAlpha = a(at(126) + 0.6); ctx.strokeStyle = 'rgba(232,233,230,0.3)'; ctx.lineWidth = 12; ctx.lineJoin = 'round';
  for (const P of [loop, back]) { ctx.beginPath(); ctx.moveTo(...P.pts[0]); for (const p of P.pts) ctx.lineTo(...p); ctx.stroke(); }
  ctx.restore();
  if (flow > 0) { flowLine(loop, t, { color: COLOR.blue, width: 8, amount: flow }); flowLine(back, t, { color: COLOR.fire, width: 8, amount: flow * 0.9 }); }
  // Componentes.
  const box = (x, y, w, h, name, t0, col = COLOR.paper) => {
    const k = a(t0); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = COLOR.ink2; rr(ctx, x - w / 2, y - h / 2, w, h, 14); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    label(ctx, name, x, y - h / 2 - 22, col, k, { size: 22, spacing: 6, weight: 700, align: 'center' });
  };
  box(tank[0], tank[1], 180, 140, 'DEPÓSITO', at(126) + 0.6, COLOR.blue);
  if (a(at(126) + 0.6) > 0) { ctx.save(); ctx.globalAlpha = a(at(126) + 0.6); ctx.fillStyle = COLOR.blue; ctx.fillRect(tank[0] - 80, tank[1] - 10, 160, 70); ctx.restore(); }
  box(pump[0], pump[1], 120, 120, 'BOMBA ELÉCTRICA', at(126) + 3.0);
  if (a(at(126) + 3.0) > 0) { ctx.save(); ctx.globalAlpha = a(at(126) + 3.0); ctx.translate(...pump); ctx.rotate(t * 5); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 5; for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -14, 38, -10); ctx.stroke(); } ctx.restore(); }
  box(rad[0], rad[1], 240, 130, 'RADIADOR', at(129) + 0.2, COLOR.fire);
  if (a(at(129) + 0.2) > 0) { ctx.save(); ctx.globalAlpha = a(at(129) + 0.2) * 0.6; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2; for (let k = -100; k <= 100; k += 14) { ctx.beginPath(); ctx.moveTo(rad[0] + k, rad[1] - 50); ctx.lineTo(rad[0] + k, rad[1] + 50); ctx.stroke(); } ctx.restore(); }
  label(ctx, 'CANALES DENTRO DE LA PINZA', 1340, 1010, COLOR.blue, prog(t, at(126) + 5.0, at(126) + 5.5), { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'El agua absorbía el calor antes de que llegara al líquido de frenos', M, 210, COLOR.paper, prog(t, at(128), at(128) + 0.6), { size: 36, spacing: 0, weight: 600 });
  tag(t, 'PINZAS REFRIGERADAS POR AGUA', M, 140, s0 + 0.1, COLOR.blue);
}
// Frenar mucho más tarde: el punto de frenada se acerca a la curva.
function sLater(t, s0) {
  bg(); dots(0.03);
  const y = 640, x0 = 760, x1 = 1780;
  ctx.fillStyle = '#1A1C20'; ctx.fillRect(x0, y - 70, x1 - x0, 140);
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.4)'; ctx.lineWidth = 3; ctx.setLineDash([30, 24]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore();
  label(ctx, 'CURVA', x1 - 10, y - 100, DIM, 1, { size: 22, spacing: 6, weight: 700, align: 'right' });
  ctx.fillStyle = COLOR.paper; ctx.fillRect(x1 - 8, y - 80, 8, 160);
  const old = 1050, now = lerp(old, 1440, ease.inOut(prog(t, at(130) + 1.2, at(130) + 2.6)));
  ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = COLOR.paper; ctx.fillRect(old - 3, y - 90, 6, 180); ctx.restore();
  ctx.fillStyle = COLOR.blue; ctx.fillRect(now - 4, y - 100, 8, 200);
  label(ctx, 'PUNTO DE FRENADA', now, y - 130, COLOR.blue, ease.out(prog(t, s0 + 0.3, s0 + 0.8)), { size: 22, spacing: 6, weight: 700, align: 'center' });
  arrowPath([[old + 20, y + 140], [now - 20, y + 140]], prog(t, at(130) + 1.4, at(130) + 2.6), COLOR.blue, 4, 16);
  side(t, 'ERA TAN EFECTIVO QUE PERMITÍA', ['Frenar mucho', 'más tarde'], at(130) + 0.6, { y: 460, size: 110, maxW: 560, label: 'Sin perder tacto en el pedal', labelT: at(130) + 3.4 });
}
function sWaterBan(t, s0) {
  bg(); dots(0.03);
  const items = [['Peso', at(132)], ['Complejidad', at(133)], ['Presupuestos', at(133) + 1.2]];
  tag(t, 'SIN EMBARGO, AÑADÍA', M, 330, s0 + 0.1);
  items.forEach(([s, tt], i) => revealText(ctx, s, M, 460 + i * 110, FONT.display(800, 96), COLOR.paper, prog(t, tt, tt + 0.6), { stagger: 0.02 }));
  const b = ease.out(prog(t, at(134) + 0.6, at(134) + 1.2));
  if (b > 0) {
    ctx.save(); ctx.globalAlpha = b;
    ctx.font = FONT.display(800, 64); ctx.fillStyle = COLOR.red; ctx.textAlign = 'left';
    ctx.fillText('La FIA prohibió la', 1000, 520); ctx.fillText('refrigeración líquida', 1000, 600);
    ctx.restore();
    label(ctx, 'De vuelta al flujo de aire y los materiales exóticos', 1000, 700, COLOR.paper, prog(t, at(134) + 3.4, at(134) + 3.9), { size: 32, spacing: 0, weight: 600 });
  }
}

// ---------------------------------------------------------------------------
// Freno de mano hidráulico.

// Vista cenital de una horquilla: el coche pivota sobre el morro.
function sHairpin(t, s0) {
  bg(); dots(0.03);
  const cx = 1340, cy = 600;
  ctx.save(); ctx.strokeStyle = '#1F2125'; ctx.lineWidth = 170; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 160, 1180); ctx.lineTo(cx - 160, cy); ctx.arc(cx, cy, 160, Math.PI, 0); ctx.lineTo(cx + 160, 1180); ctx.stroke(); ctx.restore();
  const u = ease.inOut(prog(t, at(139) + 0.6, at(140) + 2.0));
  // Recorrido: sube por la izquierda, pivota en el vértice, baja por la derecha.
  let x, y, r;
  if (u < 0.35) { const k = u / 0.35; x = cx - 160; y = lerp(1000, cy + 20, k); r = -Math.PI / 2; }
  else if (u < 0.7) { const k = (u - 0.35) / 0.35; const a = Math.PI + k * Math.PI; x = cx + Math.cos(a) * 160 * (1 - 0.4 * Math.sin(k * Math.PI)); y = cy + Math.sin(a) * 160 * 0.6; r = -Math.PI / 2 + ease.inOut(k) * Math.PI; }
  else { const k = (u - 0.7) / 0.3; x = cx + 160; y = lerp(cy + 20, 1000, k); r = Math.PI / 2; }
  const slide = u > 0.35 && u < 0.7 ? Math.sin(((u - 0.35) / 0.35) * Math.PI) : 0;
  drawAWD(t, { cx: x, cy: y, s: 0.27, rot: r + slide * 0.5, power: 1, rearLock: slide > 0.1 ? 1 : 0 });
  side(t, 'PARA GIRAR EN HORQUILLAS', ['El freno de mano', 'hidráulico'], at(140) + 0.1, { y: 460, size: 100, maxW: 640 });
}
// Esquema: palanca vertical, cilindro maestro propio y pinzas traseras.
function sHandSchematic(t, s0) {
  bg(); dots(0.03);
  const pull = ease.inOut(prog(t, at(143) + 0.3, at(143) + 0.8));
  const a = (t0) => ease.out(prog(t, t0, t0 + 0.6));
  // Volante.
  ctx.save(); ctx.globalAlpha = a(s0 + 0.2); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(980, 400, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(840, 400); ctx.lineTo(1120, 400); ctx.moveTo(980, 400); ctx.lineTo(980, 550); ctx.stroke(); ctx.restore();
  // Palanca vertical a centímetros del volante.
  const lx = 1200, ly = 820;
  ctx.save(); ctx.globalAlpha = a(at(141)); ctx.translate(lx, ly); ctx.rotate(-0.05 - pull * 0.45);
  ctx.strokeStyle = COLOR.red; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -330); ctx.stroke();
  ctx.fillStyle = COLOR.red; rr(ctx, -20, -380, 40, 80, 14); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = a(at(141)); ctx.fillStyle = COLOR.ink; ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  pin(t, lx - 30, 560, lx - 210, 640, 'PALANCA VERTICAL', at(141) + 0.4);
  // Cilindro maestro propio.
  const mx = 1330, my = 820;
  ctx.save(); ctx.globalAlpha = a(at(142)); ctx.fillStyle = '#6E7379'; rr(ctx, mx, my - 30, 190, 60, 10); ctx.fill();
  ctx.fillStyle = COLOR.blue; ctx.fillRect(mx + 20 + pull * 70, my - 18, 150 - pull * 70, 36); ctx.restore();
  ctx.save(); ctx.globalAlpha = a(at(142)); ctx.strokeStyle = 'rgba(232,233,230,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(lx + Math.sin(0.05 + pull * 0.45) * 120, ly - 120); ctx.lineTo(mx + 20 + pull * 70, my); ctx.stroke(); ctx.restore();
  pin(t, mx + 95, my + 30, mx + 95, my + 120, 'CILINDRO MAESTRO PROPIO', at(142) + 0.5, COLOR.paper, 'center');
  // Línea trasera a las dos pinzas.
  const P = poly([[mx + 190, my], [1640, my], [1640, 300], [1640, 300]]);
  ctx.save(); ctx.globalAlpha = a(at(142) + 1.0); ctx.strokeStyle = 'rgba(232,233,230,0.3)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(mx + 190, my); ctx.lineTo(1640, my); ctx.lineTo(1640, 300); ctx.stroke(); ctx.restore();
  if (pull > 0) flowLine(P, t, { color: COLOR.blue, width: 7, amount: pull, speed: 2 });
  const lock = ease.out(prog(t, at(145), at(145) + 0.4));
  for (const [x, y] of [[1640, 300], [1640, 560]]) {
    const rot = spinRot(t, s0, 1.2) * (1 - lock) + (lock > 0 ? spinRot(Math.min(t, at(145)), s0, 1.2) * lock : 0);
    drawDiscFront(x, y, 110, { rot, heat: 0.3 + 0.3 * lock, holes: 'drilled' });
    drawCaliperFront(x, y, 110, Math.PI, { n: 1, span: 0.5 });
  }
  ctx.save(); ctx.globalAlpha = a(at(142) + 1.0); ctx.strokeStyle = 'rgba(232,233,230,0.3)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(1640, my); ctx.lineTo(1640, 560); ctx.stroke(); ctx.restore();
  label(ctx, 'PINZAS TRASERAS', 1640, 160, COLOR.paper, a(at(144)), { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'BLOQUEADAS', 1640, 720, COLOR.red, lock, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'CON UN LEVE TIRÓN', ['Presión brutal', 'atrás'], at(144) + 0.1, { y: 290, size: 84, maxW: 540, label: 'Para hacer pivotar la zaga', labelT: at(145) + 1.2 });
}
// Tracción total: bloquear atrás con el motor empujando destroza el diferencial central.
function sAWDProblem(t, s0) {
  bg(); dots(0.03);
  const lock = ease.out(prog(t, at(149) + 0.6, at(149) + 1.0));
  const stress = ease.out(prog(t, at(150) + 0.2, at(150) + 0.8));
  drawAWD(t, { cx: 1320, cy: 560, s: 0.95, power: 1, rearLock: lock, stress, appear: ease.out(prog(t, s0 + 0.1, s0 + 0.8)) });
  label(ctx, 'DIFERENCIAL CENTRAL', 1320, 470, COLOR.paper, prog(t, at(148) + 1.0, at(148) + 1.5), { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'UN PROBLEMA MECÁNICO OCULTO', ['Tracción total'], at(147), { y: 300, size: 96, maxW: 560, label: 'Las cuatro ruedas, conectadas entre sí', labelT: at(148) + 0.6 });
  label(ctx, 'Destrozarías el', M, 640, COLOR.red, prog(t, at(150), at(150) + 0.5), { size: 56, spacing: 0, weight: 800 });
  label(ctx, 'diferencial central', M, 710, COLOR.red, prog(t, at(150) + 0.3, at(150) + 0.8), { size: 56, spacing: 0, weight: 800 });
}
// Sensor de presión → centralita → desacople del diferencial central.
function sDecouple(t, s0) {
  bg(); dots(0.03);
  const sensor = ease.out(prog(t, at(152), at(152) + 0.6));
  const sig = prog(t, at(153) + 1.2, at(154) + 0.6);
  const dec = ease.inOut(prog(t, at(154) + 1.0, at(154) + 2.4));
  drawAWD(t, { cx: 1320, cy: 560, s: 0.95, power: 1, decouple: dec, rearPress: ease.out(prog(t, at(153) + 1.2, at(153) + 1.8)), rearLock: ease.out(prog(t, at(153) + 1.6, at(153) + 2.0)), sensor });
  if (sig > 0) { ctx.save(); ctx.globalAlpha = 1 - prog(t, at(155) + 1.5, at(155) + 2.0); ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(1320, 560, 30 + 40 * ((t * 2) % 1), 0, Math.PI * 2); ctx.globalAlpha *= 0.3 * (1 - ((t * 2) % 1)); ctx.fill(); ctx.restore(); }
  pin(t, 1320 - 40 * 0.95, 560 - 120 * 0.95, 1180, 900, 'SENSOR DE PRESIÓN', at(152) + 0.2, COLOR.blue);
  pin(t, 1320, 560 + 44 * 0.95, 1520, 900, 'DESACOPLADO', at(154) + 1.6, COLOR.yellow);
  side(t, 'UNA OBRA MAESTRA DE SINCRONIZACIÓN', ['En el milisegundo', 'exacto'], at(153) - 0.1, { y: 360, size: 96, maxW: 560, label: 'La centralita desacopla el diferencial', labelT: at(154) + 0.4 });
  label(ctx, 'El eje trasero, desconectado del delantero', M, 700, COLOR.yellow, prog(t, at(155), at(155) + 0.5), { size: 32, spacing: 0, weight: 700 });
}
// El motor tira de las delanteras, las traseras deslizan; al soltar, el diferencial se cierra.
function sRelease(t, s0) {
  bg(); dots(0.03);
  const rel = ease.inOut(prog(t, at(159) + 0.4, at(159) + 1.0));
  const u = prog(t, s0, s0 + 12);
  const rot = -0.2 - 0.9 * ease.inOut(prog(t, s0 + 0.3, at(158))) + 0.6 * rel;
  drawAWD(t, { cx: 1320 + 120 * ease.inExpo(rel), cy: 560, s: 0.85, rot, power: 1, decouple: 1 - rel, rearLock: 1 - rel });
  side(t, 'EL MOTOR SIGUE RUGIENDO', ['Las delanteras', 'traccionan'], at(156) + 0.6, { y: 360, size: 96, maxW: 560, label: 'y las traseras deslizan bloqueadas', labelT: at(157) + 2.6 });
  label(ctx, 'Al soltar la palanca, se cierra de golpe', M, 720, COLOR.yellow, prog(t, at(158) + 0.6, at(158) + 1.1), { size: 32, spacing: 0, weight: 700 });
  if (rel > 0) arrowPath([[1500, 560], [1800, 560]], rel, COLOR.yellow, 6, 22);
  void u;
}
// Pedal box: dos bombas y una barra basculante con el reparto ajustable.
function sPedalBox(t, s0) {
  bg(); dots(0.03);
  const a = (t0) => ease.out(prog(t, t0, t0 + 0.6));
  const bias = ease.inOut(prog(t, at(163) + 1.0, at(163) + 2.6)) - ease.inOut(prog(t, at(163) + 4.4, at(163) + 6.0)) * 1.6;
  const cx = 1320, y0 = 420;
  const press = 0.5 + 0.5 * Math.sin((t - s0) * 1.6);
  // Bombas.
  const mc = (x, name, col, share) => {
    ctx.save(); ctx.globalAlpha = a(at(161)); ctx.fillStyle = '#6E7379'; rr(ctx, x - 50, y0 - 260, 100, 220, 12); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(x - 32, y0 - 240, 64, 150 - press * 30 * share); ctx.restore();
    label(ctx, name, x, y0 - 290, col, a(at(161)), { size: 22, spacing: 6, weight: 700, align: 'center' });
  };
  const span2 = 320, piv = cx + bias * 90;
  const lf = clamp(0.5 + (cx - piv) / span2 * 1.0, 0.1, 0.9);
  mc(cx - span2 / 2, 'DELANTERO', COLOR.blue, 1 - lf + 0.5);
  mc(cx + span2 / 2, 'TRASERO', COLOR.yellow, lf + 0.5);
  // Barra basculante.
  ctx.save(); ctx.globalAlpha = a(at(161) + 0.8);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - span2 / 2, y0 + press * 20); ctx.lineTo(cx + span2 / 2, y0 + press * 20); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - span2 / 2, y0 + press * 20); ctx.lineTo(cx - span2 / 2, y0 - 40); ctx.moveTo(cx + span2 / 2, y0 + press * 20); ctx.lineTo(cx + span2 / 2, y0 - 40); ctx.stroke();
  ctx.fillStyle = COLOR.red; ctx.beginPath(); ctx.arc(piv, y0 + press * 20, 20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  pin(t, piv - 10, y0 + press * 20, piv - 230, y0 + 120, 'BALANCE BAR', at(161) + 3.0, COLOR.red, 'right');
  // Pedal debajo.
  drawPedal(cx, y0 + 30 + press * 20, 0.2 + press * 0.15, { appear: a(at(160) + 0.4), s: 0.8, floor: false });
  // Reparto.
  const ra = a(at(162) + 0.6);
  meter(t, 1060, 920, 520, lf, ra, 'REPARTO DE FRENADA', COLOR.blue);
  label(ctx, 'ADELANTE', 1060, 990, COLOR.blue, ra, { size: 20, spacing: 6, weight: 700 });
  label(ctx, 'ATRÁS', 1580, 990, COLOR.yellow, ra, { size: 20, spacing: 6, weight: 700, align: 'right' });
  side(t, 'TODO ESTO SE COMBINA CON LA', ['Pedal Box'], at(160) + 0.4, { y: 330, size: 120, maxW: 560, label: 'Dos bombas de freno independientes', labelT: at(161) + 0.4 });
  label(ctx, 'Con una ruleta en el salpicadero', M, 600, COLOR.paper, prog(t, at(162) + 0.2, at(162) + 0.7), { size: 36, spacing: 0, weight: 700 });
  label(ctx, 'el piloto desplaza el reparto', M, 650, DIM, prog(t, at(163) + 0.4, at(163) + 0.9), { size: 36, spacing: 0, weight: 600 });
  label(ctx, 'si empieza a llover', M, 760, COLOR.blue, prog(t, at(163) + 4.6, at(163) + 5.1), { size: 30, spacing: 0, weight: 700 });
  label(ctx, 'o si los traseros se degradan', M, 810, COLOR.yellow, prog(t, at(163) + 6.4, at(163) + 6.9), { size: 30, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Rally1: metalurgia aeroespacial.

// Fresado CNC: la fresa recorre un bloque y deja la pinza monobloque.
function sMonoblock(t, s0) {
  bg(); dots(0.03);
  const cx = 1330, cy = 560;
  const m = ease.inOut(prog(t, s0 + 0.3, at(169) + 5.0));
  const ph2 = ease.inOut(prog(t, at(170) - 0.2, at(170) + 0.6));
  if (ph2 < 1) {
    ctx.save(); ctx.globalAlpha = 1 - ph2;
    // Bloque en bruto que se vacía por pasadas.
    const bw = 760, bh = 480, x0 = cx - bw / 2, y0 = cy - bh / 2;
    const rows = 12, done = m * rows;
    ctx.fillStyle = '#9EA3A9';
    for (let r = 0; r < rows; r++) {
      const fr = clamp(done - r);
      if (fr >= 1) continue;
      const y = y0 + (r / rows) * bh, hh = bh / rows;
      const xa = r % 2 ? x0 + bw * fr : x0, xb = r % 2 ? x0 + bw : x0 + bw * (1 - fr);
      ctx.fillRect(xa, y, xb - xa, hh + 1);
    }
    ctx.restore();
    // La pinza aparece bajo el material.
    ctx.save(); ctx.globalAlpha = (1 - ph2) * clamp(m * 1.2);
    drawCaliperFront(cx, cy + 520, 620, -Math.PI / 2, { n: 3, span: 0.42, color: ALU, mono: true });
    ctx.restore();
    // Fresa.
    const r = Math.min(11, Math.floor(m * 12)), fr = m * 12 - r;
    const fx = r % 2 ? cx - 380 + 760 * fr : cx + 380 - 760 * fr, fy = cy - 240 + (r + 0.5) * 40;
    if (m < 1) { ctx.save(); ctx.globalAlpha = 1 - ph2; ctx.fillStyle = COLOR.paper; ctx.beginPath(); ctx.arc(fx, fy, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = COLOR.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx - 16, fy); ctx.lineTo(fx + 16, fy); ctx.moveTo(fx, fy - 16); ctx.lineTo(fx, fy + 16); ctx.stroke(); ctx.restore(); }
  }
  if (ph2 > 0) {
    const de = 0.5 + 0.5 * Math.sin((t - at(170)) * 2.4);
    ctx.save(); ctx.globalAlpha = ph2;
    drawSection(t, { cx: 1330, cy: 720, s: 0.85, clamp: 1, heat: 0.4, pressure: 1, deflect: 0 });
    ctx.globalAlpha = ph2 * 0.35 * de; ctx.setLineDash([10, 10]);
    drawSection(t, { cx: 1330, cy: 720, s: 0.85, clamp: 1, heat: 0.4, deflect: 1, appear: 1 });
    ctx.restore();
    label(ctx, 'PINZA CONVENCIONAL BAJO PRESIÓN', 1330, 960, DIM, ph2 * de, { size: 20, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'MÁS DE 100 BARES', 1330, 270, COLOR.blue, ph2, { size: 24, spacing: 7, weight: 700, align: 'center' });
  }
  side(t, 'FRESADO CNC · ALUMINIO-LITIO', ['Bloques', 'monolíticos'], at(169) + 0.4, { y: 400, size: 120, maxW: 560, label: 'Rigidez extrema: la pinza no se abre', labelT: at(170) + 1.6 });
}
// Pistón de titanio hueco: el calor se queda en el disco.
function sTitanium(t, s0) {
  bg(); dots(0.03);
  const ti = ease.inOut(prog(t, at(173), at(173) + 1.0));
  const hp = prog(t, at(175), at(175) + 2.0) * 0.62;
  focus(1403, 485, 1.7, 1560, 560, () => drawSection(t, { cx: 1280, cy: 700, s: 1.0, clamp: 1, heat: 0.9, padHeat: 0.75, fluidHeat: 0, ti, heatPath: hp }));
  scrim(860, 0.92);
  const sh = ease.out(prog(t, at(175) + 1.6, at(175) + 2.2));
  if (sh > 0) {
    ctx.save(); ctx.globalAlpha = sh; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1472, 430); ctx.lineTo(1472, 690); ctx.stroke(); ctx.restore();
    label(ctx, 'ESCUDO TÉRMICO', 1472, 140, COLOR.blue, sh, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
  const hot = ease.out(prog(t, at(175) + 0.6, at(175) + 1.1));
  if (hot > 0) { ctx.save(); ctx.globalAlpha = hot; ctx.font = FONT.display(800, 90); ctx.fillStyle = COLOR.fire; ctx.textAlign = 'right'; ctx.fillText('800°', 1250, 960); ctx.restore(); }
  side(t, 'LOS PISTONES YA NO SON DE ACERO', ['Titanio hueco', 'y perforado'], at(173) + 0.1, { y: 380, size: 100, maxW: 560, label: 'Un pésimo conductor térmico', labelT: at(174) + 0.3 });
}
// Frenada regenerativa: la unidad eléctrica trasera actúa como generador.
function sRegen(t, s0) {
  bg(); dots(0.03);
  const regen = ease.out(prog(t, at(181) + 0.6, at(181) + 1.4));
  drawAWD(t, { cx: 1320, cy: 560, s: 0.95, power: 0, appear: ease.out(prog(t, s0 + 0.1, s0 + 0.8)) });
  // Unidad eléctrica trasera y batería.
  const ux = 1320 - 300 * 0.95 + 150, uy = 560, bx = 1320 - 40, by = 560 + 120;
  const a = ease.out(prog(t, at(181), at(181) + 0.6));
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COLOR.ink2; rr(ctx, ux - 60, uy - 50, 120, 100, 12); ctx.fill(); ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  label(ctx, '100 KW', ux, uy + 10, COLOR.blue, a, { size: 22, spacing: 4, weight: 800, align: 'center' });
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = COLOR.ink2; rr(ctx, bx - 90, by - 34, 180, 68, 10); ctx.fill(); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = COLOR.yellow; ctx.fillRect(bx - 76, by - 20, 152 * (0.3 + 0.6 * ease.inOut(prog(t, at(182), at(182) + 2.4))), 40); ctx.restore();
  label(ctx, 'BATERÍA', bx, by + 70, COLOR.yellow, a, { size: 20, spacing: 6, weight: 700, align: 'center' });
  if (regen > 0) {
    const r1 = poly([[1320 - 300 * 0.95, 560 - 200 * 0.95], [ux, uy - 50]]), r2 = poly([[1320 - 300 * 0.95, 560 + 200 * 0.95], [ux, uy + 50]]), r3 = poly([[ux + 60, uy], [bx - 90, by]]);
    for (const P of [r1, r2]) flowLine(P, t, { color: COLOR.blue, width: 6, amount: regen });
    flowLine(r3, t, { color: COLOR.yellow, width: 6, amount: regen });
  }
  label(ctx, 'FRENA EL EJE TRASERO', 1320 - 300 * 0.95, 560 + 330, COLOR.blue, prog(t, at(182), at(182) + 0.5), { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'TECNOLOGÍA HÍBRIDA EN LOS RALLY1', ['La frenada', 'regenerativa'], at(179) + 0.1, { y: 380, size: 110, maxW: 560, label: 'Actúa como un generador', labelT: at(181) + 2.4 });
}
// Blending: eléctrico + hidráulico = la misma frenada.
function sBlend(t, s0) {
  bg(); dots(0.03);
  const x = 880, y = 330, w = 900, h = 480;
  axes(x, y, w, h, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TIEMPO DE FRENADA', yl: 'PAR DE FRENADA' });
  const total = (u) => 0.8 * ease.out(clamp(u / 0.18)) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
  const elec = (u) => Math.min(total(u), 0.38 * ease.inOut(clamp(u / 0.3)) * (u > 0.6 ? Math.max(0, 1 - (u - 0.6) / 0.25) : 1));
  const p = prog(t, at(184), at(184) + 4.5);
  plot(x, y, w, h, total, p, COLOR.red, 0.01, { fill: 0.75 });
  plot(x, y, w, h, elec, p, COLOR.blue, 0.01, { fill: 0.95 });
  plot(x, y, w, h, total, p, COLOR.paper, 5);
  label(ctx, 'HIDRÁULICO', x + w * 0.45, y + h * (1 - 0.6), COLOR.paper, prog(t, at(184) + 2.0, at(184) + 2.5), { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'ELÉCTRICO', x + w * 0.4, y + h * (1 - 0.15), COLOR.ink, prog(t, at(184) + 2.4, at(184) + 2.9), { size: 22, spacing: 6, weight: 800, align: 'center' });
  label(ctx, 'LO QUE SIENTE EL PIE', x + w * 0.5, y + h * (1 - 0.8) - 24, COLOR.paper, prog(t, at(185) + 0.4, at(185) + 0.9), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'EL RETO DE INGENIERÍA', ['Blending'], at(183) + 0.8, { y: 400, size: 130, maxW: 560, label: 'o mezclado', labelT: at(183) + 2.0 });
  label(ctx, 'La misma mordida,', M, 640, COLOR.paper, prog(t, at(185) + 1.6, at(185) + 2.1), { size: 44, spacing: 0, weight: 700 });
  label(ctx, 'curva tras curva', M, 700, COLOR.paper, prog(t, at(185) + 2.4, at(185) + 2.9), { size: 44, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Cierre.

function sRecap(t, s0) {
  bg(); dots(0.03);
  const a1 = ease.out(prog(t, at(188) + 0.2, at(188) + 0.9)), a2 = ease.out(prog(t, at(188) + 2.6, at(188) + 3.3));
  drawDrum(t, { cx: 620, cy: 470, R: 190, rot: spinRot(t, s0, 0.3), apply: 1, heat: 0.75, trapped: 0.6, appear: a1 });
  label(ctx, 'Los tambores que se derretían en los Alpes', 620, 790, COLOR.paper, a1, { size: 30, spacing: 0, weight: 700, align: 'center' });
  arrowPath([[900, 470], [1040, 470]], prog(t, at(188) + 2.0, at(188) + 2.6), COLOR.paper, 4, 16);
  ctx.save(); ctx.globalAlpha = a2;
  drawDiscFront(1340, 470, 220, { rot: spinRot(t, s0, 0.3), heat: 0.3, holes: 'drilled', vanes: 1 });
  drawCaliperFront(1340, 470, 220, -0.9, { n: 3, span: 0.46, color: ALU, mono: true });
  ctx.restore();
  label(ctx, 'Aluminio-litio, titanio y sensores', 1340, 790, COLOR.paper, a2, { size: 30, spacing: 0, weight: 700, align: 'center' });
}

function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 720, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = la; ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h); ctx.restore();
  pill(t, 'Suscríbete', W / 2, 740, at(191) - 0.3, { press: at(191) + 0.4, color: COLOR.red, size: 42 });
  label(ctx, '¿Qué otro componente del rally quieres que exploremos?', W / 2, 880, DIM, prog(t, at(193) + 0.2, at(193) + 0.7), { size: 40, spacing: 0, weight: 600, align: 'center' });
  label(ctx, 'Nos vemos en el próximo tramo', W / 2, 960, COLOR.paper, prog(t, at(194), at(194) + 0.5), { size: 44, spacing: 0, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, sEnergy, 'dissolve'],
  [cut(3), sMass, 'cube'],
  [cut(5), sStop, 'whip'],
  [cut(6), sHeat, 'dissolve'],
  [cut(8), sPower, 'cubeV'],
  [cut(10), kClip({ seg: 'onA', from: 0.0, speed: 0.9, tag: 'EN EL RALLY, LOS FRENOS NO SIRVEN PARA IR DESPACIO', tagT: at(10) + 0.2, title: ['Ir más rápido', 'durante más tiempo'], tt: at(12) + 0.2, size: 120 }), 'whip'],
  [cut(13), sExplode, 'slices'],
  [cut(15), kPhoto3({ img: 'frenoWRC', fx: 0.55, fy: 0.5, yaw: [-0.06, 0.03], dark: 0.4, tag: 'LA EVOLUCIÓN MÁS INFRAVALORADA DEL AUTOMOVILISMO', tagT: at(14) + 3.6 - 0.2, title: ['Los frenos'], tt: at(15) + 0.3, size: 170, label: 'en el Campeonato Mundial de Rallys', labelT: at(15) + 1.0 }), 'cube'],
  [cut(16), kChapter({ img: 'alpineNoche', gray: true, fx: 0.5, fy: 0.5, era: 0, tag: 'AÑOS 60 · COCHES PRÁCTICAMENTE DE SERIE', tagT: at(16) + 0.3, title: ['Frenos de tambor'], tt: at(18) + 0.4 }), 'wipe'],
  [cut(19), sDrumTrap, 'cubeV'],
  [cut(21), sTurini, 'dissolve'],
  [cut(22) + 3.0, sDrumGrow, 'dissolve'],
  [cut(24), sNothing, 'cut'],
  [cut(25), kChapter({ img: 'stratos', fx: 0.6, fy: 0.5, era: 1, tag: 'AÑOS 70 · GRUPO 4 · LANCIA STRATOS · FORD ESCORT RS', tagT: at(25) + 0.3, title: ['Discos macizos'], tt: at(27) + 0.2 }), 'wipe'],
  [cut(28), sDiscAir, 'cube'],
  [cut(30), sFadeTitle, 'dissolve'],
  [cut(34), sPadFade, 'slices'],
  [cut(39), sPadHard, 'cut'],
  [cut(41), sHeatPath, 'cubeV'],
  [cut(45), sBoil, 'dissolve'],
  [cut(47), sCompress, 'cube'],
  [cut(51), kClip({ seg: 'onE', from: 0.0, speed: 0.95, tag: 'A 150 POR HORA', tagT: at(51) + 1.6, title: ['Bombear el freno'], tt: at(51) + 0.8, size: 130, label: 'rezando por recuperar presión antes de la curva', labelT: at(51) + 3.2 }), 'whip'],
  [cut(52), kClip({ seg: 'grupoB', from: 0.0, speed: 1, fy: 0.42, tag: 'AÑOS 80', tagT: at(52) + 0.4, title: ['El Grupo B'], tt: at(52) + 1.6, size: 150, label: '500 caballos · de 0 a 100 en 3 segundos', labelT: at(53) + 0.2, extra: (t, s0) => drawEras(t, 2, ease.out(prog(t, s0 + 0.2, s0 + 1.0)) * (1 - prog(t, at(53) + 4, at(53) + 5)), 70) }), 'wipe'],
  [cut(55), sCrack, 'whip'],
  [cut(56), kType({ tag: 'LA INGENIERÍA RESPONDIÓ CON', title: ['Dos armas clave'], tt: at(56) + 0.4, size: 170 }), 'cut'],
  [cut(57), sVented, 'cube'],
  [cut(61), sCaliper4, 'dissolve'],
  [cut(64), kPhoto3({ img: 'audiTurbofan', fx: 0.4, fy: 0.6, yaw: [0.06, -0.02], dark: 0.4, tag: 'EL INVENTO MÁS ICÓNICO Y VISUAL DEL GRUPO B', tagT: at(64) + 0.4, title: ['Turbofans'], tt: at(64) + 3.0, size: 190 }), 'whip'],
  [cut(65), kPhoto({ img: 'quattroS1', fx: 0.5, fy: 0.55, z: [1.14, 1.04], dark: 0.42, tag: 'AUDI QUATTRO · LANCIA 037', tagT: at(65) + 1.4, title: ['Tapas con aspas', 'sobre las llantas'], tt: at(65) + 4.6, size: 120 }), 'slices'],
  [cut(66), kType({ title: ['No era estética.'], tt: at(66) + 0.1, size: 190 }), 'cut'],
  [cut(67), sTurbofan, 'cubeV'],
  [cut(72), kType({ title: ['Aerodinámica aplicada', 'a la termodinámica'], tt: at(72) + 0.2, size: 130, colors: [COLOR.blue, COLOR.fire] }), 'dissolve'],
  [cut(73), kChapter({ img: 'frenoWRC', fx: 0.5, fy: 0.5, tag: 'AQUÍ, LA INGENIERÍA DE LOS RALLYS', tagT: at(73) + 0.2, title: ['Rompe todas', 'las reglas'], tt: at(73) + 1.6, label: 'En Fórmula 1 o GT3, cuanto más grande es el disco, mejor', labelT: at(74) + 0.4 }), 'wipe'],
  [cut(77), kType({ tag: 'EN EL WRC', tagT: at(77) + 0.1, title: ['Solo es cierto', 'la mitad del tiempo'], tt: at(78) + 0.1, size: 140, colors: [COLOR.paper, COLOR.yellow] }), 'dissolve'],
  [cut(79), sTarmac, 'cube'],
  [cut(84), kPhoto3({ img: 'rally1Tierra', fx: 0.6, fy: 0.6, yaw: [-0.05, 0.03], dark: 0.35, tag: 'CUANDO EL CAMPEONATO VIAJA A', tagT: at(84) + 0.2, title: ['La tierra, la nieve', 'o la grava'], tt: at(84) + 1.6, size: 120 }), 'whip'],
  [cut(86), sGravel, 'dissolve'],
  [cut(88), kType({ title: ['¿Por qué?'], tt: at(88) + 0.1, size: 200, label: 'Por dos razones físicas fundamentales', labelT: at(89) + 0.2 }), 'cut'],
  [cut(90), sSidewall, 'cube'],
  [cut(94), sGrip, 'dissolve'],
  [cut(100), sSled, 'whip'],
  [cut(102), sUnsprung, 'cubeV'],
  [cut(105), kChapter({ img: 'discoTaladrado', fx: 0.5, fy: 0.5, era: 3, tag: 'AÑOS 90 · MIRANDO A LA FÓRMULA 1', tagT: at(105) + 0.3, title: ['Carbono-carbono'], tt: at(106) + 2.6 }), 'wipe'],
  [cut(107), sCarbon, 'cube'],
  [cut(113), kClip({ seg: 'onB', from: 0.0, speed: 0.85, tag: 'TRAS UNA RECTA LARGA BAJO LA LLUVIA', tagT: at(114) + 0.1, title: ['Los discos', 'se enfriaban'], tt: at(115) + 0.1, size: 130 }), 'whip'],
  [cut(116), sColdCorner, 'dissolve'],
  [cut(118), sBanned, 'cube'],
  [cut(121), kChapter({ img: 'subaruDisco', fx: 0.4, fy: 0.6, era: 4, tag: 'WRC · AÑOS 2000 · CADA VEZ MÁS RÁPIDOS EN ASFALTO', tagT: at(121) + 0.6, title: ['El calor volvió'], tt: at(122) + 0.1, label: 'Un problema crítico', labelT: at(122) + 1.6 }), 'wipe'],
  [cut(123), kType({ tag: 'SUBARU · FORD · CITROËN', tagT: at(123) + 0.6, title: ['Pinzas refrigeradas', 'por agua'], tt: at(125) - 0.1, size: 140, colors: [COLOR.paper, COLOR.blue], }), 'dissolve'],
  [cut(126), sWaterLoop, 'cube'],
  [cut(130), sLater, 'dissolve'],
  [cut(131), sWaterBan, 'slices'],
  [cut(135), kSplit({ img: 'frenoMano', side: 'right', fx: 0.5, fy: 0.5, z: [1.04, 1.0], tag: 'EN UN COCHE DE RALLY', tagT: at(137) + 0.2, title: ['Un instrumento', 'quirúrgico'], tt: at(138) + 0.1, size: 100, label: 'No un simple cable para aparcar', labelT: at(138) + 1.4 }), 'wipe'],
  [cut(139), sHairpin, 'cube'],
  [cut(141), sHandSchematic, 'dissolve'],
  [cut(146), sAWDProblem, 'cubeV'],
  [cut(151), sDecouple, 'dissolve'],
  [cut(156), sRelease, 'cut'],
  [cut(160), sPedalBox, 'cube'],
  [cut(164), kChapter({ img: 'rally1Noche', fx: 0.5, fy: 0.5, era: 5, tag: 'HOY · SIN CARBONO Y SIN REFRIGERACIÓN POR AGUA', tagT: at(164) + 0.3, title: ['Rally1'], tt: at(166) + 0.2, label: '100 kilos más que sus predecesores', labelT: at(167) + 0.3 }), 'wipe'],
  [cut(168), kType({ tag: 'LA RESPUESTA ESTÁ EN LA', tagT: at(168) + 0.1, title: ['Metalurgia', 'aeroespacial'], tt: at(168) + 1.2, size: 160 }), 'dissolve'],
  [cut(169), sMonoblock, 'cube'],
  [cut(172), sTitanium, 'dissolve'],
  [cut(176), sRegen, 'cubeV'],
  [cut(183), sBlend, 'dissolve'],
  [cut(186), kClip({ seg: 'onD', from: 0.0, speed: 1, tag: 'LO QUE SEPARA A UN PILOTO RÁPIDO DE UN CAMPEÓN', tagT: at(187) + 0.2, title: ['La confianza ciega'], tt: at(187) + 3.4, size: 140, label: 'Al pisar el pedal a 180 por hora frente a un muro de piedra', labelT: at(187) + 6.0 }), 'whip'],
  [cut(188), sRecap, 'dissolve'],
  [cut(189), kPhoto3({ img: 'discoFuego', fx: 0.6, fy: 0.5, yaw: [-0.05, 0.03], dark: 0.45, tag: 'LA EVOLUCIÓN DE LOS FRENOS ES', tagT: at(189) + 0.2, title: ['La historia', 'silenciosa'], tt: at(189) + 1.4, size: 140, label: 'De cómo la ingeniería desafió el instinto de supervivencia', labelT: at(189) + 4.4 }), 'cube'],
  [cut(190), sChannel, 'wipe'],
];

// Ventanas de uso de cada tramo del onboard: para cargar sus fotogramas y para que la mezcla
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
export const HITS = [cut(16), cut(25), cut(52), cut(73), cut(105), cut(121), cut(164)];
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
