// Escenas del spot del Audi Sport Quattro S1. Todo depende solo de `t`.
import { W, H, HITS } from './timeline.js';
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES,
} from './lib.js';

let A; // imágenes cargadas
let ctx;
const layers = {};
const M = GRID.m;
const DIM = 'rgba(243,241,236,0.7)';
const BANDS3 = [{ c: COLOR.yellow, w: 0.9 }, ...STRIPES];

// Imagen con alternativa: si una foto opcional no está, se usa otra del cliente.
const FALLBACK = { tramo: 'hero', curva: 'calle', rally: 'hero', rohrl: 'hero', nocturna: 'hero' };
const img = (k) => A[k] ?? A[FALLBACK[k]];
const has = (k) => Boolean(A[k]);

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

// Foto en un rectángulo, con oscurecido opcional (velo plano, no degradado de color).
function photo(key, x, y, w, h, opts = {}, { dark = 0, vig = 0.4, open = 1, gray = false } = {}) {
  if (open <= 0) return;
  const im = gray ? (layers.gray[key] ?? layers.gray[FALLBACK[key]]) : img(key);
  ctx.save();
  ctx.beginPath();
  const hh = h * open;
  ctx.rect(x, y + (h - hh) / 2, w, hh);
  ctx.clip();
  drawCover(ctx, im, x, y, w, h, opts);
  if (dark > 0) {
    ctx.fillStyle = `rgba(13,13,15,${dark})`;
    ctx.fillRect(x, y, w, h);
  }
  if (vig > 0) vignette(ctx, x, y, w, h, vig);
  ctx.restore();
}

// Titular: varias líneas con el mismo cuerpo y revelado por máscara.
function lines(t, list, x, y0, lead, maxPx, t0, { color = COLOR.paper, weight = 900, exit = null, step = 0.12, colors = null, maxW = GRID.w, align = 'left' } = {}) {
  const size = Math.min(...list.map((l) => fitSize(ctx, l, (px) => FONT.display(weight, px), maxW, maxPx)));
  list.forEach((l, i) => {
    revealText(ctx, l, x, y0 + i * lead, FONT.display(weight, size), colors?.[i] ?? color, prog(t, t0 + i * step, t0 + i * step + 0.75), {
      stagger: 0.018, align, exit: exit ? prog(t, exit[0] + i * 0.05, exit[1] + i * 0.05) : 0,
    });
  });
  return size;
}

function tag(t, str, x, y, t0, color = COLOR.yellow, opts = {}) {
  label(ctx, str, x, y, color, prog(t, t0, t0 + 0.5), { size: 26, spacing: 7, weight: 700, ...opts });
}

// Pequeño acento de la librea bajo los titulares.
function accent(t, x, y, t0, len = 260, u = 10) {
  stripesH(ctx, y, u, prog(t, t0, t0 + 0.8), 0, { x0: x, x1: x + len });
}

// ---------------------------------------------------------------------------
// Planta esquemática del S1 (frente a la derecha). Unidades: 1000 = largo.

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
  out.push(out[0]);
  return out;
}
const mirror = (half) => [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [x, -y])];

// Medio contorno superior, de la punta delantera a la trasera. `k` encoge el coche (0 largo, 1 corto).
function bodyHalf(k) {
  const r = lerp(1, 0.9, k); // la zaga se acerca al acortar la batalla
  return [
    [508, 0], [505, -150], [494, -206], [470, -226], [392, -236], [338, -248], [190, -248], [150, -230],
    [-60 * r, -230], [-150 * r, -246], [-380 * r, -246], [-440 * r, -232], [-480 * r, -214], [-500 * r, -160], [-504 * r, 0],
  ];
}
const CABIN_HALF = [[168, 0], [160, -150], [130, -184], [-170, -186], [-228, -160], [-236, 0]];

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
const CABIN = poly(catmull(mirror(CABIN_HALF), true, 6));
const bodyCache = new Map();
function body(k) {
  const key = Math.round(k * 200);
  if (!bodyCache.has(key)) bodyCache.set(key, poly(catmull(mirror(bodyHalf(key / 200)), true, 6)));
  return bodyCache.get(key);
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

// mode: 'rwd' (tracción trasera genérica), 'awd' (quattro), 'mass' (reparto de pesos)
function drawPlan(t, { cx, cy, scale, rot = 0, draw = 1, mode = 'awd', power = 0, short = 1, dim = 0, flow = COLOR.yellow, wing = true }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.rotate(rot);
  c.scale(scale, scale);
  const px = 1 / scale;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const rearX = lerp(-330, -270, short);
  const frontX = 262;

  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3 * px;
  trace(c, body(short), draw);
  c.globalAlpha = 0.42;
  c.lineWidth = 2 * px;
  trace(c, CABIN, prog(draw, 0.25, 1));
  const d2 = prog(draw, 0.5, 1);
  if (d2 > 0) {
    c.globalAlpha = 0.42 * d2;
    // Rejillas del capó y alerón trasero.
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(300 + i * 40, -120);
      c.lineTo(330 + i * 40, -60);
      c.moveTo(300 + i * 40, 120);
      c.lineTo(330 + i * 40, 60);
      c.stroke();
    }
    if (wing) {
      rr(c, rearX * 1.5 - 70 * short, -262, 46, 524, 8);
      c.stroke();
    }
  }
  c.globalAlpha = 1;

  // Motor de 5 cilindros en línea, colgado por delante del eje delantero.
  const eng = prog(draw, 0.4, 1);
  if (eng > 0) {
    c.globalAlpha = eng;
    const hot = mode === 'mass' ? power : 0;
    rr(c, 276, -52, 206, 104, 10);
    if (hot > 0) {
      c.fillStyle = `rgba(227,90,38,${0.9 * hot})`;
      c.fill();
    }
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.4 * px;
    c.stroke();
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(300 + i * 40, 0, 14, 0, Math.PI * 2);
      c.stroke();
    }
    // Caja de cambios detrás del motor.
    rr(c, 120, -36, 150, 72, 8);
    c.stroke();
    if (mode !== 'rwd') {
      rr(c, -40 + rearX + 40, -28, 80, 56, 8);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Árboles de transmisión con el flujo de par.
  const shafts = [];
  if (mode === 'rwd') {
    shafts.push([[120, 0], [rearX + 40, 0]], [[rearX, -28], [rearX, -200]], [[rearX, 28], [rearX, 200]]);
  } else {
    shafts.push([[120, 0], [rearX + 40, 0]], [[frontX, -40], [frontX, -200]], [[frontX, 40], [frontX, 200]],
      [[rearX, -28], [rearX, -200]], [[rearX, 28], [rearX, 200]]);
  }
  if (power > 0 && mode !== 'mass') {
    c.save();
    c.globalAlpha = power * (1 - dim);
    c.strokeStyle = flow;
    c.lineWidth = 7 * px;
    c.setLineDash([22, 18]);
    c.lineDashOffset = -t * 260;
    for (const [a, b] of shafts) {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
    c.restore();
  }

  // Ruedas.
  const wheels = [[frontX, -226, true], [frontX, 226, true], [rearX, -226, false], [rearX, 226, false]];
  wheels.forEach(([x, y, front], i) => {
    const appear = prog(draw, 0.6 + i * 0.05, 0.9 + i * 0.025);
    if (appear <= 0) return;
    const driven = mode === 'awd' || (mode === 'rwd' && !front);
    const on = driven && mode !== 'mass' ? ease.outExpo(clamp(power * 3 - (mode === 'awd' ? i : i - 2) * 0.4)) * (1 - dim) : 0;
    c.globalAlpha = appear * (driven || mode === 'mass' ? 1 : 0.5);
    rr(c, x - 75, y - 30, 150, 60, 14);
    c.fillStyle = COLOR.ink;
    c.fill();
    if (on > 0) {
      c.globalAlpha = appear * on;
      c.fillStyle = flow;
      c.fill();
      c.globalAlpha = appear;
    }
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 3 * px;
    c.stroke();
    c.globalAlpha = 1;
  });
  c.restore();
  return { rearX, frontX };
}

// Cota de la distancia entre ejes, en coordenadas de la planta.
function wheelbaseDim(cx, cy, scale, rearX, frontX, p) {
  if (p <= 0) return;
  const c = ctx;
  const y = cy + 330 * scale;
  const x0 = cx + rearX * scale, x1 = cx + frontX * scale;
  c.save();
  c.globalAlpha = ease.out(p);
  c.strokeStyle = COLOR.yellow;
  c.fillStyle = COLOR.yellow;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(x0, y - 22); c.lineTo(x0, y + 22);
  c.moveTo(x1, y - 22); c.lineTo(x1, y + 22);
  c.moveTo(x0, y); c.lineTo(x1, y);
  c.stroke();
  for (const [x, d] of [[x0, 1], [x1, -1]]) {
    c.beginPath();
    c.moveTo(x, y); c.lineTo(x + 16 * d, y - 8); c.lineTo(x + 16 * d, y + 8);
    c.closePath();
    c.fill();
  }
  c.setLineDash([4, 8]);
  c.globalAlpha *= 0.5;
  c.beginPath();
  c.moveTo(x0, cy + 200 * scale); c.lineTo(x0, y - 22);
  c.moveTo(x1, cy + 200 * scale); c.lineTo(x1, y - 22);
  c.stroke();
  c.restore();
}

// ---------------------------------------------------------------------------
// Gráficos técnicos.

// Motor de 5 cilindros en línea visto de lado: pistones con el orden de encendido 1-2-4-5-3.
const FIRING = [0, 1, 4, 2, 3]; // posición de cada cilindro en el orden 1-2-4-5-3
function drawInline5(t, cx, cy, s, appear) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  c.lineJoin = 'round';
  const rpm = lerp(900, 3200, ease.inOut(prog(t, 77.6, 80.8)));
  const crank = Math.PI * 2 * (rpm / 60) * Math.max(0, t - 77.5) * 0.25;
  const pitch = 150, bore = 104, stroke = 70, rod = 150;
  // Bloque.
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3;
  rr(c, -pitch * 2.5 - 26, -230, pitch * 5 + 52, 330, 18);
  c.stroke();
  c.globalAlpha = appear * 0.4;
  c.beginPath();
  c.moveTo(-pitch * 2.5 - 26, -250); c.lineTo(pitch * 2.5 + 26, -250);
  c.stroke();
  c.globalAlpha = appear;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * pitch;
    // Cigüeñal de 5 cilindros: muñequillas a 144°, en el orden de encendido.
    const a = crank - FIRING[i] * (Math.PI * 4 / 5);
    const px = Math.sin(a) * stroke / 2;
    const py = -Math.cos(a) * stroke / 2;
    const pistonY = py - Math.sqrt(rod * rod - px * px);
    // Explosión cerca del punto muerto superior en la carrera de expansión.
    const cyc = ((a % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4);
    const flash = cyc < 0.9 ? 1 - cyc / 0.9 : 0;
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.5;
    c.strokeRect(x - bore / 2, -220, bore, 220);
    if (flash > 0) {
      c.fillStyle = `rgba(242,180,21,${0.95 * flash})`;
      c.fillRect(x - bore / 2 + 3, -217, bore - 6, pistonY - 30 + 217);
    }
    c.fillStyle = COLOR.paper;
    c.fillRect(x - bore / 2 + 6, pistonY - 30, bore - 12, 52);
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(x, pistonY);
    c.lineTo(x + px, py + 30);
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

// Rueda del compresor del turbo con desenfoque de giro.
function turboAngle(t) {
  const tau = Math.max(0, t - 81.0);
  return Math.PI * 2 * (0.25 * tau + 0.18 * tau * tau);
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
      c.strokeStyle = full ? COLOR.yellow : COLOR.orange;
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

// Cifra con dígitos de ancho fijo.
function counter(t, value, x, y, size, color = COLOR.paper, align = 'left') {
  const str = String(Math.round(value));
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

// Indicador genérico 0–100 km/h.
function drawGauge(t, cx, cy, r, t0, t1) {
  const c = ctx;
  const appear = ease.outExpo(prog(t, t0 - 0.2, t0 + 0.4));
  const v = 100 * ease.inOut(prog(t, t0 + 0.3, t1));
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  c.save();
  c.globalAlpha = appear;
  c.lineCap = 'butt';
  c.strokeStyle = 'rgba(243,241,236,0.16)';
  c.lineWidth = 22;
  c.beginPath();
  c.arc(cx, cy, r, a0, a0 + span);
  c.stroke();
  c.strokeStyle = COLOR.yellow;
  c.beginPath();
  c.arc(cx, cy, r, a0, a0 + span * (v / 120));
  c.stroke();
  for (let k = 0; k <= 12; k++) {
    const a = a0 + span * (k / 12);
    const big = k % 2 === 0;
    c.strokeStyle = k * 10 <= v ? COLOR.paper : 'rgba(243,241,236,0.35)';
    c.lineWidth = big ? 4 : 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * (r - 40), cy + Math.sin(a) * (r - 40));
    c.lineTo(cx + Math.cos(a) * (r - (big ? 70 : 56)), cy + Math.sin(a) * (r - (big ? 70 : 56)));
    c.stroke();
  }
  // Marca de 100 km/h.
  const a100 = a0 + span * (100 / 120);
  c.strokeStyle = COLOR.orange;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(cx + Math.cos(a100) * (r + 18), cy + Math.sin(a100) * (r + 18));
  c.lineTo(cx + Math.cos(a100) * (r - 18), cy + Math.sin(a100) * (r - 18));
  c.stroke();
  c.restore();
  ctx.save();
  ctx.globalAlpha = appear;
  counter(t, v, cx, cy + 60, 190, COLOR.paper, 'center');
  ctx.restore();
  label(ctx, 'KM/H', cx, cy + 130, DIM, appear, { size: 26, spacing: 8, weight: 700, align: 'center' });
}

// Caja de doble embrague: dos embragues concéntricos que se alternan (impares y pares).
function drawDCT(t, cx, cy, s, appear, t0) {
  const c = ctx;
  const step = Math.max(0, Math.floor((t - t0) / 0.75));
  const gear = Math.min(6, 1 + step);
  const odd = gear % 2 === 1;
  const sw = ease.inOut(clamp(((t - t0) % 0.75) / 0.18));
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.globalAlpha = appear;
  // Embrague exterior (impares) e interior (pares).
  const rings = [[230, 170, true], [150, 90, false]];
  for (const [ro, ri, isOdd] of rings) {
    const active = isOdd === odd;
    const k = active ? sw : 1 - sw;
    c.beginPath();
    c.arc(0, 0, ro, 0, Math.PI * 2);
    c.arc(0, 0, ri, 0, Math.PI * 2, true);
    c.fillStyle = isOdd ? `rgba(242,180,21,${0.15 + 0.85 * k})` : `rgba(227,90,38,${0.15 + 0.85 * k})`;
    c.fill();
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.5;
    c.stroke();
  }
  c.beginPath();
  c.arc(0, 0, 40, 0, Math.PI * 2);
  c.fillStyle = COLOR.ink;
  c.fill();
  c.stroke();
  // Árboles primarios: exterior hueco para impares, interior macizo para pares.
  c.lineWidth = 3;
  c.strokeStyle = COLOR.paper;
  c.beginPath();
  c.moveTo(260, -26); c.lineTo(760, -26);
  c.moveTo(260, 26); c.lineTo(760, 26);
  c.stroke();
  c.restore();
  // Marchas.
  const gx = cx + 360 * s, gy = cy;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = FONT.display(900, 86 * s);
  ctx.textAlign = 'center';
  [1, 3, 5].forEach((g, i) => {
    ctx.fillStyle = g === gear ? COLOR.yellow : 'rgba(243,241,236,0.28)';
    ctx.fillText(String(g), gx + i * 130 * s, gy - 70 * s);
  });
  [2, 4, 6].forEach((g, i) => {
    ctx.fillStyle = g === gear ? COLOR.orange : 'rgba(243,241,236,0.28)';
    ctx.fillText(String(g), gx + i * 130 * s, gy + 130 * s);
  });
  ctx.restore();
}

// Selector genérico P R N D de un coche actual.
function drawSelector(t, cx, cy, appear, t0) {
  const letters = ['P', 'R', 'N', 'D'];
  const sel = Math.min(3, Math.floor(clamp((t - t0) / 0.45) * 3.999));
  const w = 520, h = 140;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.fillStyle = COLOR.ink2;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  const slot = w / 4;
  const kx = cx - w / 2 + slot * (sel + 0.5);
  ctx.fillStyle = COLOR.yellow;
  ctx.beginPath();
  ctx.roundRect(kx - slot / 2 + 10, cy - h / 2 + 10, slot - 20, h - 20, (h - 20) / 2);
  ctx.fill();
  ctx.font = FONT.wide(800, 58);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  letters.forEach((l, i) => {
    ctx.fillStyle = i === sel ? COLOR.ink : DIM;
    ctx.fillText(l, cx - w / 2 + slot * (i + 0.5), cy + 3);
  });
  ctx.restore();
}

// Corrientes de aire y carga aerodinámica sobre el despiece.
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
    c.strokeStyle = COLOR.orange;
    c.fillStyle = COLOR.orange;
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

// Pikes Peak: crestas en capas, carretera con curvas de herradura y cumbre entre nubes.
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
// Planos. Los textos son extractos literales del guion del cliente.

// 0 – 2,75 · En la era más salvaje de los rallys,
function s01(t) {
  bg();
  photo('curva', 0, 0, W, H, { zoom: lerp(1.25, 1.12, ease.out(prog(t, 0, 3))), fx: 0.4, fy: 0.3 }, { dark: 0.45, vig: 0.6, gray: true });
  tag(t, 'EN LA ERA MÁS SALVAJE', M, 740, 0.05);
  lines(t, ['de los rallys'], M, 870, 0, 128, 0.35);
}

// 2,75 – 5 · el Grupo B,
function s02(t) {
  bg();
  ctx.save();
  zoomAbout(lerp(1.12, 1.0, ease.outExpo(prog(t, 2.75, 3.4))) * lerp(1, 1.04, prog(t, 3.4, 5)));
  const size = fitSize(ctx, 'GRUPO B', (px) => FONT.display(900, px), GRID.w, 330);
  revealText(ctx, 'GRUPO B', W / 2, 650, FONT.display(900, size), COLOR.paper, prog(t, 2.75, 3.25), { stagger: 0.05, align: 'center' });
  ctx.restore();
  stripesH(ctx, 720, 26, prog(t, 2.8, 3.5), prog(t, 4.6, 5.0), { bands: BANDS3 });
}

// 5 – 7,25 · un coche reescribió las leyes de la física
function s03(t) {
  bg();
  photo('rally', 0, 0, W, H, { zoom: lerp(1.12, 1.2, prog(t, 5, 7.5)), fx: 0.55, fy: 0.5, dx: lerp(-30, 30, prog(t, 5, 7.5)) }, { dark: 0.35, vig: 0.55 });
  tag(t, 'UN COCHE REESCRIBIÓ', M, 760, 5.1);
  lines(t, ['las leyes de la física'], M, 880, 0, 120, 5.35);
}

// 7,25 – 9,75 · y dejó obsoleta a la tracción trasera.
function s03b(t) {
  bg();
  const dimmed = ease.inOut(prog(t, 8.4, 9.2));
  drawPlan(t, { cx: 1320, cy: 540, scale: 0.9, draw: ease.out(prog(t, 7.0, 7.9)), mode: 'rwd', power: prog(t, 7.5, 8.1), dim: dimmed, flow: COLOR.orange });
  lines(t, ['Dejó obsoleta', 'a la tracción', 'trasera'], M, 470, 118, 104, 7.4, { maxW: 700 });
}

// 9,75 – 12,25 · Hoy hablamos del monstruo definitivo:
function s04(t) {
  bg();
  const rise = ease.inOut(prog(t, 9.6, 12.3));
  photo('hero', 0, 0, W, H, { zoom: lerp(1.35, 1.2, rise), fx: 0.62, fy: 0.62 }, { dark: lerp(0.9, 0.55, rise), vig: 0.7 });
  tag(t, 'HOY HABLAMOS DEL', M, 200, 10.1);
  lines(t, ['monstruo definitivo'], M, 320, 0, 120, 10.5);
}

// 12,25 – 15,25 · el Audi Sport Quattro S1.
function s05(t) {
  bg();
  photo('hero', 0, 0, W, H, { zoom: lerp(1.08, 1.0, ease.out(prog(t, 12.0, 15.5))), fx: 0.5, fy: 0.5 }, { dark: 0.18, vig: 0.45 });
  ctx.save();
  ctx.fillStyle = 'rgba(13,13,15,0.55)';
  ctx.fillRect(0, 110, W * ease.outExpo(prog(t, 12.3, 12.9)), 250);
  ctx.restore();
  tag(t, 'AUDI SPORT', M, 200, 12.55, COLOR.yellow);
  lines(t, ['Quattro S1'], M, 320, 0, 120, 12.6);
  accent(t, M, 345, 12.8, 300, 8);
}

// 15,25 – 18 · A principios de los 80,
function s06(t) {
  bg(COLOR.paper);
  photo('calle', 960, 0, 960, H, { zoom: lerp(1.12, 1.04, ease.out(prog(t, 15, 18.2))), fx: 0.4, fy: 0.5 }, { vig: 0.25 });
  ctx.save();
  ctx.translate(0, 0);
  tag(t, 'A PRINCIPIOS DE LOS', M, 430, 15.4, COLOR.orange);
  const size = fitSize(ctx, "80", (px) => FONT.display(900, px), 700, 420);
  revealText(ctx, '80', M, 760, FONT.display(900, size), COLOR.ink, prog(t, 15.55, 16.2), { stagger: 0.12 });
  ctx.restore();
  accent(t, M, 820, 15.8, 340, 12);
}

// 18 – 21,75 · la norma dictaba que los coches de rally debían ser de tracción trasera.
function s07(t) {
  bg();
  drawPlan(t, { cx: 1320, cy: 540, scale: 0.9, draw: ease.out(prog(t, 17.9, 18.8)), mode: 'rwd', power: prog(t, 19.8, 20.6), flow: COLOR.orange });
  tag(t, 'LA NORMA DICTABA', M, 430, 18.1);
  lines(t, ['Tracción', 'trasera'], M, 560, 128, 130, 19.9, { maxW: 700 });
}

// 21,75 – 27,5 · Los ingenieros decían que un sistema 4x4 era demasiado pesado y complejo.
function s08(t) {
  bg();
  const build = prog(t, 22.0, 25.2);
  drawPlan(t, { cx: 1320, cy: 540, scale: 0.9, draw: ease.out(prog(t, 21.6, 22.5)), mode: 'awd', power: build, flow: COLOR.grey });
  tag(t, 'LOS INGENIEROS DECÍAN QUE UN 4×4 ERA', M, 400, 22.0, COLOR.yellow, { size: 22 });
  lines(t, ['Demasiado', 'pesado', 'y complejo'], M, 540, 118, 116, 24.2, { maxW: 700, step: 0.3 });
}

// 27,5 – 29,75 · Audi ignoró a todo el mundo.
function s09(t) {
  bg(COLOR.yellow);
  ctx.save();
  zoomAbout(lerp(1.1, 1.0, ease.outExpo(prog(t, 27.5, 28.1))));
  lines(t, ['Audi ignoró', 'a todo el mundo.'], M, 500, 150, 150, 27.55, { color: COLOR.ink, step: 0.16 });
  ctx.restore();
  stripesH(ctx, 720, 30, prog(t, 27.7, 28.4), 0, { x0: M, x1: W - M });
}

// 29,75 – 34 · Metieron su sistema de tracción total quattro en un chasis de rally
function s10(t) {
  bg();
  photo('curva', 0, 0, W, H, { zoom: lerp(1.06, 1.18, prog(t, 29.5, 34.2)), fx: 0.6, fy: 0.75 }, { dark: 0.4, vig: 0.55, gray: has('curva') });
  tag(t, 'TRACCIÓN TOTAL', M, 760, 29.9);
  lines(t, ['quattro'], M, 900, 0, 150, 30.6, { color: COLOR.yellow });
  label(ctx, 'en un chasis de rally', M, 970, COLOR.paper, prog(t, 32.4, 32.9), { size: 40, spacing: 0, weight: 600 });
}

// 34 – 38,25 · y demostraron que, si puedes transmitir la potencia a las cuatro ruedas,
function s11(t) {
  bg();
  drawPlan(t, { cx: 1320, cy: 540, scale: 0.92, rot: lerp(-0.05, 0, ease.out(prog(t, 34, 38))), draw: ease.out(prog(t, 33.9, 34.6)), mode: 'awd', power: prog(t, 35.6, 37.0) });
  tag(t, 'TRANSMITIR LA POTENCIA', M, 430, 34.3);
  lines(t, ['a las cuatro', 'ruedas'], M, 560, 128, 120, 36.0, { maxW: 700 });
}

// 38,25 – 41,75 · el agarre sobre tierra y nieve es invencible.
function s12(t) {
  bg();
  photo('tramo', 900, 0, W - 900, H, { zoom: lerp(1.18, 1.06, ease.out(prog(t, 38, 42))), fx: 0.4, fy: 0.85 }, { vig: 0.3 });
  tag(t, 'SOBRE TIERRA Y NIEVE', M, 430, 38.4);
  lines(t, ['Agarre', 'invencible'], M, 570, 128, 130, 39.6, { maxW: 680 });
}

// 41,75 – 45,5 · De repente, la potencia pura ya no era el límite.
function s13(t) {
  bg();
  const x0 = M, x1 = W - M, y = 690;
  const lim = lerp(x0, x1, 0.62);
  const show = ease.out(prog(t, 41.8, 42.3));
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = 'rgba(243,241,236,0.18)';
  ctx.fillRect(x0, y, x1 - x0, 3);
  ctx.restore();
  const fill = ease.inOut(prog(t, 42.4, 44.4));
  const bx = lerp(x0, x1, fill);
  ctx.fillStyle = bx > lim ? COLOR.yellow : COLOR.paper;
  ctx.fillRect(x0, y - 24, bx - x0, 18);
  // Marca del límite: se quiebra cuando la barra la supera.
  const broken = ease.outExpo(prog(t, 43.55, 44.1));
  ctx.save();
  ctx.globalAlpha = show * (1 - broken * 0.75);
  ctx.fillStyle = COLOR.orange;
  ctx.fillRect(lim - 3, y - 90 - broken * 30, 6, 70);
  ctx.fillRect(lim - 3, y + 20 + broken * 30, 6, 70);
  ctx.restore();
  label(ctx, 'LÍMITE', lim, y - 110, COLOR.orange, show * (1 - broken), { size: 24, spacing: 7, weight: 700, align: 'center' });
  tag(t, 'DE REPENTE,', M, 330, 42.0);
  lines(t, ['la potencia pura', 'ya no era el límite.'], M, 450, 118, 110, 42.6);
}

// 45,5 – 49,75 · Pero la competencia apretó, y Audi tuvo que mutar.
// El quattro de calle muta en el S1: cortinilla vertical con la banda amarilla.
function s14(t) {
  bg();
  const m = ease.inOutExpo(prog(t, 47.6, 48.2));
  const x0 = 900;
  photo('calle', x0, 0, W - x0, H, { zoom: lerp(1.15, 1.08, ease.out(prog(t, 45.3, 49.9))), fx: 0.45, fy: 0.5 }, { vig: 0.35, gray: true });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + (W - x0) * (1 - m), 0, (W - x0) * m + 1, H);
  ctx.clip();
  photo('hero', x0, 0, W - x0, H, { zoom: lerp(1.3, 1.15, ease.out(prog(t, 47.6, 49.9))), fx: 0.62, fy: 0.55 }, { vig: 0.35 });
  ctx.restore();
  if (m > 0 && m < 1) {
    ctx.fillStyle = COLOR.yellow;
    ctx.fillRect(x0 + (W - x0) * (1 - m) - 18, 0, 18, H);
  }
  tag(t, 'PERO LA COMPETENCIA APRETÓ', M, 430, 45.8);
  lines(t, ['Audi tuvo', 'que mutar.'], M, 560, 128, 130, 47.8, { maxW: 660 });
}

// 49,75 – 55 · Así nació en 1985 la evolución más extrema:
function s15(t) {
  bg();
  ctx.save();
  zoomAbout(1 + 0.04 * ease.inOut(prog(t, 49.75, 55)));
  tag(t, 'ASÍ NACIÓ EN', W / 2, 330, 49.9, COLOR.yellow, { align: 'center' });
  const size = fitSize(ctx, '1985', (px) => FONT.display(900, px), 1200, 400);
  revealText(ctx, '1985', W / 2, 700, FONT.display(900, size), COLOR.paper, prog(t, 50.9, 51.6), { stagger: 0.08, align: 'center', exit: prog(t, 54.6, 55) });
  label(ctx, 'LA EVOLUCIÓN MÁS EXTREMA', W / 2, 850, COLOR.paper, prog(t, 52.4, 52.9) * (1 - prog(t, 54.5, 54.8)), { size: 34, spacing: 10, weight: 700, align: 'center' });
  ctx.restore();
  stripesH(ctx, 750, 18, prog(t, 51.0, 51.8), prog(t, 54.4, 55), { x0: W / 2 - 420, x1: W / 2 + 420 });
}

// 55 – 59 · el Sport Quattro S1 E2. (foto dentro de las letras y zoom a través)
function s16(t) {
  bg();
  if (t >= 56.6) {
    photo('hero', 0, 0, W, H, { zoom: lerp(1.25, 1.05, ease.outExpo(prog(t, 56.6, 59.2))), fx: 0.6, fy: 0.5 }, { dark: 0.15, vig: 0.45 });
    tag(t, 'SPORT QUATTRO', M, 200, 56.8);
    lines(t, ['S1 E2'], M, 340, 0, 150, 56.9, { color: COLOR.yellow });
    return;
  }
  const L = layers.type;
  const g = L.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  revealText(g, 'S1 E2', W / 2, layers.typeBase, FONT.display(900, layers.typeSize), '#fff', prog(t, 55.0, 55.45), { stagger: 0.07, align: 'center' });
  g.globalCompositeOperation = 'source-in';
  const bb = layers.typeBox;
  drawCover(g, A.hero, bb.x, bb.y, bb.w, bb.h, { zoom: lerp(1.3, 1.1, ease.out(prog(t, 55, 56.6))), fx: 0.6, fy: 0.55 });
  g.globalCompositeOperation = 'source-over';
  const zp = ease.inExpo(prog(t, 56.05, 56.6));
  const z = Math.exp(lerp(0, Math.log(30), zp));
  const P = layers.typeHole;
  const n = zp > 0.02 ? 6 : 1;
  for (let k = 0; k < n; k++) {
    const zk = z * (1 - 0.07 * zp * (k / Math.max(1, n - 1)));
    ctx.save();
    ctx.globalAlpha = 1 / (k + 1);
    zoomAbout(zk, P.x, P.y);
    ctx.drawImage(L, 0, 0);
    ctx.restore();
  }
}

// 59 – 62,75 · Los ingenieros acortaron la distancia entre ejes para hacerlo más ágil,
function s17(t) {
  bg();
  const k = ease.inOut(prog(t, 59.9, 61.0));
  const r = drawPlan(t, { cx: 1300, cy: 470, scale: 0.92, draw: ease.out(prog(t, 58.8, 59.5)), mode: 'awd', power: 0, short: k, wing: true });
  wheelbaseDim(1300, 470, 0.92, r.rearX, r.frontX, prog(t, 59.1, 59.5));
  label(ctx, 'DISTANCIA ENTRE EJES', 1300 + (r.rearX + r.frontX) / 2 * 0.92, 470 + 330 * 0.92 + 70, COLOR.yellow, prog(t, 59.3, 59.8), { size: 24, spacing: 7, weight: 700, align: 'center' });
  tag(t, 'LA ACORTARON PARA HACERLO', M, 430, 59.2);
  lines(t, ['más ágil'], M, 580, 0, 150, 61.6, { maxW: 640 });
}

// 62,75 – 67,75 · creando una silueta desproporcionada, casi cómica, pero letal.
function s18(t) {
  bg();
  photo('hero', 0, 0, W, H, { zoom: lerp(1.02, 1.12, ease.inOut(prog(t, 62.6, 68))), fx: 0.45, fy: 0.55 }, { dark: 0.3, vig: 0.5 });
  ctx.save();
  ctx.globalAlpha = 1 - 0.55 * ease.out(prog(t, 66.6, 66.9));
  lines(t, ['Desproporcionada'], M, 270, 0, 110, 63.0);
  label(ctx, 'casi cómica,', M, 350, COLOR.paper, prog(t, 65.55, 66.0), { size: 46, spacing: 0, weight: 600 });
  ctx.restore();
  if (t >= 66.7) {
    const slam = ease.outExpo(prog(t, 66.7, 67.0));
    ctx.save();
    ctx.translate(M, 500);
    const s = lerp(1.3, 1, slam);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(slam * 5);
    ctx.font = FONT.display(900, 120);
    ctx.fillStyle = COLOR.yellow;
    ctx.fillText('pero letal.', 0, 0);
    ctx.restore();
  }
}

// 67,75 – 70,75 · Lo vistieron con un kit aerodinámico salvaje
function s19(t) {
  bg();
  if (has('nocturna')) {
    photo('nocturna', 0, 0, W, H, { zoom: lerp(1.12, 1.22, prog(t, 67.5, 71)), fx: 0.2, fy: 0.45 }, { dark: 0.42, vig: 0.6 });
  } else {
    photo('hero', 0, 0, W, H, { zoom: lerp(2.0, 2.2, prog(t, 67.5, 71)), fx: 0.12, fy: 0.36 }, { dark: 0.25, vig: 0.5 });
  }
  tag(t, 'LO VISTIERON CON UN', M, 760, 67.9);
  lines(t, ['kit aerodinámico', 'salvaje'], M, 860, 110, 104, 68.4);
}

// 70,75 – 75,5 · con alerones colosales diseñados para aplastar el coche contra el suelo.
function s20(t) {
  bg(COLOR.paper);
  const z = lerp(1.0, 1.04, ease.inOut(prog(t, 70.6, 75.6)));
  const press = ease.inOut(prog(t, 72.2, 73.4)) * 10;
  ctx.save();
  zoomAbout(z, 1150, 560);
  const iw = 1100, ih = iw * (A.cutaway.height / A.cutaway.width);
  // Multiplicar: el blanco del despiece se funde con el fondo papel.
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(A.cutaway, 760, 250 + press, iw, ih);
  ctx.restore();
  drawDownforce(t, 900, 1780, 170, 380 + press, ease.out(prog(t, 71.2, 71.8)));
  tag(t, 'ALERONES COLOSALES PARA', M, 300, 70.9, COLOR.orange);
  lines(t, ['Aplastar', 'el coche', 'contra', 'el suelo'], M, 430, 112, 104, 72.2, { color: COLOR.ink, maxW: 600, step: 0.1 });
}

// 75,5 – 77,5 · Bajo el capó de kevlar,
function s21(t) {
  bg();
  // El capó se levanta: la foto del vano se descubre de abajo arriba.
  const open = ease.outExpo(prog(t, 75.5, 76.4));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H * (1 - open), W, H * open);
  ctx.clip();
  photo('vano', 0, 0, W, H, { zoom: lerp(1.25, 1.12, ease.out(prog(t, 75.5, 77.6))), fx: 0.5, fy: 0.35 }, { dark: 0.3, vig: 0.55 });
  ctx.restore();
  ctx.fillStyle = COLOR.yellow;
  ctx.fillRect(0, H * (1 - open) - 6, W, 6 * (1 - prog(t, 76.3, 76.6)));
  tag(t, 'BAJO EL CAPÓ DE', M, 760, 75.6);
  lines(t, ['kevlar'], M, 900, 0, 150, 75.9);
}

// 77,5 – 81,25 · el mítico motor de 5 cilindros en línea y 2,1 litros
function s22(t) {
  bg();
  drawInline5(t, 1240, 560, 1.0, ease.outExpo(prog(t, 77.45, 77.9)));
  tag(t, 'EL MÍTICO MOTOR DE', M, 400, 77.6);
  lines(t, ['5 cilindros', 'en línea'], M, 530, 120, 120, 78.2, { maxW: 600 });
  label(ctx, '2,1 litros', M, 800, COLOR.yellow, prog(t, 80.0, 80.5), { size: 56, spacing: 0, weight: 700 });
}

// 81,25 – 87,75 · producía oficialmente unos 500 caballos, aunque muchos dicen que rozaba los 600.
function s23(t) {
  bg();
  drawTurbo(t, 1380, 520, 250, ease.outExpo(prog(t, 81.2, 81.7)));
  const v = lerp(0, 500, ease.outExpo(prog(t, 82.4, 83.6))) + lerp(0, 100, ease.inOut(prog(t, 86.0, 86.9)));
  const hot = prog(t, 86.0, 86.9);
  tag(t, hot > 0.5 ? 'MUCHOS DICEN QUE ROZABA LOS' : 'OFICIALMENTE, UNOS', M, 400, hot > 0.5 ? 86.0 : 81.5, hot > 0.5 ? COLOR.orange : COLOR.yellow);
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, 82.3, 82.6));
  counter(t, v, M - 6, 700, 290, hot > 0.5 ? COLOR.orange : COLOR.paper);
  ctx.restore();
  label(ctx, 'caballos', M, 800, COLOR.paper, prog(t, 83.4, 83.9), { size: 56, spacing: 0, weight: 700 });
}

// 87,75 – 91,5 · Conducir esto requería un nivel de habilidad sobrehumano.
function s25(t) {
  bg();
  if (has('rohrl')) {
    photo('rohrl', 900, 0, W - 900, H, { zoom: lerp(1.06, 1.14, prog(t, 87.5, 91.7)), fx: 0.12, fy: 0.4 }, { vig: 0.35 });
    tag(t, 'CONDUCIR ESTO REQUERÍA', M, 430, 88.0);
    lines(t, ['Habilidad', 'sobrehumana'], M, 570, 118, 110, 88.9, { maxW: 680 });
    return;
  }
  photo('hero', 0, 0, W, H, { zoom: lerp(2.6, 2.8, prog(t, 87.5, 91.7)), fx: 0.47, fy: 0.42 }, { dark: 0.45, vig: 0.6 });
  tag(t, 'CONDUCIR ESTO REQUERÍA', M, 760, 88.0);
  lines(t, ['habilidad', 'sobrehumana'], M, 870, 106, 100, 88.9);
}

// 91,5 – 95,5 · Con un reparto de pesos desequilibrado por llevar el motor tan adelantado,
function s26(t) {
  bg();
  const cx = 1320, cy = 450, sc = 0.88;
  drawPlan(t, { cx, cy, scale: sc, draw: ease.out(prog(t, 91.4, 92.2)), mode: 'mass', power: prog(t, 93.6, 94.4), short: 1 });
  // Barra del reparto: el peso se carga hacia delante.
  const y = cy + 320 * sc + 60;
  const x0 = cx - 520 * sc, x1 = cx + 520 * sc;
  const bias = lerp(0.5, 0.64, ease.inOut(prog(t, 92.6, 94.6)));
  const show = ease.out(prog(t, 92.2, 92.7));
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = 'rgba(243,241,236,0.2)';
  ctx.fillRect(x0, y, x1 - x0, 14);
  ctx.fillStyle = COLOR.orange;
  ctx.fillRect(x1 - (x1 - x0) * bias, y, (x1 - x0) * bias, 14);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(lerp(x0, x1, 0.5) - 2, y - 14, 4, 42);
  ctx.restore();
  label(ctx, 'DELANTE', x1, y + 64, COLOR.orange, show, { size: 22, spacing: 6, weight: 700, align: 'right' });
  label(ctx, 'DETRÁS', x0, y + 64, DIM, show, { size: 22, spacing: 6, weight: 700 });
  tag(t, 'CON EL MOTOR TAN ADELANTADO', M, 400, 91.7);
  lines(t, ['Un reparto', 'de pesos', 'desequilibrado'], M, 530, 112, 100, 92.2, { maxW: 640 });
}

// 95,5 – 101 · pilotos legendarios como Walter Röhrl, Michèle Mouton y Stig Blomqvist
const DRIVERS = [['Walter Röhrl', 97.0], ['Michèle Mouton', 98.3], ['Stig Blomqvist', 99.55]];
function s27(t) {
  bg();
  photo('rohrl', 960, 0, 960, H, { zoom: lerp(has('rohrl') ? 1.7 : 2.2, has('rohrl') ? 1.55 : 2.05, ease.out(prog(t, 95.3, 101.2))), fx: has('rohrl') ? 0.18 : 0.47, fy: has('rohrl') ? 0.22 : 0.42 }, { dark: 0.2, vig: 0.4 });
  tag(t, 'PILOTOS LEGENDARIOS', M, 330, 95.7);
  DRIVERS.forEach(([name, t0], i) => {
    const y = 480 + i * 190;
    const line = ease.outExpo(prog(t, t0 - 0.1, t0 + 0.6));
    if (i > 0) {
      ctx.fillStyle = 'rgba(243,241,236,0.2)';
      ctx.fillRect(M, y - 120, 700 * line, 2);
    }
    revealText(ctx, name, M, y, FONT.display(900, Math.min(...DRIVERS.map(([n]) => fitSize(ctx, n, (px) => FONT.display(900, px), 700, 84)))), i === 0 ? COLOR.yellow : COLOR.paper, prog(t, t0, t0 + 0.7), { stagger: 0.02 });
  });
}

// 101 – 106,5 · tenían que obligar al coche a girar basándose en pura fuerza bruta y transferencias de peso.
function s28(t) {
  bg();
  // El coche se descoloca: la masa pasa de delante atrás y rota.
  const u = ease.inOut(prog(t, 101.6, 105.2));
  const yaw = Math.sin(u * Math.PI) * 0.55 - 0.1 * u;
  const cx = lerp(1220, 1380, u), cy = 500 + Math.sin(u * Math.PI) * 40;
  drawPlan(t, { cx, cy, scale: 0.8, rot: -yaw, draw: ease.out(prog(t, 100.9, 101.6)), mode: 'mass', power: 1 - u * 0.6, short: 1 });
  // Flecha de transferencia de peso.
  const a = ease.out(prog(t, 102.6, 103.2));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = COLOR.yellow;
  ctx.fillStyle = COLOR.yellow;
  ctx.lineWidth = 8;
  const ax0 = cx + 220, ax1 = cx - 200, ay = cy + 300;
  ctx.beginPath();
  ctx.moveTo(ax0, ay); ctx.lineTo(lerp(ax0, ax1, ease.inOut(prog(t, 102.8, 104.0))), ay);
  ctx.stroke();
  const hx = lerp(ax0, ax1, ease.inOut(prog(t, 102.8, 104.0)));
  ctx.beginPath();
  ctx.moveTo(hx - 24, ay); ctx.lineTo(hx + 4, ay - 18); ctx.lineTo(hx + 4, ay + 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  tag(t, 'OBLIGAR AL COCHE A GIRAR CON', M, 400, 101.2);
  lines(t, ['Fuerza bruta', 'y transferencias', 'de peso'], M, 530, 112, 100, 102.3, { maxW: 640 });
}

// 106,5 – 108,25 · Era una bala.
function s29(t) {
  bg();
  photo('rally', 0, 0, W, H, { zoom: lerp(1.3, 1.12, ease.outExpo(prog(t, 106.5, 108.3))), fx: 0.55, fy: 0.5 }, { dark: 0.3, vig: 0.55 });
  ctx.save();
  const slam = ease.outExpo(prog(t, 106.55, 106.9));
  ctx.globalAlpha = clamp(slam * 4);
  ctx.translate(W / 2, 330);
  const s = lerp(1.35, 1, slam);
  ctx.scale(s, s);
  ctx.font = FONT.display(900, 210);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.paper;
  ctx.fillText('Era una bala.', 0, 0);
  ctx.restore();
}

// 108,25 – 113,25 · Aceleraba de 0 a 100 en unos 3,1 segundos... sobre tierra.
function s30(t) {
  bg();
  drawGauge(t, 1360, 560, 330, 108.6, 110.6);
  tag(t, 'DE 0 A 100 EN UNOS', M, 400, 108.5);
  ctx.save();
  ctx.globalAlpha = ease.out(prog(t, 110.55, 110.9));
  ctx.font = FONT.display(900, 250);
  ctx.fillStyle = COLOR.yellow;
  ctx.fillText('3,1 s', M - 8, 640);
  ctx.restore();
  label(ctx, 'sobre tierra.', M, 760, COLOR.paper, prog(t, 112.0, 112.5), { size: 64, spacing: 0, weight: 700 });
}

// 113,25 – 118,75 · …experimentó con una caja de cambios de doble embrague,
function s31(t) {
  bg();
  drawDCT(t, 780, 700, 1.05, ease.outExpo(prog(t, 113.2, 113.7)), 113.8);
  tag(t, 'AUDI INCLUSO EXPERIMENTÓ CON UNA', M, 200, 113.6);
  lines(t, ['Caja de doble embrague'], M, 330, 0, 100, 115.5);
}

// 118,75 – 122,5 · sentando las bases de la tecnología que hoy usamos a diario.
function s32(t) {
  bg();
  drawSelector(t, W / 2, 380, ease.outExpo(prog(t, 118.9, 119.4)), 119.6);
  tag(t, 'SENTANDO LAS BASES DE LA TECNOLOGÍA', W / 2, 640, 119.0, COLOR.yellow, { align: 'center' });
  const size = fitSize(ctx, 'que hoy usamos a diario', (px) => FONT.display(900, px), GRID.w, 110);
  revealText(ctx, 'que hoy usamos a diario', W / 2, 790, FONT.display(900, size), COLOR.paper, prog(t, 120.2, 120.9), { stagger: 0.015, align: 'center' });
}

// 122,5 – 126 · El Grupo B se canceló por ser demasiado peligroso,
function s33(t) {
  bg();
  const fade = ease.inOut(prog(t, 122.5, 123.4));
  ctx.save();
  ctx.globalAlpha = fade;
  photo('curva', 0, 0, W, H, { zoom: lerp(1.05, 1.12, prog(t, 122.5, 126.2)), fx: 0.5, fy: 0.45 }, { dark: 0.6, vig: 0.65, gray: true });
  ctx.restore();
  const size = fitSize(ctx, 'GRUPO B', (px) => FONT.display(900, px), 1100, 240);
  revealText(ctx, 'GRUPO B', W / 2, 590, FONT.display(900, size), 'rgba(243,241,236,0.9)', prog(t, 122.7, 123.3), { stagger: 0.05, align: 'center' });
  // Tachado.
  const cut = ease.inOut(prog(t, 123.4, 124.0));
  ctx.fillStyle = COLOR.orange;
  ctx.fillRect(W / 2 - 600, 520, 1200 * cut, 16);
  label(ctx, 'CANCELADO POR SER DEMASIADO PELIGROSO', W / 2, 720, COLOR.paper, prog(t, 123.9, 124.4), { size: 30, spacing: 8, weight: 700, align: 'center' });
}

// 126 – 129,5 · pero el S1 encontró un último campo de batalla:
function s34(t) {
  bg();
  ctx.save();
  zoomAbout(lerp(1.0, 1.05, prog(t, 126, 129.6)));
  tag(t, 'PERO EL S1 ENCONTRÓ', W / 2, 400, 126.3, COLOR.yellow, { align: 'center' });
  const size = fitSize(ctx, 'un último campo de batalla', (px) => FONT.display(900, px), GRID.w, 112);
  revealText(ctx, 'un último campo de batalla', W / 2, 580, FONT.display(900, size), COLOR.paper, prog(t, 126.9, 127.7), { stagger: 0.015, align: 'center' });
  ctx.restore();
}

// 129,5 – 133,5 · Pikes Peak, donde pulverizó el récord subiendo hacia las nubes.
function s35(t) {
  bg();
  drawMountain(t, 129.4, ease.out(prog(t, 129.4, 129.8)));
  lines(t, ['Pikes Peak'], M, 250, 0, 150, 129.55);
  tag(t, 'PULVERIZÓ EL RÉCORD', M, 330, 130.8);
  label(ctx, 'subiendo hacia las nubes', M, 395, DIM, prog(t, 132.0, 132.5), { size: 40, spacing: 0, weight: 600 });
}

// 133,5 – 136,75 · El Audi Quattro S1 no solo ganó carreras;
function s36(t) {
  bg();
  if (has('tramo')) {
    photo('tramo', 0, 0, W, H, { zoom: lerp(1.2, 1.06, ease.outExpo(prog(t, 133.4, 137))), fx: 0.5, fy: 0.97 }, { dark: 0.32, vig: 0.45 });
    tag(t, 'EL AUDI QUATTRO S1', M, 200, 133.8);
    lines(t, ['no solo ganó carreras'], M, 320, 0, 112, 134.4);
    return;
  }
  photo('hero', 0, 0, W, H, { zoom: lerp(1.25, 1.1, ease.outExpo(prog(t, 133.4, 137))), fx: 0.45, fy: 0.75 }, { dark: 0.3, vig: 0.55 });
  tag(t, 'EL AUDI QUATTRO S1', M, 760, 133.8);
  lines(t, ['no solo ganó carreras'], M, 880, 0, 112, 134.4);
}

// 136,75 – 141,5 · demostró que la ingeniería radical puede cambiar la historia.
function s37(t) {
  bg(COLOR.paper);
  ctx.save();
  ctx.translate(W / 2, 780);
  ctx.rotate(-0.12);
  ctx.translate(-W / 2, -780);
  const drift = lerp(0, -80, ease.inOut(prog(t, 136.75, 141.6)));
  stripesH(ctx, 700, 78, prog(t, 136.8, 137.6), 0, { x0: -300 + drift, x1: W + 300 + drift, bands: BANDS3, stagger: 0.06 });
  ctx.restore();
  tag(t, 'DEMOSTRÓ QUE', M, 230, 137.0, COLOR.orange);
  lines(t, ['La ingeniería radical', 'puede cambiar la historia.'], M, 380, 128, 112, 137.4, { color: COLOR.ink });
}

// 141,5 – 144,5 · ¿Cuál crees que fue su mayor rival?
function s38(t) {
  bg();
  const size = fitSize(ctx, '¿Cuál crees que fue', (px) => FONT.display(900, px), GRID.w, 120);
  revealText(ctx, '¿Cuál crees que fue', M, 470, FONT.display(900, size), COLOR.paper, prog(t, 141.6, 142.3), { stagger: 0.015 });
  revealText(ctx, 'su mayor rival?', M, 600, FONT.display(900, size), COLOR.yellow, prog(t, 141.75, 142.45), { stagger: 0.015 });
  accent(t, M, 660, 142.0, 300, 10);
}

// 144,5 – 150 · Déjalo en los comentarios y suscríbete para más leyendas del motor.
function s39(t) {
  bg();
  photo('hero', 960, 0, 960, H, { zoom: lerp(1.15, 1.05, ease.out(prog(t, 144.4, 150))), fx: 0.66, fy: 0.55 }, { dark: 0.2, vig: 0.4 });
  tag(t, 'AUDI SPORT', M, 330, 144.6, COLOR.yellow);
  const size = fitSize(ctx, 'Quattro S1', (px) => FONT.display(900, px), 700, 140);
  revealText(ctx, 'Quattro S1', M, 470, FONT.display(900, size), COLOR.paper, prog(t, 144.65, 145.3), { stagger: 0.03 });
  stripesH(ctx, 510, 16, prog(t, 144.6, 145.3), 0, { x0: M, x1: M + 700, bands: BANDS3 });
  label(ctx, 'Más leyendas del motor', M, 640, DIM, prog(t, 145.4, 145.9), { size: 40, spacing: 0, weight: 600 });
  // Botones genéricos con los colores del cliente.
  const a = ease.outExpo(prog(t, 145.6, 146.1));
  if (a > 0) {
    const press = Math.sin(Math.PI * prog(t, 146.9, 147.2));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = FONT.text(700, 40);
    const tw = ctx.measureText('Suscríbete').width;
    const bw = tw + 110, bh = 96, bx = M, by = 720;
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(lerp(0.92, 1, a) * (1 - 0.05 * press), lerp(0.92, 1, a) * (1 - 0.05 * press));
    ctx.fillStyle = COLOR.yellow;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = COLOR.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Suscríbete', 0, 2);
    ctx.restore();
  }
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

function whip(t, t0, A_, B_, dir = 1, vertical = false) {
  const p = prog(t, t0 - 0.12, t0 + 0.12);
  const e = ease.inOutExpo(p);
  const a = toLayer('a', () => A_(t));
  const b = toLayer('b', () => B_(t));
  const v = Math.sin(Math.PI * p) * 420 * dir;
  const S = vertical ? H : W;
  ctx.save();
  if (vertical) {
    ctx.translate(0, -S * e * dir);
    smear(ctx, a, 0, v, 24);
    ctx.translate(0, S * dir);
    smear(ctx, b, 0, v, 24);
  } else {
    ctx.translate(-S * e * dir, 0);
    smear(ctx, a, v, 0, 24);
    ctx.translate(S * dir, 0);
    smear(ctx, b, v, 0, 24);
  }
  ctx.restore();
}

function slices(t, t0, A_, B_) {
  B_(t);
  const a = toLayer('a', () => A_(t));
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
  A_(t);
  const b = toLayer('b', () => B_(t));
  ctx.save();
  ctx.globalAlpha = ease.inOut(prog(t, t0, t0 + dur));
  ctx.drawImage(b, 0, 0);
  ctx.restore();
}

const wipe = (t, t0, A_, B_, opts) => stripeWipe(ctx, prog(t, t0 - 0.25, t0 + 0.25), () => A_(t), () => B_(t), opts);

// Lista de montaje: [inicio, plano] y transiciones [desde, hasta, tipo].
const SHOTS = [
  [0, s01], [2.75, s02], [5.0, s03], [7.25, s03b], [9.75, s04], [12.25, s05], [15.25, s06], [18.0, s07],
  [21.75, s08], [27.5, s09], [29.75, s10], [34.0, s11], [38.25, s12], [41.75, s13], [45.5, s14], [49.75, s15],
  [55.0, s16], [59.0, s17], [62.75, s18], [67.75, s19], [70.75, s20], [75.5, s21], [77.5, s22], [81.25, s23],
  [87.75, s25], [91.5, s26], [95.5, s27], [101.0, s28], [106.5, s29], [108.25, s30], [113.25, s31], [118.75, s32],
  [122.5, s33], [126.0, s34], [129.5, s35], [133.5, s36], [136.75, s37], [141.5, s38], [144.5, s39],
];
const TRANS = {
  5.0: 'whip', 9.75: 'dissolve', 12.25: 'wipe', 15.25: 'slices', 21.75: 'whipV', 29.75: 'whip', 38.25: 'wipe',
  45.5: 'dissolve', 59.0: 'slices', 62.75: 'whip', 70.75: 'wipe', 77.5: 'whip', 87.75: 'dissolve', 95.5: 'slices',
  101.0: 'whipV', 108.25: 'whip', 118.75: 'dissolve', 126.0: 'dissolve', 133.5: 'wipe', 136.75: 'slices', 141.5: 'wipe',
};

function compose(t) {
  let i = 0;
  while (i < SHOTS.length - 1 && t >= SHOTS[i + 1][0]) i++;
  // ¿Estamos dentro de la ventana de una transición hacia el plano siguiente o desde el anterior?
  for (const k of [i, i + 1]) {
    if (k <= 0 || k >= SHOTS.length) continue;
    const t0 = SHOTS[k][0];
    const type = TRANS[t0];
    if (!type) continue;
    const prev = SHOTS[k - 1][1], next = SHOTS[k][1];
    const win = { whip: 0.12, whipV: 0.12, wipe: 0.25, slices: 0.4, dissolve: 0.5 }[type];
    const a0 = type === 'slices' ? t0 - 0.2 : type === 'dissolve' ? t0 - 0.25 : t0 - win;
    const a1 = type === 'slices' ? t0 + 0.2 : type === 'dissolve' ? t0 + 0.25 : t0 + win;
    if (t >= a0 && t < a1) {
      if (type === 'whip') return whip(t, t0, prev, next, 1);
      if (type === 'whipV') return whip(t, t0, prev, next, 1, true);
      if (type === 'wipe') return wipe(t, t0, prev, next);
      if (type === 'slices') return slices(t, t0 - 0.2, prev, next);
      if (type === 'dissolve') return dissolve(t, t0 - 0.25, 0.5, prev, next);
    }
  }
  return SHOTS[i][1](t);
}

const SHAKES = [2.75, 27.5, 55.0, 66.7, 106.5, 133.5];

export function seek(main, t) {
  ctx = main.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, W, H);
  const z = 1 + punch(t, HITS, 0.035, 6.5);
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
  // Fundido de entrada y de salida.
  const fin = 1 - ease.out(prog(t, 0, 0.35));
  const fout = ease.inOut(prog(t, 149.4, 150));
  const f = Math.max(fin, fout);
  if (f > 0) {
    ctx.fillStyle = `rgba(13,13,15,${f})`;
    ctx.fillRect(0, 0, W, H);
  }
  grain(ctx, t, 0.07);
}

export function init(assets) {
  A = assets;
  for (const k of ['type', 'a', 'b']) layers[k] = makeCanvas();
  // Versiones en blanco y negro precalculadas.
  layers.gray = {};
  for (const k of Object.keys(A)) {
    const c = makeCanvas(A[k].width, A[k].height);
    const g = c.getContext('2d');
    g.filter = 'grayscale(1) contrast(1.1)';
    g.drawImage(A[k], 0, 0);
    layers.gray[k] = c;
  }
  const g = layers.type.getContext('2d');
  const size = 560;
  g.font = FONT.display(900, size);
  const m = g.measureText('S1 E2');
  const base = 740;
  layers.typeSize = size;
  layers.typeBase = base;
  layers.typeBox = { x: W / 2 - m.width / 2 - 80, y: base - size * 0.95, w: m.width + 160, h: size * 1.1 };
  // Punto dentro del trazo vertical del «1» para el zoom a través de la letra.
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.fillText('S1 E2', W / 2, base);
  const row = Math.round(base - size * 0.4);
  const data = g.getImageData(0, row, W, 1).data;
  const runs = [];
  let x0 = -1;
  for (let x = 0; x < W; x++) {
    const on = data[x * 4 + 3] > 200;
    if (on && x0 < 0) x0 = x;
    if (!on && x0 >= 0) { runs.push([x0, x]); x0 = -1; }
  }
  const r1 = runs[Math.min(1, runs.length - 1)] ?? [W / 2, W / 2];
  layers.typeHole = { x: (r1[0] + r1[1]) / 2, y: row };
  g.clearRect(0, 0, W, H);
}
