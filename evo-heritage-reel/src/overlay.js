// Capa 2D: tipografía cinética, HUD, callouts y transiciones. Coordenadas de diseño 3840x2160.
import { C, clamp, lerp, range, ease, keys, noise1, rng } from './util.js';

const W = 3840, H = 2160;
const F = {
  display: (s) => `italic 900 ${s}px "Evo Display"`,
  light: (s) => `200 ${s}px "Evo Light"`,
  bold: (s) => `700 ${s}px "Evo Bold"`,
  semi: (s) => `italic 600 ${s}px "Evo Semi"`,
  mono: (s) => `700 ${s}px "Evo Mono"`,
};

function text(g, str, x, y, font, color, { align = 'left', base = 'alphabetic', track = 0, alpha = 1 } = {}) {
  g.save(); g.globalAlpha *= alpha; g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = track + 'px'; g.fillText(str, x, y); g.restore();
}
// texto revelado por máscara que sube desde una línea base
function maskText(g, str, x, y, font, color, p, opt = {}) {
  if (p <= 0) return;
  g.save(); g.font = font;
  const m = g.measureText(str); const h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 1.25;
  g.beginPath(); g.rect(x - 4000, y - h, 8000, h * 1.15); g.clip();
  text(g, str, x, y + (1 - ease.outExpo(p)) * h, font, color, opt);
  g.restore();
}
function typeOn(g, str, x, y, font, color, p, opt = {}) {
  const n = Math.floor(str.length * clamp(p));
  if (n <= 0) return;
  const R = rng(str.length * 31 + n);
  let s = str.slice(0, n);
  if (p < 1 && n < str.length) s += '▮█▌/#'[(R() * 5) | 0];
  text(g, s, x, y, font, color, opt);
}
function stripes(g, x, y, w, h, colors, gap = 0) {
  colors.forEach((c, i) => { g.fillStyle = c; g.fillRect(x, y + i * (h + gap), w, h); });
}

// ---------------------------------------------------------------- HUD persistente
const SECTIONS = { ignition: ['01', 'IGNICIÓN'], reveal: ['02', 'LA LEYENDA'], stage: ['03', 'TRAMO NOCTURNO'], lineup: ['04', 'LA COLECCIÓN'], merch: ['05', 'DROP 01'], logo: ['06', 'PRÓXIMAMENTE'] };
function hud(g, t, id, ink) {
  const a = id === 'logo' ? 1 - range(t, 17.2, 17.6) : range(t, 0.05, 0.4);
  if (a <= 0) return;
  g.save(); g.globalAlpha = a * 0.85;
  const m = 110, L = 80;
  g.strokeStyle = ink; g.lineWidth = 4;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
  }
  stripes(g, m + 30, m + 34, 60, 8, [C.red, C.yellow], 6);
  text(g, 'EVO HERITAGE', m + 110, m + 62, F.bold(34), ink, { track: 14 });
  const fr = Math.floor(t * 30), ss = Math.floor(t);
  text(g, `TC 00:00:${String(ss).padStart(2, '0')}:${String(fr % 30).padStart(2, '0')}`, W - m - 30, m + 62, F.mono(30), ink, { align: 'right', track: 4 });
  const [n, name] = SECTIONS[id];
  text(g, `${n} / 06`, m + 30, H - m - 36, F.mono(30), ink, { track: 4 });
  text(g, name, m + 220, H - m - 36, F.bold(30), ink, { track: 12 });
  text(g, 'GRUPO B · RETRO · RALLY', W - m - 30, H - m - 36, F.light(30), ink, { align: 'right', track: 12 });
  g.restore();
}

// ---------------------------------------------------------------- transición franjas Martini-style
function wipe(g, t, t0, dur = 0.55) {
  const p = range(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) return;
  const cols = [C.navy, C.light, C.red, C.navy];
  g.save(); g.translate(W / 2, H / 2); g.rotate(-0.22);
  cols.forEach((c, i) => {
    const d = i * 0.07;
    const pin = ease.inOutExpo(clamp((p - d) / 0.5)), pout = ease.inOutExpo(clamp((p - 0.42 - d) / 0.5));
    const x0 = lerp(3000, -3000, pout), x1 = lerp(3000, -3000, pin);
    g.fillStyle = c; g.fillRect(Math.min(x0, x1) - 10, -1800 + i * 0, Math.abs(x1 - x0) + 20, 3600);
  });
  g.restore();
}

// ---------------------------------------------------------------- escenas
function ignition(g, t, r) {
  if (t < 1.5) {
    const i = Math.floor(t / 0.5), lt = t - i * 0.5, p = lt / 0.5;
    const digit = ['3', '2', '1'][i];
    // franjas que barren con cada pulso
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.22);
    [C.navy, C.light, C.red].forEach((c, k) => {
      const q = ease.outExpo(clamp((lt - k * 0.03) / 0.3));
      const x = lerp(-3400, 3400, q); g.globalAlpha = 0.9 * (1 - q * 0.6);
      g.fillStyle = c; g.fillRect(x - 900, -260 + k * 110, 1800 * (1 - q) + 40, k === 0 ? 90 : 40);
    });
    g.restore();
    const s = lerp(1.5, 1, ease.outExpo(clamp(p / 0.5)));
    g.save(); g.translate(W / 2, H / 2 + 40); g.scale(s, s);
    // anillo que se vacía
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 6; g.beginPath(); g.arc(0, -40, 600, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = C.yellow; g.lineWidth = 14; g.beginPath(); g.arc(0, -40, 600, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)); g.stroke();
    text(g, digit, 0, 280, F.display(860), '#ffffff', { align: 'center' });
    g.restore();
    text(g, 'SS01 · SALIDA EN', W / 2, 330, F.bold(44), '#ffffff', { align: 'center', track: 22, alpha: 0.85 });
    text(g, `00:0${3 - i}.${String(Math.floor((1 - p) * 100)).padStart(2, '0')}`, W / 2, 1900, F.mono(64), C.yellow, { align: 'center', track: 10 });
  }
  if (t >= 1.5 && r.lamps > 0) flares(g, r, 1 - range(t, 2.2, 2.5) * 0.6);
  if (t >= 1.65) {
    const p = range(t, 1.7, 2.1), q = range(t, 2.25, 2.45);
    g.save(); g.globalAlpha = 1 - q;
    maskText(g, 'LA LEYENDA', W / 2, H / 2 + 520, F.light(120), '#ffffff', p, { align: 'center', track: 60 });
    maskText(g, 'DESPIERTA', W / 2, H / 2 + 700, F.display(170), '#ffffff', range(t, 1.8, 2.2), { align: 'center', track: 8 });
    g.restore();
  }
}
function flares(g, r, k, glow = true) {
  if (!r.lampsScreen || r.facing < 0.1) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const l of r.lampsScreen) {
    if (l.z > 1) continue;
    const x = l.x * W, y = l.y * H, I = r.lamps * k * clamp(r.facing);
    const gr = g.createLinearGradient(x - 1600, 0, x + 1600, 0);
    gr.addColorStop(0, 'rgba(90,160,255,0)'); gr.addColorStop(0.5, `rgba(170,215,255,${0.55 * I})`); gr.addColorStop(1, 'rgba(90,160,255,0)');
    g.fillStyle = gr; g.fillRect(x - 1600, y - 4, 3200, 8);
    if (!glow) continue;
    const rg = g.createRadialGradient(x, y, 0, x, y, 160);
    rg.addColorStop(0, `rgba(255,250,235,${0.5 * I})`); rg.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = rg; g.fillRect(x - 160, y - 160, 320, 320);
  }
  g.restore();
}
const CALLOUTS = [
  { p: [2.33, 0.86, -0.5], label: 'FAROS AUXILIARES ×4', code: 'A.01', t0: 1.0, dx: 340, dy: -420 },
  { p: [-0.55, 1.5, 0], label: 'TOMA DE AIRE DE TECHO', code: 'A.02', t0: 1.35, dx: -260, dy: -440 },
  { p: [1.25, 0.34, -0.97], label: 'TRACCIÓN TOTAL · 4×4', code: 'A.03', t0: 1.7, dx: 380, dy: 360 },
  { p: [-1.9, 1.25, -0.8], label: 'ALERÓN · ANTI-LAG', code: 'A.04', t0: 2.05, dx: -420, dy: -260 },
];
function reveal(g, t, r) {
  const lt = t - 2.5;
  const ink = '#ffffff';
  // contador de año
  const yp = range(lt, 0.3, 1.5);
  const yr = Math.floor(lerp(1982, 1986, ease.outCubic(yp)));
  const out = range(lt, 3.4, 3.7);
  g.save(); g.globalAlpha = 1 - out;
  if (lt > 0.3) {
    maskText(g, String(yr), 230, 1780, F.display(300), ink, range(lt, 0.3, 0.7), { track: 4 });
    stripes(g, 236, 1820, lerp(0, 980, ease.outExpo(range(lt, 0.45, 1.1))), 14, [C.navy, C.light, C.red], 6);
    typeOn(g, 'LA ERA MÁS SALVAJE DEL RALLY', 236, 1950, F.bold(52), ink, range(lt, 0.6, 1.4), { track: 16 });
  }
  g.restore();
  // callouts anclados a puntos 3D
  for (const c of CALLOUTS) {
    const a = ease.outExpo(range(lt, c.t0, c.t0 + 0.4)) * (1 - range(lt, 3.1 + c.t0 * 0.1, 3.4 + c.t0 * 0.1));
    if (a <= 0 || !r.proj) continue;
    const s = r.proj(...c.p); if (s.z > 1) continue;
    const x = s.x * W, y = s.y * H, ex = x + c.dx * a, ey = y + c.dy * a, ex2 = ex + Math.sign(c.dx) * 520 * ease.outExpo(range(lt, c.t0 + 0.15, c.t0 + 0.6));
    g.save(); g.globalAlpha = a; g.strokeStyle = ink; g.lineWidth = 4;
    g.beginPath(); g.arc(x, y, 22 + (1 - a) * 60, 0, Math.PI * 2); g.stroke();
    g.fillStyle = C.yellow; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x + (ex - x) * 0.08, y + (ey - y) * 0.08); g.lineTo(ex, ey); g.lineTo(ex2, ey); g.stroke();
    const tx = c.dx > 0 ? ex + 10 : ex2 + 10;
    text(g, c.code, tx, ey - 22, F.mono(30), C.yellow, { track: 4 });
    typeOn(g, c.label, tx, ey + 62, F.bold(44), ink, range(lt, c.t0 + 0.2, c.t0 + 0.7), { track: 8 });
    g.restore();
  }
}
const WORDS = [
  { s: 'DERRAPA.', t0: 6.5, x: 260, y: 1880, size: 420, fill: true },
  { s: 'ACELERA.', t0: 7.5, x: 3600, y: 640, size: 420, fill: false, align: 'right' },
  { s: 'A FONDO.', t0: 8.5, x: 1920, y: 1250, size: 640, fill: true, align: 'center' },
  { s: 'SIN DUDAR.', t0: 9.5, x: 3600, y: 1150, size: 380, fill: false, align: 'right' },
];
function stage(g, t, r, TL) {
  for (const w of WORDS) {
    const lt = t - w.t0; if (lt < 0 || lt > 0.95) continue;
    const pin = ease.outExpo(clamp(lt / 0.2)), pout = ease.inExpo(range(lt, 0.8, 0.95));
    const sc = lerp(2.4, 1, pin) * lerp(1, 1.03, lt);
    g.save(); g.translate(w.x + pout * (w.align === 'right' ? 1 : -1) * -900, w.y); g.transform(1, 0, -0.08, 1, 0, 0); g.scale(sc, sc);
    g.font = F.display(w.size); g.textAlign = w.align || 'left'; g.letterSpacing = '0px';
    // estelas
    for (let k = 3; k >= 1; k--) { g.globalAlpha = (1 - pin) * 0.25 * (1 - pout); g.fillStyle = '#fff'; g.fillText(w.s, -k * 40 * (1 - pin) * 6, 0); }
    g.globalAlpha = 1 - pout;
    if (w.fill) { g.fillStyle = '#ffffff'; g.fillText(w.s, 0, 0); }
    else { g.lineWidth = 9; g.strokeStyle = '#ffffff'; g.strokeText(w.s, 0, 0); }
    g.restore();
    if (w.fill) { g.save(); g.globalAlpha = 1 - pout; const bw = 900 * ease.outExpo(range(lt, 0.08, 0.4)); const bx = w.align === 'center' ? w.x - bw / 2 : w.x; stripes(g, bx, w.y + 50, bw, 16, [C.red, C.yellow], 8); g.restore(); }
  }
  // HUD de telemetría: rpm compartidas con el audio
  const rpm = keys(TL.rpm, t), gear = keys(TL.gear, t, true);
  const a = ease.outExpo(range(t, 6.55, 6.9)) * (1 - range(t, 10.25, 10.45));
  g.save(); g.globalAlpha = a;
  const cx = 3330, cy = 1640, R = 270;
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.35)';
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25, ang = (v) => lerp(A0, A1, v / 9000);
  g.beginPath(); g.arc(cx, cy, R, A0, A1); g.stroke();
  g.lineWidth = 20; g.strokeStyle = C.red; g.beginPath(); g.arc(cx, cy, R - 14, ang(7000), A1); g.stroke();
  g.lineWidth = 20; g.strokeStyle = rpm > 7000 ? C.red : '#ffffff'; g.beginPath(); g.arc(cx, cy, R - 44, A0, ang(rpm)); g.stroke();
  for (let i = 0; i <= 9; i++) {
    const an = ang(i * 1000);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + Math.cos(an) * (R + 10), cy + Math.sin(an) * (R + 10)); g.lineTo(cx + Math.cos(an) * (R + 40), cy + Math.sin(an) * (R + 40)); g.stroke();
    text(g, String(i), cx + Math.cos(an) * (R + 85), cy + Math.sin(an) * (R + 85) + 14, F.mono(36), '#fff', { align: 'center' });
  }
  const na = ang(rpm);
  g.strokeStyle = C.yellow; g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(na) * (R - 20), cy + Math.sin(na) * (R - 20)); g.stroke();
  text(g, String(gear), cx, cy + 70, F.display(220), '#fff', { align: 'center' });
  text(g, `${Math.round(rpm)} RPM`, cx, cy + 180, F.mono(34), C.yellow, { align: 'center', track: 4 });
  const kmh = Math.round(118 + (rpm / 7600) * 40 + gear * 6);
  text(g, `${kmh}`, cx - 520, cy + 160, F.display(150), '#fff', { align: 'right' });
  text(g, 'KM/H', cx - 510, cy + 160, F.mono(34), '#fff', { track: 4 });
  // cronómetro de tramo
  const st = 134.37 + (t - 6.5);
  text(g, 'SS03 · TRAMO NOCTURNO', 230, 320, F.bold(36), '#fff', { track: 14 });
  text(g, `${String(Math.floor(st / 60)).padStart(2, '0')}:${(st % 60).toFixed(2).padStart(5, '0')}`, 230, 430, F.mono(84), C.yellow, { track: 6 });
  g.restore();
}
function lineup(g, t, r, LINE) {
  const lt = t - 10.5; const ink = C.ink;
  const out = range(lt, 3.2, 3.45);
  g.save(); g.globalAlpha = 1 - out;
  maskText(g, 'LA COLECCIÓN', 230, 470, F.display(190), ink, range(lt, 0.05, 0.45));
  typeOn(g, '4 LEYENDAS · 1983 — 1986 · INSPIRACIÓN GRUPO B', 236, 560, F.bold(40), ink, range(lt, 0.2, 0.9), { track: 12 });
  const idx = r.idx, l = LINE[idx];
  const sw = range(lt, idx * 1.0 - 0.1, idx * 1.0 + 0.25);
  maskText(g, `Nº ${l.num} — ${l.name}`, 236, 1880, F.display(120), ink, idx === 0 ? range(lt, 0.2, 0.5) : sw, { track: 4 });
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i <= idx ? LINE[i].color : 'rgba(0,0,0,0.12)';
    g.fillRect(240 + i * 190, 1940, 170, 14);
  }
  g.restore();
}
function merch(g, t, r) {
  const lt = t - 14; const idx = r.idx;
  const names = [['HERITAGE', 'BLANCO'], ["GRUPO B '86", 'NEGRO'], ['A FONDO', 'AZUL NOCHE']];
  const ink = C.ink;
  maskText(g, 'DROP', 230, 690, F.display(330), ink, range(lt, 0.05, 0.4));
  maskText(g, '01', 1180, 690, F.display(330), C.red, range(lt, 0.12, 0.47));
  typeOn(g, 'ROPA RALLY · GRUPO B & RETRO', 236, 800, F.bold(48), ink, range(lt, 0.3, 0.9), { track: 16 });
  const c0 = idx;
  const pp = idx === 0 ? range(lt, 0.4, 0.75) : range(lt, idx - 0.0, idx + 0.3);
  maskText(g, names[c0][0], 236, 1300, F.display(180), ink, pp);
  maskText(g, `CAMISETA · ${names[c0][1]}`, 236, 1400, F.light(64), ink, pp, { track: 18 });
  text(g, `0${idx + 1}/03`, 236, 1020, F.mono(44), C.red, { track: 6, alpha: range(lt, 0.3, 0.5) });
  const chips = ['100% ALGODÓN', 'SERIGRAFÍA', 'EDICIÓN LIMITADA'];
  let x = 236;
  chips.forEach((c, i) => {
    const a = ease.outExpo(range(lt, 0.6 + i * 0.12, 0.9 + i * 0.12));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.font = F.bold(36); g.letterSpacing = '8px';
    const w = g.measureText(c).width + 70;
    g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(x, 1560 - (1 - a) * 40, w, 86);
    text(g, c, x + 35, 1616 - (1 - a) * 40, F.bold(36), ink, { track: 8 });
    g.restore(); x += w + 30;
  });
}
function logo(g, t, r) {
  const lt = t - 17; const ink = C.ink;
  typeOn(g, 'TIENDA DE ROPA RALLY · GRUPO B & RETRO', W / 2, 330, F.bold(46), ink, range(lt, 1.5, 2.0), { track: 22, align: 'center' });
  if (lt >= 2) {
    const p = ease.outExpo(clamp((lt - 2) / 0.22));
    const s = lerp(1.9, 1, p);
    g.save(); g.translate(W / 2, 600); g.scale(s, s); g.globalAlpha = clamp(p * 2);
    text(g, 'PRÓXIMAMENTE', 0, 0, F.display(260), ink, { align: 'center', track: 6 });
    g.restore();
    const bw = 1500 * ease.outExpo(range(lt, 2.08, 2.5));
    stripes(g, W / 2 - bw / 2, 660, bw, 16, [C.red, C.yellow], 8);
  }
}

export function drawOverlay(g, t, id, r, ctx) {
  g.setTransform(g.canvas.width / W, 0, 0, g.canvas.height / H, 0, 0);
  g.clearRect(0, 0, W, H);
  const light = id === 'lineup' || id === 'merch' || id === 'logo';
  if (id === 'ignition') ignition(g, t, r);
  if (id === 'reveal') { reveal(g, t, r); flares(g, r, 0.3, false); }
  if (id === 'stage') stage(g, t, r, ctx.TL);
  if (id === 'lineup') lineup(g, t, r, ctx.LINE);
  if (id === 'merch') merch(g, t, r);
  if (id === 'logo') logo(g, t, r);
  hud(g, t, id, light ? C.ink : '#ffffff');
  wipe(g, t, 6.25, 0.46);
}

// ---------------------------------------------------------------- estampados de las camisetas
export function makePrintCanvases(portrait, drawSideProfile) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = 1024; return c; };
  // A: blanca — retrato del coche + franja + logotipo (ref. Evo Heritage)
  const a = mk(), ga = a.getContext('2d');
  text(ga, 'EVO', 512, 200, F.display(150), C.navy, { align: 'center', track: 6 });
  ga.save(); ga.translate(512, 690); ga.rotate(-0.16);
  ga.fillStyle = '#111'; ga.fillRect(-470, 52, 940, 12); ga.fillStyle = C.yellow; ga.fillRect(-460, 26, 940, 26); ga.fillStyle = C.red;
  ga.beginPath(); ga.moveTo(-500, 70); ga.lineTo(-330, 70); ga.lineTo(-250, 0); ga.lineTo(-360, 34); ga.lineTo(-430, 6); ga.closePath(); ga.fill();
  ga.restore();
  ga.drawImage(portrait, 22, 210, 980, 612);
  text(ga, 'H E R I T A G E', 560, 850, F.display(70), '#6c7178', { align: 'center', track: 10 });
  stripes(ga, 262, 885, 500, 10, [C.navy, C.light, C.red], 5);
  text(ga, 'GRUPO B · DESDE 1982', 512, 975, F.bold(30), '#111', { align: 'center', track: 10 });
  // B: negra — 1986 Grupo B, bandas con siluetas
  const b = mk(), gb = b.getContext('2d');
  text(gb, '1986', 150, 210, F.display(150), C.blue);
  text(gb, 'GRUPO B', 560, 150, F.display(72), C.blue);
  text(gb, 'RALLY CARS', 562, 205, F.bold(40), C.red, { track: 6 });
  const bands = [C.light, C.blue, C.yellow, C.navy]; const keys4 = ['heritage', 'lion', 'quattro', 'manta'];
  bands.forEach((c, i) => { gb.fillStyle = c; gb.fillRect(150, 260 + i * 175, 724, 140); drawSideProfile(gb, keys4[i], 560, 260 + i * 175 + 128, 86); });
  // C: azul noche — A FONDO
  const c = mk(), gc = c.getContext('2d');
  text(gc, 'SI DUDAS,', 512, 250, F.bold(70), '#f1ece1', { align: 'center', track: 14 });
  text(gc, 'A FONDO', 500, 460, F.display(180), '#f1ece1', { align: 'center' });
  stripes(gc, 150, 520, 724, 22, [C.light, C.red, C.yellow], 10);
  drawSideProfile(gc, 'heritage', 512, 880, 150);
  text(gc, 'EVO HERITAGE · DESDE 1982', 512, 960, F.bold(30), '#f1ece1', { align: 'center', track: 10 });
  return [a, b, c];
}
