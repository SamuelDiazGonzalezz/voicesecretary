// Escenas del documental sobre el sistema Anti-lag. Todo depende solo de `t`.
import { W, H, V, cut, DURATION, CLIP } from './timeline.js';
import { CLIP_ENV } from './clip-env.js';
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
  const im = gray ? layers.gray[key] : A[key];
  ctx.save();
  ctx.beginPath();
  const hh = h * open;
  ctx.rect(x, y + (h - hh) / 2, w, hh);
  ctx.clip();
  const map = drawCover(ctx, im, x, y, w, h, opts);
  if (dark > 0) {
    ctx.fillStyle = `rgba(11,13,16,${dark})`;
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


// ---------------------------------------------------------------------------
// Fondo técnico: retícula de puntos muy tenue (papel de ingeniería), solo en los planos de esquema.
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
function pipe(P, width, color = COLOR.line, fill = COLOR.ink2) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width + 6;
  ctx.beginPath();
  ctx.moveTo(P.pts[0][0], P.pts[0][1]);
  for (const p of P.pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}
const path = (pts) => poly(pts);

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

// ---------------------------------------------------------------------------
// Esquema completo del sistema (coordenadas de mundo 1920×1080; la cámara se acerca a cada parte).

const SYS = {
  comp: [700, 840], turb: [1010, 840], ecu: [150, 120, 280, 110],
  throttle: [420, 440], plenum: [500, 290, 90, 290], block: [760, 270, 360, 320],
  cyl: [[940, 320], [940, 390], [940, 460], [940, 530]], collector: [1270, 660],
};
const P_AIR_IN = path([[40, 840], [600, 840]]);
const P_AIR_UP = path([[700, 770], [700, 620], [420, 620], [420, 470]]);
const P_AIR_THR = path([[420, 410], [420, 330], [500, 330]]);
const P_BYPASS = path([[560, 620], [560, 585]]);
const P_RUN = SYS.cyl.map(([x, y]) => path([[590, y], [760, y]]));
const P_EXH_RUN = SYS.cyl.map(([x, y], i) => path(catmull([[1120, y], [1190, y + 10], [1240, 560 + i * 18], [SYS.collector[0], SYS.collector[1]]], false, 8)));
const P_EXH_DOWN = path(catmull([[1270, 660], [1250, 740], [1120, 770], [1060, 790]], false, 8));
const P_EXH_OUT = path([[1080, 840], [1880, 840]]);
const CRACKS = [
  path([[1262, 640], [1250, 612], [1258, 590], [1244, 566]]),
  path([[1282, 676], [1306, 690], [1318, 714], [1340, 722]]),
  path([[1258, 686], [1236, 702], [1228, 728]]),
];

function drawSystem(t, st) {
  const s = {
    air: 1, thr: 1, bypass: 0, inj: 0, unburnt: 0, ex: 1, rps: 3, rpsT0: 0, heat: 0, cracks: 0, bang: 0, flame: 0, ecu: 0,
    labels: 0, sig: 0, ...st,
  };
  const c = ctx;
  c.lineJoin = 'round';
  const heatCol = s.heat > 0 ? (s.heat < 0.5 ? COLOR.red : s.heat < 0.85 ? COLOR.fire : COLOR.yellow) : COLOR.line;

  // Tuberías.
  pipe(P_AIR_IN, 34); pipe(P_AIR_UP, 30); pipe(P_AIR_THR, 30); pipe(P_BYPASS, 14);
  P_RUN.forEach((P) => pipe(P, 18));
  P_EXH_RUN.forEach((P) => pipe(P, 20, s.heat > 0 ? heatCol : COLOR.line));
  pipe(P_EXH_DOWN, 30, s.heat > 0 ? heatCol : COLOR.line); pipe(P_EXH_OUT, 32);
  // Resplandor del colector caliente: un halo plano del color de la temperatura.
  if (s.heat > 0) {
    c.save();
    c.globalAlpha = 0.18 * s.heat;
    c.strokeStyle = heatCol;
    c.lineWidth = 70;
    c.lineCap = 'round';
    P_EXH_RUN.concat([P_EXH_DOWN]).forEach((P) => { c.beginPath(); c.moveTo(P.pts[0][0], P.pts[0][1]); P.pts.forEach((p) => c.lineTo(p[0], p[1])); c.stroke(); });
    c.restore();
  }
  // Grietas.
  if (s.cracks > 0) {
    c.save();
    c.strokeStyle = COLOR.ink;
    c.lineWidth = 4;
    CRACKS.forEach((P, i) => trace(c, P, clamp(s.cracks * 1.4 - i * 0.2)));
    c.restore();
  }

  // Plénum, bloque y cilindros.
  c.save();
  c.fillStyle = COLOR.ink2;
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  rr(c, ...SYS.plenum, 14); c.fill(); c.stroke();
  rr(c, ...SYS.block, 22); c.fill(); c.stroke();
  SYS.cyl.forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 26, 0, Math.PI * 2); c.stroke(); });
  c.restore();

  // Mariposa de admisión: disco que gira dentro del conducto.
  const [tx, ty] = SYS.throttle;
  c.save();
  c.translate(tx, ty);
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  c.strokeRect(-26, -34, 52, 68);
  c.rotate((Math.PI / 2) * (1 - s.thr));
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 26); c.stroke();
  c.restore();
  // Válvula bypass (pajarita) en derivación.
  c.save();
  c.translate(560, 602);
  c.fillStyle = s.bypass > 0.5 ? COLOR.air : COLOR.ink2;
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(-16, -12); c.lineTo(16, 12); c.lineTo(16, -12); c.lineTo(-16, 12); c.closePath(); c.fill(); c.stroke();
  c.restore();

  // Flujos.
  const airMain = s.air * s.thr;
  flowLine(P_AIR_IN, t, { color: COLOR.air, width: 12, amount: Math.max(s.air, s.bypass), speed: lerp(0.4, 1.4, Math.max(s.air, s.bypass)) });
  flowLine(P_AIR_UP, t, { color: COLOR.air, width: 10, amount: Math.max(airMain, s.bypass), speed: 1.2 });
  flowLine(P_AIR_THR, t, { color: COLOR.air, width: 10, amount: airMain, speed: 1.2 });
  flowLine(P_BYPASS, t, { color: COLOR.air, width: 6, amount: s.bypass, speed: 0.8, dash: [10, 10] });
  P_RUN.forEach((P, i) => {
    flowLine(P, t, { color: COLOR.air, width: 8, amount: Math.max(airMain, s.bypass), speed: 1, offset: i * 9 });
    if (s.inj > 0) flowLine(P, t, { color: COLOR.yellow, width: 8, amount: s.inj, speed: 1, offset: i * 9 + 24 });
  });
  P_EXH_RUN.forEach((P, i) => {
    flowLine(P, t, { color: COLOR.fire, width: 10, amount: s.ex, speed: lerp(0.3, 1.6, s.ex), offset: i * 13 });
    if (s.unburnt > 0) flowLine(P, t, { color: COLOR.yellow, width: 8, amount: s.unburnt, speed: 0.9, offset: i * 13 + 20, dash: [12, 30] });
  });
  flowLine(P_EXH_DOWN, t, { color: COLOR.fire, width: 14, amount: Math.max(s.ex, s.bang > 0 ? 1 : 0), speed: lerp(0.3, 1.8, Math.max(s.ex, s.bang)) });
  flowLine(P_EXH_OUT, t, { color: COLOR.fire, width: 12, amount: Math.max(s.ex, s.flame), speed: lerp(0.3, 1.8, s.ex) });

  // Inyectores (pulverizan cuando inyectan).
  SYS.cyl.forEach(([x, y]) => {
    c.save();
    c.fillStyle = COLOR.ink2;
    c.strokeStyle = COLOR.line;
    c.lineWidth = 2.5;
    rr(c, 668, y - 34, 18, 24, 4); c.fill(); c.stroke();
    if (s.inj > 0) {
      c.globalAlpha = s.inj * (0.5 + 0.5 * Math.abs(Math.sin(t * 18 + y)));
      c.fillStyle = COLOR.yellow;
      c.beginPath(); c.moveTo(677, y - 10); c.lineTo(664, y + 6); c.lineTo(690, y + 6); c.closePath(); c.fill();
    }
    c.restore();
  });

  // Turbo: compresor y turbina unidos por el eje.
  const th = spinAngle(t, s.rpsT0, typeof s.rps === 'function' ? s.rps : () => s.rps);
  const rpsNow = typeof s.rps === 'function' ? s.rps(t) : s.rps;
  c.save();
  c.strokeStyle = COLOR.line;
  c.lineWidth = 8;
  c.beginPath(); c.moveTo(SYS.comp[0] + 60, 840); c.lineTo(SYS.turb[0] - 60, 840); c.stroke();
  c.restore();
  drawWheel(th, rpsNow / 60 * Math.PI * 2, SYS.comp[0], SYS.comp[1], 62, 1, { housing: false });
  drawWheel(th, rpsNow / 60 * Math.PI * 2, SYS.turb[0], SYS.turb[1], 62, 1, { housing: false, hot: s.heat });
  c.save();
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  for (const [x, y] of [SYS.comp, SYS.turb]) { c.beginPath(); c.arc(x, y, 78, 0, Math.PI * 2); c.stroke(); }
  c.restore();

  // Centralita (interfaz genérica) y señales a inyectores, bypass y bujías.
  if (s.ecu > 0) {
    const [ex, ey, ew, eh] = SYS.ecu;
    c.save();
    c.globalAlpha = s.ecu;
    c.fillStyle = COLOR.ink2;
    c.strokeStyle = COLOR.line;
    c.lineWidth = 3;
    rr(c, ex, ey, ew, eh, 14); c.fill(); c.stroke();
    stripesH(c, ey + eh - 14, 4, 1, 0, { x0: ex + 20, x1: ex + 120 });
    c.restore();
    label(ctx, 'CENTRALITA', ex + 22, ey + 48, COLOR.paper, s.ecu, { size: 24, spacing: 6, weight: 700 });
    if (s.sig > 0) {
      const targets = [[677, 286], [560, 590], ...SYS.cyl.map(([x, y]) => [x, y - 20])];
      c.save();
      c.strokeStyle = COLOR.yellow;
      c.lineWidth = 2.5;
      c.setLineDash([6, 10]);
      c.lineDashOffset = -t * 90;
      c.globalAlpha = s.sig;
      targets.forEach(([x, y]) => { c.beginPath(); c.moveTo(ex + ew, ey + eh / 2); c.lineTo(x, ey + eh / 2); c.lineTo(x, y); c.stroke(); });
      c.restore();
    }
  }

  // Detonación en el colector y llama por el escape.
  if (s.bang > 0) {
    burst(SYS.collector[0], SYS.collector[1], 120 * ease.out(s.bang) * (0.6 + 0.4 * s.bang), 1 - s.bang * 0.6, Math.floor(t * 20));
  }
  if (s.flame > 0) {
    const fl = s.flame * (0.75 + 0.25 * noise1(t * 30));
    burst(1890 + 30 * fl, 840, 70 * fl, fl, Math.floor(t * 24) + 3);
  }

  // Etiquetas.
  if (s.labels > 0) {
    const L = [['ADMISIÓN', 60, 790], ['COMPRESOR', 640, 960], ['TURBINA', 950, 960], ['MARIPOSA', 300, 445], ['BYPASS', 470, 660],
      ['MOTOR', 890, 250], ['COLECTOR DE ESCAPE', 1300, 560], ['ESCAPE', 1700, 790]];
    L.forEach(([str, x, y], i) => label(ctx, str, x, y, DIM, clamp(s.labels * 1.5 - i * 0.08), { size: 22, spacing: 6, weight: 700 }));
  }
}

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

// ---------------------------------------------------------------------------
// Corte del turbo: compresor (aire frío) y turbina (gases calientes) sobre el mismo eje.
// Lámina técnica: carcasas en sección rayada, volutas, carcasa central y rodetes en perfil.

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

// ---------------------------------------------------------------------------
// Cilindro en sección y dial de encendido.
// Ciclo de 720°: 0 PMS de admisión · 180 PMI · 360 PMS de explosión · 540 PMI · 720.

function valveLift(a, open, close) {
  const span = ((close - open) % 720 + 720) % 720;
  const u = ((a - open) % 720 + 720) % 720;
  if (u > span) return 0;
  return Math.sin(Math.PI * u / span);
}

function drawCylinder(t, { cx, cy, s = 1, a = 0, spark = 350, als = 0, appear = 1, labels = 1 }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  c.lineJoin = 'round';
  const bore = 240, stroke = 200, rod = 330;
  const rad = (a % 360) * Math.PI / 180;
  const crankR = stroke / 2;
  const top = -200, crankY = 380;
  const px = Math.sin(rad) * crankR, py = -Math.cos(rad) * crankR;
  const pinY = crankY - (crankR * Math.cos(rad) + Math.sqrt(rod * rod - (crankR * Math.sin(rad)) ** 2));
  // Culata con puertos: admisión (izquierda) y escape (derecha).
  c.fillStyle = COLOR.ink2;
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  rr(c, -bore / 2 - 40, top - 120, bore + 80, 140, 18); c.fill(); c.stroke();
  // Camisa.
  c.beginPath();
  c.moveTo(-bore / 2, top); c.lineTo(-bore / 2, top + 400);
  c.moveTo(bore / 2, top); c.lineTo(bore / 2, top + 400);
  c.stroke();
  // Válvulas.
  const am = ((a % 720) + 720) % 720;
  const li = valveLift(am, 710, 220), le = valveLift(am, 480, 730);
  for (const [x, lift, col] of [[-60, li, COLOR.air], [60, le, COLOR.fire]]) {
    const d = lift * 38;
    c.strokeStyle = col;
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(x, top - 120); c.lineTo(x, top - 6 + d); c.stroke();
    c.lineWidth = 10;
    c.beginPath(); c.moveTo(x - 34, top - 4 + d); c.lineTo(x + 34, top - 4 + d); c.stroke();
  }
  // Bujía.
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 6;
  c.beginPath(); c.moveTo(0, top - 150); c.lineTo(0, top - 20); c.stroke();
  // Pistón, biela y cigüeñal.
  const pTop = pinY - 70;
  c.fillStyle = COLOR.ink2;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3;
  rr(c, -bore / 2 + 6, pTop, bore - 12, 110, 8); c.fill(); c.stroke();
  c.strokeStyle = COLOR.line;
  c.lineWidth = 12;
  c.beginPath(); c.moveTo(0, pinY); c.lineTo(px, crankY + py); c.stroke();
  c.lineWidth = 3;
  c.beginPath(); c.arc(0, crankY, crankR + 24, 0, Math.PI * 2); c.stroke();
  c.fillStyle = COLOR.paper;
  c.beginPath(); c.arc(px, crankY + py, 12, 0, Math.PI * 2); c.fill();
  // Mezcla y combustión.
  const chamber = (fill, alpha) => { c.save(); c.globalAlpha = appear * alpha; c.fillStyle = fill; c.fillRect(-bore / 2 + 4, top, bore - 8, pTop - top); c.restore(); };
  const sinceSpark = ((am - spark) % 720 + 720) % 720;
  if (am < 200 || am > 700) chamber(COLOR.air, 0.25);
  if (am >= 200 && am < spark) chamber(COLOR.yellow, 0.18 + 0.1 * (am - 200) / 160);
  if (sinceSpark < 90) chamber(als > 0.5 ? COLOR.yellow : COLOR.fire, (1 - sinceSpark / 90) * 0.85);
  // Con el encendido retrasado, la mezcla aún arde al abrirse el escape: la llama sale por el puerto.
  if (als > 0.5 && le > 0.05 && sinceSpark < 260) {
    burst(150, top - 60, 70 * le, le, Math.floor(t * 24));
  }
  if (sinceSpark < 6) burst(0, top - 10, 40, 1 - sinceSpark / 6, 9);
  c.restore();
  if (labels > 0) {
    const pt = (x, y) => [cx + x * s, cy + y * s];
    const L = [['ADMISIÓN', -150, -340, COLOR.air, 'right'], ['ESCAPE', 150, -340, COLOR.fire, 'left'], ['BUJÍA', 20, -370, COLOR.paper, 'left'], ['PISTÓN', 150, 80, COLOR.paper, 'left']];
    L.forEach(([str, x, y, col, al]) => { const [qx, qy] = pt(x, y); label(ctx, str, qx, qy, col, labels, { size: 22, spacing: 6, weight: 700, align: al }); });
  }
}

// Dial del cigüeñal: PMS arriba, la aguja gira y la marca amarilla indica el instante de la chispa.
function drawDial(t, { cx, cy, r, a, spark, appear = 1, showRetard = 0 }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.globalAlpha = appear;
  c.strokeStyle = COLOR.faint;
  c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  for (let d = 0; d < 360; d += 10) {
    const q = (d - 90) * Math.PI / 180;
    const big = d % 90 === 0;
    c.strokeStyle = big ? COLOR.paper : COLOR.faint;
    c.lineWidth = big ? 3 : 2;
    c.beginPath(); c.moveTo(Math.cos(q) * r, Math.sin(q) * r); c.lineTo(Math.cos(q) * (r - (big ? 26 : 14)), Math.sin(q) * (r - (big ? 26 : 14))); c.stroke();
  }
  // Arco de retraso entre PMS y la chispa.
  const sq = ((spark - 360) * Math.PI) / 180;
  if (showRetard > 0) {
    c.strokeStyle = COLOR.red;
    c.lineWidth = 12;
    c.globalAlpha = appear * showRetard;
    c.beginPath(); c.arc(0, 0, r + 22, -Math.PI / 2, -Math.PI / 2 + sq * showRetard, sq < 0); c.stroke();
    c.globalAlpha = appear;
  }
  c.fillStyle = COLOR.yellow;
  c.beginPath(); c.arc(Math.cos(sq - Math.PI / 2) * (r + 22), Math.sin(sq - Math.PI / 2) * (r + 22), 12, 0, Math.PI * 2); c.fill();
  const q = ((a % 360) * Math.PI) / 180 - Math.PI / 2;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 6;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(q) * (r - 34), Math.sin(q) * (r - 34)); c.stroke();
  c.fillStyle = COLOR.paper;
  c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
  c.restore();
  label(ctx, 'PMS', cx, cy - r - 52, COLOR.paper, appear, { size: 24, spacing: 6, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Onda del sonido real del clip: la envolvente medida, como un registro de laboratorio.
function drawWave(t, t0, { y = 560, h = 300, x0 = 0, x1 = W, color = COLOR.fire, appear = 1, window = 2.4 }) {
  const c = ctx;
  const now = (t - t0) * 120;
  const n = Math.round(window * 120);
  const bw = (x1 - x0) / n;
  c.save();
  c.globalAlpha = appear;
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(now - n + i);
    if (k < 0 || k >= CLIP_ENV.length) continue;
    const v = CLIP_ENV[k];
    const hh = Math.max(2, v * h);
    c.globalAlpha = appear * lerp(0.15, 1, i / n);
    c.fillRect(x0 + i * bw, y - hh / 2, Math.max(1, bw - 2), hh);
  }
  c.restore();
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

// Mapa genérico de la centralita: celdas de régimen × carga con la intensidad del retraso.
function drawMap(t, { x, y, w, h, preset = 0, appear = 1, cursor = null }) {
  const cols = 12, rows = 8;
  const cw = w / cols, chh = h / rows;
  ctx.save();
  ctx.globalAlpha = appear;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const base = clamp(1 - j / rows) * clamp(1.2 - i / cols);
    const agg = lerp(0.35, 1, preset);
    const v = clamp(base * agg + 0.15 * noise1(i * 1.7 + j * 3.1));
    const a = ease.out(clamp(appear * 2 - (i + j) / (cols + rows)));
    ctx.globalAlpha = a;
    ctx.fillStyle = v > 0.66 ? COLOR.red : v > 0.4 ? COLOR.fire : v > 0.18 ? COLOR.yellow : COLOR.ink2;
    ctx.globalAlpha = a * (v > 0.18 ? lerp(0.35, 1, v) : 1);
    ctx.fillRect(x + i * cw + 2, y + j * chh + 2, cw - 4, chh - 4);
  }
  ctx.restore();
  label(ctx, 'RÉGIMEN', x + w, y + h + 44, DIM, appear, { size: 20, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'CARGA', x, y - 20, DIM, appear, { size: 20, spacing: 6, weight: 700 });
  if (cursor) {
    ctx.save();
    ctx.strokeStyle = COLOR.paper;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + cursor[0] * cw, y + cursor[1] * chh, cw, chh);
    ctx.restore();
  }
}

// Selector rotativo genérico del salpicadero.
function drawKnob(t, { cx, cy, r, pos, appear = 1, steps = 5 }) {
  const c = ctx;
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  c.save();
  c.globalAlpha = appear;
  for (let k = 0; k < steps; k++) {
    const q = a0 + span * (k / (steps - 1));
    c.fillStyle = k / (steps - 1) <= pos + 1e-3 ? COLOR.fire : COLOR.faint;
    c.beginPath(); c.arc(cx + Math.cos(q) * (r + 40), cy + Math.sin(q) * (r + 40), 9, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = COLOR.ink2;
  c.strokeStyle = COLOR.line;
  c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.stroke();
  const q = a0 + span * pos;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 8;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + Math.cos(q) * r * 0.3, cy + Math.sin(q) * r * 0.3); c.lineTo(cx + Math.cos(q) * r * 0.85, cy + Math.sin(q) * r * 0.85); c.stroke();
  c.restore();
  label(ctx, 'ANTI-LAG', cx, cy + r + 90, DIM, appear, { size: 22, spacing: 8, weight: 700, align: 'center' });
}

// Gráfica: acelerador frente a presión del turbo, con o sin Anti-lag.
function drawLagGraph(t, s0, { x0 = 1000, x1 = 1800, yb = 820, yt = 300, delay = 0.22, als = 0, draw = 1, marker = 0 }) {
  const tx = (u) => lerp(x0, x1, u);
  ctx.save();
  ctx.fillStyle = 'rgba(236,239,242,0.22)';
  ctx.fillRect(x0, yb, x1 - x0, 2);
  ctx.fillRect(x0, yt - 20, 2, yb - yt + 20);
  ctx.restore();
  const thr = [], bst = [], als2 = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160;
    thr.push([tx(u), u < 0.2 ? yb - 40 : yt + 30]);
    const b = u < 0.2 ? 0 : 1 - Math.exp(-Math.max(0, u - 0.2 - delay) * 10);
    bst.push([tx(u), lerp(yb - 10, yt + 60, b)]);
    als2.push([tx(u), lerp(yb - 10, yt + 60, u < 0.2 ? 0.92 : 0.92 + 0.08 * (1 - Math.exp(-(u - 0.2) * 30)))]);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR.paper;
  ctx.lineWidth = 5;
  trace(ctx, poly(thr), draw);
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 7;
  ctx.globalAlpha = 1 - 0.65 * als;
  trace(ctx, poly(bst), draw);
  ctx.globalAlpha = 1;
  if (als > 0) {
    ctx.strokeStyle = COLOR.fire;
    ctx.lineWidth = 8;
    trace(ctx, poly(als2), als);
  }
  label(ctx, 'ACELERADOR', tx(0.2) - 16, yt + 36, COLOR.paper, clamp(draw * 3 - 1), { size: 22, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'PRESIÓN DEL TURBO', tx(0.72), yt + 150, COLOR.red, clamp(draw * 2 - 1), { size: 22, spacing: 6, weight: 700 });
  if (als > 0) label(ctx, 'CON ANTI-LAG', tx(0.62), yt + 30, COLOR.fire, als, { size: 22, spacing: 6, weight: 700 });
  if (marker > 0) dimLine(tx(0.2), tx(0.2 + delay), yb + 60, marker, COLOR.yellow, 'DOS SEGUNDOS');
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
  if (o.label) label(ctx, o.label, x, y0 + (n - 1) * lead + 74, o.labelColor ?? DIM, prog(t, o.labelT ?? tt + 0.8, (o.labelT ?? tt + 0.8) + 0.5), { size: 40, spacing: 0, weight: 600, align: o.align ?? 'left' });
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
  titleBlock(t, { ...o, x: center ? W / 2 : M, y0, size, maxW: o.maxW ?? GRID.w }, s0);
  ctx.restore();
  if (o.stripes) stripesH(ctx, y0 + (n - 1) * lead + 60, 12, prog(t, s0 + 0.3, s0 + 1.1), 0, { x0: center ? W / 2 - 360 : M, x1: center ? W / 2 + 360 : M + 520 });
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
// Planos singulares.

// Entrada: logotipo del canal y debajo «Anti-Lag».
function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.6));
  const w = 820, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = a;
  zoomAbout(lerp(1.05, 1.0, ease.outExpo(prog(t, 0.05, 2.0))));
  ctx.drawImage(lg, W / 2 - w / 2, 430 - h / 2, w, h);
  ctx.restore();
  const size = 130;
  revealText(ctx, 'Anti-Lag', W / 2, 900, FONT.display(800, size), COLOR.paper, prog(t, 0.55, 1.2), { align: 'center', stagger: 0.05, spacing: 6 });
  stripesH(ctx, 935, 10, prog(t, 0.8, 1.5), 0, { x0: W / 2 - 220, x1: W / 2 + 220 });
}

// El clip del cliente: los segundos 9 a 16 con su sonido (el coche pasa y sigue petardeando).
function sClipA(t, s0) {
  bg();
  drawClip(t - CLIP.at, { zoom: 1.04, dark: 0.1 });
  lines(t, ['Fuego por el escape.'], M, 975, 0, 120, V(0) + 0.05);
}
function sClipB(t, s0) {
  bg();
  drawClip(t - CLIP.at, { zoom: 1.08, dark: 0.6 });
  drawWave(t, CLIP.at, { y: 420, h: 340, x0: M, x1: W - M, appear: ease.out(prog(t, s0, s0 + 0.4)) });
  tag(t, 'EXPLOSIONES QUE SUENAN COMO', M, 720, s0 + 0.1);
  lines(t, ['Ráfagas de ametralladora'], M, 840, 0, 116, V(1) + 1.2);
  label(ctx, 'Para el espectador, es puro espectáculo.', M, 930, DIM, prog(t, V(2) + 0.2, V(2) + 0.7), { size: 40, spacing: 0, weight: 600 });
}

// Anti-lag: el nombre, con su apodo.
function sName(t, s0) {
  bg();
  tag(t, 'EL SECRETO MEJOR GUARDADO DE LOS RALLYS', W / 2, 330, s0 + 0.1, COLOR.yellow, { align: 'center' });
  const size = 300;
  revealText(ctx, 'Anti-lag', W / 2, 640, FONT.display(800, size), COLOR.paper, prog(t, V(7) - 0.1, V(7) + 0.5), { align: 'center', stagger: 0.05 });
  stripesH(ctx, 690, 16, prog(t, V(7) + 0.2, V(7) + 1.0), 0, { x0: W / 2 - 520, x1: W / 2 + 520 });
  label(ctx, 'también conocido como «Bang-Bang»', W / 2, 820, DIM, prog(t, V(8), V(8) + 0.5), { size: 46, spacing: 0, weight: 600, align: 'center' });
}

// El turbo abierto: corte con compresor y turbina; se dibuja al «abrir las entrañas».
function sOpen(t, s0, s1) {
  bg(); dots();
  const th = spinAngle(t, s0, () => 2.2);
  const draw = ease.out(prog(t, s0, s0 + 1.0));
  ctx.save();
  ctx.globalAlpha = draw;
  drawTurboSection(t, { cx: 1300, cy: 620, s: 0.66, th, air: draw, ex: draw, labels: prog(t, s0 + 0.8, s0 + 1.6) });
  ctx.restore();
  titleBlock(t, { tag: 'PARA ENTENDER CÓMO LOGRARON', title: ['Engañar', 'a la física'], pos: 'top', y0: 300, maxW: 560, tt: V(11) + 6.4, size: 104 }, s0);
}

// Turbocompresor gigante: el turbo del cliente sobre papel, con su cota.
function sGiant(t, s0, s1) {
  bg(COLOR.paper);
  const u = span(t, s0, s1);
  const im = A.turboBlanco;
  const iw = 980, ih = iw * (im.height / im.width);
  ctx.save();
  zoomAbout(lerp(1.0, 1.08, ease.inOut(u)), 1330, 540);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(im, 840, 540 - ih / 2, iw, ih);
  ctx.restore();
  tag(t, 'EN LOS AÑOS 80, PARA SACAR', M, 300, s0 + 0.1, COLOR.red);
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(16) + 0.6, V(16) + 1.0));
  counter(500 * ease.outExpo(prog(t, V(16) + 0.6, V(16) + 1.8)), M - 6, 520, 220, COLOR.ink);
  ctx.restore();
  label(ctx, 'caballos de motores pequeños', M, 610, 'rgba(11,13,16,0.7)', prog(t, V(16) + 1.2, V(16) + 1.7), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'COMO EL DEL PEUGEOT 205 T16', M, 660, COLOR.red, prog(t, V(16) + 3.4, V(16) + 3.9), { size: 24, spacing: 6, weight: 700 });
  lines(t, ['Turbocompresores', 'gigantescos'], M, 840, 104, 96, V(17), { color: COLOR.ink, maxW: 640 });
}

// Cómo funciona un turbo: los gases de escape mueven la turbina, que mueve el compresor.
function sHowTurbo(t, s0) {
  bg(); dots();
  const th = spinAngle(t, s0, () => 2.6);
  drawTurboSection(t, { cx: 1300, cy: 640, s: 0.66, th, air: 1, ex: 1, labels: 1 });
  titleBlock(t, { tag: 'UN TURBO FUNCIONA GRACIAS A', title: ['Los gases', 'de escape'], pos: 'top', y0: 320, maxW: 520, tt: V(18) + 2.4, colors: [COLOR.paper, COLOR.fire] }, s0);
}

// Turbo lag: la presión llega dos segundos tarde.
function sLag(t, s0) {
  bg(); dots();
  drawLagGraph(t, s0, { draw: ease.inOut(prog(t, s0 + 0.3, s0 + 4.0)), marker: prog(t, V(20) + 1.0, V(20) + 1.6) });
  tag(t, 'AL PISAR A FONDO A LA SALIDA DE LA CURVA', M, 330, s0 + 0.1, COLOR.yellow, { size: 22 });
  lines(t, ['Un par', 'de segundos'], M, 470, 120, 110, V(20) + 1.2, { maxW: 600, colors: [COLOR.paper, COLOR.yellow] });
  label(ctx, 'para hacer girar la pesada turbina', M, 640, DIM, prog(t, V(20) + 3.0, V(20) + 3.5), { size: 40, spacing: 0, weight: 600 });
}

// Toda la potencia, de golpe: el manómetro salta.
function sSurge(t, s0) {
  bg();
  const v = ease.outExpo(prog(t, V(24) - 0.05, V(24) + 0.35));
  arcGauge(t, 1380, 560, 300, 2.5 * v, 2.6, ease.out(prog(t, s0, s0 + 0.4)), 10, COLOR.red);
  label(ctx, 'BOOST', 1380, 660, DIM, prog(t, s0 + 0.2, s0 + 0.6), { size: 26, spacing: 8, weight: 700, align: 'center' });
  tag(t, 'Y DE REPENTE…', M, 360, s0 + 0.1);
  slam(t, 'De golpe', M, 560, V(24) - 0.05, 170, COLOR.paper);
  label(ctx, 'empujándote hacia el barranco', M, 680, DIM, prog(t, V(25) + 0.2, V(25) + 0.7), { size: 44, spacing: 0, weight: 600 });
  label(ctx, 'si no tenías el volante perfectamente recto', M, 740, DIM, prog(t, V(25) + 1.6, V(25) + 2.1), { size: 44, spacing: 0, weight: 600 });
}

// La mariposa de admisión se cierra (gran plano del cuerpo de mariposa).
function sThrottle(t, s0) {
  bg(); dots();
  const close = ease.inOut(prog(t, V(28) + 0.3, V(28) + 1.4));
  const cx = 1340, cy = 540;
  ctx.save();
  ctx.fillStyle = COLOR.ink2;
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 4;
  rr(ctx, cx - 520, cy - 150, 1040, 300, 30); ctx.fill(); ctx.stroke();
  ctx.restore();
  flowLine(poly([[cx - 700, cy], [cx + 700, cy]]), t, { color: COLOR.air, width: 22, amount: 1 - close * 0.9, speed: lerp(1.6, 0.15, close), dash: [50, 34] });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(lerp(Math.PI / 2 - 0.12, 0.08, close));
  ctx.fillStyle = COLOR.paper;
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 140, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLOR.line;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
  label(ctx, 'AIRE', cx - 460, cy - 190, COLOR.air, prog(t, s0 + 0.2, s0 + 0.6), { size: 24, spacing: 8, weight: 700 });
  // La pieza real: cuerpos de mariposa sobre una tarjeta clara.
  const ap = ease.outExpo(prog(t, s0 + 0.3, s0 + 0.9));
  if (ap > 0) {
    const im = A.mariposas;
    ctx.save();
    ctx.globalAlpha = ap;
    ctx.fillStyle = COLOR.paper;
    ctx.beginPath(); ctx.roundRect(M, 620, 560, 330, 18); ctx.fill();
    ctx.globalCompositeOperation = 'multiply';
    drawCover(ctx, im, M + 20, 640, 520, 290, { zoom: 1.0 });
    ctx.restore();
  }
  tag(t, 'LA MARIPOSA DE ADMISIÓN', M, 330, s0 + 0.1);
  lines(t, ['Se cierra'], M, 480, 0, 130, V(28) + 1.0);
}

// Con el pie levantado, el motor apenas quema: tres barras que caen.
function sFlow(t, s0) {
  bg();
  const items = [['COMBUSTIBLE', COLOR.yellow, V(29) + 1.4], ['AIRE', COLOR.air, V(29) + 2.6], ['GASES DE ESCAPE', COLOR.fire, V(30) + 1.4]];
  items.forEach(([name, col, t0], i) => {
    const y = 380 + i * 170;
    const v = lerp(0.92, 0.12, ease.inOut(prog(t, t0, t0 + 1.0)));
    const a = ease.out(prog(t, s0 + i * 0.15, s0 + 0.5 + i * 0.15));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = COLOR.ink2;
    ctx.fillRect(960, y, 820, 44);
    ctx.fillStyle = col;
    ctx.fillRect(960, y, 820 * v, 44);
    ctx.restore();
    label(ctx, name, 960, y - 20, DIM, a, { size: 22, spacing: 6, weight: 700 });
  });
  tag(t, 'EL MOTOR DEJA DE QUEMAR', M, 380, s0 + 0.1);
  lines(t, ['El flujo de gases', 'cae drásticamente'], M, 520, 110, 96, V(30) + 1.6, { maxW: 700 });
}

// La turbina pierde inercia: de más de 100.000 rpm a casi nada.
function sSpinDown(t, s0, s1) {
  bg();
  const rps = (u) => lerp(6, 0.25, ease.inOut(prog(u, V(34) - 0.2, V(34) + 2.0)));
  const th = spinAngle(t, s0, rps);
  drawWheel(th, rps(t) / 60 * Math.PI * 2, 1340, 540, 300, ease.out(prog(t, s0, s0 + 0.5)));
  const rpm = lerp(105000, 4000, ease.inOut(prog(t, V(34) - 0.2, V(34) + 2.0)));
  tag(t, 'LA TURBINA DEL TURBO GIRABA A MÁS DE', M, 330, s0 + 0.1, COLOR.yellow, { size: 22 });
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(33), V(33) + 0.4));
  ctx.font = FONT.display(700, 150);
  ctx.fillStyle = COLOR.paper;
  ctx.fillText(fmt(Math.round(rpm / 100) * 100), M - 4, 500);
  ctx.restore();
  label(ctx, 'revoluciones por minuto', M, 570, DIM, prog(t, V(33) + 0.6, V(33) + 1.0), { size: 40, spacing: 0, weight: 600 });
  lines(t, ['Se frena', 'casi por completo'], M, 760, 100, 90, V(34) + 1.2, { maxW: 640 });
}

// Boost: la presión de admisión cae a cero.
function sBoostZero(t, s0) {
  bg();
  const v = lerp(2.4, 0, ease.inOut(prog(t, V(37) - 0.3, V(37) + 0.6)));
  arcGauge(t, 1380, 560, 300, v, 2.6, ease.out(prog(t, s0, s0 + 0.4)), 10, COLOR.red);
  ctx.save();
  ctx.font = FONT.display(700, 150);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.paper;
  ctx.globalAlpha = ease.out(prog(t, s0 + 0.2, s0 + 0.5));
  ctx.fillText(v.toFixed(1).replace('.', ','), 1380, 610);
  ctx.restore();
  label(ctx, 'BAR', 1380, 670, DIM, prog(t, s0 + 0.3, s0 + 0.7), { size: 26, spacing: 8, weight: 700, align: 'center' });
  tag(t, 'LA PRESIÓN EN EL COLECTOR DE ADMISIÓN', M, 330, s0 + 0.1, COLOR.yellow, { size: 22 });
  lines(t, ['«Boost»'], M, 480, 0, 130, V(36));
  slam(t, 'cae a cero.', M, 640, V(37), 110, COLOR.red);
}

// El ciclo empieza de nuevo: anillo que da una vuelta.
function sCycle(t, s0) {
  bg();
  const p = ease.inOut(prog(t, V(39) - 0.2, V(39) + 1.6));
  const cx = 1380, cy = 540, r = 260;
  ctx.save();
  ctx.strokeStyle = COLOR.faint;
  ctx.lineWidth = 16;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = COLOR.yellow;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
  const q = -Math.PI / 2 + Math.PI * 2 * p;
  ctx.fillStyle = COLOR.yellow;
  ctx.beginPath(); ctx.arc(cx + Math.cos(q) * r, cy + Math.sin(q) * r, 22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  tag(t, 'AL VOLVER A ACELERAR', M, 380, s0 + 0.1);
  lines(t, ['El ciclo empieza', 'de nuevo'], M, 520, 110, 104, V(39) + 0.4, { maxW: 680 });
}

// La idea: una explosión fuera del motor (vista general del esquema).
function sIdea(t, s0) {
  bg(); dots();
  const bang = V(45) + 1.3;
  const bk = prog(t, bang, bang + 0.7);
  camera(980, 560, lerp(0.86, 0.9, prog(t, s0, s0 + 8)), () => drawSystem(t, { thr: 0, air: 0.1, ex: 0.1, rps: 1.0, labels: prog(t, s0 + 0.5, s0 + 1.5), bang: bk > 0 && bk < 1 ? bk : 0 }));
  shock(W / 2 + (SYS.collector[0] - 980) * 0.9, H / 2 + (SYS.collector[1] - 560) * 0.9, prog(t, bang, bang + 0.9), 320);
  tag(t, 'LA IDEA ES SENCILLA PERO DESTRUCTIVA', M, 120, s0 + 0.1);
  lines(t, ['Una explosión fuera del motor'], M, 220, 0, 84, V(45) + 0.3, { colors: [COLOR.fire] });
}

// La centralita ordena: inyectores sin cortar y bypass abierto.
function sCommand(t, s0, s1) {
  bg(); dots();
  const inj = prog(t, V(48) + 4.2, V(48) + 5.0);
  const by = prog(t, V(49) + 0.8, V(49) + 1.6);
  const u = span(t, s0, s1);
  camera(lerp(560, 640, ease.inOut(u)), lerp(420, 470, ease.inOut(u)), lerp(1.2, 1.35, ease.inOut(u)), () => drawSystem(t, {
    thr: 0, air: 0, bypass: by, inj, ex: 0.15, rps: 1.2, ecu: ease.out(prog(t, s0 + 0.2, s0 + 0.8)), sig: prog(t, V(48) + 2.4, V(48) + 3.0), labels: 1,
  }));
  scrim();
  tag(t, 'LA CENTRALITA ORDENA', M, 860, s0 + 0.1);
  label(ctx, 'a los inyectores que sigan escupiendo gasolina', M, 930, inj > 0 ? COLOR.yellow : DIM, prog(t, V(48) + 4.2, V(48) + 4.7), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'y a la válvula bypass que siga dejando pasar aire', M, 990, COLOR.air, prog(t, V(49) + 0.6, V(49) + 1.1), { size: 40, spacing: 0, weight: 600 });
}

// El truco: el encendido se retrasa hasta 40 grados.
function sRetard(t, s0) {
  bg(); dots();
  const k = ease.inOut(prog(t, V(51) + 1.0, V(52) + 0.6));
  const spark = lerp(350, 400, k);
  const a = 360 + ((t - s0) * 240) % 360;
  drawDial(t, { cx: 1380, cy: 560, r: 300, a, spark, appear: ease.out(prog(t, s0, s0 + 0.5)), showRetard: prog(t, V(52) - 0.2, V(52) + 0.6) });
  label(ctx, 'CHISPA', 1380 + Math.cos((spark - 360 - 90) * Math.PI / 180) * 380, 560 + Math.sin((spark - 360 - 90) * Math.PI / 180) * 380, COLOR.yellow, prog(t, s0 + 0.4, s0 + 0.8), { size: 22, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'SE RETRASA BRUTALMENTE LA CHISPA', M, 380, s0 + 0.1);
  lines(t, ['Hasta', '40 grados'], M, 520, 130, 130, V(52) + 0.1, { maxW: 600, colors: [COLOR.paper, COLOR.red] });
}

// El cilindro: primero el encendido normal (pistón arriba), luego con la válvula de escape abierta.
function sCylinder(t, s0, s1) {
  bg(); dots();
  const als = t >= V(54) - 0.2 ? 1 : 0;
  const rate = 300;
  const a = ((t - s0) * rate) % 720;
  const spark = als ? 400 : 350;
  drawCylinder(t, { cx: 1260, cy: 540, s: 1.05, a, spark, als });
  drawDial(t, { cx: 1720, cy: 300, r: 110, a: a % 360, spark, appear: 1, showRetard: als });
  tag(t, als ? 'CON ANTI-LAG, LA BUJÍA SALTA' : 'NORMALMENTE, LA MEZCLA SE ENCIENDE', M, 380, als ? V(54) : s0 + 0.1);
  if (!als) lines(t, ['Con el pistón', 'arriba'], M, 520, 120, 110, V(53) + 0.8, { maxW: 560, exit: [V(54) - 0.5, V(54) - 0.2] });
  else lines(t, ['Con la válvula', 'de escape abierta'], M, 520, 110, 96, V(54) + 0.4, { maxW: 620, colors: [COLOR.paper, COLOR.fire] });
}

// La mezcla viaja al colector de escape, a más de 800 °C.
function sTravel(t, s0, s1) {
  bg(); dots();
  const u = span(t, s0, s1);
  const heat = ease.inOut(prog(t, V(56), V(56) + 1.6)) * 0.45;
  camera(lerp(1160, 1220, ease.inOut(u)), lerp(560, 600, ease.inOut(u)), lerp(1.35, 1.6, ease.inOut(u)), () => drawSystem(t, {
    thr: 0, air: 0, bypass: 1, inj: 1, unburnt: ease.out(prog(t, s0 + 0.3, s0 + 1.2)), ex: 0.15, rps: 1.5, heat, labels: 0,
  }));
  scrim();
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(56), V(56) + 0.4));
  counter(800 * ease.outExpo(prog(t, V(56), V(56) + 1.4)), M - 6, 880, 170, COLOR.fire);
  ctx.restore();
  label(ctx, 'GRADOS CENTÍGRADOS', M, 950, DIM, prog(t, V(56) + 0.6, V(56) + 1.0), { size: 22, spacing: 6, weight: 700 });
  tag(t, 'AIRE Y GASOLINA CRUDA VIAJAN HACIA EL COLECTOR', M, 130, s0 + 0.1, COLOR.yellow, { size: 22 });
}

// ¡BAM!: detonación en el colector y onda de presión contra la turbina.
function sBam(t, s0, s1) {
  bg(); dots();
  const bam = V(60);
  const bk = prog(t, bam - 0.02, bam + 0.8);
  const u = span(t, s0, s1);
  const z = lerp(1.6, 1.75, ease.inOut(u));
  const cx = 1220, cy = 620;
  camera(cx, cy, z, () => drawSystem(t, {
    thr: 0, air: 0, bypass: 1, inj: 1, unburnt: t < bam ? 1 : 0.4, ex: t < bam ? 0.15 : 0.9, rps: (u2) => (u2 < bam ? 1.5 : lerp(1.5, 6, ease.outExpo(prog(u2, bam, bam + 1.5)))),
    rpsT0: s0, heat: 0.55, bang: bk > 0 && bk < 1 ? bk : 0,
  }));
  scrim();
  const [sx, sy] = [W / 2 + (SYS.collector[0] - cx) * z, H / 2 + (SYS.collector[1] - cy) * z];
  shock(sx, sy, prog(t, bam, bam + 1.0), 520);
  tag(t, 'AL TOCAR EL METAL INCANDESCENTE', M, 130, s0 + 0.1, COLOR.yellow, { size: 22 });
  lines(t, ['La mezcla detona', 'en el colector'], M, 260, 100, 90, V(59) + 0.6, { maxW: 700, exit: [bam - 0.3, bam - 0.05] });
  slam(t, '¡BAM!', M, 330, bam, 220, COLOR.fire);
}

// La expansión golpea las aspas: la turbina se acelera.
function sHit(t, s0) {
  bg();
  const rps = (u) => lerp(2, 7, ease.outExpo(prog(u, s0 + 0.4, s0 + 2.0)));
  const th = spinAngle(t, s0, rps);
  const pulse = (k) => prog(t, s0 + 0.4 + k * 0.6, s0 + 1.2 + k * 0.6);
  for (let k = 0; k < 6; k++) shock(1340, 540, pulse(k), 420);
  drawWheel(th, rps(t) / 60 * Math.PI * 2, 1340, 540, 300, 1, { hot: 0.6 });
  tag(t, 'LA EXPANSIÓN DE GASES GOLPEA LAS ASPAS', M, 380, s0 + 0.1, COLOR.yellow, { size: 22 });
  lines(t, ['Con una fuerza', 'brutal'], M, 520, 120, 120, V(61) + 3.4, { maxW: 600, colors: [COLOR.paper, COLOR.fire] });
}

// 120.000 vueltas gracias a explosiones continuas (detonaciones al ritmo de la música).
function sSustain(t, s0, s1) {
  bg(); dots();
  const beat = 0.25;
  const ph = ((t - s0) % beat) / beat;
  camera(1150, 700, 1.1, () => drawSystem(t, { thr: 0, air: 0, bypass: 1, inj: 1, unburnt: 0.7, ex: 0.85, rps: 6, rpsT0: s0, heat: 0.6, bang: ph < 0.6 ? ph / 0.6 : 0, flame: 0.8 }));
  scrim();
  tag(t, 'LA TURBINA NUNCA SE ENTERA', M, 130, s0 + 0.1, COLOR.yellow, { size: 22 });
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(63) + 0.4, V(63) + 0.8));
  ctx.font = FONT.display(700, 170);
  ctx.fillStyle = COLOR.paper;
  ctx.fillText('120.000', M - 6, 330);
  ctx.restore();
  label(ctx, 'vueltas, gracias a explosiones continuas', M, 400, DIM, prog(t, V(63) + 1.4, V(63) + 1.9), { size: 40, spacing: 0, weight: 600 });
}

// Cero lag: la misma gráfica, ahora con Anti-lag.
function sZeroLag(t, s0) {
  bg(); dots();
  drawLagGraph(t, s0, { draw: 1, als: ease.inOut(prog(t, V(65), V(65) + 1.2)) });
  tag(t, 'CUANDO EL PILOTO VUELVE A PISAR A FONDO', M, 330, s0 + 0.1, COLOR.yellow, { size: 22 });
  lines(t, ['La presión,', 'al máximo'], M, 470, 120, 110, V(65) + 0.4, { maxW: 600, colors: [COLOR.paper, COLOR.fire] });
}

// Mapa de Anti-lag ajustable en la centralita (interfaz genérica).
function sMap(t, s0) {
  bg(); dots();
  drawMap(t, { x: 980, y: 260, w: 800, h: 540, preset: 0.75, appear: ease.out(prog(t, s0, s0 + 1.2)), cursor: [Math.floor(lerp(2, 8, ease.inOut(prog(t, s0 + 1, s0 + 3)))), 2] });
  tag(t, 'LAS CENTRALITAS PERMITÍAN', M, 380, s0 + 0.1);
  lines(t, ['Mapas de Anti-lag', 'ajustables'], M, 520, 110, 100, V(75) + 0.8, { maxW: 700 });
}

// Botones en el salpicadero: asfalto seco de Córcega frente al barro de Gales.
function sKnob(t, s0) {
  bg();
  const corse = V(76) + 5.2, wales = V(76) + 6.9;
  const pos = t < corse ? 0.5 : t < wales ? lerp(0.5, 1, ease.inOut(prog(t, corse, corse + 0.5))) : lerp(1, 0.25, ease.inOut(prog(t, wales, wales + 0.5)));
  drawKnob(t, { cx: 1380, cy: 500, r: 190, pos, appear: ease.out(prog(t, s0, s0 + 0.5)) });
  label(ctx, 'CÓRCEGA · ASFALTO SECO', 1380, 860, t >= corse && t < wales ? COLOR.paper : DIM, prog(t, corse, corse + 0.4), { size: 26, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'GALES · BARRO', 1380, 910, t >= wales ? COLOR.paper : DIM, prog(t, wales, wales + 0.4), { size: 26, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'BOTONES EN EL SALPICADERO PARA REGULAR', M, 380, s0 + 0.1);
  lines(t, ['La agresividad', 'del sistema'], M, 520, 110, 104, V(76) + 2.6, { maxW: 680 });
}

// El precio: el colector se calienta por encima de 1.100 °C, se raja y el turbo se funde.
function sHeat(t, s0, s1) {
  bg(); dots();
  const u = span(t, s0, s1);
  const heat = lerp(0.5, 1, ease.inOut(prog(t, V(79) + 2.0, V(79) + 5.0)));
  camera(1190, 660, lerp(1.5, 1.7, ease.inOut(u)), () => drawSystem(t, { thr: 0, air: 0, bypass: 1, inj: 1, unburnt: 0.6, ex: 0.8, rps: 5, rpsT0: s0, heat, flame: 0.5, cracks: 0 }));
  scrim();
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(79) + 3.6, V(79) + 4.0));
  ctx.font = FONT.display(700, 170);
  ctx.fillStyle = COLOR.yellow;
  ctx.fillText(fmt(lerp(800, 1100, ease.outExpo(prog(t, V(79) + 3.6, V(79) + 5.0)))), M - 6, 330);
  ctx.restore();
  label(ctx, 'GRADOS, POR ENCIMA DE', M, 130, COLOR.yellow, prog(t, V(79) + 3.4, V(79) + 3.8), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'las explosiones constantes dentro de los colectores', M, 400, DIM, prog(t, s0 + 0.4, s0 + 0.9), { size: 40, spacing: 0, weight: 600 });
}
function sCrack(t, s0, s1) {
  bg(); dots();
  const u = span(t, s0, s1);
  const cr = ease.inOut(prog(t, V(80) + 0.2, V(80) + 1.4));
  const melt = ease.inOut(prog(t, V(81) + 0.4, V(81) + 2.0));
  camera(1150, 720, lerp(1.7, 1.85, ease.inOut(u)), () => drawSystem(t, { thr: 0, air: 0, bypass: 1, inj: 1, unburnt: 0.6, ex: 0.8, rps: lerp(5, 2, melt), rpsT0: s0, heat: 1, cracks: cr }));
  scrim();
  tag(t, 'EL PRECIO', M, 130, s0 + 0.1, COLOR.yellow);
  lines(t, ['Los colectores', 'se rajaban'], M, 260, 100, 96, V(80) + 0.1, { maxW: 640, exit: [V(81) - 0.2, V(81) + 0.1] });
  lines(t, ['Los turbos se derretían', 'por dentro'], M, 260, 100, 90, V(81) + 0.4, { maxW: 760, colors: [COLOR.paper, COLOR.fire] });
}

// Cierre: logotipo, suscripción y despedida.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 760, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = la;
  ctx.drawImage(lg, W / 2 - w / 2, 380 - h / 2, w, h);
  ctx.restore();
  pill(t, 'Suscríbete', W / 2, 760, s0 + 0.3, { press: V(88) + 0.5, color: COLOR.red, size: 42 });
  label(ctx, 'Nos vemos en la próxima curva.', W / 2, 920, DIM, prog(t, V(88) + 1.0, V(88) + 1.5), { size: 42, spacing: 0, weight: 600, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [CLIP.at, sClipA, 'cut'],
  [CLIP.at + 2.75, sClipB, 'cut'],
  [cut(4), kPhoto({ img: 'abierto', fx: 0.55, fy: 0.5, dark: 0.35, tag: 'PARA LOS INGENIEROS DE LOS AÑOS 80 Y 90', title: ['La única forma', 'de domar a la bestia'], tt: V(5) + 0.4, size: 104 }), 'dissolve'],
  [cut(6), sName, 'wipe'],
  [cut(9), kPhoto({ img: 'llamas', fx: 0.4, fy: 0.5, z: [1.12, 1.02], dark: 0.3, title: ['No estaba ahí', 'para hacer ruido'], tt: V(9) + 0.3, pos: 'top', size: 110 }), 'cut'],
  [cut(10), kType({ tag: 'UNA SOLUCIÓN CIENTÍFICA RADICAL A UN PROBLEMA QUE PODÍA COSTARTE', title: ['La vida', 'o el campeonato'], tt: V(10) + 3.4, size: 160, colors: [COLOR.paper, COLOR.yellow] }), 'whip'],
  [cut(11), kPhoto({ img: 'turboColector', fx: 0.45, fy: 0.5, z: [1.2, 1.06], dark: 0.35, tag: 'HOY VAMOS A ABRIR LAS ENTRAÑAS', title: ['de los motores turbo'], label: 'del Grupo B y del WRC', labelT: V(11) + 3.0, tt: V(11) + 1.2, size: 110 }), 'slices'],
  [Math.floor((V(11) + 5.2) / 0.25) * 0.25, sOpen, 'cut'],
  [cut(12), kType({ title: ['Para entender la cura,', 'hay que entender', 'la enfermedad'], tt: V(12) + 0.1, size: 130, colors: [COLOR.paper, COLOR.paper, COLOR.red] }), 'whipV'],
  [cut(14), kType({ title: ['Turbo Lag'], align: 'center', tt: V(14), size: 280, label: 'o retraso del turbo', labelT: V(14) + 0.9, stripes: true }), 'cut'],
  [cut(15), sGiant, 'wipe'],
  [cut(18), sHowTurbo, 'slices'],
  [cut(19), sLag, 'whip'],
  [cut(21), kType({ tag: 'DURANTE ESOS DOS SEGUNDOS', title: ['El coche', 'estaba muerto.'], tt: V(22), size: 170 }), 'dissolve'],
  [cut(23), sSurge, 'cut'],
  [cut(26), kType({ tag: 'EL MOMENTO CRÍTICO OCURRE', title: ['Al frenar.'], tt: V(26) + 1.2, size: 220, colors: [COLOR.red] }), 'whip'],
  [cut(27), kPhoto({ img: 'pedales', fx: 0.4, fy: 0.5, z: [1.25, 1.1], dark: 0.35, tag: 'EL PILOTO', title: ['Levanta el pie', 'del acelerador'], tt: V(27) + 0.4, size: 110 }), 'cut'],
  [cut(28), sThrottle, 'slices'],
  [cut(29), sFlow, 'whip'],
  [cut(31), kType({ title: ['¿El resultado?'], align: 'center', tt: V(31), size: 170 }), 'cut'],
  [cut(32), sSpinDown, 'cut'],
  [cut(35), sBoostZero, 'whipV'],
  [cut(38), sCycle, 'cut'],
  [cut(40), kPhoto({ img: 'vanoSubaru', fx: 0.5, fy: 0.5, z: [1.3, 1.12], dark: 0.45, tag: 'HABÍA QUE MANTENER LA TURBINA', title: ['Girando a', 'máxima velocidad'], tt: V(40) + 1.6, size: 110, label: 'incluso cuando el piloto estaba frenando', labelT: V(41) + 0.2 }), 'dissolve'],
  [cut(42), kType({ tag: 'AQUÍ ENTRA LA GENIALIDAD DEL', title: ['Anti-lag'], align: 'center', tt: V(42) + 0.9, size: 300, stripes: true }), 'wipe'],
  [cut(43), sIdea, 'cut'],
  [cut(46), kType({ tag: 'CUANDO EL PILOTO LEVANTA EL PIE', title: ['El sistema', 'entra en acción'], tt: V(47), size: 150, colors: [COLOR.paper, COLOR.fire] }), 'whip'],
  [cut(48), sCommand, 'slices'],
  [cut(50), kType({ title: ['Pero aquí', 'está el truco:'], tt: V(50) + 0.1, size: 170, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(51), sRetard, 'cut'],
  [cut(53), sCylinder, 'whipV'],
  [cut(55), sTravel, 'slices'],
  [cut(57), sBam, 'cut'],
  [cut(61), sHit, 'cut'],
  [cut(62), sSustain, 'whip'],
  [cut(64), sZeroLag, 'slices'],
  [cut(66), kType({ bg: COLOR.fire, title: ['Cero lag.'], align: 'center', tt: V(66) - 0.05, size: 300, color: COLOR.ink }), 'cut'],
  [cut(67), kType({ title: ['Aceleración', 'instantánea.'], align: 'center', tt: V(67) - 0.05, size: 190 }), 'cut'],
  [cut(68), kPhoto({ img: 'llamas', fx: 0.3, fy: 0.55, z: [1.5, 1.3], dark: 0.3, tag: 'EL SUBPRODUCTO VISUAL DE LAS DETONACIONES', title: ['Llamas por', 'el tubo de escape'], tt: V(68) + 3.6, size: 110 }), 'wipe'],
  [Math.floor((V(68) + 6.0) / 0.25) * 0.25, (t, s0, s1) => {
    bg();
    // Reprise del paso del coche, a cámara lenta (0,75×) con mezcla de fotogramas por el obturador.
    drawClip((t - s0) * 0.75, { zoom: 1.04, dark: 0.2 });
    titleBlock(t, { tag: 'Y EL SONIDO ATRONADOR QUE BAUTIZÓ AL SISTEMA', title: ['Bang-Bang'], tt: s0 + 0.6, size: 170 }, s0);
  }, 'cut'],
  [cut(69), kSplit({ img: 'taller', fx: 0.5, fy: 0.45, tag: 'EN LA ÉPOCA DEL PEUGEOT 205 T16', title: ['Rudimentario', 'y salvaje'], tt: V(70) + 0.2, size: 120, label: 'casi incontrolable y muy tosco', labelT: V(71) + 0.4 }), 'slices'],
  [cut(72), kPhoto({ img: 'presentacion', fx: 0.5, fy: 0.45, dark: 0.45, tag: 'GRUPO A Y WORLD RALLY CARS · AÑOS 90', title: ['La electrónica', 'lo cambió todo'], tt: V(73), size: 120 }), 'whip'],
  [cut(74), kPhoto({ img: 'bosque', fx: 0.5, fy: 0.62, z: [1.2, 1.08], dark: 0.3, tag: 'EN COCHES COMO EL', title: ['Subaru Impreza', 'WRC97'], tt: V(74) + 0.6, size: 120, pos: 'top', colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(75), sMap, 'slices'],
  [cut(76), sKnob, 'cut'],
  [cut(77), kType({ tag: 'EL «BANG-BANG» PASÓ DE SER UN MARTILLO', title: ['A ser un bisturí', 'de precisión'], tt: V(77) + 1.8, size: 150, colors: [COLOR.paper, COLOR.yellow] }), 'whipV'],
  [cut(78), kType({ title: ['Desafiar a la física', 'tiene un precio.'], tt: V(78) + 0.2, size: 140, colors: [COLOR.paper, COLOR.red] }), 'dissolve'],
  [cut(79), sHeat, 'cut'],
  [cut(80), sCrack, 'cut'],
  [cut(82), kPhoto({ img: 'renault', fx: 0.5, fy: 0.5, z: [1.15, 1.05], dark: 0.4, tag: 'OBLIGANDO A LOS MECÁNICOS A REEMPLAZARLOS', title: ['Cada pocos tramos'], tt: V(82) + 1.6, size: 120 }), 'slices'],
  [cut(83), kPhoto({ img: 'asistencia', fx: 0.5, fy: 0.5, z: [1.12, 1.03], dark: 0.4, title: ['Una pesadilla', 'logística'], tt: V(83) + 0.3, size: 120, label: 'pero el peaje a pagar por la gloria', labelT: V(84) + 0.2 }), 'whip'],
  [cut(85), kType({ bg: COLOR.paper, title: ['El Anti-lag', 'definió una era'], tt: V(85) + 0.1, size: 170, color: COLOR.ink, stripes: true }), 'wipe'],
  [Math.floor((V(86) + 0.6) / 0.25) * 0.25, kPhoto({ img: 'llamas', fx: 0.6, fy: 0.5, z: [1.06, 1.0], dark: 0.3, tag: 'MONSTRUOS ESCUPE-FUEGO', title: ['La banda sonora', 'más increíble'], tt: V(86) + 3.0, size: 120, label: 'de la historia del motor', labelT: V(86) + 5.0 }), 'slices'],
  [cut(87), (t, s0) => {
    bg();
    drawWave(t, s0 - 1.2, { y: 520, h: 260, x0: M, x1: W - M, appear: ease.out(prog(t, s0, s0 + 0.4)), color: COLOR.fire });
    titleBlock(t, { title: ['¿Conocías la ciencia', 'detrás de este sonido?'], tt: V(87), size: 110, y0: 860, align: 'left' }, s0);
  }, 'dissolve'],
  [cut(88), sChannel, 'wipe'],
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


// Golpes de cámara en los momentos fuertes del montaje.
export const HITS = [CLIP.at, cut(6), cut(14), cut(26), V(37), cut(42), V(60), cut(66), cut(67)];
const SHAKES = [CLIP.at, V(60), cut(66)];

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
      const k = Math.exp(-(t - h) * 8) * 16;
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
  grain(ctx, t, 0.065);
}

export function init(assets) {
  A = assets;
  for (const k of ['type', 'a', 'b']) layers[k] = makeCanvas();
  layers.gray = {};
}

export const SHOT_STARTS = SHOTS.map((s) => s[0]);
export const SHOT_TRANS = SHOTS.map((s) => [s[0], s[2] ?? 'cut']);
