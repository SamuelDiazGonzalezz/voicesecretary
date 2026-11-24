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

// Tramos del vídeo: a cámara lenta se funden dos fotogramas vecinos.
export const CLIP_N = { c037: 360, escort: 195, quattro: 270, noche: 255, impreza: 180, puma: 180, c3: 240 };
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
const ERAS = ['AÑOS 60', 'AÑOS 70', 'AÑOS 80', 'AÑOS 90', '1997', '2022'];
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

