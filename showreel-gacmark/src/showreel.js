'use strict';
/* ============================================================================
   GACMARK — Showreel 50 s
   Todo el vídeo es una función pura del tiempo: seek(t) dibuja el cuadro t.
   Nada depende del cuadro anterior: las partículas usan física en forma
   cerrada (balística con arrastre, rebotes analíticos, muelles amortiguados)
   y todo lo aleatorio sale de mulberry32 con semilla fija.
   Rejilla musical: 96 BPM -> negra 0.625 s, compás 2.5 s (ver audio/music.py)
   ========================================================================== */

// ------------------------------------------------------------------ config
const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || 1920, H = +Q.get('h') || 1080;
const FPS = +Q.get('fps') || 60;
const RENDER = Q.has('render');
const MB = RENDER ? (+Q.get('mb') || 5) : 1;      // sub-cuadros de desenfoque de movimiento
const DUR = 50;
const U = Math.min(W, H) / 1080;
const LAND = W >= H;
const DIAG = Math.hypot(W, H);
const BEAT = 0.625, BAR = 2.5;
const C = {
  ink: '#F2EEE7', paper: '#EEEAE2', acc: '#FF4A26', accD: '#B8260F',
  dark: '#0B0B0E', mute: 'rgba(242,238,231,0.6)', blue: '#2B45D8',
};
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: x => x,
  inQ: x => x * x, outQ: x => 1 - (1 - x) * (1 - x),
  inC: x => x * x * x, outC: x => 1 - Math.pow(1 - x, 3),
  inOutC: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  inQuart: x => x * x * x * x,
  outQuint: x => 1 - Math.pow(1 - x, 5),
  inOutQuint: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
// respuesta al escalón de un muelle amortiguado (forma cerrada)
function spring(t, w = 12, z = 0.45) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
const qz = t => Math.round(t * FPS) / FPS; // tiempo cuantizado al cuadro: los números no se emborronan
const fmtInt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ------------------------------------------------------------------ canvases
const main = document.getElementById('c');
main.width = W; main.height = H;
const mctx = main.getContext('2d');
const POOL = {};
function cvs(name, w, h) {
  let c = POOL[name];
  if (!c) { c = POOL[name] = document.createElement('canvas'); c.width = w; c.height = h; }
  return c;
}
const scratch = cvs('scratch', W, H);
const sctx = scratch.getContext('2d');

// ------------------------------------------------------------------ texto
function setFont(g, size, weight = 800, fam = 'Inter', style = 'normal') {
  g.font = `${style} ${weight} ${size}px ${fam === 'Inter' ? 'Inter' : 'Bodoni'}`;
}
const MCACHE = new Map();
function layoutText(g, text, track) {
  const key = g.font + '|' + text + '|' + track;
  let r = MCACHE.get(key);
  if (!r) {
    if (MCACHE.size > 4000) MCACHE.clear();
    const xs = [];
    for (let i = 0; i < text.length; i++) xs.push(g.measureText(text.slice(0, i)).width + track * i);
    const ws = [...text].map(ch => g.measureText(ch).width);
    r = { xs, ws, total: g.measureText(text).width + track * Math.max(0, text.length - 1) };
    MCACHE.set(key, r);
  }
  return r;
}
function textWidth(g, text, size, weight, fam, style, track = 0) {
  setFont(g, size, weight, fam, style);
  return layoutText(g, text, track * size).total;
}
function fitSize(g, lines, size, maxW, weight = 900, fam = 'Inter', track = 0) {
  let s = size;
  for (const l of lines) s = Math.min(s, size * maxW / textWidth(g, l, size, weight, fam, 'normal', track));
  return s;
}
/* Tipografía cinética: cada carácter entra (y sale) con retardo escalonado.
   modos: 'up' (sube desde una máscara de línea), 'scale', 'fade', 'flip' */
function kin(g, o) {
  const t = o.t, size = o.size, text = o.text;
  const st = o.st ?? 0.03, dur = o.dur ?? 0.6;
  setFont(g, size, o.weight ?? 800, o.fam ?? 'Inter', o.style ?? 'normal');
  const L = layoutText(g, text, (o.track ?? 0) * size);
  const x0 = o.x - (o.align === 'center' ? L.total / 2 : o.align === 'right' ? L.total : 0);
  const mode = o.mode || 'up';
  const ease = o.ease || E.outExpo;
  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (mode === 'up') { g.beginPath(); g.rect(x0 - size, o.y - size * 1.02, L.total + size * 2, size * 1.32); g.clip(); }
  g.fillStyle = o.color || C.ink; g.strokeStyle = o.color || C.ink;
  g.lineWidth = o.lw || Math.max(1.5 * U, size * 0.022);
  g.lineJoin = 'round';
  g.textBaseline = 'alphabetic';
  const n = text.length;
  const order = o.reverse ? (i => n - 1 - i) : (i => i);
  const baseA = g.globalAlpha;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === ' ') continue;
    const k = order(i);
    const pin = ease(seg(t, o.in + k * st, o.in + k * st + dur));
    const pout = o.out != null ? E.inExpo(seg(t, o.out + k * st * 0.6, o.out + k * st * 0.6 + dur * 0.55)) : 0;
    if (pin <= 0 || pout >= 1) continue;
    g.save();
    const cx = x0 + L.xs[i], w = L.ws[i];
    if (mode === 'up') {
      g.translate(cx, o.y + (1 - pin) * size * 1.15 - pout * size * 1.15);
    } else if (mode === 'scale') {
      const s = lerp(o.from ?? 2.2, 1, pin) * lerp(1, 0.6, pout);
      g.translate(cx + w / 2, o.y - size * 0.35); g.scale(s, s); g.translate(-w / 2, size * 0.35);
      g.globalAlpha = baseA * Math.min(1, pin * 1.5) * (1 - pout);
    } else if (mode === 'flip') {
      g.translate(cx + w / 2, o.y - size * 0.35); g.scale(1, Math.max(0.001, pin * (1 - pout))); g.translate(-w / 2, size * 0.35);
      g.globalAlpha = baseA * pin * (1 - pout);
    } else {
      g.translate(cx, o.y + (1 - pin) * size * 0.35 - pout * size * 0.3);
      g.globalAlpha = baseA * pin * (1 - pout);
    }
    if (o.stroke) g.strokeText(ch, 0, 0); else g.fillText(ch, 0, 0);
    g.restore();
  }
  g.restore();
  return L.total;
}
// Frase con palabras de distinta tipografía, cada palabra con su propio tiempo
function phrase(g, parts, x, y, t, opts = {}) {
  const gap = (opts.gap ?? 0.28);
  let total = 0;
  const ws = parts.map(p => {
    const w = textWidth(g, p.w, p.size, p.weight ?? 300, p.fam ?? 'Inter', p.style ?? 'normal', p.track ?? 0);
    return w;
  });
  parts.forEach((p, i) => { total += ws[i] + (i ? gap * p.size : 0); });
  let cx = opts.align === 'left' ? x : x - total / 2;
  parts.forEach((p, i) => {
    if (i) cx += gap * p.size;
    const { w: _w, t: tin, ...rest } = p;
    kin(g, Object.assign({ text: p.w, x: cx, y, size: p.size, out: opts.out, st: 0.025, dur: 0.7, weight: 300, track: 0 }, rest, { t, in: tin }));
    cx += ws[i];
  });
  return total;
}

// ------------------------------------------------------------------ formas (morphing)
const NM = 200;
function resample(pts, n = NM) {
  const m = pts.length, L = [0];
  for (let i = 1; i <= m; i++) {
    const a = pts[i - 1], b = pts[i % m];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = L[m], out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = k / n * total;
    while (L[j + 1] < d) j++;
    const a = pts[j], b = pts[(j + 1) % m], u = (d - L[j]) / (L[j + 1] - L[j] || 1);
    out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
  }
  return out;
}
function arc(p, cx, cy, r, a0, a1, steps = 14) {
  for (let i = 0; i <= steps; i++) { const a = lerp(a0, a1, i / steps); p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
}
// rectángulo redondeado empezando arriba al centro y en sentido horario
function rrPts(x0, y0, x1, y1, r, tail) {
  const p = [[(x0 + x1) / 2, y0]];
  arc(p, x1 - r, y0 + r, r, -Math.PI / 2, 0);
  arc(p, x1 - r, y1 - r, r, 0, Math.PI / 2);
  if (tail) { p.push([-0.05, y1]); p.push([-0.62, y1 + 0.42]); p.push([-0.42, y1]); }
  arc(p, x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  arc(p, x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  return p;
}
const SH = {
  circle: resample(Array.from({ length: 360 }, (_, i) => { const a = i / 360 * TAU; return [Math.sin(a), -Math.cos(a)]; })),
  arrow: resample([[0, -1], [0.8, -0.12], [0.3, -0.12], [0.3, 0.95], [-0.3, 0.95], [-0.3, -0.12], [-0.8, -0.12]]),
  bubble: resample(rrPts(-1, -0.72, 1, 0.5, 0.32, true)),
  heart: resample(Array.from({ length: 400 }, (_, i) => {
    const a = i / 400 * TAU;
    return [16 * Math.sin(a) ** 3 / 16.5, (-(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))) / 16.5 + 0.08];
  })),
  bag: resample((() => {
    const p = []; arc(p, 0, -0.5, 0.36, -Math.PI / 2, 0, 16);
    p.push([0.78, -0.5], [0.92, 0.95], [-0.92, 0.95], [-0.78, -0.5], [-0.36, -0.5]);
    arc(p, 0, -0.5, 0.36, Math.PI, Math.PI * 1.5, 16); return p;
  })()),
  browser: resample(rrPts(-1, -0.68, 1, 0.68, 0.12)),
  square: resample(rrPts(-0.8, -0.8, 0.8, 0.8, 0.14)),
  triangle: resample([[0, -0.95], [0.95, 0.72], [-0.95, 0.72]]),
  star: resample(Array.from({ length: 10 }, (_, i) => { const a = i / 10 * TAU, r = i % 2 ? 0.45 : 1; return [r * Math.sin(a), -r * Math.cos(a)]; })),
};
function shapePath(g, A, B, p, cx, cy, s, rot = 0) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i < NM; i++) {
    const x = lerp(A[i][0], B[i][0], p) * s, y = lerp(A[i][1], B[i][1], p) * s;
    const X = cx + x * c - y * sn, Y = cy + x * sn + y * c;
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  }
  g.closePath();
}

// ------------------------------------------------------------------ 3D
function rot3(p, rx, ry, rz) {
  let [x, y, z] = p, c, s;
  c = Math.cos(rz); s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}
// cámara virtual que orbita alrededor de un pivote; el plano z=0 se ve 1:1
function Cam(o = {}) { return Object.assign({ x: 0, y: 0, z: 0, rx: 0, ry: 0, f: 1800 * U, cx: W / 2, cy: H / 2 }, o); }
function proj(cam, p) {
  let x = p[0] - cam.x, y = p[1] - cam.y, z = p[2] - cam.z, c, s;
  c = Math.cos(-cam.ry); s = Math.sin(-cam.ry); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(-cam.rx); s = Math.sin(-cam.rx); [y, z] = [y * c - z * s, y * s + z * c];
  const k = cam.f / Math.max(cam.f + z, 1);
  return [cam.cx + x * k, cam.cy + y * k, k, z];
}
// Mapeo de textura afín por triángulo; la malla densa da la perspectiva real
function tri(g, img, P0, P1, P2, u0, v0, u1, v1, u2, v2) {
  const [x0, y0] = P0, [x1, y1] = P1, [x2, y2] = P2;
  const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(d) < 1e-9) return;
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  const ex = (x, y) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * 0.9, y + dy / l * 0.9]; };
  const a = ex(x0, y0), b = ex(x1, y1), c = ex(x2, y2);
  g.save();
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.clip();
  const a11 = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d;
  const a12 = ((u1 - u0) * (x2 - x0) - (u2 - u0) * (x1 - x0)) / d;
  const a21 = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d;
  const a22 = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / d;
  g.transform(a11, a21, a12, a22, x0 - a11 * u0 - a12 * v0, y0 - a21 * u0 - a22 * v0);
  const mu = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 2), mv = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 2);
  const Mu = Math.min(img.width, Math.ceil(Math.max(u0, u1, u2)) + 2), Mv = Math.min(img.height, Math.ceil(Math.max(v0, v1, v2)) + 2);
  g.drawImage(img, mu, mv, Mu - mu, Mv - mv, mu, mv, Mu - mu, Mv - mv);
  g.restore();
}
function cardGrid(cam, P, w, h, nx, ny) {
  const pts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const l = rot3([(i / nx - 0.5) * w, (j / ny - 0.5) * h, 0], P.rx || 0, P.ry || 0, P.rz || 0);
    pts.push(proj(cam, [P.x + l[0], P.y + l[1], P.z + l[2]]));
  }
  return pts;
}
function drawCard(g, cam, img, P, w, h, nx = 6, ny = 10, alpha = 1) {
  const pts = cardGrid(cam, P, w, h, nx, ny);
  const tw = img.width, th = img.height;
  g.save(); g.globalAlpha *= alpha;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = pts[j * (nx + 1) + i], b = pts[j * (nx + 1) + i + 1], c = pts[(j + 1) * (nx + 1) + i], d = pts[(j + 1) * (nx + 1) + i + 1];
    const u0 = i / nx * tw, u1 = (i + 1) / nx * tw, v0 = j / ny * th, v1 = (j + 1) / ny * th;
    tri(g, img, a, b, c, u0, v0, u1, v0, u0, v1);
    tri(g, img, b, d, c, u1, v0, u1, v1, u0, v1);
  }
  g.restore();
  return pts;
}
function cardPoint(cam, P, w, h, u, v) {
  const l = rot3([(u - 0.5) * w, (v - 0.5) * h, 0], P.rx || 0, P.ry || 0, P.rz || 0);
  return proj(cam, [P.x + l[0], P.y + l[1], P.z + l[2]]);
}

// ------------------------------------------------------------------ física en forma cerrada
// Balística con arrastre lineal en x y gravedad + rebotes analíticos en y
function ballistic(t, x0, y0, vx, vy, g, floor, rest = 0.5, k = 0.8) {
  const x = x0 + vx * (1 - Math.exp(-k * t)) / k;
  let tt = t, y = y0, v = vy;
  for (let b = 0; b < 8; b++) {
    // tiempo hasta tocar el suelo: y + v t + g t²/2 = floor
    const disc = v * v + 2 * g * (floor - y);
    const th = (-v + Math.sqrt(Math.max(0, disc))) / g;
    if (tt < th || !(th > 0)) { y = y + v * tt + 0.5 * g * tt * tt; return [x, Math.min(y, floor)]; }
    tt -= th; v = -(v + g * th) * rest; y = floor;
    if (Math.abs(v) < 40 * U) return [x, floor];
  }
  return [x, floor];
}

// ------------------------------------------------------------------ helpers de dibujo
function bgDark(g, gx = W / 2, gy = H / 2, k = 1) {
  g.fillStyle = '#060608'; g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.75);
  gr.addColorStop(0, `rgba(36,33,42,${k})`); gr.addColorStop(1, 'rgba(6,6,8,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function glowDot(g, x, y, r, col = '255,255,255', a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.25, `rgba(${col},${a * 0.35})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
const DUST = (() => { const r = mulberry32(11); return Array.from({ length: 480 }, () => ({ x: r() * 2 - 1, y: r() * 2 - 1, z: r(), s: 0.6 + r() * 1.6, ph: r() * TAU })); })();
function dust(g, t, speed = 0.05, alpha = 1, ox = 0, oy = 0) {
  const f = 1400 * U;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of DUST) {
    const z = ((p.z - t * speed) % 1 + 1) % 1;
    const depth = (150 + z * 2600) * U;
    const k = f / (f + depth);
    const x = p.x * W * 1.2 + Math.sin(t * 0.3 + p.ph) * 30 * U - ox, y = p.y * H * 1.2 + Math.cos(t * 0.23 + p.ph) * 30 * U - oy;
    const sx = W / 2 + x * k, sy = H / 2 + y * k, s = p.s * k * 2.4 * U;
    const a = alpha * Math.min(1, z * 6) * (1 - z) * 0.7;
    if (a <= 0.01 || sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    g.fillStyle = `rgba(242,238,231,${a})`;
    g.fillRect(sx, sy, s, s);
  }
  g.restore();
}
function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.28);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.78, x, y + s * 0.95);
  g.bezierCurveTo(x, y + s * 0.78, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.28);
  g.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y, x, y + s * 0.3);
  g.closePath();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function bar(g, x, y, w, h, col) { g.fillStyle = col; rr(g, x, y, w, h, h / 2); g.fill(); }

// ------------------------------------------------------------------ teléfono (formato 9:16)
const TW = 600, TH = 1068; // 9:16 con marco
function phoneTex(name, painter, tau, sheen = 0) {
  const c = cvs('ph_' + name, TW, TH), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, TW, TH);
  rr(g, 0, 0, TW, TH, 86); g.fillStyle = '#17171C'; g.fill();
  g.lineWidth = 4; g.strokeStyle = '#3a3a44'; g.stroke();
  g.save(); rr(g, 18, 18, TW - 36, TH - 36, 70); g.clip();
  g.translate(18, 18);
  painter(g, tau, TW - 36, TH - 36);
  g.restore();
  // isla y reflejo de cristal
  rr(g, TW / 2 - 72, 38, 144, 38, 19); g.fillStyle = '#000'; g.fill();
  g.save(); rr(g, 18, 18, TW - 36, TH - 36, 70); g.clip();
  const sx = lerp(-TW, TW * 1.6, sheen);
  const gr = g.createLinearGradient(sx, 0, sx + TW * 0.8, TH * 0.5);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  g.restore();
  return c;
}
function statusBar(g, w, dark) {
  g.fillStyle = dark ? '#fff' : '#111';
  setFont(g, 25, 600); g.textBaseline = 'alphabetic'; g.fillText('9:41', 50, 66);
  g.fillRect(w - 112, 47, 34, 18); g.fillRect(w - 74, 51, 4, 10);
  for (let i = 0; i < 4; i++) g.fillRect(w - 170 + i * 10, 62 - i * 5, 6, 4 + i * 5);
}

// ------------------------------------------------------------------ PINTORES DE PANTALLA
// 1 · SEM / Google Ads
function paintSEM(g, tau, w, h) {
  g.fillStyle = '#F7F5F0'; g.fillRect(0, 0, w, h);
  statusBar(g, w, false);
  const lift = E.inOutC(seg(tau, 1.45, 1.9));
  // logotipo genérico del buscador
  g.globalAlpha = 1 - lift;
  setFont(g, 64, 800); g.fillStyle = '#1b1b20'; g.textAlign = 'center';
  g.fillText('buscar', w / 2, 300); g.textAlign = 'left';
  g.fillStyle = C.acc; g.beginPath(); g.arc(w / 2 + 112, 266, 9, 0, TAU); g.fill();
  g.globalAlpha = 1;
  const py = lerp(350, 110, lift);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.12)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
  rr(g, 30, py, w - 60, 84, 42); g.fillStyle = '#fff'; g.fill(); g.restore();
  g.strokeStyle = '#6b6b75'; g.lineWidth = 5; g.beginPath(); g.arc(78, py + 39, 14, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(88, py + 50); g.lineTo(100, py + 62); g.stroke();
  const q = 'agencia de marketing', nch = Math.floor(seg(tau, 0.25, 1.35) * q.length);
  setFont(g, 30, 500); g.fillStyle = '#1b1b20';
  g.fillText(q.slice(0, nch), 122, py + 53);
  if (tau < 1.45 && Math.floor(tau * 3) % 2 === 0) g.fillRect(124 + g.measureText(q.slice(0, nch)).width, py + 24, 3, 38);
  // resultados
  for (let i = 0; i < 4; i++) {
    const p = E.outExpo(seg(tau, 1.65 + i * 0.09, 2.3 + i * 0.09));
    if (p <= 0) continue;
    const y = 230 + i * 188 + (1 - p) * 60;
    g.globalAlpha = p;
    if (i === 0) {
      setFont(g, 22, 800); g.fillStyle = '#1b1b20'; g.fillText('Patrocinado', 40, y);
      g.fillStyle = '#e9e5dc'; g.beginPath(); g.arc(56, y + 40, 18, 0, TAU); g.fill();
      setFont(g, 26, 800, 'Bodoni'); g.fillStyle = '#111'; g.fillText('G', 47, y + 49);
      setFont(g, 22, 500); g.fillStyle = '#55555f'; g.fillText('gacmark.com', 88, y + 48);
      setFont(g, 33, 700); g.fillStyle = C.blue; g.fillText('GACMARK · Agencia de', 40, y + 100); g.fillText('Marketing Digital', 40, y + 140);
    } else {
      g.fillStyle = '#e4e0d7'; g.beginPath(); g.arc(56, y + 16, 18, 0, TAU); g.fill();
      bar(g, 88, y + 6, 160, 18, '#e4e0d7');
      bar(g, 40, y + 56, 380 - i * 30, 26, '#d9d5cc');
      bar(g, 40, y + 100, 470, 16, '#ebe7df'); bar(g, 40, y + 128, 300, 16, '#ebe7df');
    }
    g.globalAlpha = 1;
  }
  // marco de selección + toque
  const hp = E.inOutC(seg(tau, 2.15, 2.7));
  if (hp > 0) {
    g.strokeStyle = C.acc; g.lineWidth = 6; rr(g, 22, 196, w - 44, 196, 26);
    g.setLineDash([1600 * hp, 2000]); g.stroke(); g.setLineDash([]);
  }
  const tp = seg(tau, 2.75, 3.4);
  if (tp > 0 && tp < 1) {
    g.fillStyle = `rgba(255,74,38,${0.35 * (1 - tp)})`; g.beginPath(); g.arc(400, 310, 20 + 110 * E.outC(tp), 0, TAU); g.fill();
    g.fillStyle = `rgba(20,20,24,${0.5 * (1 - tp)})`; g.beginPath(); g.arc(400, 310, 26, 0, TAU); g.fill();
  }
  // panel de rendimiento
  const sp = E.outExpo(seg(tau, 3.05, 3.7));
  if (sp > 0) {
    const y0 = lerp(h, h * 0.44, sp);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 40;
    rr(g, 0, y0, w, h - y0 + 60, 44); g.fillStyle = '#121216'; g.fill(); g.restore();
    bar(g, w / 2 - 40, y0 + 18, 80, 8, '#3a3a44');
    setFont(g, 24, 600); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText('CAMPAÑA SEM · ÚLTIMOS 30 DÍAS', 40, y0 + 78);
    setFont(g, 76, 800); g.fillStyle = '#fff';
    g.fillText(fmtInt(12480 * E.outC(seg(qz(tau), 3.3, 4.4))), 40, y0 + 168);
    setFont(g, 26, 500); g.fillStyle = C.acc; g.fillText('clics  ▲ conversiones', 40, y0 + 210);
    for (let i = 0; i < 9; i++) {
      const hh = (70 + i * i * 4.2 + 30 * hash(i + 3)) * spring(tau - 3.35 - i * 0.05, 14, 0.5);
      g.fillStyle = i === 8 ? C.acc : 'rgba(255,255,255,0.22)';
      rr(g, 40 + i * 58, y0 + 520 - hh, 38, hh, 8); g.fill();
    }
  }
}
// 2 · SEO
function paintSEO(g, tau, w, h) {
  g.fillStyle = '#0F0F13'; g.fillRect(0, 0, w, h);
  statusBar(g, w, true);
  rr(g, 30, 100, w - 60, 76, 38); g.fillStyle = '#1D1D24'; g.fill();
  setFont(g, 28, 500); g.fillStyle = '#ddd'; g.fillText('agencia seo cerca de mí', 76, 148);
  setFont(g, 22, 600); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText('RESULTADOS ORGÁNICOS', 36, 228);
  const SLOT = 132, TOP = 250;
  const pos = lerp(6.4, 0, E.inOutQuint(seg(tau, 0.9, 3.1)));
  for (let k = 0; k < 5; k++) {
    const shift = clamp(k + 1 - pos);
    const y = TOP + (k + E.inOutC(shift)) * SLOT;
    rr(g, 24, y, w - 48, SLOT - 18, 22); g.fillStyle = '#18181E'; g.fill();
    g.fillStyle = '#2a2a33'; g.beginPath(); g.arc(70, y + 40, 18, 0, TAU); g.fill();
    bar(g, 100, y + 30, 150 + 30 * hash(k), 16, '#2a2a33');
    bar(g, 46, y + 70, 360 - 40 * hash(k + 9), 20, '#24242c');
  }
  const y = TOP + pos * SLOT;
  g.save(); g.shadowColor = 'rgba(255,74,38,0.7)'; g.shadowBlur = 30;
  rr(g, 18, y - 6, w - 36, SLOT - 6, 24); g.fillStyle = '#1E1412'; g.fill(); g.restore();
  g.strokeStyle = C.acc; g.lineWidth = 4; rr(g, 18, y - 6, w - 36, SLOT - 6, 24); g.stroke();
  g.fillStyle = C.acc; g.beginPath(); g.arc(70, y + 40, 20, 0, TAU); g.fill();
  setFont(g, 24, 900, 'Bodoni'); g.fillStyle = '#fff'; g.fillText('G', 62, y + 48);
  setFont(g, 26, 700); g.fillStyle = '#fff'; g.fillText('gacmark.com', 104, y + 49);
  setFont(g, 22, 500); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('Agencia de marketing digital', 46, y + 92);
  const rank = Math.max(1, Math.round(lerp(37, 1, E.inOutQuint(seg(qz(tau), 0.9, 3.1)))));
  rr(g, w - 150, y + 14, 112, 58, 29); g.fillStyle = rank === 1 ? C.acc : '#2a2a33'; g.fill();
  setFont(g, 32, 800); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('#' + rank, w - 94, y + 55); g.textAlign = 'left';
}
// 3 · Community manager
const COMMENTS = [
  ['lucia.dsgn', '¡Me encanta esta campaña!', false],
  ['marcos_rt', '¿Hacéis envíos a Canarias?', false],
  ['gacmark', '¡Sí! Te escribimos por DM ✦', true],
  ['ana.blm', 'Guardado para el finde', false],
];
function paintCM(g, tau, w, h) {
  g.fillStyle = '#FAF8F4'; g.fillRect(0, 0, w, h);
  statusBar(g, w, false);
  g.fillStyle = '#111'; g.beginPath(); g.arc(62, 128, 28, 0, TAU); g.fill();
  g.strokeStyle = C.acc; g.lineWidth = 4; g.beginPath(); g.arc(62, 128, 34, 0, TAU); g.stroke();
  setFont(g, 30, 900, 'Bodoni'); g.fillStyle = '#fff'; g.fillText('G', 51, 139);
  setFont(g, 26, 700); g.fillStyle = '#111'; g.fillText('gacmark', 110, 124);
  setFont(g, 20, 500); g.fillStyle = '#777'; g.fillText('Madrid · hace 2 min', 110, 152);
  // imagen del post: composición abstracta animada
  const iy = 180, ih = 470;
  const gr = g.createLinearGradient(0, iy, w, iy + ih);
  gr.addColorStop(0, '#FF4A26'); gr.addColorStop(1, '#2A0E08');
  g.fillStyle = gr; g.fillRect(0, iy, w, ih);
  g.save(); g.beginPath(); g.rect(0, iy, w, ih); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w * (0.2 + 0.35 * i) + 20 * Math.sin(tau * 1.3 + i), iy + ih * 0.5 + 40 * Math.cos(tau + i * 2), 110 - i * 20, 0, TAU); g.fill(); }
  setFont(g, 200, 900, 'Bodoni'); g.fillStyle = '#F2EEE7'; g.textAlign = 'center';
  g.fillText('hola.', w / 2, iy + ih * 0.62 + 6 * Math.sin(tau * 2)); g.textAlign = 'left';
  g.restore();
  // acciones
  const pop = tau > 1.25 ? 1 + 0.45 * Math.exp(-(tau - 1.25) * 7) * Math.sin((tau - 1.25) * 24) : 1;
  g.save(); g.translate(56, 698); g.scale(pop, pop);
  heartPath(g, 0, -22, 44); g.fillStyle = tau > 1.25 ? C.acc : 'transparent'; g.fill();
  g.strokeStyle = tau > 1.25 ? C.acc : '#111'; g.lineWidth = 4; g.stroke(); g.restore();
  g.strokeStyle = '#111'; g.lineWidth = 4;
  g.beginPath(); g.arc(136, 698, 20, 0.3, TAU - 0.2); g.lineTo(158, 718); g.stroke();
  g.beginPath(); g.moveTo(200, 684); g.lineTo(240, 698); g.lineTo(200, 714); g.closePath(); g.stroke();
  setFont(g, 25, 700); g.fillStyle = '#111';
  g.fillText(fmtInt(lerp(1204, 9870, E.outC(seg(qz(tau), 1.2, 4.2)))) + ' Me gusta', 32, 768);
  // comentarios que aparecen con muelle
  COMMENTS.forEach(([u, txt, own], i) => {
    const s = spring(tau - (1.5 + i * 0.6), 13, 0.5);
    if (s <= 0.001) return;
    const y = 800 + i * 58;
    g.save(); g.translate(own ? w - 30 : 30, y); g.scale(s, s);
    setFont(g, 22, 500);
    const tw = g.measureText(txt).width + (own ? 0 : 0);
    const bw = tw + 40 + (own ? 0 : 0);
    const bx = own ? -bw : 0;
    rr(g, bx, -4, bw, 48, 22); g.fillStyle = own ? C.acc : '#ECE8E0'; g.fill();
    g.fillStyle = own ? '#fff' : '#222'; g.fillText(txt, bx + 20, 28);
    g.restore();
  });
}
// 4 · Publicidad en redes sociales (story 9:16)
const STORY_SH = ['circle', 'square', 'heart', 'star', 'triangle', 'circle'];
function paintSocial(g, tau, w, h) {
  const gr = g.createLinearGradient(0, 0, w * 0.4, h);
  gr.addColorStop(0, '#2A0E08'); gr.addColorStop(0.55, '#7A1A0B'); gr.addColorStop(1, '#FF4A26');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) {
    const p = clamp((tau + 0.4 - i * 1.6) / 1.6);
    bar(g, 24 + i * ((w - 48) / 3 + 0), 30, (w - 60) / 3, 6, 'rgba(255,255,255,0.3)');
    bar(g, 24 + i * ((w - 48) / 3 + 0), 30, Math.max(6, (w - 60) / 3 * p), 6, '#fff');
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(56, 82, 22, 0, TAU); g.fill();
  setFont(g, 24, 900, 'Bodoni'); g.fillStyle = '#111'; g.fillText('G', 48, 90);
  setFont(g, 22, 700); g.fillStyle = '#fff'; g.fillText('gacmark', 90, 80);
  setFont(g, 18, 500); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('Patrocinado', 90, 104);
  // forma central que se transforma en cada negra
  const f = Math.max(0, (tau - 0.3) / BEAT), k = Math.floor(f), fr = f - k;
  const mp = E.inOutExpo(seg(fr, 0.55, 0.95));
  const A = SH[STORY_SH[k % 6]], B = SH[STORY_SH[(k + 1) % 6]];
  const sc = 120 * (0.92 + 0.08 * Math.cos(fr * TAU)) * E.outBack(seg(tau, 0.1, 0.6));
  g.save();
  shapePath(g, A, B, mp, w / 2, 330, sc, tau * 0.6);
  g.fillStyle = '#F2EEE7'; g.fill();
  shapePath(g, A, B, mp, w / 2 + 16, 344, sc * 0.92, tau * 0.6);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = C.acc; g.fill();
  g.restore();
  ['PARA', 'EL', 'SCROLL.'].forEach((s, i) => {
    kin(g, { text: s, x: 40, y: 600 + i * 104, size: 108, weight: 900, t: tau, in: 0.45 + i * 0.22, st: 0.03, dur: 0.5, color: i === 2 ? '#111' : '#fff', track: -0.03 });
  });
  const b = Math.sin(tau * 6) * 6;
  rr(g, w / 2 - 170, h - 120 + b, 340, 70, 35); g.fillStyle = '#fff'; g.fill();
  setFont(g, 25, 800); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('Desliza ↑  Más info', w / 2, h - 75 + b); g.textAlign = 'left';
}
// 5 · Tienda online
function bottle(g, x, y, s, tau) {
  g.save(); g.translate(x, y); g.rotate(0.05 * Math.sin(tau * 1.4)); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(0, 190, 120, 18, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(-110, 0, 110, 0);
  gr.addColorStop(0, '#7A1A0B'); gr.addColorStop(0.35, '#FF4A26'); gr.addColorStop(0.55, '#FF8D6E'); gr.addColorStop(1, '#8E200E');
  rr(g, -105, -60, 210, 250, 40); g.fillStyle = gr; g.fill();
  rr(g, -38, -120, 76, 64, 10); g.fillStyle = '#16161B'; g.fill();
  rr(g, -60, -150, 120, 36, 12); g.fillStyle = '#222'; g.fill();
  rr(g, -70, 20, 140, 100, 8); g.fillStyle = '#F2EEE7'; g.fill();
  setFont(g, 54, 900, 'Bodoni'); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('G', 0, 88); g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, -88, -44, 18, 210, 9); g.fill();
  g.restore();
}
function paintShop(g, tau, w, h) {
  g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h);
  statusBar(g, w, false);
  g.strokeStyle = '#111'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(54, 110); g.lineTo(38, 126); g.lineTo(54, 142); g.stroke();
  setFont(g, 26, 700); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('Tienda', w / 2, 136); g.textAlign = 'left';
  // carrito con contador
  g.beginPath(); g.moveTo(w - 96, 108); g.lineTo(w - 86, 108); g.lineTo(w - 76, 142); g.lineTo(w - 44, 142); g.lineTo(w - 38, 118); g.lineTo(w - 82, 118); g.stroke();
  const cb = spring(tau - 2.35, 16, 0.4);
  if (cb > 0) { g.save(); g.translate(w - 40, 102); g.scale(cb, cb); g.fillStyle = C.acc; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill(); setFont(g, 18, 800); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('1', 0, 6); g.restore(); g.textAlign = 'left'; }
  g.fillStyle = '#E8E3D8'; g.beginPath(); g.arc(w / 2, 400, 200, 0, TAU); g.fill();
  bottle(g, w / 2, 400, 1, tau);
  // producto volando al carrito
  const fp = seg(tau, 1.95, 2.4);
  if (fp > 0 && fp < 1) {
    const e = E.inOutC(fp);
    const x = lerp(w / 2, w - 66, e), y = lerp(400, 124, e) - Math.sin(e * Math.PI) * 140;
    bottle(g, x, y, lerp(0.45, 0.08, e), tau);
  }
  setFont(g, 48, 900, 'Bodoni'); g.fillStyle = '#111'; g.fillText('Esencia Nº 7', 36, 690);
  setFont(g, 22, 500); g.fillStyle = '#777'; g.fillText('Eau de parfum · 50 ml', 36, 728);
  setFont(g, 40, 800); g.fillStyle = '#111'; g.fillText('49,90 €', 36, 792);
  g.fillStyle = C.acc; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(w - 210 + i * 34, 780, 11, 0, TAU); g.fill(); }
  ['30 ml', '50 ml', '100 ml'].forEach((s, i) => {
    rr(g, 36 + i * 140, 820, 124, 54, 27); g.fillStyle = i === 1 ? '#111' : '#E8E3D8'; g.fill();
    setFont(g, 22, 600); g.fillStyle = i === 1 ? '#fff' : '#111'; g.textAlign = 'center'; g.fillText(s, 98 + i * 140, 855); g.textAlign = 'left';
  });
  const press = 1 - 0.06 * Math.exp(-Math.pow((tau - 1.875) / 0.06, 2));
  const added = tau > 1.9;
  g.save(); g.translate(w / 2, 950); g.scale(press, press);
  rr(g, -(w - 72) / 2, -40, w - 72, 80, 40); g.fillStyle = added ? C.acc : '#111'; g.fill();
  setFont(g, 27, 800); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(added ? '✓  Añadido al carrito' : 'Añadir al carrito', 0, 10);
  g.restore(); g.textAlign = 'left';
  // pedido confirmado
  const op = E.outExpo(seg(tau, 2.95, 3.5));
  if (op > 0) {
    g.fillStyle = `rgba(10,10,12,${0.55 * op})`; g.fillRect(0, 0, w, h);
    const y0 = lerp(h, h * 0.5, op);
    rr(g, 0, y0, w, h, 44); g.fillStyle = '#fff'; g.fill();
    const cp = E.inOutC(seg(tau, 3.3, 3.8));
    g.fillStyle = C.acc; g.beginPath(); g.arc(w / 2, y0 + 120, 56 * E.outBack(seg(tau, 3.2, 3.5)), 0, TAU); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w / 2 - 24, y0 + 120); g.lineTo(w / 2 - 6, y0 + 140); g.lineTo(w / 2 + 28, y0 + 102);
    g.setLineDash([100 * cp, 200]); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
    setFont(g, 40, 900, 'Bodoni'); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('Pedido confirmado', w / 2, y0 + 240);
    setFont(g, 23, 500); g.fillStyle = '#777'; g.fillText('Llega mañana · Pago seguro', w / 2, y0 + 282); g.textAlign = 'left';
  }
}
// 6 · Diseño web: versión móvil
function paintWebMobile(g, tau, w, h) {
  g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h);
  statusBar(g, w, false);
  setFont(g, 30, 800, 'Bodoni'); g.fillStyle = '#111'; g.fillText('GACMARK', 36, 140);
  for (let i = 0; i < 3; i++) g.fillRect(w - 80, 118 + i * 11, 40, 4);
  setFont(g, 70, 900); g.fillStyle = '#111';
  ['Diseño', 'que', 'convierte.'].forEach((s, i) => { g.fillStyle = i === 2 ? C.acc : '#111'; g.fillText(s, 36, 270 + i * 76); });
  rr(g, 36, 470, 260, 72, 36); g.fillStyle = '#111'; g.fill();
  setFont(g, 24, 700); g.fillStyle = '#fff'; g.fillText('Empezar ahora →', 66, 515);
  const gr = g.createLinearGradient(0, 590, w, 900);
  gr.addColorStop(0, '#FF4A26'); gr.addColorStop(1, '#2A0E08');
  rr(g, 36, 590, w - 72, 300, 26); g.fillStyle = gr; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.arc(w * 0.62, 740, 90 + 8 * Math.sin(tau * 2), 0, TAU); g.fill();
  for (let i = 0; i < 2; i++) { rr(g, 36 + i * ((w - 88) / 2 + 16), 912, (w - 88) / 2, 110, 20); g.fillStyle = '#E6E1D6'; g.fill(); }
}

// ------------------------------------------------------------------ web de escritorio en capas (3D explotado)
const WEB_W = 1280, WEB_H = 800;
function webLayer(i) {
  const c = cvs('web' + i, WEB_W, WEB_H);
  if (c.done) return c;
  const g = c.getContext('2d'); c.done = true;
  if (i === 0) {
    rr(g, 0, 0, WEB_W, WEB_H, 18); g.fillStyle = '#F4F1EA'; g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.05)'; g.lineWidth = 1;
    for (let x = 0; x < WEB_W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WEB_H); g.stroke(); }
  } else if (i === 1) {
    rr(g, 0, 0, WEB_W, 84, [18, 18, 0, 0]); g.fillStyle = '#fff'; g.fill();
    setFont(g, 34, 800, 'Bodoni'); g.fillStyle = '#111'; g.fillText('GACMARK', 48, 54);
    setFont(g, 20, 600); ['Servicios', 'Casos', 'Agencia', 'Blog'].forEach((s, k) => g.fillText(s, 640 + k * 120, 50));
    rr(g, 1110, 22, 130, 42, 21); g.fillStyle = C.acc; g.fill(); g.fillStyle = '#fff'; g.fillText('Contacto', 1135, 50);
  } else if (i === 2) {
    setFont(g, 96, 900); g.fillStyle = '#111'; g.fillText('Diseño que', 64, 250); g.fillStyle = C.acc; g.fillText('convierte.', 64, 350);
    setFont(g, 24, 400); g.fillStyle = '#555'; g.fillText('Webs rápidas, accesibles y pensadas para vender.', 66, 410);
    rr(g, 64, 446, 250, 66, 33); g.fillStyle = '#111'; g.fill(); setFont(g, 22, 700); g.fillStyle = '#fff'; g.fillText('Empezar ahora →', 96, 487);
  } else if (i === 3) {
    const gr = g.createLinearGradient(700, 130, 1220, 520);
    gr.addColorStop(0, '#FF4A26'); gr.addColorStop(1, '#2A0E08');
    rr(g, 720, 130, 500, 390, 30); g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(1010, 300, 120, 0, TAU); g.fill();
    setFont(g, 150, 900, 'Bodoni'); g.fillStyle = '#F2EEE7'; g.fillText('G', 920, 470);
  } else if (i === 4) {
    for (let k = 0; k < 3; k++) {
      rr(g, 64 + k * 392, 570, 368, 190, 22); g.fillStyle = '#fff'; g.fill();
      g.fillStyle = k === 1 ? C.acc : '#111'; g.beginPath(); g.arc(110 + k * 392, 616, 22, 0, TAU); g.fill();
      bar(g, 100 + k * 392 - 10, 660, 220, 18, '#e2ddd2'); bar(g, 90 + k * 392, 694, 300, 14, '#ece8df'); bar(g, 90 + k * 392, 720, 250, 14, '#ece8df');
    }
  }
  return c;
}

// ------------------------------------------------------------------ escenas
const SERVICES = [
  { title: ['SEM', 'GOOGLE ADS'], sub: 'Aparece primero cuando te buscan.', paint: paintSEM, icon: 'circle', stat: [12480, 'clics en 30 días'] },
  { title: ['POSICIONAMIENTO', 'SEO'], sub: 'Del puesto 37 al número 1.', paint: paintSEO, icon: 'arrow', stat: [1, 'posición en Google', '#'] },
  { title: ['COMMUNITY', 'MANAGER'], sub: 'Conversaciones que crean comunidad.', paint: paintCM, icon: 'bubble', stat: [48700, 'nuevos seguidores', '+'] },
  { title: ['PUBLICIDAD EN', 'REDES SOCIALES'], sub: 'Anuncios que paran el scroll.', paint: paintSocial, icon: 'heart', stat: [1200000, 'personas alcanzadas'] },
  { title: ['TIENDAS', 'ONLINE'], sub: 'Tu tienda, abierta 24/7.', paint: paintShop, icon: 'bag', stat: [23540, 'en ventas este mes', '€'] },
  { title: ['DISEÑO', 'WEB'], sub: 'Webs rápidas, bonitas y que venden.', paint: paintWebMobile, icon: 'browser', stat: [98, 'de rendimiento', '/100'] },
];
const SVC_T0 = 10, SVC_LEN = 5;
function svcLayout() {
  return LAND
    ? { tx: W * 0.075, ty: H * 0.42, tmax: W * 0.5, px: W * 0.70, py: H * 0.515, ph: H * 0.8, tsize: 118 * U }
    : { tx: W * 0.08, ty: H * 0.15, tmax: W * 0.84, px: W * 0.5, py: H * 0.64, ph: H * 0.55, tsize: 112 * U };
}

// Bloque de texto de cada servicio: índice, título cinético, subtítulo, dato
function svcText(g, i, tau, opts = {}) {
  const s = SERVICES[i], L = svcLayout();
  const size = fitSize(g, s.title, L.tsize, L.tmax, 900, 'Inter', -0.02);
  const outT = 4.45;
  const y1 = L.ty, y2 = L.ty + size * 1.0;
  // índice
  kin(g, { text: '0' + (i + 1), x: L.tx, y: y1 - size * 1.25, size: size * 0.62, fam: 'Bodoni', weight: 900, t: tau, in: 0.05, out: outT, st: 0.06, color: C.acc });
  kin(g, { text: '/ 06 — SERVICIOS', x: L.tx + size * 0.95, y: y1 - size * 1.28, size: 18 * U, weight: 600, track: 0.3, t: tau, in: 0.25, out: outT, st: 0.012, mode: 'fade', color: C.mute });
  kin(g, { text: s.title[0], x: L.tx, y: y1, size, weight: 900, t: tau, in: 0.12, out: outT, st: 0.035, dur: 0.75, track: -0.02 });
  kin(g, { text: s.title[1], x: L.tx, y: y2, size, weight: 900, t: tau, in: 0.3, out: outT + 0.05, st: 0.035, dur: 0.75, track: -0.02, stroke: i % 2 === 0, color: i % 2 === 0 ? C.ink : C.acc });
  const subY = y2 + 66 * U;
  kin(g, { text: s.sub, x: L.tx, y: subY, size: 32 * U, fam: 'Bodoni', style: 'italic', weight: 500, t: tau, in: 0.95, out: outT, st: 0.012, dur: 0.5, mode: 'fade', color: C.ink });
  // línea de acento
  const lp = E.outExpo(seg(tau, 0.7, 1.4)) * (1 - E.inExpo(seg(tau, outT, outT + 0.4)));
  g.fillStyle = C.acc; g.fillRect(L.tx, subY + 30 * U, 120 * U * lp, 4 * U);
  // dato
  const [val, label, pre] = s.stat;
  const cp = E.outC(seg(qz(tau), 1.4, 3.6));
  let v = pre === '#' ? '#' + Math.max(1, Math.round(lerp(37, 1, cp))) : (pre === '+' ? '+' : '') + fmtInt(val * cp) + (pre === '€' ? ' €' : '') + (pre === '/100' ? '/100' : '');
  if (val >= 1e6) v = (val * cp / 1e6).toFixed(1).replace('.', ',') + 'M';
  const sy = LAND ? subY + 150 * U : H * 0.965;
  const sx = LAND ? L.tx : W * 0.08;
  const sa = seg(tau, 1.3, 1.6) * (1 - seg(tau, outT, outT + 0.3));
  g.save(); g.globalAlpha = sa;
  setFont(g, 64 * U, 900, 'Bodoni'); g.fillStyle = C.ink; g.fillText(v, sx, sy);
  const vw = g.measureText(v).width;
  setFont(g, 20 * U, 600); g.fillStyle = C.mute; g.fillText(label.toUpperCase(), sx + vw + 18 * U, sy - 6 * U);
  g.restore();
  // icono morfológico (continuidad con la transición)
  if (LAND) {
    const ip = E.outBack(seg(tau, 0.2, 0.7)) * (1 - E.inExpo(seg(tau, outT, outT + 0.4)));
    const prev = SH[SERVICES[Math.max(0, i - 1)].icon], cur = SH[s.icon];
    const lw = textWidth(g, '/ 06 — SERVICIOS', 18 * U, 600, 'Inter', 'normal', 0.3);
    shapePath(g, prev, cur, E.inOutC(seg(tau, 0.2, 0.9)), L.tx + size * 0.95 + lw + 40 * U, y1 - size * 1.28 - 7 * U, 17 * U * ip, 0);
    g.strokeStyle = C.acc; g.lineWidth = 3 * U; g.stroke();
  }
}

function phonePose(tau) {
  const L = svcLayout();
  const p = spring(tau + 0.35, 7.5, 0.62);
  return {
    x: L.px - W / 2, y: L.py - H / 2 + 10 * U * Math.sin(tau * 1.6), z: lerp(1100 * U, 0, p),
    rx: 0.05 * Math.sin(tau * 0.9 + 1) + lerp(-0.3, 0, p),
    ry: lerp(1.1, -0.2, p) + 0.06 * Math.sin(tau * 1.1),
    rz: lerp(0.2, 0, p) + 0.015 * Math.sin(tau * 0.7),
  };
}
function drawPhoneAt(g, cam, tex, P, ph) {
  const pw = ph * TW / TH;
  // halo de acento detrás del teléfono
  const c = proj(cam, [P.x, P.y, P.z]);
  glowDot(g, c[0], c[1], ph * 0.75 * c[2], '255,74,38', 0.22);
  drawCard(g, cam, tex, P, pw, ph, 6, 10);
  return pw;
}

// Fondos específicos detrás del bloque del servicio
function svcBackground(g, i, tau, cam) {
  bgDark(g, LAND ? W * 0.68 : W * 0.5, LAND ? H * 0.5 : H * 0.62, 1);
  dust(g, SVC_T0 + i * SVC_LEN + tau, 0.03, 0.7);
}

function sService(i) {
  return (g, t) => {
    const tau = t - (SVC_T0 + i * SVC_LEN);
    const L = svcLayout();
    const cam = Cam();
    svcBackground(g, i, tau, cam);
    const P = phonePose(tau);
    // extras por servicio (detrás)
    if (i === 0) {
      // "#1" gigante en contorno, con paralaje
      g.save(); g.globalAlpha = 0.09 * seg(tau, 0, 0.8);
      setFont(g, 780 * U, 900, 'Bodoni'); g.strokeStyle = C.ink; g.lineWidth = 3 * U;
      g.strokeText('#1', LAND ? W * 0.42 - tau * 30 * U : W * 0.05, LAND ? H * 0.86 : H * 0.95); g.restore();
    }
    if (i === 1) seoGraph(g, tau);
    if (i === 3) {
      // tarjetas fantasma de otros formatos (1:1 y 4:5) en abanico 3D
      for (const [k, fmt] of [[-1, 1], [1, 1.25]]) {
        const p = spring(tau - 0.25 - (k + 1) * 0.08, 8, 0.6);
        const cw = L.ph * 0.4, ch = cw * fmt;
        const tex = ghostCard(k, fmt);
        const off = LAND ? (k < 0 ? 0.36 : 0.6) : (k < 0 ? -0.42 : 0.42);
        drawCard(g, cam, tex, { x: P.x + off * L.ph * p, y: P.y + k * 0.16 * L.ph, z: 260 * U, rx: 0, ry: P.ry - 0.3, rz: (k < 0 ? -0.12 : 0.14) * p }, cw, ch, 4, 4, 0.9 * p);
      }
    }
    const tex = phoneTex('svc' + i, SERVICES[i].paint, tau, seg(tau, 0.2, 3.8));
    const pw = drawPhoneAt(g, cam, tex, P, L.ph);
    if (i === 2) heartsBurst(g, tau, cam, P, pw, L.ph);
    if (i === 4) coinsBurst(g, tau, cam, P, pw, L.ph);
    svcText(g, i, tau);
  };
}
function ghostCard(k, fmt) {
  const c = cvs('ghost' + k, 400, Math.round(400 * fmt));
  if (c.done) return c; c.done = true;
  const g = c.getContext('2d');
  rr(g, 0, 0, c.width, c.height, 30); g.fillStyle = k < 0 ? '#F2EEE7' : '#16161B'; g.fill();
  setFont(g, 120, 900); g.fillStyle = C.acc; g.fillText(k < 0 ? '-30%' : '', 30, c.height * 0.55);
  if (k > 0) { setFont(g, 92, 900, 'Bodoni'); g.fillStyle = '#F2EEE7'; g.fillText('Nuevo', 34, c.height * 0.5); g.fillStyle = C.acc; g.fillRect(36, c.height * 0.5 + 30, 140, 10); }
  setFont(g, 26, 700); g.fillStyle = k < 0 ? '#111' : '#bbb'; g.fillText('gacmark · Patrocinado', 30, c.height - 40);
  return c;
}

// SEO: gráfica 3D sobre una rejilla en perspectiva; la cámara sigue a la cabeza
function seoGraph(g, tau) {
  const prog = E.inOutC(seg(tau, 0.1, 4.3));
  const N = 60, X0 = -1700 * U, X1 = 1500 * U;
  const yAt = u => (380 - 760 * Math.pow(u, 1.6) + 50 * noise1(u * 9) * (1 - u)) * U;
  const head = [lerp(X0, X1, prog), yAt(prog), 700 * U];
  // seguimiento de cámara virtual (con retardo, en forma cerrada)
  const lag = E.inOutC(seg(tau - 0.25, 0.1, 4.3));
  const cam = Cam({ x: lerp(X0, X1, lag) * 0.42 + 200 * U, y: yAt(lag) * 0.35 - 60 * U, rx: -0.16, ry: 0.22 - 0.25 * prog, z: 0 });
  // suelo
  g.save(); g.strokeStyle = 'rgba(242,238,231,0.08)'; g.lineWidth = 1 * U;
  const fy = 460 * U;
  for (let k = 0; k <= 16; k++) {
    const x = (-2400 + k * 300) * U;
    const a = proj(cam, [x, fy, -300 * U]), b = proj(cam, [x, fy, 3600 * U]);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  for (let k = 0; k <= 13; k++) {
    const z = (-300 + k * 300) * U;
    const a = proj(cam, [-2400 * U, fy, z]), b = proj(cam, [2400 * U, fy, z]);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  // área y línea
  const pts = [];
  for (let k = 0; k <= N; k++) { const u = k / N * prog; pts.push(proj(cam, [lerp(X0, X1, u), yAt(u), 700 * U])); }
  const base = []; for (let k = N; k >= 0; k--) { const u = k / N * prog; base.push(proj(cam, [lerp(X0, X1, u), fy, 700 * U])); }
  g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); base.forEach(p => g.lineTo(p[0], p[1])); g.closePath();
  const gr = g.createLinearGradient(0, H * 0.1, 0, H); gr.addColorStop(0, 'rgba(255,74,38,0.35)'); gr.addColorStop(1, 'rgba(255,74,38,0)');
  g.fillStyle = gr; g.fill();
  g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.strokeStyle = C.acc; g.lineWidth = 5 * U; g.lineJoin = 'round'; g.stroke();
  // marcadores de posición en el eje
  setFont(g, 22 * U, 700); g.fillStyle = 'rgba(242,238,231,0.35)';
  for (const [u, lab] of [[0.05, '#37'], [0.35, '#18'], [0.62, '#6'], [0.98, '#1']]) {
    if (u > prog) continue;
    const p = proj(cam, [lerp(X0, X1, u), yAt(u) - 60 * U, 700 * U]); g.fillText(lab, p[0] - 16 * U, p[1]);
  }
  const hp = proj(cam, head);
  g.globalCompositeOperation = 'lighter';
  glowDot(g, hp[0], hp[1], 90 * U * hp[2], '255,120,80', 0.9);
  glowDot(g, hp[0], hp[1], 26 * U * hp[2], '255,255,255', 1);
  g.restore();
}
// Community manager: corazones con física (gravedad, arrastre y rebotes)
const HEARTS = (() => { const r = mulberry32(3); return Array.from({ length: 66 }, (_, i) => ({ b: i % 3, a: -Math.PI / 2 + (r() - 0.5) * 1.9, v: 900 + r() * 1300, s: 16 + r() * 30, w: (r() - 0.5) * 8, d: r() * 0.12, white: r() < 0.3 })); })();
function heartsBurst(g, tau, cam, P, pw, ph) {
  const src = cardPoint(cam, P, pw, ph, 0.1, 0.655);
  const floor = H - 30 * U;
  g.save();
  for (const h of HEARTS) {
    const t0 = 1.25 + h.b * 1.25 + h.d, tt = tau - t0;
    if (tt <= 0 || tt > 2.6) continue;
    const [x, y] = ballistic(tt, src[0], src[1], Math.cos(h.a) * h.v * U - 300 * U, Math.sin(h.a) * h.v * U, 2600 * U, floor, 0.45, 1.2);
    const a = (1 - seg(tt, 1.8, 2.6)) * Math.min(1, tt * 10);
    g.save(); g.translate(x, y); g.rotate(h.w * tt * 0.3); g.globalAlpha = a;
    heartPath(g, 0, -h.s * U * 0.5, h.s * U); g.fillStyle = h.white ? C.ink : C.acc; g.fill(); g.restore();
  }
  g.restore();
}
// Tienda: monedas que saltan del botón de compra y rebotan
const COINS = (() => { const r = mulberry32(5); return Array.from({ length: 34 }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.2, v: 1000 + r() * 1200, s: 18 + r() * 16, w: 6 + r() * 14, d: r() * 0.15 })); })();
function coinsBurst(g, tau, cam, P, pw, ph) {
  const src = cardPoint(cam, P, pw, ph, 0.5, 0.89);
  const floor = H - 30 * U;
  for (const c of COINS) {
    const tt = tau - 1.9 - c.d;
    if (tt <= 0 || tt > 2.8) continue;
    const [x, y] = ballistic(tt, src[0], src[1], Math.cos(c.a) * c.v * U - 380 * U, Math.sin(c.a) * c.v * U, 2800 * U, floor, 0.5, 1.0);
    const a = (1 - seg(tt, 2.0, 2.8));
    const sx = Math.cos(c.w * tt);
    g.save(); g.translate(x, y); g.globalAlpha = a; g.scale(Math.max(0.08, Math.abs(sx)), 1);
    g.fillStyle = sx > 0 ? '#FFB27A' : C.accD; g.beginPath(); g.arc(0, 0, c.s * U, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2 * U; g.beginPath(); g.arc(0, 0, c.s * U * 0.72, 0, TAU); g.stroke();
    if (sx > 0) { setFont(g, c.s * U * 1.1, 900); g.fillStyle = '#7A1A0B'; g.textAlign = 'center'; g.fillText('€', 0, c.s * U * 0.38); }
    g.restore();
  }
  g.textAlign = 'left';
}

// Servicio 6: diseño web con capas explotadas en 3D que se ensamblan
function sWeb(g, t) {
  const tau = t - 35;
  bgDark(g, W * 0.62, H * 0.5, 1);
  dust(g, t, 0.03, 0.7);
  const L = svcLayout();
  const ex = 1 - E.inOutQuint(seg(tau, 1.6, 3.0));
  const cw = LAND ? W * 0.45 : W * 0.86, ch = cw * WEB_H / WEB_W;
  const gx = LAND ? W * 0.68 - W / 2 : 0, gy = LAND ? -10 * U : H * 0.56 - H / 2;
  const cam = Cam({ rx: lerp(-0.42, -0.02, 1 - ex) + 0.02 * Math.sin(tau), ry: lerp(0.62, 0.0, 1 - ex) + 0.04 * Math.sin(tau * 0.8), x: gx, y: gy, cx: W / 2 + gx, cy: H / 2 + gy });
  const sc = spring(tau + 0.35, 7, 0.7);
  // ventana del navegador (aparece al ensamblar)
  const bp = E.outExpo(seg(tau, 2.8, 3.4));
  if (bp > 0) {
    const a = cardPoint(cam, { x: gx, y: gy, z: 0 }, cw, ch, 0, 0), b = cardPoint(cam, { x: gx, y: gy, z: 0 }, cw, ch, 1, 1);
    g.save(); g.globalAlpha = bp;
    rr(g, a[0] - 10 * U, a[1] - 44 * U, b[0] - a[0] + 20 * U, b[1] - a[1] + 54 * U, 16 * U); g.fillStyle = '#1C1C22'; g.fill();
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(a[0] + (14 + k * 20) * U, a[1] - 22 * U, 6 * U, 0, TAU); g.fill(); });
    rr(g, a[0] + 90 * U, a[1] - 34 * U, (b[0] - a[0]) * 0.5, 24 * U, 12 * U); g.fillStyle = '#2A2A33'; g.fill();
    setFont(g, 14 * U, 500); g.fillStyle = '#aaa'; g.fillText('gacmark.com', a[0] + 104 * U, a[1] - 17 * U);
    g.restore();
  }
  for (let k = 0; k < 5; k++) {
    const p = spring(tau + 0.3 - k * 0.12, 8, 0.65);
    if (p <= 0.001) continue;
    const z = -k * 170 * U * ex * sc - (1 - p) * 500 * U;
    const P = { x: gx + (1 - p) * (k - 2) * 120 * U, y: gy - (1 - p) * 200 * U, z, rx: 0, ry: 0, rz: 0 };
    drawCard(g, cam, webLayer(k), P, cw, ch, 5, 4, Math.min(1, p * 1.4));
    if (ex > 0.05 && k > 0) {
      // aristas de la capa (estética de wireframe)
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => cardPoint(cam, P, cw, ch, u, v));
      g.strokeStyle = `rgba(255,74,38,${0.5 * ex})`; g.lineWidth = 1.5 * U;
      g.beginPath(); corners.forEach((c, j) => j ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1])); g.closePath(); g.stroke();
    }
  }
  // versión móvil (responsive)
  const mp = spring(tau - 3.1, 8, 0.65);
  if (mp > 0.001) {
    const ph = LAND ? H * 0.5 : H * 0.36;
    const P = { x: gx + cw * (LAND ? 0.4 : 0.3) + (1 - mp) * 500 * U, y: gy + ch * 0.25, z: -60 * U, rx: 0, ry: -0.15 * (1 - mp), rz: 0.1 * (1 - mp) };
    drawPhoneAt(g, Cam({ x: 0, y: 0 }), phoneTex('webm', paintWebMobile, tau, seg(tau, 3.2, 4.4)), { x: P.x - 0, y: P.y, z: P.z, rx: P.rx, ry: P.ry, rz: P.rz }, ph);
  }
  svcText(g, 5, tau);
}

// ---- INTRO 0 → 5
const COLLAPSE = (() => { const r = mulberry32(21); return Array.from({ length: 300 }, () => ({ a: r() * TAU, r: 0.25 + r() * 0.8, d: r() * 0.35, s: 1 + r() * 2.5 })); })();
function sIntro(g, t) {
  bgDark(g, W / 2, H / 2, 0.4 + 0.6 * seg(t, 0, 2));
  dust(g, t, 0.05, seg(t, 0, 1.2));
  const zoom = 1 + t * 0.014;
  g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  const sz = (LAND ? 92 : 70) * U;
  const cy = H / 2;
  // horizonte de luz anamórfico
  const lw = W * 0.86 * E.outExpo(seg(t, 0.1, 1.5)) * (1 - E.inExpo(seg(t, 4.1, 4.7)));
  if (lw > 1) {
    const ly = cy + 46 * U;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0);
    gr.addColorStop(0, 'rgba(255,74,38,0)'); gr.addColorStop(0.5, 'rgba(255,240,230,1)'); gr.addColorStop(1, 'rgba(255,74,38,0)');
    g.fillStyle = gr; g.fillRect(W / 2 - lw / 2, ly - 1.5 * U, lw, 3 * U);
    g.globalAlpha = 0.5; g.fillRect(W / 2 - lw / 2, ly - 10 * U, lw, 20 * U);
    g.restore();
  }
  // frase 1 y 2, palabra a palabra en corcheas (BEAT/2)
  const b2 = BEAT / 2;
  const inter = (w, tt) => ({ w, t: tt, size: sz, weight: 300, track: -0.01 });
  const bod = (w, tt, col) => ({ w, t: tt, size: sz * 1.15, fam: 'Bodoni', style: 'italic', weight: 500, color: col });
  phrase(g, [inter('Hay', BEAT), inter('marcas', BEAT + b2), inter('que', BEAT * 2), inter('se', BEAT * 2 + b2), bod('ven.', BEAT * 3, C.ink)], W / 2, cy, t, { out: 2.2 });
  phrase(g, [inter('Y', BEAT * 4), inter('marcas', BEAT * 4 + b2), inter('que', BEAT * 5), bod('se eligen.', BEAT * 6, C.acc)], W / 2, cy, t, { out: 4.25 });
  g.restore();
  // colapso de partículas hacia el centro (aceleración exponencial)
  if (t > 3.9) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of COLLAPSE) {
      const k = seg(t, 3.95 + p.d, 4.97);
      if (k <= 0) continue;
      const r = p.r * DIAG * 0.5 * (1 - E.inExpo(k));
      const a = p.a + 2.2 * E.inC(k);
      g.fillStyle = `rgba(255,${180 + 70 * k | 0},${150 + 100 * k | 0},${Math.min(1, k * 3)})`;
      g.fillRect(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, p.s * U, p.s * U);
    }
    const cr = 90 * U * E.inQ(seg(t, 4.2, 4.95));
    glowDot(g, W / 2, H / 2, cr * 3, '255,140,100', 1);
    glowDot(g, W / 2, H / 2, cr, '255,255,255', 1);
    g.restore();
  }
  // destello que inunda de papel
  const fr = E.inExpo(seg(t, 4.86, 5.0)) * DIAG * 0.6;
  if (fr > 0) { g.fillStyle = C.paper; g.beginPath(); g.arc(W / 2, H / 2, fr, 0, TAU); g.fill(); }
}

// ---- LOGO 5 → 7.5 (fondo papel, como el logotipo original)
let LOGO_ZOOM = null;
function logoMetrics() {
  const g = sctx;
  const size = Math.min(LAND ? 250 * U : 190 * U, fitSize(g, ['GACMARK'], 250 * U, W * (LAND ? 0.66 : 0.84), 800, 'Bodoni', 0.045));
  return { size, cx: W / 2, cy: H / 2 + size * 0.33 };
}
function drawLogo(g, t, tin, track, color, M, opts = {}) {
  return kin(g, Object.assign({ text: 'GACMARK', x: M.cx, y: M.cy, size: M.size, fam: 'Bodoni', weight: 800, t, in: tin, st: 0.055, dur: 0.85, align: 'center', track, color }, opts));
}
function findZoomPoint() {
  // busca el punto más "interior" de un trazo grueso del logotipo para hacer zoom a través de él
  const c = cvs('zoomprobe', W, H), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const M = logoMetrics();
  drawLogo(g, 100, 0, 0.045, '#000', M);
  const d = g.getImageData(0, 0, W, H).data;
  const dark = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4] < 100;
  let best = [M.cx, M.cy], br = 0;
  const step = Math.max(2, Math.round(3 * U));
  for (let y = Math.round(M.cy - M.size); y < M.cy; y += step) for (let x = Math.round(W * 0.15); x < W * 0.85; x += step) {
    if (!dark(x, y)) continue;
    let r = 1;
    while (r < 80 && dark(x + r, y) && dark(x - r, y) && dark(x, y + r) && dark(x, y - r) && dark(x + r * 0.7 | 0, y + r * 0.7 | 0) && dark(x - r * 0.7 | 0, y - r * 0.7 | 0)) r++;
    if (r > br + 1 || (r >= br && Math.abs(x - W / 2) < Math.abs(best[0] - W / 2))) { br = r; best = [x, y]; }
  }
  return best;
}
function sLogo(g, t) {
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  const M = logoMetrics();
  const [fx, fy] = LOGO_ZOOM;
  const zp = E.inExpo(seg(t, 6.9, 7.5));
  const zs = Math.exp(Math.log(140) * zp);
  const push = 1 + 0.045 * E.outC(seg(t, 5, 7));
  g.save(); g.translate(fx, fy); g.scale(push * zs, push * zs); g.rotate(-0.08 * zp); g.translate(-fx, -fy);
  const track = lerp(0.5, 0.045, E.inOutQuint(seg(t, 5.0, 6.5)));
  const w = drawLogo(g, t, 5.05, track, C.dark, M);
  const bp = E.outExpo(seg(t, 5.7, 6.4));
  const bw = textWidth(g, 'GACMARK', M.size, 800, 'Bodoni', 'normal', 0.045);
  g.fillStyle = C.acc; g.fillRect(W / 2 - bw / 2, M.cy + M.size * 0.16, bw * bp, 6 * U);
  kin(g, { text: 'AGENCIA DE MARKETING DIGITAL', x: W / 2, y: M.cy + M.size * 0.16 + 58 * U, size: 24 * U, weight: 600, track: 0.42, t, in: 6.0, st: 0.016, dur: 0.35, align: 'center', mode: 'fade', color: C.dark });
  g.restore();
  const fl = 1 - E.outC(seg(t, 5.0, 5.6));
  if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, W, H); }
}

// ---- "6 servicios · 1 objetivo · crecer" 7.5 → 10
function extruded(g, ch, cx, cy, size, ry, rx, color, depth = 70 * U) {
  setFont(g, size, 900, 'Bodoni');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const f = 1600 * U, layers = 22;
  for (let k = layers; k >= 0; k--) {
    const z = k / layers * depth;
    const p = rot3([0, 0, z], rx, ry, 0);
    const kk = f / (f + p[2]);
    g.save(); g.translate(cx + p[0] * kk, cy + p[1] * kk); g.scale(kk * Math.cos(ry), kk * Math.cos(rx));
    if (k === 0) { g.fillStyle = color; }
    else { const s = 1 - k / layers; g.fillStyle = `rgb(${120 + 135 * s * 0.4 | 0},${30 + 30 * s | 0},${15 + 20 * s | 0})`; }
    g.fillText(ch, 0, 0);
    g.restore();
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function sSix(g, t) {
  const tau = t - 7.5;
  bgDark(g, W / 2, H / 2, 1);
  dust(g, t, 0.06, 1);
  const nx = LAND ? W * 0.3 : W * 0.5, ny = LAND ? H * 0.5 : H * 0.36;
  const tx = LAND ? W * 0.46 : W * 0.5, al = LAND ? 'left' : 'center';
  const tyy = LAND ? H * 0.5 : H * 0.66;
  const spin = E.inOutC(seg(tau, 1.05, 1.45)) * TAU;
  const ch = spin > Math.PI * 0.5 ? '1' : '6';
  const ry = lerp(-1.3, 0.38, E.outExpo(seg(tau, 0, 0.9))) + spin + 0.12 * Math.sin(tau * 1.4);
  const out = E.inExpo(seg(tau, 1.72, 1.9));
  const ns = (LAND ? 560 : 480) * U * (1 - out) * (1 + 0.04 * Math.sin(tau * 2));
  if (ns > 1) extruded(g, ch, nx, ny, ns, ry % TAU, -0.12, C.ink);
  const ts = (LAND ? 120 : 96) * U;
  kin(g, { text: 'SERVICIOS', x: tx, y: tyy + ts * 0.35, size: ts, weight: 900, t: tau, in: 0.12, out: 1.0, st: 0.03, align: al, track: -0.02 });
  kin(g, { text: 'OBJETIVO', x: tx, y: tyy + ts * 0.35, size: ts, weight: 900, t: tau, in: 1.32, out: 1.6, st: 0.03, align: al, stroke: true, track: -0.02 });
  // CRECER. en la negra 9.375
  const cs = fitSize(g, ['CRECER.'], (LAND ? 300 : 220) * U, W * 0.86, 900);
  if (tau > 1.8) {
    // trazos ascendentes
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 40; k++) {
      const x = W * hash(k * 7.1), sp = 0.6 + hash(k) * 1.6;
      const y = H * 1.2 - ((tau - 1.8) * sp * H * 1.4 + hash(k * 3.3) * H) % (H * 1.6);
      g.fillStyle = `rgba(255,74,38,${0.25 + 0.35 * hash(k + 1)})`; g.fillRect(x, y, 2 * U, (80 + 200 * hash(k * 9)) * U);
    }
    g.restore();
    kin(g, { text: 'CRECER.', x: W / 2, y: H / 2 + cs * 0.36, size: cs, weight: 900, t: tau, in: 1.875, st: 0.03, dur: 0.5, align: 'center', mode: 'scale', from: 3, color: C.acc, track: -0.03 });
  }
}

// ---- MONTAJE 40 → 45: carrusel 3D de los seis anuncios
const MONT_WORDS = ['POSICIONA', 'ANUNCIA', 'CONECTA', 'ENAMORA', 'VENDE', 'DISEÑA', 'CRECE.'];
function montTex(i) {
  const name = 'mont' + i;
  if (POOL['ph_' + name] && POOL['ph_' + name].done) return POOL['ph_' + name];
  const c = phoneTex(name, SERVICES[i].paint, [3.0, 2.9, 3.4, 2.0, 2.6, 2.0][i], 0.5);
  c.done = true; return c;
}
function sMontage(g, t) {
  const tau = t - 40;
  bgDark(g, W / 2, H / 2, 1);
  dust(g, t, 0.12 + 0.3 * seg(tau, 3.5, 4.3), 1);
  // palabra gigante en contorno por negra
  const k = Math.min(6, Math.floor(tau / BEAT));
  if (tau < 4.375) {
    const ws = fitSize(g, [MONT_WORDS[k]], 340 * U, W * 0.94, 900);
    kin(g, { text: MONT_WORDS[k], x: W / 2, y: H / 2 + ws * 0.36, size: ws, weight: 900, t: tau, in: k * BEAT, st: 0.012, dur: 0.25, align: 'center', mode: 'scale', from: 1.25, stroke: true, color: 'rgba(242,238,231,0.28)', lw: 2 * U });
  }
  const col = E.inExpo(seg(tau, 3.9, 4.375));
  const R = (LAND ? 640 : 400) * U * (1 - col);
  const th = tau * 0.75 + 5 * E.inC(seg(tau, 3.2, 4.375));
  const cam = Cam({ rx: -0.2 + 0.06 * Math.sin(tau), ry: 0.2 * Math.sin(tau * 0.7), y: 0 });
  const ch = (LAND ? 440 : 380) * U * (1 - col * 0.8);
  const cards = [];
  for (let i = 0; i < 6; i++) {
    const a = th + i * TAU / 6;
    cards.push({ i, a, P: { x: Math.sin(a) * R, y: 0, z: Math.cos(a) * R, rx: 0, ry: 0.45 * Math.sin(a), rz: 0 } });
  }
  cards.sort((A, B) => proj(cam, [B.P.x, B.P.y, B.P.z])[3] - proj(cam, [A.P.x, A.P.y, A.P.z])[3]);
  const drawCenter = () => {
    const f = tau / BEAT, kk = Math.floor(f), fr = f - kk;
    const A = SH[SERVICES[kk % 6].icon], B = SH[SERVICES[(kk + 1) % 6].icon];
    const s = 92 * U * (1 - col) * (1 + 0.25 * Math.exp(-fr * 6));
    g.save();
    shapePath(g, A, B, E.inOutExpo(seg(fr, 0.5, 0.95)), W / 2, H / 2, s, 0);
    g.fillStyle = C.acc; g.fill(); g.restore();
  };
  let centerDone = false;
  for (const c of cards) {
    const depth = proj(cam, [c.P.x, c.P.y, c.P.z])[3];
    if (!centerDone && depth < 0) { drawCenter(); centerDone = true; }
    const fade = 1 - 0.55 * clamp(depth / (R + 1));
    drawCard(g, cam, montTex(c.i), c.P, ch * TW / TH, ch, 4, 7, fade * (1 - col));
  }
  if (!centerDone) drawCenter();
  // punto de colapso
  if (tau > 3.9) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = 60 * U * E.inQ(seg(tau, 3.9, 4.375)) * (1 - seg(tau, 4.375, 4.5));
    glowDot(g, W / 2, H / 2, r * 4, '255,120,80', 1); glowDot(g, W / 2, H / 2, r, '255,255,255', 1);
    g.restore();
  }
  if (tau >= 4.45) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
}

// ---- FINAL 45 → 50: partículas que forman el logotipo + lema
let LOGO_PTS = null;
function sampleLogo() {
  const c = cvs('logoprobe', W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const M = finalMetrics();
  drawLogo(g, 100, 0, 0.045, '#fff', M);
  const d = g.getImageData(0, 0, W, H).data;
  const pts = [], step = Math.max(3, Math.round(4 * U));
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
  const r = mulberry32(99);
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return pts.slice(0, 2600).map(p => ({ tx: p[0], ty: p[1], a: r() * TAU, v: (500 + r() * 1700) * U, d: r() * 0.55, s: 1.2 + r() * 1.6 }));
}
function finalMetrics() {
  const M = logoMetrics();
  return { size: M.size, cx: W / 2, cy: H * (LAND ? 0.47 : 0.44) + M.size * 0.33 };
}
function sFinal(g, t) {
  const tau = t - 45;
  const M = finalMetrics();
  const flood = E.inOutC(seg(t, 46.875, 47.45));
  const drawDark = () => {
    bgDark(g, W / 2, H / 2, 1);
    dust(g, t, 0.02, 0.6);
    // partículas: explosión con arrastre y después muelles hacia el logotipo
    g.save(); g.globalCompositeOperation = 'lighter';
    const pa = 1 - seg(t, 46.3, 46.9);
    if (pa > 0) for (const p of LOGO_PTS) {
      const k = 3.2, ex = (1 - Math.exp(-k * tau)) / k;
      const x0 = W / 2 + Math.cos(p.a) * p.v * ex, y0 = H / 2 + Math.sin(p.a) * p.v * ex;
      const s = spring(tau - 0.3 - p.d, 9, 0.72);
      const x = lerp(x0, p.tx, s), y = lerp(y0, p.ty, s);
      g.fillStyle = `rgba(255,${200 + 55 * s | 0},${170 + 85 * s | 0},${pa})`;
      g.fillRect(x, y, p.s * U, p.s * U);
    }
    const fl = 1 - seg(tau, 0, 0.5);
    if (fl > 0) { glowDot(g, W / 2, H / 2, DIAG * 0.5 * fl, '255,140,100', fl); }
    g.restore();
    const la = seg(t, 46.2, 46.7);
    if (la > 0) drawLogo(g, 100, 0, 0.045, C.ink, M, { alpha: la });
  };
  drawDark();
  if (flood > 0) {
    g.save(); g.beginPath(); g.arc(W / 2, M.cy - M.size * 0.33, flood * DIAG * 0.55, 0, TAU); g.clip();
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    drawLogo(g, 100, 0, 0.045, C.dark, M);
    // barrido de luz de acento sobre el logotipo
    const sw = seg(t, 48.2, 49.1);
    if (sw > 0 && sw < 1) {
      const sx = lerp(W * 0.1, W * 0.95, E.inOutC(sw));
      const gr = g.createLinearGradient(sx - 160 * U, 0, sx + 160 * U, 0);
      gr.addColorStop(0, 'rgba(255,74,38,0)'); gr.addColorStop(0.5, 'rgba(255,74,38,1)'); gr.addColorStop(1, 'rgba(255,74,38,0)');
      drawLogo(g, 100, 0, 0.045, gr, M);
    }
    const bw = textWidth(g, 'GACMARK', M.size, 800, 'Bodoni', 'normal', 0.045);
    const bp = E.outExpo(seg(t, 47.3, 48.0));
    g.fillStyle = C.acc; g.fillRect(W / 2 - bw / 2 * bp, M.cy + M.size * 0.16, bw * bp, 6 * U);
    const ls = (LAND ? 50 : 46) * U, ly = M.cy + M.size * 0.16 + 90 * U;
    phrase(g, [{ w: 'Marketing', t: 47.5, size: ls, weight: 600, color: C.dark, track: -0.01 }, { w: 'que', t: 47.6, size: ls, weight: 600, color: C.dark }, { w: 'se ve.', t: 47.7, size: ls * 1.12, fam: 'Bodoni', style: 'italic', weight: 500, color: C.dark }], W / 2, ly, t);
    phrase(g, [{ w: 'Resultados', t: 48.125, size: ls, weight: 600, color: C.dark, track: -0.01 }, { w: 'que', t: 48.225, size: ls, weight: 600, color: C.dark }, { w: 'se miden.', t: 48.325, size: ls * 1.12, fam: 'Bodoni', style: 'italic', weight: 500, color: C.acc }], W / 2, ly + ls * 1.25, t);
    kin(g, { text: 'GACMARK.COM', x: W / 2, y: H * (LAND ? 0.92 : 0.9), size: 22 * U, weight: 700, track: 0.5, t, in: 48.75, st: 0.025, dur: 0.4, align: 'center', mode: 'fade', color: C.dark });
    g.restore();
    g.save(); g.beginPath(); g.arc(W / 2, M.cy - M.size * 0.33, flood * DIAG * 0.55, 0, TAU);
    g.strokeStyle = C.acc; g.lineWidth = 8 * U * (1 - flood); g.stroke(); g.restore();
  }
}

// ------------------------------------------------------------------ línea de tiempo
const SCENES = [
  { a: 0, b: 5.0, draw: sIntro },
  { a: 5.0, b: 7.5, draw: sLogo },
  { a: 7.5, b: 10.35, draw: sSix },
  ...[0, 1, 2, 3, 4].map(i => ({ a: SVC_T0 + i * SVC_LEN - 0.35, b: SVC_T0 + (i + 1) * SVC_LEN + 0.35, draw: sService(i) })),
  { a: 34.65, b: 40.35, draw: sWeb },
  { a: 39.65, b: 45.0, draw: sMontage },
  { a: 45.0, b: 50.01, draw: sFinal },
];
// cada corte cae en un tiempo fuerte de la música
const TRANS = [
  { c: 10, type: 'shape', A: 'circle', B: 'circle' },
  { c: 15, type: 'shape', A: 'circle', B: 'arrow' },
  { c: 20, type: 'slats', dir: 'v' },
  { c: 25, type: 'shape', A: 'bubble', B: 'heart' },
  { c: 30, type: 'diag' },
  { c: 35, type: 'shape', A: 'bag', B: 'browser' },
  { c: 40, type: 'slats', dir: 'h' },
];
const TH2 = 0.35;
function sceneAt(t) {
  let s = null;
  for (const sc of SCENES) if (t >= sc.a && t < sc.b) s = sc;
  return s || SCENES[SCENES.length - 1];
}
function sceneBefore(c) { return SCENES.filter(s => s.a < c - TH2 + 1e-6 && s.b >= c + TH2 - 1e-6 && s.a < c - 0.5).slice(-1)[0]; }
function maskPath(g, tr, p) {
  if (tr.type === 'shape') {
    const s = 24 * U + DIAG * 1.4 * Math.pow(p, 2.4);
    shapePath(g, SH[tr.A], SH[tr.B], E.inOutC(seg(p, 0.05, 0.6)), W / 2, H / 2, s, (1 - p) * 0.5);
  } else if (tr.type === 'slats') {
    const n = 9; g.beginPath();
    for (let k = 0; k < n; k++) {
      const pk = E.inOutC(seg(p, k * 0.045, k * 0.045 + 0.62));
      if (tr.dir === 'v') { const w = W / n; const hh = H * pk; g.rect(k * w - 0.5, k % 2 ? H - hh : 0, w + 1, hh); }
      else { const hh = H / n; const ww = W * pk; g.rect(k % 2 ? W - ww : 0, k * hh - 0.5, ww, hh + 1); }
    }
  } else if (tr.type === 'diag') {
    const sl = 0.55 * H, d = lerp(-sl, W + sl, E.inOutC(p));
    g.beginPath(); g.moveTo(-10, -10); g.lineTo(d + sl / 2, -10); g.lineTo(d - sl / 2, H + 10); g.lineTo(-10, H + 10); g.closePath();
  }
}
function maskEdge(g, tr, p) {
  g.save();
  if (tr.type === 'shape') { maskPath(g, tr, p); g.strokeStyle = C.acc; g.lineWidth = 10 * U * (1 - p * 0.6); g.stroke(); }
  if (tr.type === 'diag') {
    const sl = 0.55 * H, d = lerp(-sl, W + sl, E.inOutC(p));
    g.beginPath(); g.moveTo(d + sl / 2, -10); g.lineTo(d + sl / 2 + 60 * U, -10); g.lineTo(d - sl / 2 + 60 * U, H + 10); g.lineTo(d - sl / 2, H + 10); g.closePath();
    g.fillStyle = C.acc; g.fill();
  }
  if (tr.type === 'slats') {
    const n = 9; g.fillStyle = C.acc;
    for (let k = 0; k < n; k++) {
      const pk = E.inOutC(seg(p, k * 0.045, k * 0.045 + 0.62));
      if (pk <= 0 || pk >= 1) continue;
      if (tr.dir === 'v') { const w = W / n, hh = H * pk; g.fillRect(k * w, k % 2 ? H - hh - 4 * U : hh, w, 4 * U); }
      else { const hh = H / n, ww = W * pk; g.fillRect(k % 2 ? W - ww - 4 * U : ww, k * hh, 4 * U, hh); }
    }
  }
  g.restore();
}
function drawScene(g, t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  const tr = TRANS.find(x => t >= x.c - TH2 && t < x.c + TH2);
  if (tr) {
    const p = seg(t, tr.c - TH2, tr.c + TH2);
    const A = SCENES.find(s => s.a < tr.c - 1 && s.b >= tr.c + TH2 - 1e-6 && s.b < tr.c + 1);
    const B = SCENES.find(s => Math.abs(s.a - (tr.c - TH2)) < 1e-6);
    g.save(); A.draw(g, t); g.restore();
    g.save(); maskPath(g, tr, p); g.clip(); B.draw(g, t); g.restore();
    maskEdge(g, tr, p);
  } else {
    g.save(); sceneAt(t).draw(g, t); g.restore();
  }
}

// ------------------------------------------------------------------ post: bloom, viñeta, grano, HUD
const BL1 = cvs('bl1', Math.ceil(W / 4), Math.ceil(H / 4)), BL2 = cvs('bl2', Math.ceil(W / 4), Math.ceil(H / 4)), BL3 = cvs('bl3', Math.ceil(W / 12), Math.ceil(H / 12));
function bloomAmt(t) {
  if (t < 4.9) return 0.9;
  if (t < 7.45) return 0.0;
  if (t < 10) return 0.7;
  if (t < 40) return 0.42;
  if (t < 46.8) return 0.7;
  return 0.7 * (1 - seg(t, 46.8, 47.3));
}
function bloom(g, amt) {
  if (amt <= 0.01) return;
  const b1 = BL1.getContext('2d'), b2 = BL2.getContext('2d'), b3 = BL3.getContext('2d');
  // umbral de altas luces: brillo 0.556 + contraste 9 ≈ max(0,(v-0.8)/0.2)
  b1.globalCompositeOperation = 'copy'; b1.filter = 'brightness(0.5556) contrast(9)';
  b1.drawImage(main, 0, 0, BL1.width, BL1.height); b1.filter = 'none';
  b2.globalCompositeOperation = 'copy'; b2.filter = `blur(${4 * U}px)`; b2.drawImage(BL1, 0, 0); b2.filter = 'none';
  b3.globalCompositeOperation = 'copy'; b3.filter = `blur(${5 * U}px)`; b3.drawImage(BL1, 0, 0, BL3.width, BL3.height); b3.filter = 'none';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = amt * 0.8; g.drawImage(BL2, 0, 0, W, H);
  g.globalAlpha = amt * 0.7; g.drawImage(BL3, 0, 0, W, H);
  g.restore();
}
const GRAIN = Array.from({ length: 6 }, (_, k) => {
  const c = cvs('grain' + k, 256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256), r = mulberry32(1000 + k);
  for (let i = 0; i < 256 * 256; i++) { const v = 128 + (r() - 0.5) * 255 * 0.9; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
});
let VIG = null;
function post(g, t, frame) {
  bloom(g, bloomAmt(t));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (!VIG) {
    VIG = cvs('vig', W, H); const v = VIG.getContext('2d');
    const gr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, DIAG * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); v.fillStyle = gr; v.fillRect(0, 0, W, H);
  }
  const light = (t >= 5 && t < 7.45) || t > 47.2;
  g.globalAlpha = light ? 0.35 : 1; g.drawImage(VIG, 0, 0);
  // grano de película: cambia cada 2 cuadros (determinista por índice de cuadro)
  const gi = Math.floor(frame / 2);
  const pat = g.createPattern(GRAIN[gi % 6], 'repeat');
  pat.setTransform(new DOMMatrix().translate(hash(gi) * 256, hash(gi + 0.5) * 256));
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.06; g.fillStyle = pat; g.fillRect(0, 0, W, H);
  g.restore();
  hud(g, t, frame);
}
function sectionName(t) {
  if (t < 5) return 'INTRO'; if (t < 10) return 'AGENCIA';
  if (t < 40) return SERVICES[Math.floor((t - 10) / 5)].title.join(' ');
  if (t < 45) return 'SERVICIOS'; return 'GACMARK';
}
function hud(g, t, frame) {
  const a = seg(t, 0.4, 1.2) * (1 - seg(t, 44.2, 44.4));
  if (a <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'difference'; g.globalAlpha = a * 0.85; g.fillStyle = '#E8E4DC';
  const m = 44 * U;
  setFont(g, 22 * U, 800, 'Bodoni'); g.fillText('GACMARK', m, m + 12 * U);
  setFont(g, 13 * U, 600); g.textAlign = 'right';
  g.fillText('SHOWREEL  ·  2026', W - m, m + 8 * U);
  const f = frame % FPS, s = Math.floor(t);
  g.fillText(`00:00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`, W - m, H - m + 6 * U);
  g.textAlign = 'left';
  g.fillText(sectionName(t), m, H - m + 6 * U);
  g.fillRect(m, H - m + 20 * U, (W - 2 * m) * (t / DUR), 2 * U);
  g.globalAlpha = a * 0.25; g.fillRect(m, H - m + 20 * U, W - 2 * m, 1 * U);
  g.restore();
}

// ------------------------------------------------------------------ seek / render
function shutter(t) {
  const near = [5, 7.5, 10, 15, 20, 25, 30, 35, 40, 45].some(c => Math.abs(t - c) < 0.45);
  return near ? 1.0 : 0.6;   // 360º en los cortes, 216º el resto
}
function seek(t, frame = Math.round(t * FPS)) {
  const n = MB;
  if (n <= 1) { drawScene(mctx, t); }
  else {
    const sh = shutter(t) / FPS;
    for (let i = 0; i < n; i++) {
      const ti = t + ((i + 0.5) / n - 0.5) * sh;
      drawScene(sctx, Math.max(0, Math.min(DUR - 1e-3, ti)));
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalCompositeOperation = 'source-over';
      mctx.globalAlpha = 1 / (i + 1);
      mctx.drawImage(scratch, 0, 0);
    }
    mctx.globalAlpha = 1;
  }
  post(mctx, t, frame);
}
window.seek = seek;
window.renderFrame = f => { seek(f / FPS, f); return true; };

window.__ready = (async () => {
  await Promise.all([
    document.fonts.load(`800 100px Bodoni`), document.fonts.load(`900 100px Bodoni`), document.fonts.load(`italic 500 100px Bodoni`),
    document.fonts.load(`300 100px Inter`), document.fonts.load(`900 100px Inter`), document.fonts.load(`600 100px Inter`),
  ]);
  await document.fonts.ready;
  LOGO_ZOOM = findZoomPoint();
  LOGO_PTS = sampleLogo();
  for (let i = 0; i < 6; i++) montTex(i);
  for (let i = 0; i < 5; i++) webLayer(i);
  ghostCard(-1, 1); ghostCard(1, 1.25);
  if (!RENDER) setupPreview();
  return true;
})();

function setupPreview() {
  document.body.classList.add('preview');
  document.body.style.setProperty('--ar', W / H);
  const sc = document.getElementById('scrub'), tc = document.getElementById('tc'), au = document.getElementById('music'), pl = document.getElementById('play');
  const T0 = +Q.get('t') || 0;
  const show = t => { seek(t); sc.value = t; tc.textContent = t.toFixed(3) + ' s'; };
  sc.oninput = () => { au.pause(); show(+sc.value); };
  pl.onclick = () => { if (au.paused) { au.currentTime = +sc.value; au.play(); } else au.pause(); };
  const loop = () => { if (!au.paused) show(au.currentTime); requestAnimationFrame(loop); };
  loop(); show(T0);
}
