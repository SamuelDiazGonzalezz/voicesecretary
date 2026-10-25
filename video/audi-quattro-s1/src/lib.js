// Utilidades deterministas: curvas, ruido con semilla, tipografía y recursos gráficos.
import { W, H } from './timeline.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));

// Cubic-bezier como en CSS, resuelto por Newton + bisección.
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) return sy(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1;
    u = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

export const ease = {
  out: bezier(0.22, 1, 0.36, 1),
  outExpo: bezier(0.16, 1, 0.3, 1),
  outQuart: bezier(0.25, 1, 0.5, 1),
  inExpo: bezier(0.7, 0, 0.84, 0),
  inOut: bezier(0.65, 0, 0.35, 1),
  inOutExpo: bezier(0.87, 0, 0.13, 1),
  inQuad: bezier(0.11, 0, 0.5, 0),
};

// Mulberry32: PRNG con semilla, mismo resultado en cada render.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valor 1D suave, para derivas de cámara.
const NOISE = (() => {
  const r = rng(1983);
  return Array.from({ length: 512 }, () => r() * 2 - 1);
})();
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = NOISE[i & 511], b = NOISE[(i + 1) & 511];
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

// Golpe de cámara que decae tras cada impacto.
export function punch(t, hits, amount = 0.05, decay = 7) {
  let v = 0;
  for (const h of hits) if (t >= h) v += amount * Math.exp(-(t - h) * decay);
  return v;
}

// Colores de la librea HB Audi Team del S1: blanco, amarillo, naranja y marrón, sobre negro.
export const COLOR = {
  ink: '#0D0D0F',
  ink2: '#17171A',
  paper: '#F3F1EC',
  yellow: '#F2B415',
  orange: '#E35A26',
  brown: '#5E2C22',
  grey: '#8E8E92',
};

export const FONT = {
  display: (w, px) => `italic ${w} ${px}px "Archivo Expanded"`,
  wide: (w, px) => `${w} ${px}px "Archivo Expanded"`,
  text: (w, px) => `${w} ${px}px "Archivo"`,
};

export const GRID = { m: 140, top: 110, bottom: 970, w: W - 280 };

export function makeCanvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Dibuja una imagen cubriendo el rectángulo (como object-fit: cover) con zoom y foco.
export function drawCover(ctx, img, x, y, w, h, { zoom = 1, fx = 0.5, fy = 0.5, dx = 0, dy = 0, src } = {}) {
  const s0 = src ?? { x: 0, y: 0, w: img.width, h: img.height };
  const scale = Math.max(w / s0.w, h / s0.h) * zoom;
  const sw = w / scale, sh = h / scale;
  const sx = clamp(s0.x + (s0.w - sw) * fx - dx / scale, s0.x, s0.x + s0.w - sw);
  const sy = clamp(s0.y + (s0.h - sh) * fy - dy / scale, s0.y, s0.y + s0.h - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Texto con revelado por máscara: sube desde la línea base, letra a letra.
export function revealText(ctx, str, x, y, font, color, p, { stagger = 0.04, spacing = 0, align = 'left', lift = 1.05, exit = 0 } = {}) {
  if (p <= 0) return;
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(str);
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]);
  let x0 = x;
  if (align === 'center') x0 = x - m.width / 2;
  if (align === 'right') x0 = x - m.width;
  const asc = size * 0.98, desc = size * 0.38;
  ctx.beginPath();
  ctx.rect(x0 - size, y - asc, m.width + size * 2, asc + desc);
  ctx.clip();
  const n = str.length;
  const span = 1 - stagger * Math.max(0, n - 1);
  for (let i = 0; i < n; i++) {
    const ch = str[i];
    if (ch === ' ') continue;
    const local = clamp((p - i * stagger) / Math.max(span, 0.0001));
    const e = ease.outExpo(local);
    const ex = ease.inExpo(clamp((exit - i * stagger * 0.5) / Math.max(1 - stagger * 0.5 * (n - 1), 0.0001)));
    const off = (1 - e) * size * lift - ex * size * lift;
    const px = x0 + ctx.measureText(str.slice(0, i)).width;
    ctx.fillText(ch, px, y + off);
  }
  ctx.restore();
}

// Ajusta el tamaño de fuente para que una línea quepa en un ancho.
export function fitSize(ctx, str, fontFn, maxW, maxPx, spacing = 0) {
  ctx.save();
  ctx.letterSpacing = `${spacing}px`;
  ctx.font = fontFn(maxPx);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w <= maxW ? maxPx : Math.floor(maxPx * (maxW / w));
}

// Etiqueta pequeña con tracking amplio y fundido + desplazamiento corto.
export function label(ctx, str, x, y, color, p, { size = 34, weight = 600, spacing = 6, align = 'left' } = {}) {
  if (p <= 0) return;
  const e = ease.out(p);
  ctx.save();
  ctx.font = FONT.text(weight, size);
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.globalAlpha *= e;
  ctx.textAlign = align;
  ctx.fillText(str, x, y + (1 - e) * 18);
  ctx.restore();
}

// Las bandas de la librea: naranja y marrón separadas por un filete blanco roto.
export const STRIPES = [
  { c: COLOR.orange, w: 1 },
  { c: COLOR.brown, w: 0.72 },
];
const GAP = 0.2;
export function stripeTotal(u, bands = STRIPES) {
  return bands.reduce((s, b) => s + b.w * u, 0) + GAP * u * (bands.length - 1);
}

// Bandas horizontales que se dibujan de izquierda a derecha (p) y se retiran (q).
export function stripesH(ctx, y, u, p, q = 0, { x0 = -40, x1 = W + 40, skew = 0, stagger = 0.08, bands = STRIPES, gapColor = null } = {}) {
  let yy = y;
  bands.forEach((b, i) => {
    const h = b.w * u;
    const pa = ease.outExpo(clamp((p - i * stagger) / (1 - stagger * 2)));
    const qa = ease.inExpo(clamp((q - i * stagger) / (1 - stagger * 2)));
    const a = lerp(x0, x1, qa), z = lerp(x0, x1, pa);
    if (z > a) {
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.moveTo(a + skew, yy);
      ctx.lineTo(z + skew, yy);
      ctx.lineTo(z, yy + h);
      ctx.lineTo(a, yy + h);
      ctx.closePath();
      ctx.fill();
      if (gapColor && i < bands.length - 1) {
        ctx.fillStyle = gapColor;
        ctx.fillRect(Math.min(a, a + skew), yy + h, z - a + Math.abs(skew), GAP * u);
      }
    }
    yy += h + GAP * u;
  });
}

// Cortinilla diagonal con las bandas: A delante, B detrás; por el filete se ve A.
export function stripeWipe(ctx, p, drawA, drawB, { angle = -0.5, u = 260, bands = [{ c: COLOR.yellow, w: 0.9 }, ...STRIPES] } = {}) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => x * ux + y * uy);
  const qmin = Math.min(...corners), qmax = Math.max(...corners);
  const total = stripeTotal(u, bands);
  const s = lerp(qmin, qmax + total, ease.inOutExpo(p));
  const vx = -uy, vy = ux;
  const L = 5000;
  const band = (q0, q1) => {
    ctx.beginPath();
    ctx.moveTo(q0 * ux - vx * L, q0 * uy - vy * L);
    ctx.lineTo(q0 * ux + vx * L, q0 * uy + vy * L);
    ctx.lineTo(q1 * ux + vx * L, q1 * uy + vy * L);
    ctx.lineTo(q1 * ux - vx * L, q1 * uy - vy * L);
    ctx.closePath();
  };
  drawA();
  ctx.save();
  band(qmin - 10, s - total);
  ctx.clip();
  drawB();
  ctx.restore();
  let q = s;
  for (let i = bands.length - 1; i >= 0; i--) {
    const b = bands[i];
    const w = b.w * u;
    ctx.fillStyle = b.c;
    band(q - w, q + 0.5);
    ctx.fill();
    q -= w;
    if (i > 0) {
      ctx.fillStyle = COLOR.paper;
      band(q - GAP * u, q + 0.5);
      ctx.fill();
      q -= GAP * u;
    }
  }
}

// Desenfoque de movimiento direccional a partir de una capa ya renderizada.
export function smear(ctx, layer, dx, dy, n = 10) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5;
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(layer, dx * k, dy * k);
  }
  ctx.restore();
}

// Grano de película: teselas fijas generadas con semilla, elegidas por fotograma.
let grainTiles = null;
export function grain(ctx, t, amount = 0.07) {
  if (!grainTiles) {
    grainTiles = [];
    for (let k = 0; k < 6; k++) {
      const c = makeCanvas(384, 384);
      const g = c.getContext('2d');
      const img = g.createImageData(384, 384);
      const r = rng(9000 + k);
      for (let i = 0; i < img.data.length; i += 4) {
        // Suma de dos uniformes ≈ distribución triangular, más orgánica.
        const v = 128 + (r() + r() - 1) * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
  }
  const f = Math.floor(t * 24 + 1e-6);
  const r = rng(f * 7919 + 17);
  const tile = grainTiles[f % grainTiles.length];
  const ox = Math.floor(r() * 384), oy = Math.floor(r() * 384);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  for (let y = -oy; y < H; y += 384) for (let x = -ox; x < W; x += 384) ctx.drawImage(tile, x, y);
  ctx.restore();
}

export function vignette(ctx, x, y, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(11,12,15,0)');
  g.addColorStop(1, `rgba(11,12,15,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
