// Escenas del vídeo del Peugeot 205 Turbo 16. Todo depende solo de `t`.
import { W, H, V, cut, DURATION } from './timeline.js';
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES,
} from './lib.js';

let A; // imágenes cargadas
let ctx;
const layers = {};
const M = GRID.m;
const DIM = 'rgba(244,242,238,0.7)';
const INK_DIM = 'rgba(14,15,18,0.65)';

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
    ctx.fillStyle = `rgba(14,15,18,${dark})`;
    ctx.fillRect(x, y, w, h);
  }
  if (vig > 0) vignette(ctx, x, y, w, h, vig);
  ctx.restore();
  return map;
}

// Titular de varias líneas con el mismo cuerpo, revelado por máscara.
function lines(t, list, x, y0, lead, maxPx, t0, { color = COLOR.paper, weight = 900, exit = null, step = 0.12, colors = null, maxW = GRID.w, align = 'left' } = {}) {
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
  ctx.font = FONT.display(900, size);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// Cifra con dígitos de ancho fijo.
function counter(value, x, y, size, color = COLOR.paper, align = 'left', digits = 0) {
  const str = String(Math.round(value)).padStart(digits, ' ');
  ctx.save();
  ctx.font = FONT.display(900, size);
  const slot = ctx.measureText('0').width;
  const total = slot * str.length;
  const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  [...str].forEach((d, i) => ctx.fillText(d, x0 + slot * (i + 0.5), y));
  ctx.restore();
  return total;
}

function pill(t, str, cx, cy, t0, { press = null, color = COLOR.red, pressed = COLOR.navy, text = COLOR.paper, size = 40 } = {}) {
  const a = ease.outExpo(prog(t, t0, t0 + 0.45));
  if (a <= 0) return;
  const p = press ? Math.sin(Math.PI * prog(t, press, press + 0.3)) : 0;
  ctx.save();
  ctx.globalAlpha *= a;
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

// ---------------------------------------------------------------------------
// Planta esquemática (frente a la derecha; 1000 unidades = largo).
// layout: 'audi' (5 cilindros por delante del eje), 'lancia' (central longitudinal), '205' (central transversal).

function bodyHalf(stretch) {
  const r = 1 + 0.22 * stretch; // el 205 «Dakar» alarga la zaga
  return [
    [492, 0], [489, -140], [478, -200], [455, -222], [380, -232], [330, -246], [210, -246], [170, -228],
    [-120 * r, -228], [-160 * r, -246], [-360 * r, -246], [-410 * r, -232], [-458 * r, -216], [-486 * r, -168], [-492 * r, 0],
  ];
}
const CABIN = poly(catmull(mirror([[190, 0], [182, -150], [150, -184], [-40, -186], [-90, -160], [-96, 0]]), true, 6));
const bodyCache = new Map();
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

function drawTurbo(t, cx, cy, r, appear) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.globalAlpha = appear;
  // Voluta: espiral de la carcasa.
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2;
    const rr2 = r * (1.18 + 0.22 * (i / 200));
    const x = Math.cos(a) * rr2, y = Math.sin(a) * rr2;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.lineTo(r * 1.4 + 160, -r * 0.0);
  c.stroke();
  c.globalAlpha = appear * 0.35;
  c.beginPath();
  c.arc(0, 0, r * 1.06, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = appear;
  const th = turboAngle(t);
  const dth = turboAngle(t) - turboAngle(t - 1 / 60);
  const N = 10;
  for (let k = 0; k < N; k++) {
    c.globalAlpha = appear * (1 / (k + 1));
    const base = th - dth * (k / (N - 1));
    for (let b = 0; b < 12; b++) {
      const a0 = base + (b / 12) * Math.PI * 2;
      const full = b % 2 === 0;
      c.beginPath();
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const rad = lerp(r * 0.2, r * (full ? 1 : 0.92), u);
        const a = a0 + u * u * 0.9;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = full ? COLOR.yellow : COLOR.red;
      c.lineWidth = full ? 9 : 6;
      c.lineCap = 'round';
      c.stroke();
    }
  }
  c.globalAlpha = appear;
  c.fillStyle = COLOR.ink;
  c.beginPath();
  c.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3;
  c.stroke();
  c.restore();
}
function drawDownforce(t, x0, x1, yTop, ySurf, appear) {
  const c = ctx;
  c.save();
  c.globalAlpha = appear;
  c.strokeStyle = 'rgba(13,13,15,0.55)';
  c.lineWidth = 3;
  c.setLineDash([60, 30]);
  c.lineDashOffset = -t * 600;
  for (let k = 0; k < 4; k++) {
    const yy = yTop + k * 38;
    c.beginPath();
    c.moveTo(x0 - 160, yy);
    c.bezierCurveTo(x0 + 300, yy, x0 + 500, yy - 60 + k * 10, x1 + 200, yy - 120 + k * 22);
    c.stroke();
  }
  c.setLineDash([]);
  // Flechas de carga: bajan con un pulso escalonado.
  for (let i = 0; i < 6; i++) {
    const x = lerp(x0 + 60, x1 - 60, i / 5);
    const ph = (t * 1.6 + i * 0.12) % 1;
    const d = ease.inOut(ph) * 26;
    const y1 = ySurf - 40 + d;
    c.strokeStyle = COLOR.red;
    c.fillStyle = COLOR.red;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(x, y1 - 120);
    c.lineTo(x, y1 - 20);
    c.stroke();
    c.beginPath();
    c.moveTo(x - 20, y1 - 26); c.lineTo(x + 20, y1 - 26); c.lineTo(x, y1 + 6);
    c.closePath();
    c.fill();
  }
  c.restore();
}
function ridge(seed, x, base, amp, freq) {
  return base - amp * (0.6 * noise1(x * freq + seed) + 0.3 * noise1(x * freq * 2.3 + seed * 3) + 0.1 * noise1(x * freq * 5.1 + seed * 7));
}
const ROAD = (() => {
  // Zigzag que sube por la ladera hacia la cumbre (1340, 300).
  const pts = [[260, 1000], [700, 930], [520, 860], [900, 800], [760, 730], [1080, 660], [960, 590], [1200, 520], [1110, 450], [1300, 380], [1340, 318]];
  return poly(catmull(pts, false, 10).slice(0, -1).concat([pts[pts.length - 1]]));
})();
function drawMountain(t, t0, appear) {
  const c = ctx;
  const cam = ease.inOut(prog(t, t0, t0 + 4.2));
  c.save();
  c.globalAlpha = appear;
  c.translate(0, lerp(40, -30, cam));
  const layersDef = [
    { col: '#26262B', base: 520, amp: 160, f: 0.004, seed: 11, par: 0.2 },
    { col: '#1C1C20', base: 700, amp: 120, f: 0.006, seed: 23, par: 0.5 },
  ];
  for (const L of layersDef) {
    c.fillStyle = L.col;
    c.beginPath();
    c.moveTo(-50, H + 100);
    for (let x = -50; x <= W + 50; x += 12) c.lineTo(x, ridge(L.seed, x + cam * 200 * L.par, L.base, L.amp, L.f));
    c.lineTo(W + 50, H + 100);
    c.closePath();
    c.fill();
  }
  // Macizo principal con la cumbre.
  c.fillStyle = '#121215';
  c.beginPath();
  c.moveTo(-50, H + 100);
  for (let x = -50; x <= W + 50; x += 8) {
    const peak = 300 + Math.abs(x - 1340) * 0.62;
    const y = Math.max(peak, 300) + 18 * noise1(x * 0.03 + 5) + 8 * noise1(x * 0.11);
    c.lineTo(x, Math.min(y, H + 50));
  }
  c.lineTo(W + 50, H + 100);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(243,241,236,0.18)';
  c.lineWidth = 2;
  c.stroke();
  // Carretera: se dibuja hasta la cumbre, con el coche como punto de luz.
  const p = ease.inOut(prog(t, t0 + 0.3, t0 + 3.6));
  c.strokeStyle = 'rgba(243,241,236,0.25)';
  c.lineWidth = 3;
  trace(c, ROAD, 1);
  c.strokeStyle = COLOR.yellow;
  c.lineWidth = 6;
  trace(c, ROAD, p);
  const target = ROAD.len * p;
  let i = 1;
  while (i < ROAD.pts.length - 1 && ROAD.acc[i] < target) i++;
  const f = (target - ROAD.acc[i - 1]) / (ROAD.acc[i] - ROAD.acc[i - 1] || 1);
  const carX = lerp(ROAD.pts[i - 1][0], ROAD.pts[i][0], clamp(f)), carY = lerp(ROAD.pts[i - 1][1], ROAD.pts[i][1], clamp(f));
  if (p > 0) {
    c.fillStyle = COLOR.paper;
    c.beginPath();
    c.arc(carX, carY, 9, 0, Math.PI * 2);
    c.fill();
  }
  // Nubes: bancos planos de color papel con poca opacidad, a la deriva.
  for (let k = 0; k < 5; k++) {
    const y = 250 + k * 34;
    const drift = (t * (14 + k * 5) + k * 300) % (W + 900) - 450;
    c.fillStyle = `rgba(243,241,236,${0.05 + 0.02 * k})`;
    c.beginPath();
    c.ellipse(drift + 400, y, 520, 26 + k * 4, 0, 0, Math.PI * 2);
    c.ellipse(W - drift * 0.7, y + 20, 600, 22 + k * 3, 0, 0, Math.PI * 2);
    c.fill();
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

// Entrada: logotipo del canal.
function sIdent(t) {
  bg();
  const lg = A.logo;
  const a = ease.out(prog(t, 0.05, 0.55));
  const w = 980, h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = a;
  zoomAbout(lerp(1.06, 1.0, ease.outExpo(prog(t, 0.05, 1.6))));
  ctx.drawImage(lg, W / 2 - w / 2, H / 2 - h / 2 - 10, w, h);
  ctx.restore();
}

// Audi frente a Lancia: dos mitades que se encienden por turnos.
function sVersus(t, s0) {
  bg();
  const L0 = V(0), L1 = V(1);
  ctx.fillStyle = 'rgba(244,242,238,0.12)';
  ctx.fillRect(W / 2 - 1, 120 + (H - 240) * (1 - ease.outExpo(prog(t, s0, s0 + 0.8))), 2, (H - 240) * ease.outExpo(prog(t, s0, s0 + 0.8)));
  drawPlan(t, { cx: 480, cy: 440, scale: 0.6, draw: ease.out(prog(t, L0 - 0.2, L0 + 0.7)), layout: 'audi', drive: 'awd', power: prog(t, L0 + 0.6, L0 + 1.4), flow: COLOR.sky });
  drawPlan(t, { cx: 1440, cy: 440, scale: 0.6, draw: ease.out(prog(t, L1 - 0.2, L1 + 0.7)), layout: 'lancia', drive: 'rwd', power: prog(t, L1 + 0.6, L1 + 1.4), flow: COLOR.red });
  tag(t, 'AUDI', 480, 740, L0, COLOR.sky, { align: 'center' });
  const sz = fitSize(ctx, 'Tracción total y fuerza bruta', (px) => FONT.display(900, px), 760, 58);
  revealText(ctx, 'Tracción total y fuerza bruta', 480, 830, FONT.display(900, sz), COLOR.paper, prog(t, L0 + 0.3, L0 + 1.0), { align: 'center', stagger: 0.01 });
  tag(t, 'LANCIA', 1440, 740, L1, COLOR.red, { align: 'center' });
  revealText(ctx, 'Equilibrio y agilidad', 1440, 830, FONT.display(900, sz), COLOR.paper, prog(t, L1 + 0.8, L1 + 1.5), { align: 'center', stagger: 0.012 });
  label(ctx, 'de la tracción trasera', 1440, 900, DIM, prog(t, L1 + 2.0, L1 + 2.5), { size: 36, spacing: 0, weight: 600, align: 'center' });
}

// Gráfica genérica que cae: problemas financieros.
function sFinance(t, s0) {
  bg();
  const x0 = 900, x1 = 1780, y0 = 260, y1 = 760;
  const pts = [[0, 0.25], [0.15, 0.3], [0.3, 0.22], [0.45, 0.4], [0.6, 0.52], [0.72, 0.5], [0.86, 0.78], [1, 0.9]];
  const P = poly(catmull(pts.map(([u, v]) => [lerp(x0, x1, u), lerp(y0, y1, v)]), false, 10));
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, s0, s0 + 0.4));
  ctx.fillStyle = 'rgba(244,242,238,0.16)';
  for (let k = 0; k <= 4; k++) ctx.fillRect(x0, lerp(y0, y1 + 60, k / 4), x1 - x0, 2);
  ctx.restore();
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  trace(ctx, P, ease.inOut(prog(t, s0 + 0.2, s0 + 1.8)));
  const [hx, hy] = pointAt(P, ease.inOut(prog(t, s0 + 0.2, s0 + 1.8)));
  ctx.fillStyle = COLOR.red;
  ctx.beginPath();
  ctx.arc(hx, hy, 12, 0, Math.PI * 2);
  ctx.fill();
  titleBlock(t, { tag: 'PEUGEOT ESTABA EN', title: ['Problemas', 'financieros'], pos: 'top', y0: 520, maxW: 680, tt: V(9) + 0.5 }, s0);
}

// «205» con la foto del coche de calle dentro de las cifras.
function s205(t, s0, s1) {
  bg();
  const L = layers.type;
  const g = L.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  revealText(g, '205', W / 2, 800, FONT.display(900, 640), '#fff', prog(t, s0, s0 + 0.45), { stagger: 0.1, align: 'center' });
  g.globalCompositeOperation = 'source-in';
  drawCover(g, A.calle, 200, 100, W - 400, 900, { zoom: lerp(1.3, 1.1, ease.out(prog(t, s0, s1))), fx: 0.5, fy: 0.55 });
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(L, 0, 0);
  tag(t, 'SU NUEVO MODELO DE CALLE, EL', W / 2, 150, s0 + 0.1, COLOR.yellow, { align: 'center' });
}

// Peugeot Talbot Sport: rótulo compuesto, sin logotipo.
function sPTS(t, s0) {
  bg();
  ctx.save();
  zoomAbout(lerp(1.06, 1.0, ease.outExpo(prog(t, s0, s0 + 1))));
  tag(t, 'PARA ELLO, FUNDARON', W / 2, 330, s0 + 0.1, COLOR.yellow, { align: 'center' });
  const size = fitSize(ctx, 'Peugeot Talbot Sport', (px) => FONT.display(900, px), GRID.w, 150);
  revealText(ctx, 'Peugeot Talbot Sport', W / 2, 520, FONT.display(900, size), COLOR.paper, prog(t, V(13), V(13) + 0.8), { align: 'center', stagger: 0.012 });
  ctx.restore();
  stripesH(ctx, 580, 20, prog(t, V(13) + 0.3, V(13) + 1.2), 0, { x0: W / 2 - 520, x1: W / 2 + 520 });
  label(ctx, 'y al mando, un estratega brillante', W / 2, 760, DIM, prog(t, V(13) + 2.6, V(13) + 3.1), { size: 44, spacing: 0, weight: 600, align: 'center' });
}

function sTodt(t, s0) {
  bg(COLOR.navy);
  const s = ease.outExpo(prog(t, s0, s0 + 0.35));
  ctx.save();
  zoomAbout(lerp(1.25, 1, s) * lerp(1, 1.03, prog(t, s0 + 0.35, s0 + 2)));
  ctx.globalAlpha = clamp(s * 4);
  ctx.font = FONT.display(900, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.paper;
  ctx.fillText('Jean Todt', W / 2, H / 2 + 90);
  ctx.restore();
  stripesH(ctx, H / 2 + 150, 18, prog(t, s0 + 0.15, s0 + 0.8), 0, { x0: W / 2 - 600, x1: W / 2 + 600 });
}

// Cheque genérico en blanco (interfaz inventada con los colores del cliente).
function sCheque(t, s0) {
  bg();
  const a = ease.outExpo(prog(t, s0 + 0.05, s0 + 0.7));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(1340, 540 + (1 - a) * 60);
  ctx.rotate(-0.06 * (1 - a) - 0.03);
  ctx.fillStyle = COLOR.paper;
  ctx.beginPath();
  ctx.roundRect(-420, -190, 840, 380, 18);
  ctx.fill();
  stripesH(ctx, -190, 10, 1, 0, { x0: -420, x1: 420 });
  ctx.fillStyle = 'rgba(14,15,18,0.25)';
  for (const [x, y, w] of [[-360, -60, 520], [-360, 40, 380], [80, 110, 260], [190, -150, 150]]) ctx.fillRect(x, y, w, 3);
  ctx.strokeStyle = 'rgba(14,15,18,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(210, -60, 150, 60);
  ctx.restore();
  titleBlock(t, { tag: 'TODT RECIBIÓ', title: ['Un cheque', 'en blanco'], pos: 'top', y0: 520, maxW: 640, tt: V(16) + 0.6, label: 'y una misión:', labelT: V(16) + 1.9 }, s0);
}

function sRivals(t, s0) {
  bg();
  drawPlan(t, { cx: 1000, cy: 380, scale: 0.42, draw: ease.out(prog(t, s0 + 0.1, s0 + 0.9)), layout: 'audi', drive: 'awd' });
  drawPlan(t, { cx: 1560, cy: 380, scale: 0.42, draw: ease.out(prog(t, s0 + 0.3, s0 + 1.1)), layout: 'lancia', drive: 'rwd' });
  label(ctx, 'AUDI QUATTRO', 1000, 560, DIM, prog(t, s0 + 0.6, s0 + 1.0), { size: 22, spacing: 7, weight: 700, align: 'center' });
  label(ctx, 'LANCIA 037', 1560, 560, DIM, prog(t, s0 + 0.8, s0 + 1.2), { size: 22, spacing: 7, weight: 700, align: 'center' });
  titleBlock(t, { tag: 'EN LUGAR DE PRECIPITARSE', title: ['Analizó', 'a sus rivales'], pos: 'top', y0: 720, maxW: 700, tt: V(19) }, s0);
}

// Audi: la trayectoria ideal frente a la real, que se abre por el subviraje.
const IDEAL = poly(catmull([[880, 900], [1200, 860], [1420, 700], [1480, 470], [1440, 200]], false, 14));
const WIDE = poly(catmull([[880, 900], [1220, 870], [1510, 760], [1650, 520], [1690, 230]], false, 14));
function sUnder(t, s0) {
  bg();
  const p = ease.inOut(prog(t, V(21) - 0.2, V(21) + 3.6));
  ctx.save();
  ctx.setLineDash([16, 14]);
  ctx.strokeStyle = 'rgba(244,242,238,0.45)';
  ctx.lineWidth = 4;
  trace(ctx, IDEAL, ease.out(prog(t, s0, s0 + 1.2)));
  ctx.restore();
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 6;
  trace(ctx, WIDE, p);
  const [x, y, a] = pointAt(WIDE, p);
  drawPlan(t, { cx: x, cy: y, scale: 0.2, rot: a, layout: 'audi', drive: 'awd', hot: prog(t, V(21) + 0.2, V(21) + 0.8) });
  label(ctx, 'TRAYECTORIA IDEAL', 1300, 470, DIM, prog(t, s0 + 0.8, s0 + 1.2), { size: 22, spacing: 6, weight: 700, align: 'right' });
  titleBlock(t, { tag: 'EL AUDI QUATTRO ERA RAPIDÍSIMO, PERO…', title: ['Subvirador', 'y torpe'], pos: 'top', y0: 520, maxW: 640, tt: V(21) + 3.0,
    label: 'en curvas cerradas', labelT: V(21) + 3.9 }, s0);
  label(ctx, 'motor colgado por delante del eje', M, 300, COLOR.paper, prog(t, V(21) + 0.4, V(21) + 0.9), { size: 40, spacing: 0, weight: 600 });
}

function sSpin(t, s0) {
  bg();
  drawPlan(t, { cx: 1390, cy: 470, scale: 0.78, draw: ease.out(prog(t, s0, s0 + 0.8)), layout: 'lancia', drive: 'rwd', power: prog(t, s0 + 0.4, s0 + 1.0),
    flow: COLOR.red, hot: prog(t, s0 + 0.5, s0 + 1.0), spin: ease.inOut(prog(t, V(23) + 0.8, V(23) + 1.6)) });
  titleBlock(t, { tag: 'EL LANCIA 037 ERA ÁGIL', title: ['Sufría en', 'nieve y barro'], pos: 'top', y0: 530, maxW: 640, tt: V(23) + 1.5,
    label: 'y de motor central, pero…', labelT: V(22) + 1.2 }, s0);
}

// Lo mejor de ambos mundos: las dos plantas se funden en la del 205.
function sMerge(t, s0) {
  bg();
  const m = ease.inOutExpo(prog(t, V(25) - 0.1, V(25) + 0.9));
  ctx.save();
  ctx.globalAlpha = 1 - m;
  drawPlan(t, { cx: lerp(900, 1300, m), cy: 470, scale: 0.5, layout: 'audi', drive: 'awd', power: 1, flow: COLOR.sky });
  drawPlan(t, { cx: lerp(1700, 1300, m), cy: 470, scale: 0.5, layout: 'lancia', drive: 'rwd', power: 1, flow: COLOR.red });
  ctx.restore();
  if (m > 0) {
    ctx.save();
    ctx.globalAlpha = m;
    drawPlan(t, { cx: 1300, cy: 470, scale: lerp(0.5, 0.82, m), layout: '205', drive: 'awd', power: m, hot: m });
    ctx.restore();
  }
  tag(t, 'LA SOLUCIÓN DE TODT ERA', M, 380, s0 + 0.1);
  lines(t, ['Simple', 'y diabólica'], M, 510, 120, 110, V(24) + 1.4, { maxW: 600, exit: [V(25) - 0.3, V(25)] });
  lines(t, ['Lo mejor de', 'ambos mundos'], M, 510, 120, 110, V(25) + 0.2, { maxW: 600, colors: [COLOR.paper, COLOR.yellow] });
}

// Tracción total y motor central: el reparto de pesos perfecto.
function sBalance(t, s0) {
  bg();
  const cx = 1300, cy = 420, sc = 0.8;
  drawPlan(t, { cx, cy, scale: sc, layout: '205', drive: 'awd', power: prog(t, V(26), V(26) + 0.8), hot: prog(t, V(28) + 0.8, V(28) + 1.4) });
  const y = cy + 300 * sc + 70;
  const x0 = cx - 500 * sc, x1 = cx + 500 * sc;
  const show = ease.out(prog(t, V(28) + 1.0, V(28) + 1.5));
  const bias = lerp(0.62, 0.5, ease.inOut(prog(t, V(28) + 1.4, V(28) + 3.2)));
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = 'rgba(244,242,238,0.2)';
  ctx.fillRect(x0, y, x1 - x0, 14);
  ctx.fillStyle = COLOR.yellow;
  ctx.fillRect(x0, y, (x1 - x0) * (1 - bias), 14);
  ctx.fillStyle = COLOR.sky;
  ctx.fillRect(x1 - (x1 - x0) * bias, y, (x1 - x0) * bias, 14);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect((x0 + x1) / 2 - 2, y - 16, 4, 46);
  ctx.restore();
  titleBlock(t, { tag: 'TRACCIÓN TOTAL Y MOTOR CENTRAL', title: ['El reparto', 'de pesos perfecto'], pos: 'top', y0: 540, maxW: 640, tt: V(28) + 1.8 }, s0);
}

// Del coche de calle solo conservaba…: anotaciones sobre la foto.
function sKept(t, s0, s1) {
  bg();
  const map = photo('shell', 0, 0, W, H, { zoom: lerp(1.02, 1.06, span(t, s0, s1)), fx: 0.5, fy: 0.5 }, { dark: 0.25, vig: 0.5 });
  // Coordenadas en la foto original (1920 px); la de build/ está reescalada ×1,5.
  const pt = (x, y) => map(x * 1.5, y * 1.5);
  const [fx1, fy1] = pt(470, 615), [gx, gy] = pt(690, 628), [wx, wy] = pt(930, 410), [dx, dy] = pt(1330, 620);
  callout(t, fx1, fy1, fx1 - 120, fy1 + 230, 'FAROS', V(30) + 2.0);
  callout(t, gx, gy, gx + 40, gy + 300, 'PARRILLA', V(31));
  callout(t, wx, wy, wx - 260, wy - 170, 'PARABRISAS', V(32));
  callout(t, dx, dy, dx + 220, dy - 230, 'PUERTAS', V(32) + 1.0);
  tag(t, 'DEL COCHE DE CALLE SOLO CONSERVABA', M, 130, s0 + 0.1);
}

// Chasis: el despiece sobre papel, con sus materiales.
function sChassis(t, s0, s1) {
  bg(COLOR.paper);
  const u = span(t, s0, s1);
  const im = A.despiece;
  const iw = 1240, ih = iw * (im.height / im.width);
  ctx.save();
  zoomAbout(lerp(1.0, 1.05, ease.inOut(u)), 1250, 560);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(im, 640, 170, iw, ih);
  ctx.restore();
  tag(t, 'CONSTRUYERON UN', M, 330, s0 + 0.1, COLOR.red);
  lines(t, ['Chasis tubular', 'de acero'], M, 460, 110, 100, V(34) + 0.6, { color: COLOR.ink, maxW: 520 });
  label(ctx, 'PANELES DE KEVLAR', M, 760, COLOR.navy, prog(t, V(34) + 3.2, V(34) + 3.7), { size: 28, spacing: 6, weight: 700 });
  label(ctx, 'Y FIBRA DE VIDRIO', M, 810, COLOR.navy, prog(t, V(34) + 4.2, V(34) + 4.7), { size: 28, spacing: 6, weight: 700 });
}

function sFour(t, s0) {
  bg();
  drawInline4(t, s0, 1300, 560, 1.0, ease.outExpo(prog(t, s0, s0 + 0.5)));
  titleBlock(t, { tag: 'PEUGEOT TOMÓ UN BLOQUE DE', title: ['4 cilindros'], pos: 'top', y0: 560, maxW: 640, tt: V(36) + 1.6, label: '1,8 litros', labelColor: COLOR.yellow, labelT: V(36) + 2.6 }, s0);
}

function sTurbo(t, s0) {
  bg();
  TURBO_T0 = s0;
  drawTurbo(t, 1420, 540, 260, ease.outExpo(prog(t, s0, s0 + 0.5)));
  titleBlock(t, { tag: 'LE ACOPLÓ UN ENORME', title: ['Turbo-', 'compresor KKK'], pos: 'top', y0: 560, maxW: 640, tt: V(37) + 0.6 }, s0);
}

function sTransverse(t, s0) {
  bg();
  drawPlan(t, { cx: 1250, cy: 540, scale: 0.92, layout: '205', drive: 'awd', engineRot: ease.inOut(prog(t, s0 + 0.3, s0 + 1.2)), hot: 1 });
  lines(t, ['Transversal'], M, 1000, 0, 130, s0 + 0.6);
}

function sShort(t, s0) {
  bg();
  const cx = 1300, cy = 460, sc = 0.86;
  const r = drawPlan(t, { cx, cy, scale: sc, layout: '205', drive: 'awd', power: prog(t, V(39) + 1.2, V(39) + 2.4), flow: COLOR.yellow });
  dimLine(cx - 492 * sc, cx + 492 * sc, cy + 300 * sc + 40, prog(t, V(40) + 1.2, V(40) + 1.7), COLOR.sky);
  void r;
  titleBlock(t, { tag: 'ESPACIO PARA LA CAJA Y LA TRACCIÓN TOTAL', title: ['Corto', 'y ratonero'], pos: 'top', y0: 560, maxW: 600, tt: V(40) + 2.0 }, s0);
}

// La almeja: la zaga entera se abre (revelado en arco desde la bisagra).
function sClam(t, s0, s1) {
  bg();
  const u = span(t, s0, s1);
  const o = ease.inOutExpo(prog(t, s0 + 0.1, s0 + 1.0));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W * 0.32, 0);
  ctx.arc(W * 0.32, 0, 2600 * o, Math.PI * 0.0, Math.PI * 1.0);
  ctx.closePath();
  ctx.clip();
  photo('almeja', 0, 0, W, H, { zoom: lerp(1.12, 1.03, ease.out(u)), fx: 0.5, fy: 0.55 }, { dark: 0.12, vig: 0.4 });
  ctx.restore();
  titleBlock(t, { tag: 'TODO EL CHASIS TRASERO', title: ['Se abría', 'como una almeja'], pos: 'top', y0: 300, maxW: 820, tt: V(42) + 0.8 }, s0);
}

function sTwenty(t, s0) {
  bg();
  const cx = 1380, cy = 520, r = 300;
  const p = ease.inOut(prog(t, V(44) + 0.6, V(44) + 2.4));
  ctx.save();
  ctx.strokeStyle = 'rgba(244,242,238,0.15)';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COLOR.yellow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (20 / 60) * p);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, V(44) + 0.5, V(44) + 0.9));
  counter(20 * p, cx, cy + 70, 230, COLOR.paper, 'center', 2);
  ctx.restore();
  label(ctx, 'MINUTOS', cx, cy + 140, DIM, prog(t, V(44) + 1.0, V(44) + 1.4), { size: 26, spacing: 8, weight: 700, align: 'center' });
  tag(t, 'LOS MECÁNICOS PODÍAN CAMBIAR', M, 380, s0 + 0.1);
  [['Caja de cambios', V(43) + 1.3], ['Embrague', V(44) + 0.1], ['Correas', V(44) + 0.7]].forEach(([str, t0], i) => {
    revealText(ctx, str, M, 520 + i * 112, FONT.display(900, 92), COLOR.paper, prog(t, t0, t0 + 0.6), { stagger: 0.015 });
  });
  label(ctx, 'durante una asistencia', M, 900, DIM, prog(t, V(44) + 2.6, V(44) + 3.1), { size: 40, spacing: 0, weight: 600 });
}

function sSteroids(t, s0) {
  bg();
  TURBO_T0 = s0 - 2;
  ctx.save();
  ctx.globalAlpha = 0.28;
  drawTurbo(t, 1500, 540, 360, 1);
  ctx.restore();
  titleBlock(t, { tag: 'PORQUE EL MOTOR HABÍA RECIBIDO', title: ['Una inyección', 'de esteroides'], pos: 'top', y0: 560, maxW: 900, tt: V(59) + 1.4, colors: [COLOR.paper, COLOR.red] }, s0);
}

// Retraso del turbo: el acelerador y la presión, desfasados un segundo.
function sLag(t, s0) {
  bg();
  const x0 = 860, x1 = 1800, yb = 820, yt = 300;
  const tx = (u) => lerp(x0, x1, u);
  const draw = ease.inOut(prog(t, s0 + 0.3, s0 + 3.4));
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, s0, s0 + 0.4));
  ctx.fillStyle = 'rgba(244,242,238,0.22)';
  ctx.fillRect(x0, yb, x1 - x0, 2);
  ctx.fillRect(x0, yt - 20, 2, yb - yt + 20);
  ctx.restore();
  // Acelerador: escalón; presión: curva que llega tarde.
  const thr = [], bst = [];
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    thr.push([tx(u), u < 0.25 ? yb - 40 : yt + 30]);
    const b = u < 0.25 ? 0 : 1 - Math.exp(-Math.max(0, u - 0.36) * 9);
    bst.push([tx(u), lerp(yb - 10, yt + 60, b)]);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR.paper;
  ctx.lineWidth = 5;
  trace(ctx, poly(thr), draw);
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 7;
  trace(ctx, poly(bst), draw);
  label(ctx, 'ACELERADOR', tx(0.25) - 16, yt + 36, COLOR.paper, prog(t, s0 + 1.4, s0 + 1.8), { size: 22, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'PRESIÓN DEL TURBO', tx(0.7), yt + 140, COLOR.red, prog(t, s0 + 2.8, s0 + 3.2), { size: 22, spacing: 6, weight: 700 });
  // Cota de 1 s y la curva.
  const p2 = prog(t, V(61) + 4.8, V(61) + 5.4);
  dimLine(tx(0.25), tx(0.47), yb + 60, p2, COLOR.yellow, '1 SEGUNDO');
  ctx.save();
  ctx.globalAlpha = ease.out(p2);
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = COLOR.yellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx(0.47), yt - 20); ctx.lineTo(tx(0.47), yb);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'CURVA', tx(0.47), yt - 40, COLOR.yellow, p2, { size: 22, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'EL RETRASO DEL TURBO', M, 300, s0 + 0.1);
  label(ctx, 'era tan bestial que…', M, 380, DIM, prog(t, s0 + 0.6, s0 + 1.1), { size: 36, spacing: 0, weight: 600 });
  lines(t, ['Había que', 'acelerar a fondo'], M, 510, 110, 100, V(61) + 3.3, { maxW: 640, exit: [V(61) + 5.2, V(61) + 5.6] });
  lines(t, ['Un segundo', 'antes de la curva'], M, 510, 110, 100, V(61) + 5.6, { maxW: 640, colors: [COLOR.yellow, COLOR.paper] });
}

// Pistas de los títulos: dos tarjetas genéricas.
function sTitles(t, s0) {
  bg();
  tag(t, 'PEUGEOT DOMINÓ LA ERA DORADA', M, 300, s0 + 0.1);
  [['2', 'mundiales de pilotos', V(79) + 2.4], ['2', 'de constructores', V(79) + 3.6]].forEach(([n, str, t0], i) => {
    const a = ease.outExpo(prog(t, t0, t0 + 0.6));
    if (a <= 0) return;
    const x = M + i * 860, y = 380;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 40);
    ctx.fillStyle = COLOR.ink2;
    ctx.beginPath();
    ctx.roundRect(x, y, 780, 460, 22);
    ctx.fill();
    stripesH(ctx, y + 420, 8, 1, 0, { x0: x + 50, x1: x + 330 });
    ctx.font = FONT.display(900, 300);
    ctx.fillStyle = i === 0 ? COLOR.yellow : COLOR.sky;
    ctx.fillText(n, x + 46, y + 300);
    ctx.font = FONT.text(700, 42);
    ctx.fillStyle = COLOR.paper;
    ctx.fillText(str, x + 50, y + 380);
    ctx.restore();
  });
  label(ctx, 'consecutivos · 1985 y 1986', M, 960, DIM, prog(t, V(79) + 4.4, V(79) + 4.9), { size: 40, spacing: 0, weight: 600 });
}

function sBan(t, s0) {
  bg();
  tag(t, 'PERO EN 1986, TRAS TRAGEDIAS IRREPARABLES', W / 2, 330, s0 + 0.2, COLOR.paper, { align: 'center' });
  label(ctx, 'EN PORTUGAL Y CÓRCEGA', W / 2, 380, DIM, prog(t, V(81) + 0.4, V(81) + 0.9), { size: 26, spacing: 7, weight: 700, align: 'center' });
  const size = fitSize(ctx, 'GRUPO B', (px) => FONT.display(900, px), 1200, 260);
  revealText(ctx, 'GRUPO B', W / 2, 640, FONT.display(900, size), 'rgba(244,242,238,0.92)', prog(t, V(82), V(82) + 0.6), { stagger: 0.05, align: 'center' });
  const c = ease.inOut(prog(t, V(82) + 1.0, V(82) + 1.6));
  ctx.fillStyle = COLOR.red;
  ctx.fillRect(W / 2 - 620, 560, 1240 * c, 18);
  label(ctx, 'LA FIA LO PROHIBIÓ', W / 2, 780, COLOR.red, prog(t, V(82) + 1.4, V(82) + 1.9), { size: 30, spacing: 9, weight: 700, align: 'center' });
}

// Para el Dakar: el chasis se alarga y gana suspensión y depósitos.
function sStretch(t, s0) {
  bg();
  const k = ease.inOut(prog(t, V(85) + 1.0, V(85) + 2.4));
  const cx = 1280, cy = 450, sc = 0.78;
  const r = drawPlan(t, { cx, cy, scale: sc, layout: '205', drive: 'awd', stretch: k, wing: false });
  dimLine(cx + r.rearX * sc, cx + r.frontX * sc, cy + 300 * sc + 40, prog(t, V(85) + 0.6, V(85) + 1.0), COLOR.yellow, 'CHASIS ALARGADO');
  // Depósitos: dos bloques que aparecen en la zaga.
  const d = ease.outExpo(prog(t, V(87), V(87) + 0.6));
  if (d > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.globalAlpha = d;
    ctx.fillStyle = 'rgba(242,194,28,0.85)';
    for (const y of [-150, 60]) { ctx.beginPath(); ctx.roundRect(-430 * (1 + 0.2 * k), y, 140, 90, 10); ctx.fill(); }
    ctx.restore();
  }
  tag(t, 'JEAN TODT', M, 380, s0 + 0.1);
  [['Chasis alargado', V(85) + 0.8], ['Suspensiones más altas', V(86)], ['Depósitos de gasolina gigantes', V(87)]].forEach(([str, t0], i) => {
    revealText(ctx, str, M, 510 + i * 100, FONT.display(900, fitSize(ctx, 'Depósitos de gasolina gigantes', (px) => FONT.display(900, px), 700, 72)),
      i === 2 ? COLOR.yellow : COLOR.paper, prog(t, t0, t0 + 0.6), { stagger: 0.012 });
  });
}

// Desierto: dunas en capas con ruido con semilla.
function sDesert(t, s0, s1) {
  bg(COLOR.paper);
  const u = span(t, s0, s1);
  ctx.fillStyle = COLOR.yellow;
  ctx.beginPath();
  ctx.arc(1480, 330 + 40 * u, 120, 0, Math.PI * 2);
  ctx.fill();
  const cols = ['#E3D8C4', '#C9B79A', '#2A2B30'];
  cols.forEach((col, k) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-20, H + 20);
    for (let x = -20; x <= W + 20; x += 10) {
      const y = 560 + k * 140 + 70 * noise1(x * (0.003 + k * 0.001) + k * 13 + u * (k + 1) * 2) + 30 * noise1(x * 0.011 + k * 5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, H + 20);
    ctx.closePath();
    ctx.fill();
  });
  tag(t, 'Y LO MANDÓ A', M, 230, s0 + 0.1, COLOR.red);
  lines(t, ['Conquistar', 'el desierto'], M, 360, 120, 118, V(88) + 0.5, { color: COLOR.ink });
}

// París–Dakar: ruta esquemática entre dos puntos.
const ROUTE = poly(catmull([[1180, 170], [1120, 300], [1060, 410], [1140, 520], [1010, 640], [880, 760], [760, 900]], false, 12));
function sDakar(t, s0) {
  bg();
  const p = ease.inOut(prog(t, s0 + 0.4, s0 + 3.4));
  ctx.save();
  ctx.setLineDash([2, 14]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(244,242,238,0.35)';
  ctx.lineWidth = 5;
  trace(ctx, ROUTE, 1);
  ctx.restore();
  ctx.strokeStyle = COLOR.yellow;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  trace(ctx, ROUTE, p);
  for (const [i, name, t0] of [[0, 'PARÍS', s0 + 0.2], [ROUTE.pts.length - 1, 'DAKAR', s0 + 3.2]]) {
    const [x, y] = ROUTE.pts[i];
    const a = ease.outExpo(prog(t, t0, t0 + 0.4));
    ctx.fillStyle = COLOR.paper;
    ctx.beginPath();
    ctx.arc(x, y, 12 * a, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, name, x + 30, y + 10, COLOR.paper, a, { size: 30, spacing: 8, weight: 700 });
  }
  const [hx, hy] = pointAt(ROUTE, p);
  ctx.fillStyle = COLOR.red;
  ctx.beginPath();
  ctx.arc(hx, hy, 10, 0, Math.PI * 2);
  ctx.fill();
  titleBlock(t, { tag: 'EL 205 T16 GANÓ EN 1987 EL', title: ['París-Dakar'], x: 1260, pos: 'top', y0: 560, maxW: 560, tt: V(89) + 1.4, label: 'con Vatanen de vuelta al volante', labelT: V(89) + 3.6 }, s0);
  slam(t, 'y en el 88', 1260, 860, V(90) + 1.2, 90, COLOR.yellow);
}

// Las tres leyendas del Grupo B y la perfección final.
function sTriptych(t, s0, s1) {
  bg();
  const cols = [['AUDI QUATTRO', 'Trajo la idea', V(94), COLOR.paper], ['LANCIA 037', 'El último destello romántico', V(95), COLOR.paper], ['PEUGEOT 205 T16', 'La perfección del Grupo B', V(96) + 0.6, COLOR.yellow]];
  const grow = ease.inOutExpo(prog(t, V(96) + 2.4, V(96) + 3.2));
  const cw = (W - 2 * M - 80) / 3;
  cols.forEach(([name, str, t0, col], i) => {
    const x = M + i * (cw + 40);
    const a = ease.outExpo(prog(t, t0, t0 + 0.6));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * (i < 2 ? 1 - grow : 1);
    ctx.fillStyle = 'rgba(244,242,238,0.25)';
    ctx.fillRect(x, 300, cw * a, 2);
    label(ctx, name, x, 380, col === COLOR.yellow ? COLOR.yellow : DIM, 1, { size: 26, spacing: 7, weight: 700 });
    const size = fitSize(ctx, 'El último destello', (px) => FONT.display(900, px), cw - 20, 64);
    const words = str.split(' ');
    const half = Math.ceil(words.length / 2);
    [words.slice(0, half).join(' '), words.slice(half).join(' ')].forEach((ln, k) => {
      revealText(ctx, ln, x, 480 + k * 76, FONT.display(900, size), COLOR.paper, prog(t, t0 + 0.1 + k * 0.1, t0 + 0.8 + k * 0.1), { stagger: 0.015 });
    });
    ctx.restore();
  });
  if (grow > 0) {
    ctx.save();
    ctx.globalAlpha = grow;
    photo('shell', 0, 0, W, H, { zoom: lerp(1.2, 1.06, ease.out(prog(t, V(96) + 2.4, s1))), fx: 0.5, fy: 0.55 }, { dark: 0.25, vig: 0.5 });
    ctx.restore();
    titleBlock(t, { tag: 'PEUGEOT 205 T16', title: ['La perfección', 'del Grupo B'], pos: 'bottom', size: 120, tt: V(96) + 2.7 }, s0);
  }
}

function sLike(t, s0) {
  bg();
  titleBlock(t, { tag: 'SI TE HA GUSTADO', title: ['Esta historia'], pos: 'top', y0: 500, x: W / 2, align: 'center', tt: s0 + 0.3 }, s0);
  pill(t, 'Me gusta', W / 2, 700, V(102), { press: V(102) + 0.6, color: COLOR.red, size: 40 });
}

// Cierre: logotipo del canal, suscripción y pregunta a la audiencia.
function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const up = ease.inOut(prog(t, V(104) - 0.3, V(104) + 0.4));
  const w = lerp(820, 620, up), h = w * (lg.height / lg.width);
  ctx.save();
  ctx.globalAlpha = la;
  ctx.drawImage(lg, W / 2 - w / 2, lerp(380, 260, up) - h / 2, w, h);
  ctx.restore();
  // El botón se va antes de que entre la pregunta, para no solaparse.
  const gone = ease.inOut(prog(t, V(104) - 0.6, V(104) - 0.2));
  ctx.save();
  ctx.globalAlpha = 1 - gone;
  ctx.translate(0, gone * 30);
  pill(t, 'Suscríbete', W / 2, 800, s0 + 0.35, { press: V(103) + 0.5, color: COLOR.red, size: 42 });
  ctx.restore();
  if (up > 0) {
    const size = fitSize(ctx, '¿Cuál es para ti el mejor coche', (px) => FONT.display(900, px), GRID.w, 96);
    revealText(ctx, '¿Cuál es para ti el mejor coche', W / 2, 680, FONT.display(900, size), COLOR.paper, prog(t, V(104), V(104) + 0.6), { align: 'center', stagger: 0.012 });
    revealText(ctx, 'del Grupo B?', W / 2, 790, FONT.display(900, size), COLOR.yellow, prog(t, V(104) + 0.15, V(104) + 0.75), { align: 'center', stagger: 0.02 });
  }
  label(ctx, '¡Nos vemos en el próximo tramo!', W / 2, 930, DIM, prog(t, V(105), V(105) + 0.5), { size: 40, spacing: 0, weight: 600, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.0, sVersus, 'wipe'],
  [cut(2, 0.3), kType({ tag: 'LA GUERRA DEL GRUPO B ERA', title: ['Cosa de dos.'], align: 'center', tt: V(2) + 2.0, size: 190, stripes: true }), 'dissolve'],
  [cut(3), kPhoto({ img: 'polvo', fx: 0.5, fy: 0.4, dark: 0.5, tag: 'PERO EN FRANCIA', title: ['estaban observando'], tt: V(3) + 0.6, pos: 'top' }), 'whip'],
  [cut(4), kPhoto({ img: 'calle', fx: 0.5, fy: 0.6, dark: 0.3, tag: 'PREPARANDO A', title: ['Un asesino', 'con piel de utilitario'], tt: V(4) + 1.8, pos: 'top', size: 104 }), 'slices'],
  [cut(5), kPhoto({ img: 'shell', fx: 0.5, fy: 0.55, z: [1.2, 1.08], tag: 'UN COCHE QUE NO SOLO', title: ['entraría en la batalla'], tt: V(5) + 0.9, size: 104 }), 'whip'],
  [cut(6), kPhoto({ img: 'nieve', fx: 0.5, fy: 0.45, dark: 0.4, title: ['Aplastaría', 'a los gigantes'], tt: V(6) + 0.6, pos: 'top' }), 'cut'],
  [Math.floor((V(6) + 3.2) / 0.25) * 0.25, kType({ tag: 'LA MÁS EXITOSA DE LA ERA MÁS PELIGROSA', title: ['La máquina', 'definitiva'], tt: V(6) + 3.6, size: 170, colors: [COLOR.paper, COLOR.yellow] }), 'whipV'],
  [cut(7), kPhoto({ img: 'shell', fx: 0.45, fy: 0.5, z: [1.08, 1.0], dark: 0.3, tag: 'HOY DESENTRAÑAMOS EL MITO DEL', title: ['Peugeot 205', 'Turbo 16'], tt: V(7) + 1.6, size: 150, colors: [COLOR.paper, COLOR.yellow] }), 'wipe'],
  [cut(8), kSplit({ img: 'arbol', fx: 0.5, fy: 0.6, bg: COLOR.paper, tag: 'A PRINCIPIOS DE LOS', tagColor: COLOR.red, title: ['80'], size: 420, y0: 700, color: COLOR.ink }), 'slices'],
  [cut(9), sFinance, 'whip'],
  [cut(10), kPhoto({ img: 'calle', fx: 0.4, fy: 0.5, z: [1.25, 1.12], dark: 0.3, tag: 'UN GOLPE DE EFECTO PUBLICITARIO', title: ['para vender su nuevo', 'modelo de calle'], tt: V(10) + 1.6, pos: 'top', size: 96 }), 'cut'],
  [cut(11), s205, 'cut'],
  [cut(12), sPTS, 'wipe'],
  [cut(14), kType({ tag: 'AÑOS DESPUÉS HARÍA INVENCIBLE A', title: ['Michael Schumacher'], tt: V(14) + 1.6, size: 150, label: 'en Ferrari:', labelT: V(14) + 3.1 }), 'whip'],
  [cut(15), sTodt, 'cut'],
  [cut(16), sCheque, 'whipV'],
  [cut(17), kType({ bg: COLOR.red, title: ['Ganar.'], align: 'center', tt: V(17) - 0.05, size: 330 }), 'cut'],
  [cut(18), sRivals, 'cut'],
  [cut(20), sUnder, 'slices'],
  [cut(22), sSpin, 'whip'],
  [cut(24), sMerge, 'whipV'],
  [cut(26), sBalance, 'cut'],
  [cut(29), kPhoto({ img: 'polvo', fx: 0.5, fy: 0.55, z: [1.25, 1.08], dark: 0.3, tag: 'NACIÓ ASÍ EL', title: ['205 Turbo 16'], tt: V(29) + 0.9, size: 160, colors: [COLOR.yellow] }), 'wipe'],
  [cut(30), sKept, 'whip'],
  [cut(33), kType({ title: ['El resto era', 'un monstruo.'], tt: V(33) + 0.1, size: 170, colors: [COLOR.paper, COLOR.red] }), 'cut'],
  [cut(34), sChassis, 'slices'],
  [cut(35), kPhoto({ img: 'almeja', fx: 0.62, fy: 0.42, z: [1.9, 1.75], dark: 0.35, tag: 'LA VERDADERA MAGIA ESTABA', title: ['detrás de los asientos'], tt: V(35) + 1.4, size: 104 }), 'whip'],
  [cut(36), sFour, 'cut'],
  [cut(37), sTurbo, 'whip'],
  [Math.floor((V(37) + 3.1) / 0.25) * 0.25, sTransverse, 'cut'],
  [cut(38), kType({ title: ['¿Por qué', 'transversal?'], align: 'center', tt: V(38), size: 170, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(39), sShort, 'whipV'],
  [cut(41), sClam, 'cut'],
  [cut(43), sTwenty, 'slices'],
  [cut(45), kType({ bg: COLOR.paper, tag: 'ERA UN COCHE DISEÑADO PARA GANAR', tagColor: COLOR.red, title: ['Y para no perder', 'tiempo en el taller'], tt: V(47), color: COLOR.ink, size: 130 }), 'wipe'],
  [cut(48), kStat({ tag: 'LA PRIMERA VERSIÓN, LA EVO 1', value: (t) => 350 * ease.outExpo(prog(t, V(50) + 1.2, V(50) + 2.4)), showT: V(50) + 1.1, unit: 'caballos', unitT: V(50) + 2.4,
    label: 'unos «modestos»', labelT: V(50) + 0.4, under: (t, s0) => { TURBO_T0 = s0; ctx.save(); ctx.globalAlpha = 0.9; drawTurbo(t, 1420, 540, 250, ease.outExpo(prog(t, s0, s0 + 0.5))); ctx.restore(); } }), 'whip'],
  [cut(51), kSplit({ img: 'agachado', fx: 0.5, fy: 0.55, tag: 'EL COCHE DEBUTÓ EN', title: ['1984'], size: 230, label: 'y el impacto fue inmediato', labelT: V(51) + 2.8 }), 'slices'],
  [cut(52), kPhoto({ img: 'nieve', fx: 0.5, fy: 0.6, z: [1.3, 1.15], dark: 0.4, tag: 'ARI VATANEN', title: ['Empezó a ganar tramos'], tt: V(52) + 0.9, pos: 'top', size: 104,
    label: 'como si los demás fueran parados', labelT: V(52) + 2.4 }), 'whip'],
  [cut(53), kType({ tag: 'PERO EN EL GRUPO B', title: ['No podías', 'quedarte quieto.'], tt: V(53) + 0.6, size: 150 }), 'cut'],
  [cut(54), kType({ tag: 'AUDI SACÓ EL', title: ['Sport Quattro'], tt: V(54) + 0.6, size: 120, y0: 420,
    extra: (t) => { tag(t, 'LANCIA PREPARABA EL', M, 640, V(55)); lines(t, ['Delta S4'], M, 780, 0, 120, V(55) + 0.7); } }), 'whipV'],
  [cut(56), kPhoto({ img: 'shell', fx: 0.42, fy: 0.62, z: [1.7, 1.5], dark: 0.3, tag: 'PEUGEOT RESPONDIÓ EN 1985 CON EL', title: ['Evo 2'], tt: V(56) + 3.6, size: 230, colors: [COLOR.yellow] }), 'wipe'],
  [cut(57), kSplit({ img: 'arbol', fx: 0.5, fy: 0.85, z: [1.25, 1.12], tag: 'VISUALMENTE ERA', title: ['Aterrador'], size: 150 }), 'cut'],
  [cut(58), (t, s0, s1) => { sChassisLite(t, s0, s1); }, 'slices'],
  [cut(59), sSteroids, 'cut'],
  [cut(60), kStat({ tag: 'AHORA ROZABA LOS', value: (t) => 350 + 150 * ease.outExpo(prog(t, V(60) + 0.9, V(60) + 2.0)), showT: V(60) + 0.2, unit: 'caballos', unitT: V(60) + 1.4, color: COLOR.yellow,
    label: 'y más de 2,5 bares en el turbo', labelT: V(60) + 3.4,
    extra: (t) => { arcGauge(t, 1420, 560, 280, 2.5 * ease.inOut(prog(t, V(60) + 3.0, V(60) + 4.4)), 3, ease.out(prog(t, V(60) + 2.8, V(60) + 3.2)));
      ctx.save(); ctx.globalAlpha = ease.out(prog(t, V(60) + 3.0, V(60) + 3.4)); ctx.font = FONT.display(900, 130); ctx.textAlign = 'center'; ctx.fillStyle = COLOR.paper;
      ctx.fillText((2.5 * ease.inOut(prog(t, V(60) + 3.0, V(60) + 4.4))).toFixed(1).replace('.', ','), 1420, 600); ctx.restore();
      label(ctx, 'BAR', 1420, 660, DIM, prog(t, V(60) + 3.2, V(60) + 3.6), { size: 26, spacing: 8, weight: 700, align: 'center' }); } }), 'whip'],
  [cut(61), sLag, 'cut'],
  [cut(62), kPhoto({ img: 'polvo', fx: 0.3, fy: 0.6, z: [1.6, 1.4], dx: [60, -60], dark: 0.3, tag: 'ERA', title: ['Un misil balístico'], tt: V(62) + 0.4, size: 120 }), 'whip'],
  [Math.floor((V(62) + 2.3) / 0.25) * 0.25, kStat({ tag: 'DE MENOS DE', value: (t) => 910 * ease.outExpo(prog(t, V(62) + 2.5, V(62) + 3.4)), showT: V(62) + 2.4, unit: 'kilos', unitT: V(62) + 3.2,
    label: 'que requería reflejos de piloto de combate', labelT: V(62) + 3.9 }), 'cut'],
  [cut(63), kSplit({ img: 'volante', fx: 0.5, fy: 0.4, tag: 'UNA MÁQUINA TAN EXTREMA NECESITABA', title: ['Pilotos', 'de otra pasta'], tt: V(63) + 1.8, size: 110 }), 'slices'],
  [cut(64), kSplit({ img: 'agachado', side: 'left', fx: 0.5, fy: 0.45, z: [1.35, 1.2], tag: 'ARI VATANEN', title: ['El talento puro'], size: 110, label: 'volando de rasante en rasante', labelT: V(65) }), 'whip'],
  [cut(66), kType({ tag: 'PARECÍA IMBATIBLE HASTA QUE, EN', tagColor: COLOR.paper, title: ['Argentina, 1985'], tt: V(66) + 4.2, size: 150, align: 'center' }), 'dissolve'],
  [cut(67), kType({ tag: 'INCONTABLES VUELTAS DE CAMPANA', tagColor: COLOR.paper, title: ['A casi 200', 'por hora'], tt: V(67) + 1.8, size: 150, align: 'center' }), 'dissolve'],
  [cut(68), kType({ title: ['Sobrevivió de milagro.'], tt: V(68), size: 130, align: 'center' }), 'dissolve'],
  [cut(69), kPhoto({ img: 'salonen', fx: 0.6, fy: 0.4, dark: 0.3, gray: true, tag: 'CON VATANEN FUERA, EL PESO CAYÓ EN', title: ['Timo Salonen'], tt: V(70) + 0.6, size: 130 }), 'dissolve'],
  [cut(71), kSplit({ img: 'salonen', fx: 0.72, fy: 0.3, z: [1.5, 1.35], gray: true, tag: 'LA ANTÍTESIS DEL ATLETA MODERNO', title: [],
    extra: (t) => { [['Regordete', V(72)], ['Gafas gruesas', V(73) + 0.1], ['Fumador empedernido', V(73) + 1.1]].forEach(([s, t0], i) => {
      revealText(ctx, s, M, 560 + i * 110, FONT.display(900, fitSize(ctx, 'Fumador empedernido', (px) => FONT.display(900, px), 680, 92)), i === 2 ? COLOR.yellow : COLOR.paper, prog(t, t0, t0 + 0.6), { stagger: 0.015 }); }); } }), 'whip'],
  [cut(74), kPhoto({ img: 'habitaculo', fx: 0.4, fy: 0.5, z: [1.15, 1.05], dark: 0.35, tag: 'DOMINABA A UNA BESTIA DE 500 CABALLOS', title: ['Con una sola mano'], tt: V(74) + 0.8, size: 120 }), 'slices'],
  [cut(75), kType({ tag: 'TIMO SALONEN', title: ['Ganó el mundial', 'del 85'], tt: V(75) + 0.4, size: 160, colors: [COLOR.paper, COLOR.yellow], stripes: true }), 'wipe'],
  [cut(76), kSplit({ img: 'n4', fx: 0.5, fy: 0.5, tag: 'AL AÑO SIGUIENTE, UN JOVEN', title: ['Juha', 'Kankkunen'], tt: V(77) + 0.4, size: 120, label: 'tomó el relevo', labelT: V(77) + 1.6 }), 'whip'],
  [cut(78), kType({ tag: 'VOLVIÓ A HACER CAMPEÓN AL PEUGEOT EN', title: ['1986'], tt: V(78) + 2.2, size: 300, label: 'tras una tensa batalla legal con Lancia', labelT: V(78) + 3.8 }), 'cut'],
  [cut(79), sTitles, 'slices'],
  [cut(80), sBan, 'dissolve'],
  [cut(83), kPhoto({ img: 'almeja', fx: 0.5, fy: 0.55, dark: 0.55, gray: true, tag: 'TODOS LOS FABRICANTES SE QUEDARON CON', title: ['Prototipos millonarios', 'que ya no podían correr'], tt: V(83) + 0.8, size: 96, pos: 'top' }), 'dissolve'],
  [cut(84), kType({ title: ['¿Qué hizo Peugeot?'], tt: V(84), size: 150, align: 'center' }), 'cut'],
  [cut(85), sStretch, 'whip'],
  [cut(88), sDesert, 'wipe'],
  [cut(89), sDakar, 'slices'],
  [cut(91), (t, s0, s1) => {
    bg();
    drawMountain(t, s0, ease.out(prog(t, s0, s0 + 0.4)));
    tag(t, 'LE SOBRÓ TIEMPO PARA IR A ESTADOS UNIDOS', M, 150, s0 + 0.1);
    lines(t, ['Pikes Peak'], M, 280, 0, 150, V(92));
    label(ctx, 'y plantar cara a los Audi en la subida a las nubes', M, 350, DIM, prog(t, V(93) + 0.4, V(93) + 0.9), { size: 38, spacing: 0, weight: 600 });
  }, 'whip'],
  [cut(94), sTriptych, 'dissolve'],
  [cut(97), kPhoto({ img: 'polvo', fx: 0.5, fy: 0.5, z: [1.08, 1.0], dark: 0.3, title: ['La máquina de guerra', 'definitiva'], tt: V(97), pos: 'top', size: 120, colors: [COLOR.paper, COLOR.yellow] }), 'cut'],
  [cut(98), (t, s0, s1) => {
    bg(COLOR.paper);
    ctx.save();
    ctx.translate(W / 2, 860);
    ctx.rotate(-0.1);
    ctx.translate(-W / 2, -860);
    stripesH(ctx, 820, 60, prog(t, s0 + 0.1, s0 + 0.9), 0, { x0: -300 + lerp(0, -80, span(t, s0, s1)), x1: W + 300, stagger: 0.05 });
    ctx.restore();
    tag(t, 'UN UTILITARIO HIPERVITAMINADO DEMOSTRÓ QUE', M, 200, s0 + 0.1, COLOR.red);
    lines(t, ['El diseño inteligente', 'siempre vence', 'a la fuerza bruta.'], M, 340, 120, 112, V(100), { color: COLOR.ink, colors: [COLOR.ink, COLOR.ink, COLOR.red] });
  }, 'slices'],
  [cut(101), sLike, 'wipe'],
  [cut(103), sChannel, 'wipe'],
];

// El alerón y los deflectores del Evo 2: carga aerodinámica sobre el despiece.
function sChassisLite(t, s0, s1) {
  bg(COLOR.paper);
  const u = span(t, s0, s1);
  const im = A.despiece;
  const iw = 1180, ih = iw * (im.height / im.width);
  const press = ease.inOut(prog(t, V(58) + 3.5, V(58) + 4.6)) * 10;
  ctx.save();
  zoomAbout(lerp(1.0, 1.04, ease.inOut(u)), 1250, 560);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(im, 700, 230 + press, iw, ih);
  ctx.restore();
  drawDownforce(t, 820, 1760, 150, 330 + press, ease.out(prog(t, V(58) + 1.0, V(58) + 1.6)));
  tag(t, 'ALERÓN GIGANTESCO Y DEFLECTORES EN EL MORRO', M, 300, s0 + 0.1, COLOR.red, { size: 22 });
  lines(t, ['Pegado', 'al suelo'], M, 430, 120, 120, V(58) + 3.6, { color: COLOR.ink, maxW: 560 });
}

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
export const HITS = [cut(7), cut(15), cut(17), cut(29), cut(33), cut(56), cut(62), cut(96), cut(103)];
const SHAKES = [cut(17), cut(29), cut(56), cut(62)];

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
    if (t >= h && t < h + 0.6) {
      const k = Math.exp(-(t - h) * 9) * 12;
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
  const fout = ease.inOut(prog(t, DURATION - 0.7, DURATION));
  if (fout > 0) {
    ctx.fillStyle = `rgba(14,15,18,${fout})`;
    ctx.fillRect(0, 0, W, H);
  }
  grain(ctx, t, 0.07);
}

export function init(assets) {
  A = assets;
  for (const k of ['type', 'a', 'b']) layers[k] = makeCanvas();
  layers.gray = {};
  for (const k of ['salonen', 'almeja', 'polvo']) {
    const c = makeCanvas(A[k].width, A[k].height);
    const g = c.getContext('2d');
    g.filter = 'grayscale(1) contrast(1.1)';
    g.drawImage(A[k], 0, 0);
    layers.gray[k] = c;
  }
}
export const SHOT_STARTS = SHOTS.map((s) => s[0]);
export const SHOT_TRANS = SHOTS.map((s) => [s[0], s[2] ?? 'cut']);
