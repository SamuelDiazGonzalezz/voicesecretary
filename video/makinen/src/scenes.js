// Escenas del documental sobre Tommi Mäkinen. Todo depende solo de `t`.
import { W, H, V, cut, DURATION, CLIP_FPS, BREAKS } from './timeline.js';
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
// Componentes del documental de Tommi Mäkinen. Todo en coordenadas de pantalla, animado por `t`.

const ICE = COLOR.ice;

// Trazo de una polilínea con revelado parcial y grosor fijo.
function strokePath(pts, p, color, width = 3, dash = null) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  trace(ctx, poly(pts), p);
  ctx.restore();
}

// --- Mapa de Finlandia, esquemático (longitud y latitud reales de la costa y las fronteras) ---
const FIN = [
  [22.95, 59.82], [24.94, 60.17], [26.9, 60.47], [27.8, 60.55], [29.5, 61.3], [31.0, 62.4], [31.5, 62.9], [30.6, 63.4], [30.0, 64.6],
  [29.6, 65.6], [30.1, 66.4], [29.1, 67.6], [28.7, 68.0], [28.4, 68.5], [28.9, 69.0], [28.8, 69.7], [27.9, 70.09], [27.0, 69.9], [26.0, 69.7],
  [25.4, 69.1], [24.2, 68.7], [22.4, 68.7], [21.0, 69.25], [20.55, 69.05], [21.6, 68.4], [23.6, 67.9], [23.9, 66.8], [24.15, 65.85],
  [25.47, 65.01], [24.4, 64.7], [23.1, 63.84], [21.6, 63.1], [21.8, 61.48], [21.5, 61.13], [22.27, 60.45], [22.95, 59.82],
];
const finXY = (lon, lat, cx, cy, k) => [cx + (lon - 26) * Math.cos(64 * Math.PI / 180) * k, cy - (lat - 65) * k];
function drawFinland(t, { cx, cy, k = 90, draw = 1, dot = 0, label = 0, ring = 0, lakes = 0 }) {
  const pts = catmull(FIN.map(([lo, la]) => finXY(lo, la, cx, cy, k)), false, 6);
  ctx.save();
  if (draw >= 1) {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = 'rgba(232,233,230,0.05)'; ctx.fill();
  }
  ctx.restore();
  strokePath(pts, draw, COLOR.line, 2.5);
  // Los lagos: puntos tenues en el sur y el centro (la región de los 1000 Lagos).
  if (lakes > 0) {
    const r = rng(1000);
    for (let i = 0; i < 140; i++) {
      const lo = 23.5 + r() * 6, la = 60.9 + r() * 2.6;
      const [x, y] = finXY(lo, la, cx, cy, k);
      ctx.fillStyle = `rgba(156,203,234,${0.5 * clamp(lakes * 2 - i / 140)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (dot > 0) {
    const [x, y] = finXY(25.7, 62.3, cx, cy, k);
    ctx.fillStyle = COLOR.red;
    ctx.beginPath(); ctx.arc(x, y, 10 * ease.outExpo(dot), 0, Math.PI * 2); ctx.fill();
    if (ring > 0 && ring < 1) { ctx.strokeStyle = `rgba(221,42,36,${1 - ring})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10 + 80 * ease.out(ring), 0, Math.PI * 2); ctx.stroke(); }
    if (label > 0) {
      ctx.strokeStyle = COLOR.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + 14 + 160 * ease.out(label), y); ctx.stroke();
    }
    return [x, y];
  }
  return null;
}

// --- Tractor forestal, en línea ---
function drawTractor(t, { cx, cy, s = 1, draw = 1, rock = 0 }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.rotate(rock * 0.035 * Math.sin(t * 2.3));
  ctx.strokeStyle = COLOR.paper;
  ctx.lineWidth = 3 / s;
  ctx.lineJoin = 'round';
  const seg = (pts, p) => trace(ctx, poly(pts), p);
  const d = (a, b) => clamp((draw - a) / (b - a));
  seg([[-20, -40], [230, -40], [250, 10], [250, 40], [40, 40]], d(0, 0.4));                  // capó y bastidor
  seg([[-190, 30], [-190, -250], [-20, -250], [-20, 30]], d(0.1, 0.5));                       // cabina
  seg([[-175, -235], [-35, -235], [-35, -110], [-175, -110], [-175, -235]], d(0.3, 0.6));     // ventana
  seg([[140, -40], [140, -150], [150, -160]], d(0.4, 0.7));                                   // escape
  seg([[250, 0], [330, 0], [345, 40]], d(0.5, 0.8));                                          // pala
  ctx.restore();
  // Ruedas: trasera grande y delantera pequeña con tacos.
  for (const [x, y, r] of [[-110, 60, 120], [170, 105, 70]]) {
    const a = ease.out(d2(draw, 0.4, 0.9));
    if (a <= 0) continue;
    ctx.save();
    ctx.translate(cx + x * s, cy + y * s);
    ctx.globalAlpha = a;
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * s * 0.45, 0, Math.PI * 2); ctx.stroke();
    const sp = t * 0.6;
    for (let k = 0; k < 14; k++) {
      const an = sp + (k / 14) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * s, Math.sin(an) * r * s); ctx.lineTo(Math.cos(an) * (r - 16) * s, Math.sin(an) * (r - 16) * s); ctx.stroke();
    }
    ctx.restore();
  }
}
const d2 = (v, a, b) => clamp((v - a) / (b - a));

// Barras de agarre por superficie (sin cifras: solo la proporción).
function gripBars(t, x, y, p, rows) {
  rows.forEach(([name, v, col], i) => {
    const a = ease.out(clamp(p * 3 - i * 0.5));
    const yy = y + i * 110;
    label(ctx, name, x, yy, DIM, a, { size: 26, spacing: 7, weight: 700 });
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(232,233,230,0.1)'; ctx.fillRect(x, yy + 22, 560, 14);
    ctx.fillStyle = col; ctx.fillRect(x, yy + 22, 560 * v * ease.out(clamp(p * 3 - i * 0.5 - 0.2)), 14);
    ctx.restore();
  });
}

// --- Regla de años ---
function drawRuler(t, { x0 = 140, x1 = 1780, y = 640, from, to, draw = 1, hi = null, hiColor = COLOR.red, marks = [], dim = [] }) {
  const n = to - from;
  const X = (yr) => lerp(x0, x1, (yr - from) / n);
  ctx.save();
  ctx.fillStyle = 'rgba(232,233,230,0.35)';
  ctx.fillRect(x0, y, (x1 - x0) * ease.inOut(draw), 2);
  for (let yr = from; yr <= to; yr++) {
    const a = ease.out(clamp(draw * (n + 3) - (yr - from)));
    if (a <= 0) continue;
    const big = hi && yr >= hi[0] && yr <= hi[1];
    ctx.globalAlpha = a * (dim.includes(yr) ? 0.35 : 1);
    ctx.fillStyle = big ? hiColor : 'rgba(232,233,230,0.6)';
    ctx.fillRect(X(yr) - 1, y - (big ? 26 : 14), 2, big ? 26 : 14);
    label(ctx, String(yr), X(yr), y + 54, big ? COLOR.paper : DIM, a * (dim.includes(yr) ? 0.4 : 1), { size: big ? 34 : 24, spacing: 1, weight: big ? 700 : 600, align: 'center' });
  }
  ctx.restore();
  for (const [yr, p, col] of marks) {
    if (p <= 0) continue;
    ctx.save();
    ctx.fillStyle = col ?? COLOR.red;
    ctx.globalAlpha = ease.out(p);
    ctx.beginPath(); ctx.arc(X(yr), y, 12 * ease.outExpo(p), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  return X;
}

// --- Perfil de la berlina (Lancer Evolution) ---
const SEDAN = [[452, -40], [458, -96], [436, -126], [190, -150], [70, -246], [-150, -252], [-292, -172], [-402, -166], [-446, -152], [-458, -96], [-452, -40]];
function drawSedan(t, { cx, cy, s = 1, draw = 1, dashed = false, rally = 0, color = COLOR.paper, alpha = 1, fill = true }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  const top = catmull(SEDAN, false, 6);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(-452, -40);
    ctx.lineTo(-280 - 86, -40); ctx.arc(-280, -70, 86, Math.PI + 0.35, -0.35, false);
    ctx.lineTo(300 - 86, -40); ctx.arc(300, -70, 86, Math.PI + 0.35, -0.35, false);
    ctx.lineTo(452, -40);
  };
  if (fill && draw >= 1) { path(); ctx.fillStyle = COLOR.ink2; ctx.fill(); }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / s;
  if (dashed) ctx.setLineDash([12 / s, 10 / s]);
  if (draw >= 1) { path(); ctx.stroke(); } else trace(ctx, poly([...top, [-452, -40], [452, -40]]), draw);
  ctx.setLineDash([]);
  // Ventanillas y puerta.
  ctx.globalAlpha = alpha * clamp(draw * 2 - 1);
  ctx.beginPath(); ctx.moveTo(176, -150); ctx.lineTo(64, -234); ctx.lineTo(-140, -238); ctx.lineTo(-270, -170); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40, -236); ctx.lineTo(-40, -50); ctx.moveTo(170, -150); ctx.lineTo(166, -52); ctx.moveTo(-240, -170); ctx.lineTo(-236, -60); ctx.stroke();
  // Equipamiento de rally: alerón, faldillas, toma de techo y faros auxiliares.
  if (rally > 0) {
    ctx.globalAlpha = alpha * ease.out(rally);
    ctx.strokeStyle = COLOR.red;
    ctx.lineWidth = 4 / s;
    ctx.beginPath(); ctx.moveTo(-436, -205); ctx.lineTo(-330, -212); ctx.moveTo(-420, -205); ctx.lineTo(-412, -166); ctx.moveTo(-345, -211); ctx.lineTo(-350, -168); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-180, -258); ctx.lineTo(-120, -262); ctx.lineTo(-110, -252); ctx.stroke();
    for (const x of [-200, 380]) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, 4); ctx.stroke(); }
    for (const x of [400, 430]) { ctx.beginPath(); ctx.arc(x, -112, 12, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
  // Ruedas.
  for (const x of [-280, 300]) {
    const a = ease.out(clamp(draw * 2 - 1)) * alpha;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    if (dashed) ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(cx + x * s, cy - 70 * s, 70 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + x * s, cy - 70 * s, 40 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// --- Vista frontal: Grupo A (estrecho, de serie) frente a World Rally Car (ensanchado) ---
function drawFrontCar(t, { cx, cy, s = 1, wide = 0, draw = 1, color = COLOR.paper, tag = null, tagColor = DIM }) {
  const kw = 1 + 0.34 * wide;
  const half = [[0, -300], [170, -292], [212, -236], [300 * (1 + 0.04 * wide), -178], [334 * kw, -150], [344 * kw, -70], [312 * kw, -30], [0, -30]];
  const pts = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [cx + x * s, cy + y * s]);
  ctx.save();
  ctx.globalAlpha = draw;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = COLOR.ink2; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 150 * s, cy - 286 * s); ctx.lineTo(cx + 150 * s, cy - 286 * s); ctx.lineTo(cx + 200 * s, cy - 222 * s); ctx.lineTo(cx - 200 * s, cy - 222 * s); ctx.closePath(); ctx.stroke();
  const tw = 255 * kw, tW = 78 * (1 + 0.25 * wide);
  ctx.fillStyle = COLOR.ink;
  for (const sd of [-1, 1]) { ctx.fillRect(cx + (sd * tw - tW / 2) * s, cy - 110 * s, tW * s, 110 * s); ctx.strokeRect(cx + (sd * tw - tW / 2) * s, cy - 110 * s, tW * s, 110 * s); }
  ctx.restore();
  dimLine(cx - 344 * kw * s, cx + 344 * kw * s, cy + 50, draw, color);
  if (tag) label(ctx, tag, cx, cy + 130, tagColor, draw, { size: 26, spacing: 7, weight: 700, align: 'center' });
}

// --- Planta del Evo: motor transversal delante, tres diferenciales y par a cada rueda ---
function drawEvoPlan(t, { cx, cy, s = 1, rot = -Math.PI / 2, draw = 1, torque = [0.25, 0.25, 0.25, 0.25], diffs = 0, flow = 0, grip = null, missing = -1, wheelOff = 0, oil = 0, labels = 0 }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const px = 1 / s;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR.paper;
  ctx.lineWidth = 3 * px;
  trace(ctx, body(0.25), draw);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2 * px;
  trace(ctx, CABIN, d2(draw, 0.3, 1));
  ctx.globalAlpha = 1;
  const fX = 290, rX = -300 * 1.05;
  const a = d2(draw, 0.5, 1);
  // Motor transversal y caja de cambios.
  if (a > 0) {
    ctx.globalAlpha = a;
    ctx.lineWidth = 2.4 * px;
    rr(ctx, 340, -120, 110, 200, 10); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(395, -90 + i * 46, 15, 0, Math.PI * 2); ctx.stroke(); }
    rr(ctx, 300, 90, 90, 70, 8); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Ejes.
  const shafts = [[[fX, -226], [fX, 226]], [[fX - 20, 0], [rX + 30, 0]], [[rX, -226], [rX, 226]]];
  ctx.save();
  ctx.globalAlpha = a * 0.6;
  ctx.lineWidth = 3 * px;
  for (const sh of shafts) { ctx.beginPath(); ctx.moveTo(...sh[0]); ctx.lineTo(...sh[1]); ctx.stroke(); }
  ctx.restore();
  if (flow > 0) {
    ctx.save();
    ctx.globalAlpha = flow;
    ctx.strokeStyle = COLOR.red;
    ctx.lineWidth = 7 * px;
    ctx.setLineDash([22, 18]);
    ctx.lineDashOffset = -t * 260;
    ctx.beginPath(); ctx.moveTo(fX - 20, 0); ctx.lineTo(rX + 30, 0); ctx.stroke();
    for (const [x, y, w] of [[fX, -1, torque[0]], [fX, 1, torque[1]], [rX, -1, torque[2]], [rX, 1, torque[3]]]) {
      ctx.lineWidth = (3 + 14 * w * 4) * px;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y * 200); ctx.stroke();
    }
    ctx.restore();
  }
  // Diferenciales: delantero, central (activo) y trasero (activo).
  if (diffs > 0) {
    [[fX, 0, 'D'], [0, 0, 'C'], [rX, 0, 'T']].forEach(([x, y], i) => {
      const k = ease.outExpo(clamp(diffs * 3 - i * 0.6));
      if (k <= 0) return;
      ctx.save();
      ctx.fillStyle = COLOR.ink;
      ctx.strokeStyle = i ? COLOR.ice : COLOR.paper;
      ctx.lineWidth = 4 * px;
      ctx.beginPath(); ctx.arc(x, y, 34 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (i) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + i); ctx.beginPath(); ctx.arc(x, y, 48 * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
  }
  // Ruedas, con su círculo de agarre opcional.
  const wheels = [[fX, -226], [fX, 226], [rX, -226], [rX, 226]];
  wheels.forEach(([x, y], i) => {
    const ap = d2(draw, 0.6 + i * 0.05, 0.9 + i * 0.025);
    if (ap <= 0 || i === missing) return;
    ctx.save();
    let ox = 0, oy = 0, rr2 = 0;
    if (i === 2 && wheelOff > 0) { const e = ease.out(wheelOff); ox = -260 * e; oy = -320 * e; rr2 = e * 4; }
    ctx.translate(x + ox, y + oy);
    ctx.rotate(rr2);
    ctx.globalAlpha = ap;
    rr(ctx, -75, -30, 150, 60, 14);
    ctx.fillStyle = COLOR.ink; ctx.fill();
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3 * px; ctx.stroke();
    ctx.restore();
    if (grip) {
      ctx.save();
      ctx.strokeStyle = grip[i] === Math.max(...grip) ? COLOR.ice : 'rgba(232,233,230,0.4)';
      ctx.lineWidth = 3 * px;
      ctx.globalAlpha = ap;
      ctx.beginPath(); ctx.arc(x, y + Math.sign(y) * 110, 40 + 90 * grip[i], 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  });
  if (missing >= 0) {
    const [x, y] = wheels[missing];
    ctx.save(); ctx.strokeStyle = COLOR.red; ctx.lineWidth = 3 * px; ctx.setLineDash([10, 8]);
    rr(ctx, x - 75, y - 30, 150, 60, 14); ctx.stroke(); ctx.restore();
  }
  // Mancha de aceite.
  if (oil > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(232,233,230,0.12)';
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const an = (k / 24) * Math.PI * 2; const r = (120 + 30 * noise1(k * 1.7)) * ease.out(oil); ctx.lineTo(rX - 40 + Math.cos(an) * r, -330 + Math.sin(an) * r * 0.6); }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// --- Pedalier: embrague, freno y acelerador; pie izquierdo en el freno ---
function drawPedals(t, { cx, cy, s = 1, brake = 0, throttle = 0, appear = 1, feet = 1 }) {
  const P = [['EMBRAGUE', -200, 0], ['FRENO', 0, brake], ['ACELERADOR', 200, throttle]];
  P.forEach(([name, x, press], i) => {
    const a = ease.out(clamp(appear * 3 - i * 0.4));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx + x * s, cy);
    ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -330 * s); ctx.lineTo(0, -60 * s + press * 50 * s); ctx.stroke();
    ctx.rotate(press * 0.12);
    ctx.fillStyle = i === 1 ? COLOR.yellow : i === 2 ? COLOR.red : COLOR.steel;
    ctx.beginPath(); ctx.roundRect(-55 * s, -60 * s + press * 50 * s, 110 * s, i === 2 ? 190 * s : 120 * s, 14 * s); ctx.fill();
    ctx.restore();
    label(ctx, name, cx + x * s, cy + 230 * s, i === 0 ? DIM : COLOR.paper, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  });
  // Pies: izquierdo en el freno, derecho en el acelerador.
  for (const [x, press, col, nm] of [[0, brake, COLOR.yellow, 'IZQUIERDO'], [200, throttle, COLOR.red, 'DERECHO']]) {
    const a = ease.out(feet) * appear;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx + x * s, cy + 40 * s + press * 50 * s);
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 48 * s, 110 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    label(ctx, nm, cx + x * s, cy - 380 * s, col, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
}

// Señales de acelerador y freno en el tiempo (acelerador a fondo, freno modulado).
function drawTraces(t, { x0 = 980, x1 = 1780, y0 = 300, h = 420, draw = 1 }) {
  ctx.save();
  ctx.fillStyle = 'rgba(232,233,230,0.2)';
  ctx.fillRect(x0, y0 + h, x1 - x0, 2); ctx.fillRect(x0, y0 - 20, 2, h + 20);
  ctx.restore();
  const thr = [], brk = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160, x = lerp(x0, x1, u);
    thr.push([x, y0 + h - h * 0.92 * clamp(u * 8)]);
    const b = 0.45 * Math.max(0, Math.sin(u * Math.PI * 5)) ** 1.5 * clamp((u - 0.12) * 6);
    brk.push([x, y0 + h - h * b]);
  }
  strokePath(thr, draw, COLOR.red, 6);
  strokePath(brk, draw, COLOR.yellow, 6);
  label(ctx, 'ACELERADOR · A FONDO', x0 + 20, y0 + 16, COLOR.red, draw, { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'FRENO · PIE IZQUIERDO', x0 + 20, y0 + h - 30, COLOR.yellow, clamp(draw * 2 - 0.5), { size: 22, spacing: 6, weight: 700 });
}

// --- Dos trazadas en una curva: el fuego (McRae) y el hielo (Mäkinen) ---
const ROAD = catmull([[200, 980], [520, 720], [760, 470], [1000, 330], [1260, 320], [1480, 430], [1640, 640], [1760, 900]], false, 10);
function drawCorner(t, { fire = 0, ice = 0, road = 1 }) {
  ctx.save();
  ctx.globalAlpha = road;
  ctx.strokeStyle = 'rgba(232,233,230,0.08)'; ctx.lineWidth = 220; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ROAD.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.restore();
  // Trazada de McRae: abierta, cruzada y larga; la de Mäkinen: ceñida y limpia.
  const off = (k, amt) => ROAD.map(([x, y], i) => {
    const [x2, y2] = ROAD[Math.min(i + 1, ROAD.length - 1)], [x1, y1] = ROAD[Math.max(i - 1, 0)];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const u = i / (ROAD.length - 1);
    const o = amt(u);
    return [x - (dy / L) * o, y + (dx / L) * o];
  });
  const fireP = off(0, (u) => 70 * Math.sin(u * Math.PI * 1.1 + 0.4));
  const iceP = off(0, (u) => -55 * Math.sin(u * Math.PI));
  strokePath(fireP, fire, COLOR.fire, 7);
  strokePath(iceP, ice, COLOR.ice, 5);
  // Coches a lo largo de cada trazada: los de McRae cruzados (deriva), los de Mäkinen alineados.
  const cars = (P, p, slip, col) => {
    const PP = poly(P);
    for (let k = 1; k <= 5; k++) {
      const u = k / 6;
      if (u > p) continue;
      const [x, y, an] = pointAt(PP, u);
      ctx.save(); ctx.translate(x, y); ctx.rotate(an + slip * Math.sin(u * Math.PI));
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.fillStyle = COLOR.ink;
      ctx.beginPath(); ctx.roundRect(-34, -17, 68, 34, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };
  cars(fireP, fire, 0.75, COLOR.fire);
  cars(iceP, ice, 0.05, COLOR.ice);
}

// --- Distancia a la meta: 300 metros ---
function drawFinish(t, { y = 640, p = 0, stop = 0, boom = 0 }) {
  const x0 = 200, xf = 1700, xs = lerp(x0, xf - 300, 1); // el coche de Sainz se para a 300 m (escala: 1 px = 1 m)
  ctx.save();
  ctx.fillStyle = 'rgba(232,233,230,0.3)'; ctx.fillRect(x0, y, (xf - x0) * ease.inOut(clamp(p * 1.5)), 2);
  // Bandera a cuadros.
  const fa = ease.out(clamp(p * 2 - 0.6));
  ctx.globalAlpha = fa;
  ctx.fillStyle = COLOR.paper; ctx.fillRect(xf, y - 170, 4, 170);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { if ((r + c) % 2) continue; ctx.fillRect(xf + 4 + c * 16, y - 170 + r * 16, 16, 16); }
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2; ctx.strokeRect(xf + 4, y - 170, 96, 64);
  ctx.restore();
  // Coche avanzando hasta pararse.
  const xc = lerp(x0, xs, ease.out(clamp(p * 1.3)));
  ctx.save();
  ctx.translate(xc, y - 40);
  ctx.fillStyle = COLOR.ink2; ctx.strokeStyle = boom > 0 ? COLOR.red : COLOR.paper; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-70, -26, 140, 52, 10); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (boom > 0) shock(xc + 40, y - 40, boom, 220);
  dimLine(xs, xf, y + 90, stop, COLOR.yellow);
  label(ctx, '300 m', (xs + xf) / 2, y + 160, COLOR.yellow, stop, { size: 44, spacing: 2, weight: 700, align: 'center' });
}

// --- Teléfono de hotel, en línea, sonando ---
function drawPhone(t, { cx, cy, s = 1, ring = 0, draw = 1 }) {
  const shake = ring > 0 ? Math.sin(t * 60) * 3 * ring : 0;
  ctx.save();
  ctx.translate(cx + shake, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3 / s; ctx.lineJoin = 'round';
  trace(ctx, poly([[-170, 120], [-120, -20], [120, -20], [170, 120], [-170, 120]]), draw);
  trace(ctx, poly(catmull([[-190, -60], [-150, -110], [0, -130], [150, -110], [190, -60]], false, 8)), d2(draw, 0.3, 1));
  ctx.globalAlpha = d2(draw, 0.5, 1);
  ctx.beginPath(); ctx.arc(0, 50, 46, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 10; k++) { const an = -Math.PI / 2 + (k / 10) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(an) * 32, 50 + Math.sin(an) * 32, 5, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  if (ring > 0) {
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 1.6 + k / 3) % 1);
      ctx.save();
      ctx.strokeStyle = `rgba(233,168,37,${(1 - ph) * ring})`; ctx.lineWidth = 3;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(cx, cy - 60 * s, (150 + ph * 140) * s, sd > 0 ? -0.5 : Math.PI - 0.5 + 0, sd > 0 ? 0.5 : Math.PI + 0.5); ctx.stroke(); }
      ctx.restore();
    }
  }
}

// --- Fusión piloto y máquina ---
function drawFusion(t, { cx, cy, p = 0, appear = 1 }) {
  const d = lerp(320, 0, ease.inOut(p));
  for (const [sd, name, col] of [[-1, 'PILOTO', COLOR.ice], [1, 'MÁQUINA', COLOR.red]]) {
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx + sd * d, cy, 190, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    label(ctx, name, cx + sd * (d + 40), cy + 10, col, appear * (1 - ease.inOut(clamp(p * 1.4 - 0.3))), { size: 30, spacing: 8, weight: 700, align: 'center' });
  }
  if (p > 0.85) {
    const k = ease.outExpo((p - 0.85) / 0.15);
    ctx.save(); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 2; ctx.globalAlpha = k;
    ctx.beginPath(); ctx.arc(cx, cy, 190 + 40 * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}

// --- Editor genérico de calibración (interfaz inventada con los colores del canal) ---
function drawCalib(t, { x = 860, y = 200, w = 920, h = 680, appear = 1, bend = 0 }) {
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.fillStyle = COLOR.ink2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
  ctx.fillStyle = 'rgba(232,233,230,0.06)'; ctx.fillRect(x, y + 70, w, 2);
  ctx.restore();
  label(ctx, 'DIFERENCIAL CENTRAL', x + 40, y + 46, COLOR.paper, appear, { size: 22, spacing: 6, weight: 700 });
  for (let k = 0; k < 3; k++) { ctx.save(); ctx.globalAlpha = appear; ctx.fillStyle = k === 0 ? COLOR.red : 'rgba(232,233,230,0.25)'; ctx.beginPath(); ctx.arc(x + w - 50 - k * 34, y + 36, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  // Rejilla y curva con puntos de control que se mueven.
  const gx = x + 60, gy = y + 120, gw = w - 120, gh = h - 200;
  ctx.save();
  ctx.globalAlpha = appear * 0.5;
  ctx.strokeStyle = 'rgba(232,233,230,0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(gx + (gw * i) / 8, gy); ctx.lineTo(gx + (gw * i) / 8, gy + gh); ctx.stroke(); }
  for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(gx, gy + (gh * i) / 5); ctx.lineTo(gx + gw, gy + (gh * i) / 5); ctx.stroke(); }
  ctx.restore();
  const cps = [0, 0.18, 0.45, 0.7, 1].map((u, i) => [gx + gw * u, gy + gh * (0.85 - 0.6 * u - (i === 2 ? 0.28 * bend : 0) - (i === 3 ? 0.12 * bend : 0))]);
  const curve = catmull(cps, false, 12);
  strokePath(curve, appear, COLOR.ice, 5);
  cps.forEach(([px2, py2], i) => { ctx.save(); ctx.globalAlpha = appear; ctx.fillStyle = i === 2 ? COLOR.red : COLOR.paper; ctx.beginPath(); ctx.arc(px2, py2, i === 2 ? 11 : 7, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
  label(ctx, 'BLOQUEO', gx - 10, gy - 16, DIM, appear, { size: 20, spacing: 5, weight: 600 });
  label(ctx, 'ÁNGULO DE VOLANTE', gx + gw, gy + gh + 40, DIM, appear, { size: 20, spacing: 5, weight: 600, align: 'right' });
}

// Marcas de victoria (24 en el mundial).
function drawTally(t, { x0 = 140, y0 = 520, n = 24, p = 0, cols = 12 }) {
  for (let i = 0; i < n; i++) {
    const a = ease.outExpo(clamp(p * n * 1.1 - i));
    if (a <= 0) continue;
    const c = i % cols, r = Math.floor(i / cols);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = COLOR.red;
    ctx.fillRect(x0 + c * 46, y0 + r * 120 - 80 * a, 22, 80 * a);
    ctx.restore();
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

// Tramos del vídeo de archivo: fotogramas extraídos, elegidos por tiempo (determinista).
export const CLIP_N = { intro: 181, aerial: 180, slide: 121, front: 136, road: 300, face: 300 };
function clipImg(seg, local) {
  const k = clamp(Math.floor(local * CLIP_FPS), 0, CLIP_N[seg] - 1);
  return A.clips?.[seg]?.[k] ?? null;
}
function drawSeg(seg, local, { zoom = 1.03, fx = 0.5, fy = 0.5, dark = 0, src } = {}) {
  const im = clipImg(seg, local);
  if (!im) { bg(); return; }
  drawCover(ctx, im, 0, 0, W, H, { zoom, fx, fy, src });
  if (dark > 0) { ctx.fillStyle = `rgba(11,12,14,${dark})`; ctx.fillRect(0, 0, W, H); }
  vignette(ctx, 0, 0, W, H, 0.55);
}
// Sombra inferior neutra para leer los rótulos sobre la imagen de archivo.
function scrimB(h = 560, a = 0.8) {
  const g = ctx.createLinearGradient(0, H - h, 0, H);
  g.addColorStop(0, 'rgba(11,12,14,0)');
  g.addColorStop(1, `rgba(11,12,14,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, H - h, W, h);
}

// Plano de archivo con titular.
const kClip = (o) => { const f = (t, s0, s1) => {
  bg();
  drawSeg(o.seg, (o.from ?? 0) + (t - s0) * (o.speed ?? 1), { zoom: lerp(o.z?.[0] ?? 1.04, o.z?.[1] ?? 1.1, ease.inOut(span(t, s0, s1))), fx: o.fx, fy: o.fy, dark: o.dark ?? 0.08 });
  scrimB();
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
}; f.seg = o.seg; return f; };
// Foto como plano 3D con titular.
const kPhoto3 = (o) => (t, s0, s1) => {
  photo3D(o.img, t, s0, s1, { fx: o.fx ?? 0.5, fy: o.fy ?? 0.5, yaw: o.yaw ?? [-0.06, 0.03], zoom: o.zoom ?? [1.12, 1.03], dark: o.dark ?? 0.38, gray: o.gray });
  titleBlock(t, o, s0);
  o.extra?.(t, s0, s1);
};

// ---------------------------------------------------------------------------
// Planos singulares.

// Entrada: logotipo y debajo «Tommi Mäkinen».
function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 800, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.2))));
  ctx.drawImage(lg, W / 2 - w / 2, 420 - h / 2, w, h);
  ctx.restore();
  revealText(ctx, 'Tommi Mäkinen', W / 2, 880, FONT.display(700, 130), COLOR.paper, prog(t, 0.55, 1.25), { align: 'center', stagger: 0.03, spacing: 2 });
  stripesH(ctx, 920, 10, prog(t, 0.85, 1.55), 0, { x0: W / 2 - 240, x1: W / 2 + 240 });
}

// El tramo de 2:03 a 2:09 del vídeo del cliente. El encuadre se abre cuando desaparece el panel de la cadena.
function sIntro(t, s0) {
  bg();
  const local = (t - s0) * 0.9;
  const srcT = 123 + local;
  const k = ease.inOut(prog(srcT, 124.35, 125.0));
  const src = { x: lerp(320, 162, k), y: lerp(76, 80, k), w: lerp(640, 810, k), h: lerp(360, 456, k) };
  drawSeg('intro', local, { src, zoom: 1, dark: 0.05 });
  scrimB();
  lines(t, ['Campeones.'], M, 975, 0, 130, V(0) + 3.0, { exit: [V(1) + 0.4, V(1) + 0.7] });
  lines(t, ['Leyendas.'], M, 975, 0, 130, V(1) + 0.75, { exit: [s0 + 6.5, s0 + 6.7] });
}

// Gigantes: Colin McRae y Carlos Sainz.
function sGiants(t, s0) {
  bg();
  tag(t, 'GIGANTES COMO', M, 400, s0 + 0.1);
  lines(t, ['Colin McRae'], M, 560, 0, 170, V(4) + 3.5);
  lines(t, ['Carlos Sainz'], M, 760, 0, 170, V(4) + 4.6);
  accent(t, M, 820, V(4) + 4.9, 420, 10);
}

// Un granjero finlandés: su cara, en el archivo.
function sFace(t, s0, s1) {
  bg();
  drawSeg('face', 0.5 + (t - s0) * 0.75, { zoom: lerp(1.05, 1.12, ease.inOut(span(t, s0, s1))), fx: 0.6, fy: 0.45, dark: 0.12 });
  scrimB(640, 0.88);
  tag(t, 'UN GRANJERO FINLANDÉS DE POCAS PALABRAS', M, 760, V(6) + 0.1);
  lines(t, ['Mirada de hielo.'], M, 880, 0, 110, V(7) + 0.9, { colors: [COLOR.ice] });
  lines(t, ['Pie derecho de plomo.'], M, 990, 0, 110, V(7) + 2.1);
}

// Cuatro mundiales consecutivos (avance).
function sFour(t, s0) {
  bg();
  slam(t, '4', W / 2 - 330, 720, s0, 520, COLOR.red, 'center');
  tag(t, 'MUNDIALES CONSECUTIVOS', W / 2 - 80, 430, s0 + 0.15, COLOR.yellow);
  ['1996', '1997', '1998', '1999'].forEach((y, i) => {
    const tt = s0 + 0.35 + i * 0.25;
    revealText(ctx, y, W / 2 - 80, 560 + i * 110, FONT.display(700, 100), COLOR.paper, prog(t, tt, tt + 0.4), { stagger: 0.04 });
  });
}

// Título del documental: retrato y nombre.
function sTitle(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  photo('tommiJoven', 1060, 0, 860, H, { zoom: lerp(1.12, 1.02, ease.out(u)), fx: 0.5, fy: 0.35 }, { vig: 0.35 });
  tag(t, 'EL GRAN', M, 420, V(13) - 0.1);
  lines(t, ['Tommi', 'Mäkinen'], M, 590, 170, 190, V(13) + 0.35, { maxW: 860, colors: [COLOR.paper, COLOR.red] });
  accent(t, M, 840, V(13) + 1.0, 420, 10);
}

// No fue una línea recta.
const PATH = catmull([[140, 860], [360, 760], [470, 880], [640, 600], [760, 720], [900, 470], [1040, 640], [1220, 380], [1380, 520], [1560, 250], [1780, 300]], false, 12);
function sPath(t, s0) {
  bg(); dots(0.06);
  strokePath(PATH, ease.inOut(prog(t, s0 + 0.2, s0 + 2.6)), COLOR.ice, 5);
  strokePath([[140, 860], [1780, 300]], prog(t, s0 + 0.2, s0 + 1.0) * 0.999, 'rgba(232,233,230,0.18)', 2, [10, 10]);
  tag(t, 'LA HISTORIA DE MÄKINEN', M, 170, s0 + 0.1);
  lines(t, ['No fue una línea recta'], M, 290, 0, 100, V(15) + 1.2);
}

// Nacido en Puuppola, Finlandia. Un piloto tardío.
function sMap(t, s0) {
  bg(); dots(0.05);
  const p = drawFinland(t, { cx: 1300, cy: 540, k: 80, draw: ease.inOut(prog(t, s0, s0 + 1.6)), dot: prog(t, V(16) + 0.4, V(16) + 0.9), ring: prog(t, V(16) + 0.5, V(16) + 1.7), label: prog(t, V(16) + 0.7, V(16) + 1.2) });
  if (p) label(ctx, 'PUUPPOLA', p[0] + 190, p[1] + 9, COLOR.paper, prog(t, V(16) + 0.9, V(16) + 1.4), { size: 28, spacing: 7, weight: 700 });
  label(ctx, 'FINLANDIA', 1300, 1010, DIM, prog(t, V(17), V(17) + 0.5), { size: 26, spacing: 10, weight: 700, align: 'center' });
  tag(t, 'NACIDO EN PUUPPOLA, FINLANDIA', M, 560, V(16));
  lines(t, ['Un piloto', 'tardío'], M, 700, 120, 130, V(18) + 0.6, { maxW: 700 });
}

// Tractores y maquinaria forestal: bestias pesadas sobre hielo y barro.
function sTractor(t, s0) {
  bg(); dots(0.05);
  const gy = 860;
  ctx.fillStyle = 'rgba(232,233,230,0.3)';
  ctx.fillRect(900, gy + 2, 960 * ease.inOut(prog(t, s0, s0 + 1)), 2);
  drawTractor(t, { cx: 1300, cy: gy - 180, s: 1.0, draw: ease.inOut(prog(t, s0 + 0.2, s0 + 2.0)), rock: prog(t, s0 + 1.8, s0 + 2.5) });
  tag(t, 'TRABAJABA CONDUCIENDO', M, 230, s0 + 0.2);
  lines(t, ['Tractores y', 'maquinaria forestal'], M, 360, 120, 110, V(19) + 0.9, { maxW: 760 });
  label(ctx, 'Bestias pesadas sobre hielo y barro', M, 610, COLOR.paper, prog(t, V(20) + 2.6, V(20) + 3.1), { size: 44, spacing: 0, weight: 600 });
  gripBars(t, M, 720, prog(t, V(20) + 3.2, V(20) + 4.4), [['AGARRE EN BARRO', 0.55, COLOR.fire], ['AGARRE EN HIELO', 0.16, COLOR.ice]]);
}

// Categorías inferiores: años sin resultados.
function sYears(t, s0) {
  bg();
  drawRuler(t, { from: 1985, to: 1993, y: 720, draw: ease.out(prog(t, s0, s0 + 1.6)) });
  tag(t, 'DURANTE AÑOS', M, 260, s0 + 0.1);
  lines(t, ['Categorías inferiores'], M, 400, 0, 130, V(22) + 0.2);
  label(ctx, 'Buscando patrocinios y arañando oportunidades', M, 490, DIM, prog(t, V(23) + 0.2, V(23) + 0.7), { size: 44, spacing: 0, weight: 600 });
}

// 1994: todo cambió.
function s1994(t, s0) {
  bg();
  slam(t, '1994', W / 2, 640, V(24) + 0.7, 330, COLOR.paper, 'center');
  stripesH(ctx, 700, 14, prog(t, V(24) + 0.9, V(24) + 1.6), 0, { x0: W / 2 - 330, x1: W / 2 + 330 });
  label(ctx, 'Todo cambió', W / 2, 830, COLOR.red, prog(t, V(25) + 0.1, V(25) + 0.6), { size: 60, spacing: 0, weight: 700, align: 'center' });
}

// La victoria en los 1000 Lagos, en el mapa.
function sVictory(t, s0, s1) {
  bg();
  const u = ease.inOut(span(t, s0, s1));
  const pv = drawFinland(t, { cx: lerp(1130, 1150, u), cy: lerp(180, 150, u), k: lerp(200, 215, u), draw: 1, dot: 1, ring: prog(t, V(29) + 2.0, V(29) + 3.2), label: prog(t, s0 + 0.4, s0 + 0.9) });
  if (pv) label(ctx, 'RALLY DE LOS 1000 LAGOS', pv[0] + 190, pv[1] + 9, COLOR.paper, prog(t, s0 + 0.6, s0 + 1.1), { size: 26, spacing: 6, weight: 700 });
  tag(t, 'TOMMI NO SOLO PARTICIPÓ', M, 330, s0 + 0.1);
  lines(t, ['Aplastó a la', 'competencia'], M, 470, 130, 130, V(29) + 0.3, { maxW: 760 });
  slam(t, 'Victoria', M, 820, V(29) + 2.0, 170, COLOR.red);
}

// Andrew Cowan.
function sCowan(t, s0) {
  bg();
  tag(t, 'EL LEGENDARIO JEFE DE EQUIPO DE RALLIART', M, 420, V(33));
  lines(t, ['Andrew Cowan'], M, 590, 0, 190, V(34) - 0.05);
  accent(t, M, 650, V(34) + 0.4, 420, 10);
  label(ctx, 'Supo exactamente a quién necesitaba fichar', M, 760, COLOR.paper, prog(t, V(35) + 0.8, V(35) + 1.3), { size: 46, spacing: 0, weight: 600 });
  label(ctx, 'para su equipo oficial Mitsubishi', M, 830, COLOR.red, prog(t, V(35) + 2.6, V(35) + 3.1), { size: 46, spacing: 0, weight: 700 });
}

// Piloto y máquina se fusionaron.
function sFusion(t, s0) {
  bg(); dots(0.05);
  drawFusion(t, { cx: 1330, cy: 560, p: prog(t, V(39) + 0.4, V(39) + 3.0), appear: ease.out(prog(t, s0, s0 + 0.8)) });
  lines(t, ['La historia se', 'vuelve mágica'], M, 470, 120, 120, V(38) + 1.4, { maxW: 700, exit: [V(39) - 0.2, V(39) + 0.1] });
  tag(t, 'PILOTO Y MÁQUINA', M, 340, V(39) + 0.1);
  lines(t, ['Un solo ente'], M, 470, 0, 130, V(39) + 3.0, { colors: [COLOR.paper] });
}

// Grupo A frente a World Rally Car.
function sWRC(t, s0) {
  bg(); dots(0.05);
  drawFrontCar(t, { cx: 500, cy: 850, s: 0.88, wide: 0, draw: ease.out(prog(t, s0 + 0.2, s0 + 1.0)), color: COLOR.red, tag: 'GRUPO A', tagColor: COLOR.red });
  drawFrontCar(t, { cx: 1420, cy: 850, s: 0.88, wide: ease.inOut(prog(t, V(41) + 4.6, V(41) + 6.0)), draw: ease.out(prog(t, V(41) + 0.8, V(41) + 1.6)), color: COLOR.steel, tag: 'WORLD RALLY CAR', tagColor: DIM });
  tag(t, 'SUBARU Y FORD EMPEZABAN A CONSTRUIR LOS NUEVOS', M, 150, V(41) + 0.2);
  lines(t, ['World Rally Cars'], M, 270, 0, 100, V(41) + 2.2);
  label(ctx, 'Prototipos con mayor libertad técnica y chasis ensanchados', M, 350, DIM, prog(t, V(41) + 4.2, V(41) + 4.7), { size: 40, spacing: 0, weight: 600 });
}

// Fieles al Grupo A: la carrocería del coche de calle.
function sStreet(t, s0) {
  bg(); dots(0.05);
  const road = ease.inOut(prog(t, V(43) + 0.4, V(43) + 1.4));
  drawSedan(t, { cx: 1120, cy: 940, s: 1.3, draw: ease.inOut(prog(t, s0 + 0.1, s0 + 1.5)), rally: prog(t, s0 + 1.2, s0 + 2.0) });
  if (road > 0) drawSedan(t, { cx: 1120, cy: 940, s: 1.3, draw: 1, dashed: true, color: COLOR.ice, alpha: road, fill: false });
  label(ctx, 'COCHE DE CALLE', 1120, 1020, COLOR.ice, road, { size: 24, spacing: 7, weight: 700, align: 'center' });
  tag(t, 'MITSUBISHI Y MÄKINEN', M, 170, s0 + 0.1);
  lines(t, ['Fieles al Grupo A'], M, 290, 0, 110, V(42) + 1.6, { exit: [V(43) - 0.2, V(43) + 0.1] });
  lines(t, ['Carrocería del coche de calle'], M, 290, 0, 100, V(43) + 0.7, { colors: [COLOR.paper] });
}

// El motor 4G63, sobre la foto del cliente.
function sEngine(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  const map = photo('motor4g63', 0, 0, W, H, { zoom: lerp(1.08, 1.0, ease.out(u)), fx: 0.5, fy: 0.5 }, { dark: 0.42, vig: 0.6 });
  if (map) {
    const im = A.motor4g63;
    const [ax, ay] = map(im.width * 0.55, im.height * 0.22);
    const [bx, by] = map(im.width * 0.66, im.height * 0.62);
    callout(t, ax, ay, ax + 300, ay - 70, 'CULATA 4G63', V(46) + 2.6, COLOR.yellow);
    callout(t, bx, by, bx + 260, by + 120, 'TURBO', V(46) + 3.8, COLOR.yellow);
  }
  scrimB(600, 0.85);
  tag(t, 'BAJO EL CAPÓ LATÍA EL INDESTRUCTIBLE', M, 860, s0 + 0.1);
  lines(t, ['Motor 4G63 turboalimentado'], M, 975, 0, 110, V(46) + 2.0);
}

// Diferenciales activos: la planta del Evo tumbada en perspectiva.
function sDiffs(t, s0, s1) {
  const split = 0.5 + 0.18 * Math.sin((t - s0) * 1.6);
  const L = toLayer('p', () => {
    bg(); dots(0.08);
    drawEvoPlan(t, { cx: 1140, cy: 560, s: 0.8, draw: ease.inOut(prog(t, s0, s0 + 1.4)), diffs: prog(t, V(48) + 1.6, V(48) + 2.6), flow: prog(t, V(48) + 2.2, V(48) + 3.0),
      torque: [0.5 * split * 0.5 + 0.1, 0.5 * split * 0.5 + 0.1, 0.5 * (1 - split) * 0.5 + 0.12, 0.5 * (1 - split) * 0.5 + 0.12] });
  });
  bg();
  planeX(L, lerp(0.62, 0.48, ease.out(span(t, s0, s1))), { w: W * 1.1, h: H * 1.1, cy: 600, z: 40 });
  tag(t, 'BAJO EL CHASIS', M, 150, s0 + 0.1);
  lines(t, ['Diferenciales activos'], M, 270, 0, 110, V(48) + 2.3);
  label(ctx, 'que rozaban la brujería', M, 340, COLOR.ice, prog(t, V(48) + 3.4, V(48) + 3.9), { size: 40, spacing: 0, weight: 600 });
}

// Tommi calibra la electrónica: que el coche rotara como él quería.
function sCalib(t, s0) {
  bg(); dots(0.05);
  const bend = ease.inOut(prog(t, V(49) + 1.2, V(49) + 3.2));
  drawCalib(t, { appear: ease.out(prog(t, s0 + 0.1, s0 + 0.7)), bend });
  drawEvoPlan(t, { cx: 460, cy: 760, s: 0.32, rot: -Math.PI / 2 + 0.55 * bend * Math.sin((t - s0) * 1.2), draw: 1, diffs: 1 });
  tag(t, 'TOMMI AYUDÓ A CALIBRAR LA ELECTRÓNICA', M, 230, s0 + 0.1);
  lines(t, ['Que el coche rotara', 'como él quería'], M, 350, 110, 100, V(49) + 2.4, { maxW: 680 });
}

// De 1996 a 1999: la tiranía.
function sTyranny(t, s0) {
  bg();
  drawRuler(t, { from: 1994, to: 2003, y: 700, draw: ease.out(prog(t, s0, s0 + 1.2)), hi: t > V(52) + 0.6 ? [1996, 1999] : null,
    marks: [1996, 1997, 1998, 1999].map((y, i) => [y, prog(t, V(52) + 0.6 + i * 0.3, V(52) + 1.0 + i * 0.3)]) });
  tag(t, 'DE 1996 A 1999', M, 300, V(52));
  lines(t, ['Una tiranía'], M, 440, 0, 150, V(53) + 1.2, { colors: [COLOR.red] });
}

// Cuatro campeonatos del mundo consecutivos: un récord.
function sRecord(t, s0) {
  bg();
  tag(t, 'CUATRO CAMPEONATOS DEL MUNDO CONSECUTIVOS', M, 300, s0 + 0.05);
  ['1996', '1997', '1998', '1999'].forEach((y, i) => slam(t, y, M + i * 430, 600, s0 + i * 0.5, 165, i === 3 ? COLOR.red : COLOR.paper));
  stripesH(ctx, 660, 12, prog(t, s0 + 1.9, s0 + 2.6), 0, { x0: M, x1: M + 1640 });
  label(ctx, 'Un récord que nadie había logrado antes', M, 790, COLOR.paper, prog(t, V(55) + 0.1, V(55) + 0.6), { size: 52, spacing: 0, weight: 600 });
}

// El fuego contra el hielo.
function sFireIce(t, s0) {
  bg();
  ctx.fillStyle = 'rgba(232,233,230,0.14)';
  ctx.fillRect(W / 2 - 1, 260, 2, 560 * ease.inOut(prog(t, s0, s0 + 0.6)));
  revealText(ctx, 'Fuego', W / 2 - 80, 600, FONT.display(900, 230), COLOR.fire, prog(t, V(57) + 1.3, V(57) + 1.8), { align: 'right', stagger: 0.04 });
  revealText(ctx, 'Hielo', W / 2 + 80, 600, FONT.display(900, 230), COLOR.ice, prog(t, V(57) + 2.2, V(57) + 2.7), { stagger: 0.04 });
  label(ctx, 'COLIN McRAE', W / 2 - 80, 700, DIM, prog(t, V(57) + 1.6, V(57) + 2.0), { size: 26, spacing: 8, weight: 700, align: 'right' });
  label(ctx, 'TOMMI MÄKINEN', W / 2 + 80, 700, DIM, prog(t, V(57) + 2.5, V(57) + 2.9), { size: 26, spacing: 8, weight: 700 });
}

// Dos trazadas en la misma curva.
function sCorner(t, s0) {
  bg(); dots(0.04);
  drawCorner(t, { road: ease.out(prog(t, s0, s0 + 0.6)), fire: ease.inOut(prog(t, V(58) + 0.3, V(59) + 1.6)), ice: ease.inOut(prog(t, V(60) + 0.2, V(61) + 1.0)) });
  label(ctx, 'McRAE', M, 200, COLOR.fire, prog(t, V(58), V(58) + 0.5), { size: 30, spacing: 8, weight: 700 });
  label(ctx, 'Puro espectáculo, derrapes largos', M, 260, COLOR.paper, prog(t, V(58) + 0.4, V(58) + 0.9), { size: 44, spacing: 0, weight: 600 });
  label(ctx, 'MÄKINEN', M, 380, COLOR.ice, prog(t, V(60), V(60) + 0.5), { size: 30, spacing: 8, weight: 700 });
  label(ctx, 'La precisión nórdica, la eficiencia brutal', M, 440, COLOR.paper, prog(t, V(60) + 0.4, V(60) + 0.9), { size: 44, spacing: 0, weight: 600 });
}

// 1998, frente a Carlos Sainz.
function s1998(t, s0) {
  bg();
  tag(t, 'EL CLÍMAX DE ESTA LOCURA', W / 2, 360, s0 + 0.1, COLOR.yellow, { align: 'center' });
  revealText(ctx, '1998', W / 2, 640, FONT.display(900, 300), COLOR.paper, prog(t, V(62) + 2.0, V(62) + 2.6), { align: 'center', stagger: 0.05 });
  label(ctx, 'El Mundial frente a Carlos Sainz', W / 2, 780, COLOR.paper, prog(t, V(62) + 3.6, V(62) + 4.1), { size: 52, spacing: 0, weight: 600, align: 'center' });
}

// Gran Bretaña: la mancha de aceite y la rueda arrancada.
function sOil(t, s0, s1) {
  const off = prog(t, V(65) + 1.6, V(65) + 2.6);
  const L = toLayer('p', () => {
    bg(); dots(0.08);
    drawEvoPlan(t, { cx: 1140, cy: lerp(640, 560, ease.out(prog(t, s0, V(65) + 1.6))), s: 0.72, draw: 1, oil: prog(t, V(65) + 0.6, V(65) + 1.4), wheelOff: off });
  });
  bg();
  planeX(L, 0.5, { w: W * 1.1, h: H * 1.1, cy: 620, z: 40 });
  tag(t, 'EL ÚLTIMO RALLY DEL AÑO · GRAN BRETAÑA', M, 150, s0 + 0.1);
  lines(t, ['Una mancha de aceite'], M, 270, 0, 100, V(65) + 0.9, { exit: [V(66) - 0.6, V(66) - 0.3] });
  lines(t, ['Retirado'], M, 270, 0, 120, V(66) - 0.3, { colors: [COLOR.red] });
}

// A 300 metros de la meta.
function sFinish(t, s0) {
  bg(); dots(0.04);
  const stop = prog(t, V(67) + 1.6, V(67) + 2.1);
  drawFinish(t, { y: 700, p: prog(t, s0 + 0.1, V(67) + 1.6), stop, boom: prog(t, V(68) + 0.2, V(68) + 0.9) });
  tag(t, 'CARLOS SAINZ · TOYOTA COROLLA', M, 230, s0 + 0.1);
  lines(t, ['A 300 metros de la meta'], M, 360, 0, 110, V(67) + 1.0);
}

// El teléfono del hotel.
function sPhone(t, s0) {
  bg(); dots(0.04);
  drawPhone(t, { cx: 1340, cy: 600, s: 1.2, draw: ease.inOut(prog(t, s0, s0 + 1.4)), ring: prog(t, V(71) + 0.5, V(71) + 0.9) * (1 - prog(t, V(71) + 3.0, V(71) + 3.4)) });
  tag(t, 'MÄKINEN YA ESTABA EN SU HOTEL', M, 340, s0 + 0.1);
  lines(t, ['Haciendo las maletas'], M, 470, 0, 110, V(70) + 0.8, { maxW: 760, exit: [V(71) - 0.2, V(71) + 0.1] });
  lines(t, ['Una llamada', 'telefónica'], M, 470, 120, 120, V(71) + 0.6, { maxW: 760, colors: [COLOR.paper, COLOR.yellow] });
}

// Tricampeón del mundo.
function sTriple(t, s0) {
  bg();
  tag(t, 'SENTADO EN LA CAMA DE SU HABITACIÓN', W / 2, 330, BREAKS.triple - 0.4, COLOR.yellow, { align: 'center' });
  slam(t, 'Tricampeón', W / 2, 600, BREAKS.triple, 250, COLOR.paper, 'center');
  label(ctx, 'del mundo', W / 2, 720, COLOR.red, prog(t, BREAKS.triple + 0.3, BREAKS.triple + 0.8), { size: 70, spacing: 0, weight: 700, align: 'center' });
  ['1996', '1997', '1998'].forEach((y, i) => label(ctx, y, W / 2 + (i - 1) * 200, 860, i === 2 ? COLOR.paper : DIM, prog(t, BREAKS.triple + 0.6 + i * 0.15, BREAKS.triple + 1.0 + i * 0.15), { size: 40, spacing: 2, weight: 700, align: 'center' }));
}

// El pie izquierdo en el freno.
function sPedals(t, s0) {
  bg(); dots(0.04);
  const ph = (t - s0);
  drawPedals(t, { cx: 1300, cy: 620, s: 1.0, appear: ease.out(prog(t, s0, s0 + 0.8)), feet: prog(t, s0 + 0.8, s0 + 1.4), throttle: ease.out(prog(t, s0 + 1.2, s0 + 1.6)), brake: 0.5 * Math.max(0, Math.sin(ph * 4.5)) * prog(t, s0 + 1.8, s0 + 2.2) });
  tag(t, 'UN MAESTRO ABSOLUTO DE LA TÉCNICA DEL', M, 400, s0 + 0.1);
  lines(t, ['Pie izquierdo', 'en el freno'], M, 540, 130, 130, V(76) + 2.3, { maxW: 700, colors: [COLOR.yellow, COLOR.paper] });
}

// Acelerador a fondo, freno modulado: equilibrar el peso en pleno vuelo.
function sTraces(t, s0) {
  bg(); dots(0.04);
  drawTraces(t, { x0: 980, x1: 1780, y0: 260, h: 520, draw: ease.inOut(prog(t, s0 + 0.2, V(77) + 4.5)) });
  tag(t, 'ACELERABA A FONDO CON EL DERECHO', M, 300, s0 + 0.1);
  lines(t, ['Equilibrar el peso', 'en pleno vuelo'], M, 440, 120, 115, V(77) + 3.4, { maxW: 760 });
}

// La tracción a la rueda que más agarre tenía.
function sGrip(t, s0, s1) {
  const ph = Math.floor((t - s0) / 1.6) % 4;
  const grips = [[0.9, 0.4, 0.5, 0.3], [0.4, 0.5, 0.95, 0.3], [0.3, 0.9, 0.4, 0.5], [0.5, 0.3, 0.4, 0.9]][ph];
  const tq = grips.map((g) => (g === Math.max(...grips) ? 0.55 : 0.15));
  const L = toLayer('p', () => {
    bg(); dots(0.08);
    drawEvoPlan(t, { cx: 1140, cy: 520, s: 0.58, draw: 1, diffs: 1, flow: 1, grip: grips, torque: tq });
  });
  bg();
  planeX(L, 0.52, { w: W * 1.1, h: H * 1.1, cy: 640, z: 40 });
  tag(t, 'LOS DIFERENCIALES ACTIVOS ENVIABAN LA TRACCIÓN', M, 150, s0 + 0.1);
  lines(t, ['A la rueda que más agarre tenía'], M, 270, 0, 100, V(78) + 3.8);
}

// En tres ruedas.
function sThree(t, s0) {
  const L = toLayer('p', () => {
    bg(); dots(0.08);
    drawEvoPlan(t, { cx: 1140, cy: 520, s: 0.64, draw: 1, missing: 2, flow: 1, torque: [0.3, 0.3, 0, 0.3] });
  });
  bg();
  planeX(L, 0.5, { w: W * 1.1, h: H * 1.1, cy: 620, z: 40 });
  tag(t, 'LO HEMOS VISTO LLEGAR A META', M, 150, s0 + 0.1);
  lines(t, ['En tres ruedas'], M, 270, 0, 120, V(82) + 1.2, { colors: [COLOR.paper] });
}

// Una sola orden: máxima velocidad hasta la línea de meta.
function sOrder(t, s0) {
  bg();
  tag(t, 'EL CEREBRO DE MÄKINEN SOLO ENTENDÍA UNA ORDEN', M, 420, V(86));
  lines(t, ['Máxima velocidad', 'hasta la línea de meta'], M, 580, 140, 140, V(87) + 0.2, { colors: [COLOR.paper, COLOR.red] });
  const p = ease.inOut(prog(t, V(87) + 0.8, V(87) + 2.4));
  ctx.fillStyle = 'rgba(232,233,230,0.3)';
  ctx.fillRect(M, 870, 1640 * p, 3);
  ctx.fillStyle = COLOR.paper;
  if (p > 0.98) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) if ((r + c) % 2 === 0) ctx.fillRect(M + 1640 - 30 + c * 14, 840 + r * 14 + 2, 14, 14);
}

// El final del Grupo A.
function sEraEnd(t, s0) {
  bg();
  const X = drawRuler(t, { from: 1993, to: 2003, y: 700, draw: ease.out(prog(t, s0, s0 + 1.2)), dim: [] });
  const k = ease.inOut(prog(t, s0 + 0.6, s0 + 1.6));
  ctx.save();
  ctx.fillStyle = COLOR.red; ctx.globalAlpha = 0.9 * k * (1 - 0.6 * prog(t, V(89) + 0.6, V(89) + 1.4));
  ctx.fillRect(X(1995), 650, (X(2000) - X(1995)) * k, 12);
  ctx.restore();
  label(ctx, 'GRUPO A', (X(1995) + X(2000)) / 2, 620, COLOR.red, k, { size: 26, spacing: 8, weight: 700, align: 'center' });
  tag(t, 'CON LA LLEGADA DEL NUEVO MILENIO', M, 260, s0 + 0.1);
  lines(t, ['El milagro del Grupo A', 'llegó a su fin'], M, 380, 110, 100, V(89) + 0.6, { maxW: 1100 });
}

// Peugeot 206: la era de Mitsubishi se apaga.
function s206(t, s0) {
  bg();
  tag(t, 'PEUGEOT IRRUMPIÓ CON EL', M, 420, s0 + 0.1);
  lines(t, ['Peugeot 206'], M, 600, 0, 200, V(90) + 1.0);
  const dim = prog(t, V(90) + 3.0, V(90) + 4.6);
  label(ctx, 'y la era de Mitsubishi comenzó a apagarse', M, 720, `rgba(221,42,36,${1 - 0.5 * dim})`, prog(t, V(90) + 2.4, V(90) + 2.9), { size: 50, spacing: 0, weight: 700 });
}

// 2002: de Mitsubishi a Subaru.
function sSwitch(t, s0) {
  bg();
  tag(t, 'EN UN GIRO DRAMÁTICO DEL DESTINO', M, 340, s0 + 0.1);
  slam(t, '2002', M, 560, V(92) + 2.8, 200, COLOR.paper);
  lines(t, ['Mitsubishi'], M, 800, 0, 160, V(92) + 0.6, { colors: [COLOR.red], exit: [V(93) - 0.3, V(93)] });
  lines(t, ['Subaru'], M, 800, 0, 160, V(93) - 0.05, { colors: [COLOR.blue] });
  label(ctx, 'SU ETERNO RIVAL', M, 880, DIM, prog(t, V(93) + 0.2, V(93) + 0.6), { size: 26, spacing: 8, weight: 700 });
}

// 24 victorias.
function sTally(t, s0) {
  bg();
  const p = prog(t, V(97) + 0.2, V(97) + 1.6);
  drawTally(t, { x0: 900, y0: 520, p, cols: 12 });
  tag(t, 'EN 2003, TRAS', M, 380, s0 + 0.1);
  ctx.save(); ctx.globalAlpha = ease.out(prog(t, V(97), V(97) + 0.3)); counter(24 * ease.out(p), M - 8, 640, 260, COLOR.paper); ctx.restore();
  label(ctx, 'victorias en el mundial', M, 740, COLOR.paper, prog(t, V(97) + 0.6, V(97) + 1.1), { size: 52, spacing: 0, weight: 600 });
}

// Voluntad de hierro: el archivo, a cámara lenta.
function sIron(t, s0, s1) {
  bg();
  drawSeg('road', (t - s0) * 0.85, { zoom: lerp(1.04, 1.12, ease.inOut(span(t, s0, s1))), fx: 0.55, fy: 0.5, dark: 0.15 });
  scrimB(640, 0.9);
  tag(t, 'NO NECESITAS EL COCHE MÁS SOFISTICADO', M, 820, V(105) + 1.4);
  slam(t, 'Voluntad de hierro', M, 975, BREAKS.iron, 140, COLOR.paper);
}

// La tapa del maletero de la Tommi Mäkinen Edition.
function sTrunk(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  const map = photo('tmeTrasera', 0, 0, W, H, { zoom: lerp(1.04, 1.16, ease.inOut(u)), fx: 0.72, fy: 0.45 }, { dark: 0.28, vig: 0.55 });
  if (map) { const im = A.tmeTrasera; const [x, y] = map(im.width * 0.8, im.height * 0.47); callout(t, x, y, x - 360, y - 200, 'TAPA DEL MALETERO', V(107) + 0.9, COLOR.yellow); }
  scrimB(560, 0.85);
  tag(t, 'SU NOMBRE QUEDÓ INMORTALIZADO', M, 860, V(106) + 0.4);
  lines(t, ['No solo en los libros de historia'], M, 975, 0, 100, V(106) + 1.2);
}

// ¿El mejor piloto de los años 90?
function sQuestion(t, s0, s1) {
  bg();
  drawSeg('face', 5.0 + (t - s0) * 0.7, { zoom: 1.1, fx: 0.62, fy: 0.45, dark: 0.35 });
  scrimB(700, 0.92);
  lines(t, ['¿Es para ti el mejor piloto', 'de los años 90?'], M, 880, 110, 110, V(109) + 0.3, { colors: [COLOR.paper, COLOR.red] });
}

// Cierre: logotipo y suscripción.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 760, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = la;
  ctx.drawImage(lg, W / 2 - w / 2, 370 - h / 2, w, h);
  ctx.restore();
  label(ctx, 'Cuéntamelo en los comentarios', W / 2, 700, DIM, prog(t, V(110), V(110) + 0.5) * (1 - prog(t, V(111) + 0.2, V(111) + 0.5)), { size: 44, spacing: 0, weight: 600, align: 'center' });
  pill(t, 'Me gusta', W / 2 - 230, 760, V(111) + 0.3, { press: V(111) + 0.9, color: COLOR.ink2, pressed: COLOR.steel, text: COLOR.paper, size: 40 });
  pill(t, 'Suscríbete', W / 2 + 230, 760, V(111) + 1.2, { press: V(111) + 1.9, color: COLOR.red, size: 40 });
  label(ctx, '¡Nos vemos en el próximo tramo!', W / 2, 930, COLOR.paper, prog(t, V(112), V(112) + 0.5), { size: 46, spacing: 0, weight: 600, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, sIntro, 'dissolve'],
  [cut(2), kPhoto3({ img: 'evo5polvo', fx: 0.4, fy: 0.5, yaw: [0.06, -0.02], dark: 0.3, title: ['Los dioses', 'de la grava'], tt: V(2) + 0.3, size: 140 }), 'whip'],
  [cut(3), kClip({ seg: 'aerial', speed: 0.85, fx: 0.5, fy: 0.5, z: [1.02, 1.08], tag: 'SEGUNDA MITAD DE LOS AÑOS 90', tagT: V(3) + 0.1, title: ['Un campo de batalla'], tt: V(4) + 0.9, size: 130 }), 'dissolve'],
  [snap(V(4) + 3.0), sGiants, 'slices'],
  [cut(5), kSplit({ img: 'tommiRetrato', side: 'left', fx: 0.5, fy: 0.3, title: ['Un hombre', 'los doblegó', 'a todos'], tt: V(5) + 1.0, size: 120, colors: [COLOR.paper, COLOR.paper, COLOR.red] }), 'whip'],
  [cut(6), sFace, 'dissolve'],
  [cut(8), kPhoto3({ img: 'evoPublico', fx: 0.55, fy: 0.6, yaw: [-0.05, 0.03], tag: 'UNA ALIANZA INDESTRUCTIBLE CON', tagT: V(8) + 0.2, title: ['Una máquina roja'], tt: V(8) + 1.8, size: 140, colors: [COLOR.red] }), 'slices'],
  [BREAKS.four, sFour, 'cut'],
  [cut(10), kClip({ seg: 'front', from: 0.8, speed: 0.9, fx: 0.5, fy: 0.5, z: [1.03, 1.08], title: ['Una era de', 'dominio absoluto'], tt: V(10) + 0.2, size: 130 }), 'whip'],
  [cut(11), kPhoto3({ img: 'evo4salto', fx: 0.5, fy: 0.5, yaw: [0.05, -0.03], tag: 'EL HOMBRE QUE LLEVÓ AL MITSUBISHI LANCER EVOLUTION', tagT: V(12) + 0.6, title: ['A la cima', 'del mundo'], tt: V(12) + 3.6, size: 140 }), 'dissolve'],
  [cut(13), sTitle, 'wipe'],
  [cut(15), sPath, 'dissolve'],
  [cut(16), sMap, 'dissolve'],
  [cut(19), sTractor, 'slices'],
  [cut(21), sYears, 'dissolve'],
  [cut(24), s1994, 'wipe'],
  [cut(26), kPhoto({ img: 'escort1000lagos', fx: 0.22, fy: 0.35, z: [1.42, 1.32], dark: 0.3, tag: 'CON 30 AÑOS · RALLY DE LOS 1000 LAGOS', tagT: V(26) + 0.1, title: ['Ford Escort', 'RS Cosworth'], tt: V(27) + 1.6, size: 130 }), 'slices'],
  [cut(28), sVictory, 'cube'],
  [cut(30), kPhoto({ img: 'onboardTommi', fx: 0.4, fy: 0.45, z: [1.15, 1.05], dark: 0.35, tag: 'ESE DÍA', title: ['El mundo descubrió', 'a un genio'], tt: V(31) + 0.2, size: 120 }), 'dissolve'],
  [cut(32), sCowan, 'whip'],
  [cut(36), kPhoto3({ img: 'evo3nieve', fx: 0.5, fy: 0.55, yaw: [-0.06, 0.02], tag: 'EN 1995', tagT: V(36) + 0.1, title: ['Mitsubishi', 'Lancer Evolution'], tt: V(37) + 0.9, size: 130, colors: [COLOR.paper, COLOR.red] }), 'cube'],
  [cut(38), sFusion, 'dissolve'],
  [cut(40), kPhoto({ img: 'evoBlanco', fx: 0.6, fy: 0.42, z: [1.18, 1.1], dark: 0.3, tag: 'EL «EVO» ERA UN COCHE DE LA VIEJA ESCUELA DEL', tagT: V(40) + 0.2, title: ['Grupo A'], tt: V(40) + 2.2, size: 200 }), 'slices'],
  [cut(41), sWRC, 'whip'],
  [cut(42), sStreet, 'dissolve'],
  [cut(44), kType({ title: ['¿Cómo lograban ganar a coches', 'sobre el papel superiores?'], tt: V(44) + 0.1, size: 110, colors: [COLOR.paper, COLOR.ice] }), 'cut'],
  [cut(45), kPhoto({ img: 'motorVano', fx: 0.5, fy: 0.5, z: [1.14, 1.04], dark: 0.4, tag: 'LA RESPUESTA ESTABA EN', tagT: V(45) + 0.6, title: ['La electrónica', 'y el corazón de la bestia'], tt: V(45) + 1.5, size: 120, colors: [COLOR.ice, COLOR.paper] }), 'whipV'],
  [cut(46), sEngine, 'dissolve'],
  [cut(47), sDiffs, 'cubeV'],
  [cut(49), sCalib, 'slices'],
  [cut(50), kPhoto3({ img: 'evoMarlboro', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], tag: 'NO NECESITABA UN COCHE MÁS ANCHO', tagT: V(50) + 0.2, title: ['El arma más afilada'], tt: V(51) + 0.6, size: 140 }), 'whip'],
  [cut(52), sTyranny, 'dissolve'],
  [BREAKS.record, sRecord, 'cut'],
  [cut(56), kClip({ seg: 'road', speed: 0.85, fx: 0.5, fy: 0.5, z: [1.03, 1.08], tag: 'SU RIVALIDAD CON EL SUBARU DE', tagT: V(56) + 0.2, title: ['Colin McRae'], tt: V(56) + 1.6, size: 140, label: 'Definió una generación', labelT: V(56) + 3.0 }), 'dissolve'],
  [cut(57), sFireIce, 'cut'],
  [cut(58), sCorner, 'dissolve'],
  [cut(62), s1998, 'wipe'],
  [cut(63), sOil, 'cube'],
  [cut(66), kType({ tag: 'PARECÍA QUE', title: ['El título era', 'de Sainz'], tt: V(66) + 0.3, size: 170 }), 'cut'],
  [cut(67), sFinish, 'slices'],
  [snap(V(68) + 1.2), kPhoto({ img: 'corollaRoto', fx: 0.4, fy: 0.5, z: [1.12, 1.04], dark: 0.3, title: ['El motor del Corolla', 'reventó'], tt: V(68) + 1.5, size: 120, colors: [COLOR.paper, COLOR.red] }), 'cut'],
  [cut(69), sPhone, 'dissolve'],
  [snap(BREAKS.triple - 0.75), sTriple, 'wipe'],
  [cut(73), kClip({ seg: 'slide', speed: 0.5, fx: 0.5, fy: 0.5, z: [1.03, 1.1], tag: 'NO ERA SOLO UNA CALCULADORA FRÍA', tagT: V(74) + 0.1, title: ['Salvaje'], tt: V(75) + 1.3, size: 170 }), 'cubeV'],
  [cut(76), sPedals, 'dissolve'],
  [cut(77), sTraces, 'slices'],
  [cut(78), sGrip, 'cube'],
  [cut(79), kClip({ seg: 'road', from: 6.2, speed: 0.75, fx: 0.55, fy: 0.5, z: [1.04, 1.1], tag: 'IBA TAN AL LÍMITE QUE A VECES', tagT: V(79) + 0.2, title: ['La física le pasaba factura'], tt: V(79) + 1.4, size: 110 }), 'whip'],
  [cut(80), kType({ title: ['Si el coche se rompía,', 'seguía acelerando'], tt: V(80) + 0.1, size: 140, colors: [COLOR.paper, COLOR.red] }), 'cut'],
  [cut(82), sThree, 'cubeV'],
  [cut(83), kSplit({ img: 'accidente', side: 'left', gray: true, fx: 0.5, fy: 0.5, tag: 'O DESTROZAR EL COCHE EN', title: ['Accidentes', 'espeluznantes'], tt: V(83) + 1.2, size: 120, label: 'Sus vuelcos en Argentina y en Córcega', labelT: V(84) + 1.4 }), 'slices'],
  [cut(85), sOrder, 'dissolve'],
  [cut(88), sEraEnd, 'dissolve'],
  [cut(90), s206, 'cut'],
  [cut(91), sSwitch, 'wipe'],
  [cut(94), kPhoto3({ img: 'subaruAgua', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.02], tag: 'CON SUBARU', tagT: V(94) + 0.1, title: ['La magia', 'seguía intacta'], tt: V(94) + 0.6, size: 140, colors: [COLOR.paper, COLOR.ice] }), 'whip'],
  [snap(V(95) + 0.6), kPhoto({ img: 'celebraSubaru', fx: 0.6, fy: 0.4, z: [1.12, 1.04], dark: 0.35, tag: 'DEBUT ABSOLUTO CON SUBARU', title: ['Victoria en', 'Montecarlo'], tt: V(95) + 1.6, size: 130, label: 'Frente al joven prodigio Sébastien Loeb', labelT: V(95) + 3.4 }), 'dissolve'],
  [cut(96), sTally, 'cut'],
  [cut(98), kPhoto({ img: 'subaruCabina', fx: 0.4, fy: 0.45, z: [1.12, 1.04], dark: 0.4, title: ['El Rey abdicó'], tt: V(98) + 0.4, size: 150, label: 'Petter Solberg, su heredero', labelT: V(99) + 0.9 }), 'dissolve'],
  [cut(100), kType({ title: ['Las leyendas nunca', 'se van del todo'], tt: V(100) + 0.2, size: 150 }), 'dissolve'],
  [cut(101), kPhoto3({ img: 'gazoo2', fx: 0.55, fy: 0.4, yaw: [0.05, -0.02], tag: 'AÑOS DESPUÉS', tagT: V(101) + 0.1, title: ['Arquitecto y jefe de', 'Toyota Gazoo Racing'], tt: V(103) + 1.6, size: 110 }), 'slices'],
  [cut(104), kPhoto({ img: 'gazoo1', fx: 0.75, fy: 0.4, z: [1.12, 1.04], dark: 0.4, title: ['La máquina campeona'], tt: V(104) + 0.4, size: 140, label: 'que devolvió a la marca a la gloria', labelT: V(104) + 2.0 }), 'dissolve'],
  [cut(105), sIron, 'fly'],
  [cut(106), sTrunk, 'dissolve'],
  [cut(108), kPhoto3({ img: 'tmeFrente', fx: 0.55, fy: 0.55, yaw: [-0.07, 0.02], tag: 'MITSUBISHI LANCER EVO VI', tagT: V(108) + 0.1, title: ['Tommi Mäkinen', 'Edition'], tt: V(108) + 1.2, size: 150, pos: 'top', colors: [COLOR.paper, COLOR.paper] }), 'wipe'],
  [cut(109), sQuestion, 'dissolve'],
  [cut(110), sChannel, 'wipe'],
];

// Ventanas en las que se usa cada tramo de archivo (para cargar sus fotogramas solo cuando hacen falta).
export const CLIP_USE = (() => {
  const segOf = new Map([[sIntro, 'intro'], [sFace, 'face'], [sIron, 'road'], [sQuestion, 'face']]);
  const out = [];
  SHOTS.forEach(([s0, fn], i) => {
    const s1 = SHOTS[i + 1]?.[0] ?? DURATION;
    let seg = segOf.get(fn);
    if (!seg && fn.seg) seg = fn.seg;
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
export const HITS = [BREAKS.four, V(24) + 0.7, BREAKS.record, BREAKS.triple, BREAKS.iron];
const SHAKES = [BREAKS.four, BREAKS.record, BREAKS.triple, BREAKS.iron];

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
