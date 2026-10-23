// Escenas del spot. Todo depende solo de `t`: seek(t) dibuja siempre el mismo fotograma.
import { W, H, HITS } from './timeline.js';
import {
  clamp, lerp, prog, ease, noise1, punch, COLOR, FONT, GRID, makeCanvas, drawCover,
  revealText, fitSize, label, stripesH, stripeWipe, smear, grain, vignette, STRIPES,
} from './lib.js';

let A; // recursos cargados
let ctx;
const layers = {};

const M = GRID.m;

// ---------------------------------------------------------------------------
// Geometría: planta esquemática del 037 (unidades: 1000 = largo del coche).

function catmull(points, closed = true, steps = 10) {
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

function mirrorHalf(half) {
  // half va de la punta delantera (x=0) a la trasera (x=0) por el lado derecho.
  const left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...left];
}

function poly(pts) {
  let len = 0;
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    acc.push(len);
  }
  return { pts, len, acc };
}

const BODY = poly(catmull(mirrorHalf([
  [0, -500], [95, -496], [162, -480], [206, -452], [227, -404], [235, -340], [236, -262], [228, -196],
  [212, -146], [206, -60], [211, 36], [229, 98], [243, 170], [246, 300], [240, 392], [225, 452],
  [194, 486], [118, 498], [0, 500],
])));
const CABIN = poly(catmull(mirrorHalf([
  [0, -232], [118, -222], [158, -186], [168, -70], [166, 56], [152, 118], [0, 132],
])));
const WHEELS = [
  { x: -224, y: -318, front: true }, { x: 224, y: -318, front: true },
  { x: -234, y: 330, front: false }, { x: 234, y: 330, front: false },
];

function tracePoly(c, P, p) {
  if (p <= 0) return;
  const target = P.len * clamp(p);
  c.beginPath();
  c.moveTo(P.pts[0][0], P.pts[0][1]);
  for (let i = 1; i < P.pts.length; i++) {
    if (P.acc[i] >= target) {
      const k = (target - P.acc[i - 1]) / (P.acc[i] - P.acc[i - 1] || 1);
      c.lineTo(lerp(P.pts[i - 1][0], P.pts[i][0], k), lerp(P.pts[i - 1][1], P.pts[i][1], k));
      break;
    }
    c.lineTo(P.pts[i][0], P.pts[i][1]);
  }
  c.stroke();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

// mode: 'awd' (tracción total) o 'rwd' (tracción trasera).
function drawPlan(t, { cx, cy, scale, rot, draw, mode, power }) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.rotate(rot);
  c.scale(scale, scale);
  const px = 1 / scale;
  c.lineJoin = 'round';
  c.lineCap = 'round';

  // Contorno y habitáculo.
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3.2 * px;
  tracePoly(c, BODY, draw);
  c.globalAlpha = 0.45;
  c.lineWidth = 2.2 * px;
  tracePoly(c, CABIN, prog(draw, 0.25, 1));
  // Alerón trasero y rejillas del capó motor.
  const d2 = prog(draw, 0.55, 1);
  if (d2 > 0) {
    c.globalAlpha = 0.45 * d2;
    roundRect(c, -236, 462, 472, 26, 6);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const y = 170 + i * 34;
      c.beginPath();
      c.moveTo(-96, y);
      c.lineTo(96, y);
      c.stroke();
    }
  }
  c.globalAlpha = 1;

  // Motor central longitudinal: bloque y cuatro cilindros en línea.
  const eng = prog(draw, 0.45, 1);
  if (eng > 0) {
    const hot = mode === 'rwd' ? power : 0;
    c.globalAlpha = eng;
    c.fillStyle = mode === 'rwd' ? `rgba(224,38,29,${0.85 * hot})` : 'rgba(0,0,0,0)';
    roundRect(c, -64, 140, 128, 178, 10);
    c.fill();
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.4 * px;
    c.stroke();
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(0, 168 + i * 41, 15, 0, Math.PI * 2);
      c.stroke();
    }
    // Caja de cambios en el eje trasero.
    roundRect(c, -40, 318, 80, 70, 8);
    c.stroke();
    if (mode === 'awd') {
      roundRect(c, -30, -345, 60, 54, 8);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Árboles de transmisión con flujo de par animado.
  const shafts = [];
  if (mode === 'awd') {
    shafts.push([[0, 300], [0, -291]], [[-30, -318], [-200, -318]], [[30, -318], [200, -318]]);
  }
  shafts.push([[-40, 330], [-208, 330]], [[40, 330], [208, 330]]);
  const flowColor = mode === 'awd' ? COLOR.blue : COLOR.red;
  if (power > 0) {
    c.save();
    c.globalAlpha = power;
    c.strokeStyle = flowColor;
    c.lineWidth = 7 * px;
    c.setLineDash([22 * px * scale, 18 * px * scale]);
    c.lineDashOffset = -t * 260;
    for (const [a, b] of shafts) {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
    c.restore();
  }

  // Ruedas (vista en rayos X, por encima de la carrocería).
  WHEELS.forEach((w, i) => {
    const appear = prog(draw, 0.6 + i * 0.05, 0.9 + i * 0.025);
    if (appear <= 0) return;
    const driven = mode === 'awd' || !w.front;
    const order = mode === 'awd' ? i : i - 2;
    const on = driven ? ease.outExpo(clamp(power * 4 - order * 0.6)) : 0;
    c.globalAlpha = appear * (driven ? 1 : 0.5);
    const ww = 58, wh = 150;
    roundRect(c, w.x - ww / 2, w.y - wh / 2, ww, wh, 14);
    c.fillStyle = COLOR.ink;
    c.fill();
    if (on > 0) {
      c.globalAlpha = appear * on;
      c.fillStyle = flowColor;
      c.fill();
      c.globalAlpha = appear * (driven ? 1 : 0.5);
    }
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 3 * px;
    c.stroke();
    // Banda de rodadura.
    c.globalAlpha *= 0.4;
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(w.x - ww / 2 + 10, w.y + k * 26);
      c.lineTo(w.x + ww / 2 - 10, w.y + k * 26);
      c.stroke();
    }
    c.globalAlpha = 1;
  });
  c.restore();
}

// ---------------------------------------------------------------------------
// Compresor volumétrico: dos rotores trilobulados que engranan.

const R0 = 148, LOBE = 52, D = 2 * R0 + 8;
function rotorPath(c, theta) {
  c.beginPath();
  const n = 180;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = R0 + LOBE * Math.cos(3 * (a - theta)) - 4;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

const BLOWER_T0 = 22.4;
function blowerAngle(t) {
  const tau = Math.max(0, t - BLOWER_T0);
  return Math.PI * 2 * (0.35 * tau + 0.62 * tau * tau);
}

function drawBlower(t, cx, cy, s, appear) {
  const c = ctx;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  const px = 1 / s;
  const Rh = R0 + LOBE + 14;
  const half = D / 2;
  const iy = Math.sqrt(Rh * Rh - half * half);
  const a = Math.atan2(iy, half);
  // Carcasa en forma de ocho.
  c.globalAlpha = appear;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3 * px;
  c.beginPath();
  c.arc(-half, 0, Rh, -a, a, true);
  c.arc(half, 0, Rh, Math.PI - a, -(Math.PI - a), true);
  c.closePath();
  c.stroke();
  c.globalAlpha = appear * 0.35;
  c.lineWidth = 2 * px;
  c.beginPath();
  c.arc(-half, 0, Rh + 26, -a * 0.82, a * 0.82, true);
  c.stroke();
  c.beginPath();
  c.arc(half, 0, Rh + 26, Math.PI - a * 0.82, -(Math.PI - a * 0.82), true);
  c.stroke();

  // Flujo de aire: entra por arriba, sale comprimido por abajo.
  c.globalAlpha = appear * 0.9;
  c.strokeStyle = COLOR.paper;
  c.lineWidth = 3 * px;
  c.setLineDash([16, 22]);
  c.lineDashOffset = -t * 320;
  for (const x of [-34, 0, 34]) {
    c.beginPath();
    c.moveTo(x, -Rh - 190);
    c.lineTo(x, -iy - 18);
    c.stroke();
    c.beginPath();
    c.moveTo(x, iy + 18);
    c.lineTo(x, Rh + 190);
    c.stroke();
  }
  c.setLineDash([]);

  // Rotores con desenfoque de giro: copias promediadas dentro del obturador.
  const th = blowerAngle(t);
  const dth = blowerAngle(t) - blowerAngle(t - 1 / 60);
  const N = 8;
  for (const [ox, sign, col] of [[-half, 1, COLOR.blue], [half, -1, COLOR.red]]) {
    c.save();
    c.translate(ox, 0);
    for (let k = 0; k < N; k++) {
      c.globalAlpha = appear * (1 / (k + 1));
      rotorPath(c, sign * (th - dth * (k / (N - 1))));
      c.fillStyle = col;
      c.fill();
    }
    c.globalAlpha = appear;
    c.fillStyle = COLOR.ink;
    c.beginPath();
    c.arc(0, 0, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = COLOR.paper;
    c.lineWidth = 2.5 * px;
    c.stroke();
    c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------------------
// Escenas. Cada una recibe el tiempo global; los textos son los del guion del cliente.

const DIM = 'rgba(242,239,232,0.72)';

function bg(color = COLOR.ink) {
  ctx.fillStyle = color;
  ctx.fillRect(-200, -200, W + 400, H + 400);
}

function photoBand(img, y, h, open, opts, vig = 0.35) {
  if (open <= 0) return;
  const hh = h * open;
  const yy = y + (h - hh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, yy, W, hh);
  ctx.clip();
  drawCover(ctx, img, 0, y, W, h, opts);
  vignette(ctx, 0, y, W, h, vig);
  ctx.restore();
}

// Titular de varias líneas, alineado a la rejilla izquierda, con un único cuerpo.
function lines(t, list, y0, lead, maxPx, t0, { color = COLOR.paper, weight = 800, exit = null, step = 0.14, colors = null } = {}) {
  const size = Math.min(...list.map((l) => fitSize(ctx, l, (px) => FONT.display(weight, px), GRID.w, maxPx)));
  list.forEach((l, i) => {
    revealText(ctx, l, M, y0 + i * lead, FONT.display(weight, size), colors?.[i] ?? color, prog(t, t0 + i * step, t0 + i * step + 0.7), {
      stagger: 0.022, exit: exit ? prog(t, exit[0] + i * 0.05, exit[1] + i * 0.05) : 0,
    });
  });
  return size;
}

function zoomAbout(z, x = W / 2, y = H / 2) {
  ctx.translate(x, y);
  ctx.scale(z, z);
  ctx.translate(-x, -y);
}

// 0 – 4,5 · …el último coche en ganar un Mundial de Rally con solo dos ruedas motrices
function pHook(t) {
  bg();
  drawPlan(t, {
    cx: W / 2, cy: 690, scale: 0.76 + 0.03 * ease.inOut(prog(t, 0, 4.5)), rot: lerp(-0.07, -0.02, ease.out(prog(t, 0, 4.5))),
    draw: ease.out(prog(t, -0.5, 1.0)), mode: 'rwd', power: prog(t, 2.55, 3.3),
  });
  label(ctx, 'EL ÚLTIMO EN GANAR UN MUNDIAL', M, 1250, COLOR.blue, prog(t, -0.25, 0.4), { size: 32, spacing: 6 });
  lines(t, ['Solo dos ruedas', 'motrices'], 1420, 150, 170, 2.5);
}

// 4,5 – 7,5 · humilló al todopoderoso Audi Quattro 4x4
function pQuattro(t) {
  bg();
  const z = lerp(1.08, 1.0, ease.out(prog(t, 4.5, 7.75)));
  ctx.save();
  zoomAbout(z, W / 2, 760);
  ctx.font = FONT.display(900, 520);
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(242,239,232,0.75)';
  // El contorno se descubre con una máscara diagonal.
  const p = ease.outExpo(prog(t, 4.5, 5.4));
  ctx.save();
  ctx.beginPath();
  ctx.rect(-100, 300, (W + 200) * p, 700);
  ctx.clip();
  ctx.strokeText('4×4', W / 2, 960);
  ctx.restore();
  ctx.restore();
  // Las bandas Martini tachan el 4×4.
  ctx.save();
  ctx.translate(W / 2, 760);
  ctx.rotate(-0.42);
  ctx.translate(-W / 2, -760);
  stripesH(ctx, 690, 46, prog(t, 6.45, 7.05), 0, { x0: -200, x1: W + 200, stagger: 0.06 });
  ctx.restore();
  lines(t, ['Humilló al', 'todopoderoso'], 1330, 146, 160, 4.6);
  label(ctx, 'AUDI QUATTRO 4×4', M, 1560, DIM, prog(t, 5.95, 6.4), { size: 36, spacing: 6 });
}

// 7,5 – 9,5 · Es el Lancia 037.
function pReveal(t) {
  bg();
  const open = ease.outExpo(prog(t, 7.45, 8.15));
  photoBand(A.salon, 300, 960, open, {
    zoom: lerp(1.3, 1.08, ease.out(prog(t, 7.45, 9.6))), fx: 0.62, fy: 0.5, dx: lerp(40, -20, prog(t, 7.5, 9.6)),
  });
  stripesH(ctx, 1300, 13, prog(t, 7.8, 8.6), 0, { x0: M, x1: M + 420 });
  lines(t, ['Lancia 037'], 1520, 0, 200, 7.7);
}

// 9,5 – 11,5 · Era el año 1983,
function p1983(t) {
  bg();
  ctx.save();
  zoomAbout(1 + 0.04 * ease.inOut(prog(t, 9.5, 11.5)));
  const size = fitSize(ctx, '1983', (px) => FONT.display(900, px), GRID.w, 440);
  label(ctx, 'ERA EL AÑO', W / 2, 640, COLOR.blue, prog(t, 9.5, 9.9), { size: 34, spacing: 9, align: 'center' });
  revealText(ctx, '1983', W / 2, 1010, FONT.display(900, size), COLOR.paper, prog(t, 9.52, 10.25), {
    stagger: 0.09, align: 'center', exit: prog(t, 11.1, 11.5),
  });
  const u = lerp(5, 30, ease.outExpo(prog(t, 9.6, 10.2)));
  stripesH(ctx, 1080, u, prog(t, 9.5, 10.3), prog(t, 11.05, 11.5));
  ctx.restore();
}

// 11,5 – 14,5 · y mientras el mundo entero se pasaba a la tracción total,
function pTotal(t) {
  bg();
  const lt = prog(t, 11.5, 14.6);
  drawPlan(t, {
    cx: W / 2, cy: 680, scale: 0.74 + 0.03 * ease.inOut(lt), rot: lerp(0.08, 0.03, ease.out(lt)),
    draw: ease.inOut(prog(t, 11.5, 12.4)), mode: 'awd', power: prog(t, 12.6, 13.6),
  });
  lines(t, ['El mundo entero', 'se pasaba a la', 'tracción total'], 1270, 128, 140, 11.6, {
    colors: [COLOR.paper, COLOR.paper, COLOR.blue],
  });
}

// 14,5 – 17,5 · los italianos decidieron ir a contracorriente con este monstruo.
function pContra(t) {
  bg();
  const lt = prog(t, 14.3, 17.7);
  photoBand(A.pista, 300, 660, 1, { zoom: lerp(1.2, 1.1, ease.out(lt)), fx: 0.55, fy: 0.6, dx: lerp(-80, 80, lt) });
  // Las bandas fluyen en sentido contrario al paneo de la foto.
  const off = lerp(260, -260, lt);
  stripesH(ctx, 1010, 22, prog(t, 14.55, 15.3), 0, { x0: -300 + off, x1: W + 300 + off });
  label(ctx, 'LOS ITALIANOS DECIDIERON IR', M, 1250, COLOR.blue, prog(t, 14.6, 15.1), { size: 32, spacing: 6 });
  lines(t, ['a contracorriente'], 1420, 0, 150, 15.0);
  label(ctx, 'con este monstruo', M, 1530, DIM, prog(t, 16.6, 17.1), { size: 46, spacing: 0, weight: 500 });
}

// 17,5 – 19 · Su fórmula era extrema:
function pFormula(t) {
  bg();
  ctx.save();
  zoomAbout(lerp(1.0, 1.05, prog(t, 17.5, 19)));
  lines(t, ['Su fórmula', 'era extrema'], 900, 200, 210, 17.65, { colors: [COLOR.paper, COLOR.red], weight: 900 });
  ctx.restore();
}

// 19 – 21 · menos de mil kilos de peso…
function pKilos(t) {
  bg();
  lines(t, ['Menos de', 'mil kilos'], 820, 190, 200, 19.05, { weight: 900 });
  // Báscula genérica: la barra se queda justo antes de los 1000 kg.
  const x0 = M, x1 = W - M, y = 1250;
  const k = (kg) => lerp(x0, x1, kg / 1200);
  const show = ease.out(prog(t, 19.1, 19.5));
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = 'rgba(242,239,232,0.22)';
  ctx.fillRect(x0, y, x1 - x0, 2);
  for (let kg = 0; kg <= 1200; kg += 100) {
    const big = kg % 500 === 0;
    ctx.fillRect(k(kg) - 1, y - (big ? 26 : 14), 2, big ? 26 : 14);
  }
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(k(1000) - 2, y - 44, 4, 60);
  ctx.restore();
  const fill = ease.outExpo(prog(t, 19.3, 20.3)) * 985;
  ctx.fillStyle = COLOR.red;
  ctx.fillRect(x0, y + 18, k(fill) - x0, 16);
  label(ctx, '0', x0, y + 84, DIM, prog(t, 19.2, 19.6), { size: 30, spacing: 1, weight: 500 });
  label(ctx, '1000 kg', k(1000), y + 84, COLOR.paper, prog(t, 19.3, 19.7), { size: 30, spacing: 1, weight: 600, align: 'center' });
}

// 21 – 22,5 · …y un motor central sobrealimentado
function pMotor(t) {
  bg();
  const lt = prog(t, 21, 22.7);
  photoBand(A.motor, 250, 860, 1, {
    zoom: lerp(1.25, 1.06, ease.outExpo(lt)), fx: 0.5, fy: 0.45, src: { x: 0, y: 0, w: A.motor.width, h: A.motor.height * 0.865 },
  });
  lines(t, ['Motor central', 'sobrealimentado'], 1330, 132, 136, 21.05);
}

// 22,5 – 25,5 · que escupía más de 300 caballos de pura rabia
// Contador que sube de 0 a 300 con cifras de ancho fijo (sin baile de anchura).
function counter(t, x, y, size) {
  const v = Math.round(300 * ease.outExpo(prog(t, 22.75, 24.1)));
  const str = String(v).padStart(3, '0');
  ctx.save();
  ctx.font = FONT.display(900, size);
  const slot = ctx.measureText('0').width * 0.98;
  ctx.textAlign = 'center';
  [...str].forEach((d, i) => {
    // Los ceros a la izquierda quedan apagados hasta que la cifra se ocupa.
    const lead = v < 10 ** (2 - i) && i < 2;
    ctx.fillStyle = lead ? 'rgba(242,239,232,0.18)' : COLOR.paper;
    ctx.fillText(d, x + slot * (i + 0.5), y);
  });
  ctx.restore();
}

function pCaballos(t) {
  bg();
  const appear = ease.outExpo(prog(t, 22.45, 22.9));
  drawBlower(t, W / 2, 610, lerp(1.0, 0.9, ease.out(prog(t, 22.5, 25.5))), appear);
  label(ctx, 'MÁS DE', M, 1130, COLOR.blue, prog(t, 22.6, 23.0), { size: 34, spacing: 9 });
  const show = ease.outExpo(prog(t, 22.7, 23.1));
  if (show > 0) {
    ctx.save();
    ctx.globalAlpha = show;
    counter(t, M, 1440, 330);
    ctx.restore();
  }
  lines(t, ['caballos de pura rabia'], 1580, 0, 96, 24.0, { weight: 800 });
}

// 25,5 – 27 · directos al eje trasero.
function pEje(t) {
  bg();
  drawPlan(t, {
    cx: W / 2, cy: 700, scale: lerp(0.9, 0.84, ease.out(prog(t, 25.5, 27.2))), rot: 0,
    draw: ease.outExpo(prog(t, 25.45, 25.95)), mode: 'rwd', power: prog(t, 25.6, 26.1),
  });
  lines(t, ['Directos al', 'eje trasero'], 1380, 150, 160, 25.55);
}

// 27 – 29,5 · Era tan salvaje que el propio Walter Röhrl dijo
function pRohrl(t) {
  bg();
  const lt = prog(t, 26.8, 29.7);
  drawCover(ctx, layers.standBlur, 0, 0, W, H, { zoom: lerp(1.15, 1.05, lt) });
  photoBand(A.stand, 260, 740, ease.outExpo(prog(t, 26.9, 27.5)), { zoom: lerp(1.18, 1.06, ease.out(lt)), fx: 0.5, fy: 0.42 }, 0.45);
  label(ctx, 'ERA TAN SALVAJE QUE EL PROPIO', M, 1250, COLOR.blue, prog(t, 27.05, 27.5), { size: 32, spacing: 6 });
  lines(t, ['Walter Röhrl'], 1420, 0, 170, 28.2, { weight: 900 });
  label(ctx, 'dijo', M, 1520, DIM, prog(t, 28.9, 29.3), { size: 46, spacing: 0, weight: 500 });
}

// 29,5 – 33 · que si intentabas forzarlo contra su naturaleza, te comía vivo.
function pNaturaleza(t) {
  bg();
  const lt = prog(t, 29.3, 33.2);
  const slam = ease.outExpo(prog(t, 32.0, 32.3));
  photoBand(A.salon, 260, 760, 1, {
    zoom: lerp(1.0, 1.12, ease.inOut(lt)) + 0.06 * slam, src: { x: 820, y: 470, w: 966, h: 620 }, fx: 0.5, fy: 0.5,
  }, 0.5);
  ctx.save();
  ctx.globalAlpha = 1 - 0.6 * slam;
  lines(t, ['Si intentabas forzarlo', 'contra su naturaleza,'], 1180, 104, 104, 29.55);
  ctx.restore();
  // «te comía vivo.» entra de golpe, en rojo, con el impacto.
  if (t >= 32.0) {
    const size = fitSize(ctx, 'te comía vivo.', (px) => FONT.display(900, px), GRID.w, 190);
    ctx.save();
    const s = lerp(1.25, 1, slam);
    ctx.translate(M, 1480);
    ctx.scale(s, s);
    ctx.font = FONT.display(900, size);
    ctx.fillStyle = COLOR.red;
    ctx.globalAlpha = clamp(slam * 5);
    ctx.fillText('te comía vivo.', 0, 0);
    ctx.restore();
  }
}

// 33 – 35,5 · Tenías que dejarlo rotar, dejarlo vivir.
function driftPose(t) {
  const u = ease.inOut(prog(t, 32.6, 35.9));
  const C = [540, 900], R = 250;
  const phi = lerp(-2.55, -0.7, u);
  const x = C[0] + R * Math.cos(phi), y = C[1] + R * Math.sin(phi);
  const psi = Math.atan2(Math.cos(phi), -Math.sin(phi));
  const beta = 0.62 * ease.inOut(prog(t, 33.0, 34.0)) + 0.08 * Math.sin((t - 33) * 3.1);
  return { x, y, rot: psi + beta + Math.PI / 2 };
}

function pRotar(t) {
  bg();
  const s = 0.62;
  // Huellas de las ruedas traseras: la trayectoria reciente del coche.
  for (const lx of [-234, 234]) {
    ctx.beginPath();
    for (let k = 0; k <= 50; k++) {
      const tk = Math.max(32.9, t - 1.3 + (k / 50) * 1.3);
      const P = driftPose(tk);
      const wx = P.x + s * (lx * Math.cos(P.rot) - 330 * Math.sin(P.rot));
      const wy = P.y + s * (lx * Math.sin(P.rot) + 330 * Math.cos(P.rot));
      if (k === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.strokeStyle = 'rgba(242,239,232,0.2)';
    ctx.lineWidth = 26 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  const P = driftPose(t);
  drawPlan(t, { cx: P.x, cy: P.y, scale: s, rot: P.rot, draw: 1, mode: 'rwd', power: 1 });
  lines(t, ['Dejarlo rotar,'], 1400, 0, 150, 33.12);
  lines(t, ['dejarlo vivir.'], 1550, 0, 150, 34.52);
}

// 35,5 – 38 · Lancia logró lo imposible, ganó el campeonato
function pImposible(t) {
  bg(COLOR.paper);
  ctx.save();
  ctx.translate(W / 2, 1180);
  ctx.rotate(-0.2);
  ctx.translate(-W / 2, -1180);
  const drift = lerp(0, -80, ease.inOut(prog(t, 35.5, 38.2)));
  stripesH(ctx, 1060, 104, prog(t, 35.55, 36.3), 0, { x0: -420 + drift, x1: W + 420 + drift, stagger: 0.07 });
  ctx.restore();
  lines(t, ['Lancia logró', 'lo imposible'], 640, 210, 230, 35.7, { color: COLOR.ink, weight: 900 });
  label(ctx, 'GANÓ EL CAMPEONATO · 1983', M, 1560, COLOR.navy, prog(t, 37.15, 37.6), { size: 38, spacing: 8, weight: 700 });
}

// 38 – 39 · y el 037… (la foto dentro de las cifras y zoom a través del «0»)
function pType(t) {
  bg();
  const L = layers.type;
  const g = L.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  revealText(g, '037', W / 2, layers.typeBase, FONT.display(900, layers.typeSize), '#fff', prog(t, 38.0, 38.4), {
    stagger: 0.12, align: 'center',
  });
  g.globalCompositeOperation = 'source-in';
  const bb = layers.typeBox;
  drawCover(g, A.salon, bb.x, bb.y, bb.w, bb.h, { zoom: lerp(1.25, 1.1, ease.out(prog(t, 38, 39))), fx: 0.62, fy: 0.5 });
  g.globalCompositeOperation = 'source-over';

  const zp = ease.inExpo(prog(t, 38.55, 39.0));
  const z = Math.exp(lerp(0, Math.log(26), zp));
  const P = layers.typeHole;
  // Desenfoque radial: varias escalas promediadas mientras acelera el zoom.
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

// 39 – 41,5 · …se convirtió en el último rey de la tracción trasera.
function pRey(t) {
  bg();
  const lt = prog(t, 38.9, 41.7);
  photoBand(A.salon, 230, 1000, 1, {
    zoom: lerp(1.3, 1.12, ease.outExpo(lt)), fx: 0.25, fy: 0.5, src: { x: 0, y: 100, w: 1000, h: 1000 }, dx: lerp(-20, 20, lt),
  });
  lines(t, ['El último rey', 'de la tracción', 'trasera.'], 1370, 122, 140, 39.1, { colors: [COLOR.paper, COLOR.paper, COLOR.red] });
}

// 41,5 – 45 · ¿Conocías esta leyenda de los rallys? ¡Suscríbete para más!
function pEnd(t) {
  bg();
  const up = ease.inOut(prog(t, 43.35, 43.9)) * -90;
  ctx.save();
  ctx.translate(0, up);
  const spread = lerp(10, 20, ease.out(prog(t, 41.6, 45)));
  revealText(ctx, 'LANCIA', M, 760, FONT.display(800, 104), COLOR.paper, prog(t, 41.6, 42.3), { stagger: 0.05, spacing: spread });
  const size = fitSize(ctx, 'RALLY 037', (px) => FONT.display(900, px), GRID.w, 250);
  revealText(ctx, 'RALLY 037', M, 970, FONT.display(900, size), COLOR.paper, prog(t, 41.7, 42.45), { stagger: 0.035 });
  stripesH(ctx, 1022, 44, prog(t, 41.5, 42.05), 0);
  label(ctx, 'LA LEYENDA DE LOS RALLYS', M, 1250, COLOR.blue, prog(t, 42.4, 42.9), { size: 34, spacing: 8, weight: 600 });
  ctx.restore();

  // Botón genérico de suscripción con los colores del cliente.
  const a = ease.outExpo(prog(t, 43.55, 44.0));
  if (a > 0) {
    const press = Math.sin(Math.PI * prog(t, 44.15, 44.45));
    const s = lerp(0.92, 1, a) * (1 - 0.05 * press);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = FONT.text(700, 54);
    ctx.letterSpacing = '1px';
    const tw = ctx.measureText('Suscríbete').width;
    const bw = tw + 140, bh = 128, bx = M, by = 1360;
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(s, s);
    ctx.fillStyle = press > 0.01 ? COLOR.navy : COLOR.red;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = COLOR.paper;
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

function whip(t, t0, dur, drawA, drawB, dir = 1) {
  const p = prog(t, t0 - dur / 2, t0 + dur / 2);
  const e = ease.inOutExpo(p);
  const a = toLayer('a', drawA);
  const b = toLayer('b', drawB);
  const v = Math.sin(Math.PI * p) * 300 * dir;
  ctx.save();
  ctx.translate(-W * e * dir, 0);
  smear(ctx, a, v, 0, 24);
  ctx.translate(W * dir, 0);
  smear(ctx, b, v, 0, 24);
  ctx.restore();
}

function slices(t, t0, drawA, drawB) {
  drawB();
  const a = toLayer('a', drawA);
  const n = 8, h = H / n;
  for (let i = 0; i < n; i++) {
    const p = ease.inExpo(prog(t, t0 + i * 0.028, t0 + i * 0.028 + 0.34));
    if (p >= 1) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, i * h, W, h + 1);
    ctx.clip();
    ctx.drawImage(a, -W * 1.05 * p, 0);
    ctx.restore();
  }
}

const wipe = (t, t0, A_, B_, opts) => stripeWipe(ctx, prog(t, t0 - 0.25, t0 + 0.25), () => A_(t), () => B_(t), opts);

function compose(t) {
  if (t < 4.5) return pHook(t);
  if (t < 7.25) return pQuattro(t);
  if (t < 7.75) return wipe(t, 7.5, pQuattro, pReveal);
  if (t < 9.5) return pReveal(t);
  if (t < 11.5) return p1983(t);
  if (t < 14.38) return pTotal(t);
  if (t < 14.62) return whip(t, 14.5, 0.24, () => pTotal(t), () => pContra(t));
  if (t < 17.5) return pContra(t);
  if (t < 19) return pFormula(t);
  if (t < 21) return pKilos(t);
  if (t < 22.38) return pMotor(t);
  if (t < 22.62) return whip(t, 22.5, 0.24, () => pMotor(t), () => pCaballos(t), -1);
  if (t < 25.5) return pCaballos(t);
  if (t < 26.75) return pEje(t);
  if (t < 27.25) return wipe(t, 27.0, pEje, pRohrl, { angle: 0.3 });
  if (t < 29.35) return pRohrl(t);
  if (t < 29.75) return slices(t, 29.35, () => pRohrl(t), () => pNaturaleza(t));
  if (t < 33) return pNaturaleza(t);
  if (t < 35.25) return pRotar(t);
  if (t < 35.75) return wipe(t, 35.5, pRotar, pImposible, { u: 260 });
  if (t < 37.85) return pImposible(t);
  if (t < 38.25) return slices(t, 37.85, () => pImposible(t), () => pType(t));
  if (t < 39) return pType(t);
  if (t < 41.5) return pRey(t);
  return pEnd(t);
}

const SHAKES = [7.5, 19.0, 32.0, 35.5, 41.5];

export function seek(main, t) {
  ctx = main.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(0, 0, W, H);

  // Cámara: golpe de zoom en los impactos y temblor breve que decae.
  const z = 1 + punch(t, HITS, 0.04, 6.5);
  let sx = 0, sy = 0;
  for (const h of SHAKES) {
    if (t >= h && t < h + 0.6) {
      const k = Math.exp(-(t - h) * 9) * 14;
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
  grain(ctx, t, 0.075);
}

export function init(assets) {
  A = assets;
  for (const k of ['type', 'a', 'b']) layers[k] = makeCanvas();
  const g = layers.type.getContext('2d');
  const size = 600;
  g.font = FONT.display(900, size);
  const m = g.measureText('037');
  const base = 1130;
  layers.typeSize = size;
  layers.typeBase = base;
  layers.typeBox = { x: W / 2 - m.width / 2 - 60, y: base - size * 0.95, w: m.width + 120, h: size * 1.1 };
  // Punto dentro del trazo izquierdo del «0» para el zoom a través de la cifra.
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.fillText('037', W / 2, base);
  const row = Math.round(base - size * 0.36);
  const data = g.getImageData(0, row, W, 1).data;
  let x0 = -1, x1 = -1;
  for (let x = 0; x < W; x++) {
    const on = data[x * 4 + 3] > 200;
    if (on && x0 < 0) x0 = x;
    if (!on && x0 >= 0) { x1 = x; break; }
  }
  layers.typeHole = { x: (x0 + x1) / 2, y: row };
  g.clearRect(0, 0, W, H);

  // Fondo desenfocado precalculado (el desenfoque en vivo sería caro).
  const sb = makeCanvas(540, 960);
  const sg = sb.getContext('2d');
  sg.filter = 'blur(22px) brightness(0.34) saturate(0.9)';
  drawCover(sg, A.stand, -60, -60, 660, 1080);
  layers.standBlur = sb;
}
