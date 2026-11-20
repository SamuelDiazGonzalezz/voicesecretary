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
  side(t, 'UNA OBRA MAESTRA DE SINCRONIZACIÓN', ['En el milisegundo', 'exacto'], at(153) - 0.1, { y: 360, size: 96, maxW: 560, label: 'La centralita desacopla el diferencial central', labelT: at(154) + 0.4 });
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
  focus(1403, 485, 1.7, 1500, 560, () => drawSection(t, { cx: 1280, cy: 700, s: 1.0, clamp: 1, heat: 0.9, padHeat: 0.75, fluidHeat: 0, ti, heatPath: hp }));
  scrim(860, 0.92);
  const sh = ease.out(prog(t, at(175) + 1.6, at(175) + 2.2));
  if (sh > 0) {
    ctx.save(); ctx.globalAlpha = sh; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1412, 430); ctx.lineTo(1412, 690); ctx.stroke(); ctx.restore();
    label(ctx, 'ESCUDO TÉRMICO', 1412, 400, COLOR.blue, sh, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
  const hot = ease.out(prog(t, at(175) + 0.6, at(175) + 1.1));
  if (hot > 0) { ctx.save(); ctx.globalAlpha = hot; ctx.font = FONT.display(800, 90); ctx.fillStyle = COLOR.fire; ctx.textAlign = 'center'; ctx.fillText('800°', 1291, 1040); ctx.restore(); }
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
  side(t, 'TECNOLOGÍA HÍBRIDA EN LOS RALLY1', ['La frenada', 'regenerativa'], at(179) + 0.1, { y: 380, size: 110, maxW: 560, label: 'El motor eléctrico actúa como un generador', labelT: at(181) + 2.4 });
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
