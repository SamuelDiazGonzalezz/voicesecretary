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
  revealText(ctx, 'Las centralitas en el rally', W / 2, 860, FONT.display(800, 112), COLOR.paper, prog(t, 0.55, 1.3), { align: 'center', stagger: 0.016 });
  stripesH(ctx, 910, 10, prog(t, 0.95, 1.65), 0, { x0: W / 2 - 260, x1: W / 2 + 260 });
}

// Hasta 1.000 veces por segundo: cuatro canales de cálculo con sus pulsos.
function sRate(t, s0) {
  bg(); dots(0.03);
  tag(t, 'LA CENTRALITA DE UN COCHE DEL WRC CALCULA', M, 200, at(3) - 0.2);
  const rows = [['INYECCIÓN', at(3) + 2.2, COLOR.yellow], ['ENCENDIDO', at(4), COLOR.fire], ['PRESIÓN DEL TURBO', at(5) + 0.1, COLOR.blue], ['REPARTO DE PAR', at(5) + 1.6, COLOR.paper]];
  const x0 = M, x1 = W - M, y0 = 330;
  rows.forEach(([name, t0, col], i) => {
    const y = y0 + i * 120;
    const a = ease.out(prog(t, t0, t0 + 0.5));
    if (a <= 0) return;
    label(ctx, name, x0, y + 8, COLOR.paper, a, { size: 26, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(232,233,230,0.14)'; ctx.fillRect(560, y, x1 - 560, 2);
    // Pulsos que avanzan a ritmo fijo: cada uno es un cálculo.
    const speed = 380, gap = 34;
    for (let k = 0; k < 40; k++) {
      const x = 560 + ((k * gap + (t - t0) * speed) % (x1 - 560));
      const rise = ease.outExpo(prog(t, t0 + k * 0.02, t0 + k * 0.02 + 0.4));
      ctx.fillStyle = col; ctx.fillRect(x, y - 26 * rise, 6, 26 * rise);
    }
    ctx.restore();
  });
  const cnt = prog(t, at(5) + 2.8, at(5) + 4.0);
  if (cnt > 0) {
    ctx.save(); ctx.globalAlpha = ease.out(prog(t, at(5) + 2.8, at(5) + 3.1));
    ctx.font = FONT.display(800, 150); ctx.fillStyle = COLOR.paper; ctx.textAlign = 'left';
    ctx.fillText(fmt(1000 * ease.out(cnt)), M, 940); ctx.restore();
    label(ctx, 'veces por segundo', M + 420, 930, COLOR.yellow, prog(t, at(5) + 3.2, at(5) + 3.7), { size: 48, spacing: 0, weight: 700 });
  }
}

// Si el motor es el músculo, la ECU es el sistema nervioso central.
function sNervous(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1290, cy: 560, s: 1.05 };
  const nv = ease.inOut(prog(t, at(7) + 1.8, at(7) + 4.2));
  drawCarECU(t, { ...o, appear: ease.out(prog(t, s0, s0 + 0.6)), nerves: nv, sensors: [1, 1, 1, 1], ecuGlow: prog(t, at(7), at(7) + 1), power: 0 });
  const [mx, my] = carToScreen(o, 195, -25);
  pin(t, mx, my, mx + 60, 160, 'EL MÚSCULO', at(6) + 0.5, COLOR.paper);
  side(t, null, ['ECU'], at(7) + 0.2, { y: 400, size: 200 });
  label(ctx, 'Engine Control Unit', M, 480, DIM, prog(t, at(7) + 1.0, at(7) + 1.5), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'El sistema nervioso', M, 640, COLOR.paper, prog(t, at(7) + 2.8, at(7) + 3.3), { size: 56, spacing: 0, weight: 700 });
  label(ctx, 'central', M, 710, COLOR.yellow, prog(t, at(7) + 3.3, at(7) + 3.8), { size: 56, spacing: 0, weight: 700 });
}

// Abrir la carcasa: la ECU en 3D gira, la tapa sube y la placa sale.
function sOpenECU(t, s0, s1) {
  bg(); dots(0.03);
  const u = prog(t, s0, s1);
  const open = ease.inOut(prog(t, at(13) + 1.2, at(13) + 3.4));
  const lift = ease.inOut(prog(t, at(13) + 2.6, at(13) + 4.6));
  const f = drawECU3D(t, { cx: 1290, cy: 760, s: 1.1, yaw: lerp(-0.85, -0.38, ease.inOut(u)), pitch: lerp(0.5, 0.72, ease.inOut(u)), open, lift, pulse: prog(t, at(13) + 4.6, at(13) + 5.4), appear: ease.out(prog(t, s0, s0 + 0.6)) });
  ecuLabels(t, f, [['mcu', 1440, 600, 'MICROCONTROLADOR'], ['flash', 820, 520, 'MEMORIA FLASH'], ['can1', 820, 700, 'TRANSCEPTORES CAN'], ['drv3', 1440, 720, 'ETAPAS DE POTENCIA']], at(13) + 5.0, 0.45);
  side(t, 'HOY VAMOS A', ['Abrir', 'la carcasa'], at(13) + 0.2, { y: 300, size: 110, maxW: 560 });
  label(ctx, 'Del carburador', M, 560, DIM, prog(t, at(13) + 6.4, at(13) + 6.9), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'a la mecatrónica de los Rally1', M, 612, COLOR.paper, prog(t, at(13) + 7.6, at(13) + 8.1), { size: 40, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Años 60 y 70: carburadores.

function sCarb(t, s0) {
  bg(); dots(0.03);
  const ap = ease.out(prog(t, s0, s0 + 0.6));
  drawCarb(t, { cx: 1270, cy: 440, s: 0.8, appear: ap, air: 1, fuel: ease.out(prog(t, at(18) + 1.5, at(18) + 2.5)), labels: prog(t, at(18) + 0.3, at(19) + 4.2), atm: prog(t, at(18) + 2.2, at(18) + 3.2) });
  label(ctx, 'PRESIÓN ATMOSFÉRICA', 1270 - 360 * 0.8, 440 + 140 * 0.8, COLOR.blue, prog(t, at(18) + 2.6, at(18) + 3.1), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'LA MEZCLA DE AIRE Y GASOLINA', ['Dependía de', 'la física'], at(18) + 0.1, { y: 760, size: 84, maxW: 560 });
  label(ctx, 'Presión, chiclés y depresión', M, 920, DIM, prog(t, at(19) + 2.4, at(19) + 2.9), { size: 36, spacing: 0, weight: 600 });
}

// Montecarlo: el puerto de montaña.
function sAltitude(t, s0) {
  bg(); dots(0.03);
  const a = ease.out(prog(t, s0 + 0.1, s0 + 0.7));
  const x0 = 760, x1 = W - M, yb = 700, ytop = 300;
  const prof = (u) => yb - (ytop - yb) * -1 * (0.08 + 0.92 * (u + 0.06 * Math.sin(u * 14) * u));
  const climb = ease.inOut(prog(t, at(22) + 0.4, at(24) + 3.6));
  // Perfil del puerto.
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.moveTo(x0, yb);
  for (let i = 0; i <= 120; i++) { const u = i / 120; ctx.lineTo(lerp(x0, x1, u), prof(u)); }
  ctx.lineTo(x1, yb); ctx.closePath(); ctx.fillStyle = 'rgba(232,233,230,0.06)'; ctx.fill();
  ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3;
  ctx.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120; if (i) ctx.lineTo(lerp(x0, x1, u), prof(u)); else ctx.moveTo(x0, prof(0)); } ctx.stroke();
  ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 6;
  ctx.beginPath(); for (let i = 0; i <= 120 * climb; i++) { const u = i / 120; if (i) ctx.lineTo(lerp(x0, x1, u), prof(u)); else ctx.moveTo(x0, prof(0)); } ctx.stroke();
  const cxp = lerp(x0, x1, climb), cyp = prof(climb);
  ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  label(ctx, 'ALTITUD', x1, ytop - 40, DIM, a, { size: 22, spacing: 6, weight: 700, align: 'right' });
  // Muestra de aire: menos moléculas por volumen al subir.
  const dens = 1 - 0.45 * climb;
  const R = rng(9);
  const bx = x0, by = 790, bw = 260, bh = 200;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(23) - 0.3, at(23) + 0.3));
  ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = COLOR.blue;
  for (let i = 0; i < 70; i++) { const x = bx + 10 + R() * (bw - 20), y = by + 10 + R() * (bh - 20); if (R() < dens) { ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + i) * 3, y + Math.cos(t * 2.3 + i) * 3, 5, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  label(ctx, 'DENSIDAD DEL AIRE', bx, by - 18, COLOR.blue, prog(t, at(23) - 0.3, at(23) + 0.3), { size: 22, spacing: 6, weight: 700 });
  const am = ease.out(prog(t, at(24) - 0.2, at(24) + 0.4));
  meter(t, 1120, 860, 330, 0.4 + 0.55 * climb, am, 'MEZCLA MÁS RICA', COLOR.fire);
  meter(t, 1500, 860, 280, 1 - 0.35 * prog(t, at(24) + 2.0, at(24) + 4.0), ease.out(prog(t, at(24) + 1.8, at(24) + 2.3)), 'POTENCIA', COLOR.yellow);
  side(t, 'SI SUBÍAS UN PUERTO DE MONTAÑA', ['Rally de', 'Montecarlo'], at(22) + 0.2, { y: 400, size: 96, maxW: 560 });
  label(ctx, 'El coche perdía', M, 640, DIM, prog(t, at(24) + 2.4, at(24) + 2.9), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'docenas de caballos', M, 700, COLOR.red, prog(t, at(24) + 2.8, at(24) + 3.3), { size: 52, spacing: 0, weight: 700 });
}

// De aspirada por vacío a inyectada a presión.
function sSuckPress(t, s0) {
  bg(); dots(0.03);
  const L = ease.out(prog(t, s0 + 0.1, s0 + 0.7)), Rr = ease.out(prog(t, at(27) + 2.4, at(27) + 3.0));
  // Izquierda: surtidor que aspira por la depresión.
  ctx.save(); ctx.globalAlpha *= L;
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(180, 380); ctx.quadraticCurveTo(480, 470, 780, 380); ctx.moveTo(180, 700); ctx.quadraticCurveTo(480, 610, 780, 700); ctx.stroke();
  ctx.fillStyle = '#8C9096'; ctx.fillRect(468, 600, 24, 120);
  ctx.restore();
  for (let k = -1; k <= 1; k++) flowLine(poly([[200, 540 + k * 50], [480, 540 + k * 30], [760, 540 + k * 50]]), t, { color: COLOR.blue, width: 5, amount: L, speed: 1.2, offset: k * 20 });
  arrowPath([[480, 820], [480, 640]], ease.out(prog(t, s0 + 0.8, s0 + 1.6)), COLOR.yellow, 6, 18);
  const R = rng(2);
  ctx.save();
  for (let i = 0; i < 20; i++) { const ph = (t * 0.6 + R()) % 1; ctx.globalAlpha = L * (1 - ph); ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(480 + ph * 260, 590 - ph * 40 + (R() - 0.5) * 30 * ph, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  label(ctx, 'ASPIRADA POR VACÍO', 480, 300, COLOR.paper, L, { size: 26, spacing: 6, weight: 700, align: 'center' });
  // Derecha: inyector a presión.
  ctx.save(); ctx.globalAlpha *= Rr;
  ctx.translate(1440, 420); ctx.rotate(Math.PI / 2);
  rr(ctx, -150, -26, 150, 52, 10); ctx.fillStyle = COLOR.paper; ctx.fill(); ctx.fillStyle = COLOR.yellow; ctx.fillRect(-150, -26, 36, 52);
  const R2 = rng(Math.floor(t * 30));
  for (let k = 0; k < 60; k++) { const d = 10 + R2() * 360, a = (R2() - 0.5) * 0.45; ctx.globalAlpha = Rr * (1 - d / 380); ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 4.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  arcGauge(t, 1440, 250, 70, 0.8 * Rr, 1, Rr, 8, COLOR.yellow);
  label(ctx, 'INYECTADA A PRESIÓN', 1440, 900, COLOR.paper, Rr, { size: 26, spacing: 6, weight: 700, align: 'center' });
  ctx.save(); ctx.globalAlpha *= Rr * 0.5; ctx.fillStyle = COLOR.paper; ctx.fillRect(W / 2 - 1, 260, 2, 600); ctx.restore();
}

// La ROM soldada a mano en el parque de asistencia.
function sSolder(t, s0) {
  bg(); dots(0.03);
  const out = prog(t, at(32) + 0.6, at(32) + 2.0), inn = prog(t, at(32) + 2.0, at(32) + 3.4), sold = prog(t, at(32) + 3.6, at(32) + 6.8);
  drawAnalogBoard(t, { cx: 1290, cy: 600, s: 1.1, appear: ease.out(prog(t, s0, s0 + 0.6)), out, inn, solder: sold, iron: ease.out(prog(t, at(32) + 3.2, at(32) + 3.7)) * (1 - prog(t, at(32) + 6.8, at(32) + 7.2)), highlight: prog(t, at(31) + 1.4, at(31) + 2.0) * (1 - prog(t, at(32) + 0.4, at(32) + 0.8)) });
  side(t, 'PARA CAMBIAR EL MAPA DE ENCENDIDO', ['Soldar', 'una ROM nueva'], at(31) + 0.1, { y: 380, size: 100, maxW: 560 });
  label(ctx, 'en pleno parque', M, 640, DIM, prog(t, at(32) + 4.6, at(32) + 5.1), { size: 40, spacing: 0, weight: 600 });
  label(ctx, 'de asistencia', M, 692, DIM, prog(t, at(32) + 4.8, at(32) + 5.3), { size: 40, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Grupo A: brida restrictora, turbo lag y anti-lag.

function sRestrictor(t, s0) {
  bg(); dots(0.03);
  const a = ease.out(prog(t, s0, s0 + 0.6));
  const choke = ease.inOut(prog(t, at(34) + 3.6, at(34) + 5.4));
  const y = 560, x0 = 700, x1 = 1640, xr = 1050;
  // Conducto que se estrecha en la brida.
  const half = (x) => lerp(150, lerp(150, 52, choke), Math.exp(-(((x - xr) / 70) ** 2)));
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = COLOR.line; ctx.lineWidth = 3;
  for (const sg of [-1, 1]) { ctx.beginPath(); for (let i = 0; i <= 100; i++) { const x = lerp(x0, x1 - 200, i / 100); if (i) ctx.lineTo(x, y + sg * half(x)); else ctx.moveTo(x, y + sg * half(x)); } ctx.stroke(); }
  ctx.fillStyle = COLOR.yellow;
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(xr - 40, y + sg * 160); ctx.lineTo(xr + 40, y + sg * 160); ctx.lineTo(xr + 6, y + sg * (half(xr) + 2)); ctx.lineTo(xr - 6, y + sg * (half(xr) + 2)); ctx.closePath(); ctx.globalAlpha = a * choke; ctx.fill(); }
  ctx.restore();
  for (let k = -3; k <= 3; k++) {
    const pts = []; for (let i = 0; i <= 60; i++) { const x = lerp(x0, x1 - 220, i / 60); pts.push([x, y + (k / 3.6) * (half(x) - 14)]); }
    flowLine(poly(pts), t, { color: COLOR.blue, width: 4, amount: a, speed: lerp(1.3, 0.6, choke), offset: k * 11 });
  }
  const th = spinRot(t, s0, 4, lerp(4, 2.4, choke), 2);
  drawWheel(th, 0.4, x1 - 60, y, 120, a, { housing: true, blades: 12 });
  label(ctx, 'COMPRESOR', x1 - 60, y + 230, COLOR.paper, a, { size: 22, spacing: 6, weight: 700, align: 'center' });
  label(ctx, 'BRIDA RESTRICTORA', xr, y - 200, COLOR.yellow, prog(t, at(34) + 3.8, at(34) + 4.3), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'BLOQUES DE 2 LITROS CON TURBOCOMPRESOR', ['Una brida', 'que ahogaba', 'el aire'], at(34) + 3.4, { y: 330, size: 96, maxW: 520 });
}

// El turbo lag: el piloto suelta, los gases caen, el turbo se para y vuelve tarde.
function sLag(t, s0) {
  bg(); dots(0.03);
  const tLift = at(36) + 0.8, tBack = at(39) + 0.2;
  const thr = (tt) => (tt < tLift ? 1 : tt < tBack ? 0 : 1);
  const boostAt = (tt) => {
    if (tt < tLift) return 1;
    if (tt < tBack) return Math.exp(-(tt - tLift) * 0.9);
    const b0 = Math.exp(-(tBack - tLift) * 0.9), d = tt - tBack;
    return d < 1.6 ? b0 * Math.exp(-d * 0.5) : lerp(b0 * Math.exp(-0.8), 1, ease.inOut(clamp((d - 1.6) / 1.2)));
  };
  const ex = 0.2 + 0.8 * boostAt(t);
  const th = spinAngle(t, s0, (u) => 0.2 + 3.2 * boostAt(u));
  drawTurboSection(t, { cx: 1240, cy: 430, s: 0.62, th, air: ex, ex, labels: 0 });
  // Gráfica: acelerador y presión del turbo frente al tiempo.
  const gx = 760, gy = 700, gw = 1020, gh = 220, T0 = s0, T1 = s0 + 14;
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TIEMPO' });
  const sweep = prog(t, T0, T1);
  trace2(gx, gy, gw, gh, (u) => thr(lerp(T0, T1, u)) * 0.92, sweep, COLOR.paper, 3);
  trace2(gx, gy, gw, gh, (u) => boostAt(lerp(T0, T1, u)) * 0.8, sweep, COLOR.yellow, 5);
  label(ctx, 'ACELERADOR', gx + 12, gy - 6, COLOR.paper, prog(t, s0 + 0.6, s0 + 1.1), { size: 20, spacing: 6, weight: 700 });
  label(ctx, 'PRESIÓN DEL TURBO', gx + 220, gy - 6, COLOR.yellow, prog(t, s0 + 0.8, s0 + 1.3), { size: 20, spacing: 6, weight: 700 });
  // Vacío de potencia.
  const xb = gx + gw * (tBack - T0) / (T1 - T0), xe = gx + gw * (tBack + 2.2 - T0) / (T1 - T0);
  const v = ease.out(prog(t, at(40) + 0.3, at(40) + 0.9));
  if (v > 0) { ctx.save(); ctx.globalAlpha *= v * 0.35; ctx.fillStyle = COLOR.red; ctx.fillRect(xb, gy, xe - xb, gh); ctx.restore(); }
  label(ctx, 'VACÍO DE POTENCIA', (xb + xe) / 2, gy - 16, COLOR.red, v, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'EL GRAN PROBLEMA TÉCNICO', ['Turbo lag'], s0 + 0.3, { y: 330, size: 130, maxW: 560 });
  const steps = [['Suelta el acelerador', at(36) + 0.6], ['Los gases caen', at(37)], ['El turbo se detiene', at(38)], ['Vuelve a acelerar…', at(39)]];
  steps.forEach(([s, t0], i) => label(ctx, s, M, 480 + i * 56, i === 3 ? COLOR.paper : DIM, prog(t, t0, t0 + 0.5), { size: 36, spacing: 0, weight: 600 }));
}

// El anti-lag, por partes. Estado común: el pedal se levanta en at(44)+0.6; el encendido se corta en at(46)+1.6.
const ALS_T0 = () => at(43);
function alsState(t) {
  const lift = prog(t, at(44) + 0.6, at(44) + 1.1);
  const cutI = prog(t, at(46) + 1.6, at(46) + 2.0);
  const injOn = 1;
  const thr = lerp(1, 0.22, lift);
  const als = ease.out(prog(t, at(46) + 4.0, at(46) + 5.5));
  return { lift, cutI, injOn, thr, als };
}
function alsPanel(t, x, y, appear, st) {
  if (appear <= 0) return;
  const rows = [['ENCENDIDO', st.cutI > 0.5 ? 'CORTADO' : 'ACTIVO', st.cutI > 0.5 ? COLOR.red : COLOR.paper],
    ['INYECCIÓN', 'ACTIVA', COLOR.yellow], ['MARIPOSA', st.lift > 0.5 ? 'LIGERAMENTE ABIERTA' : 'ABIERTA', COLOR.blue]];
  rows.forEach(([k, v, col], i) => {
    const yy = y + i * 52;
    label(ctx, k, x, yy, DIM, appear, { size: 22, spacing: 6, weight: 700 });
    label(ctx, v, x + 250, yy, col, appear, { size: 22, spacing: 6, weight: 800 });
  });
}
function sALS1(t, s0) {
  bg(); dots(0.03);
  const st = alsState(t);
  const crank = engineAngle(t, s0, 1.2);
  const th = spinRot(t, s0, 3.2, 3.2, 1);
  drawCylinder(t, { cx: 1010, cy: 700, s: 0.72, appear: ease.out(prog(t, s0, s0 + 0.6)), crank, spark: 1, inj: 1, thr: st.thr, exhaust: lerp(1, 0.35, st.lift), th, dth: 0.5, labels: prog(t, s0 + 0.4, s0 + 2.0) });
  drawPedal(260, 640, 1 - st.lift, { appear: ease.out(prog(t, at(44), at(44) + 0.5)), s: 0.7, floor: true });
  label(ctx, 'ACELERADOR', 260, 590, DIM, prog(t, at(44), at(44) + 0.5), { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'LOS INGENIEROS PROGRAMARON LA CENTRALITA', ['Al levantar', 'el pie'], at(43) + 0.2, { y: 210, size: 80, maxW: 620 });
  label(ctx, 'ocurría una magia diabólica', M, 960, COLOR.fire, prog(t, at(45) + 0.4, at(45) + 0.9), { size: 44, spacing: 0, weight: 700 });
}
function sALS2(t, s0) {
  bg(); dots(0.03);
  const st = alsState(t);
  const crank = engineAngle(t, s0 - 10, 1.2);
  const th = spinRot(t, s0, 2.2, 2.6, 4);
  drawCylinder(t, { cx: 1010, cy: 700, s: 0.72, crank, spark: 1 - st.cutI, inj: 1, thr: st.thr, exhaust: 0.4, als: st.als * 0.6, th, dth: 0.4, labels: 1 });
  alsPanel(t, M, 820, ease.out(prog(t, at(46) + 0.8, at(46) + 1.4)), st);
  side(t, 'LA ECU ORDENABA', ['Cortar el encendido,', 'seguir inyectando'], at(46) + 0.2, { y: 210, size: 76, maxW: 680, colors: [COLOR.red, COLOR.yellow] });
  label(ctx, 'y mantener la mariposa ligeramente abierta', M, 1000, DIM, prog(t, at(46) + 6.4, at(46) + 6.9), { size: 34, spacing: 0, weight: 600 });
}
function sALS3(t, s0) {
  bg(); dots(0.03);
  const crank = engineAngle(t, s0 - 20, 1.2);
  const th = spinRot(t, s0, 2.8, 3.6, 3);
  // Detonaciones antes de la turbina: instantes fijos con semilla.
  const R = rng(17), hits = []; let tt = at(47) + 3.6; while (tt < at(48) + 2) { hits.push(tt); tt += 0.35 + R() * 0.55; }
  let k = 0, hx = 0;
  for (const h of hits) { if (t >= h && t < h + 0.45) { k = Math.max(k, 1 - (t - h) / 0.45); hx = h; } }
  const zoom = lerp(1, 1.35, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2)));
  focus(1300, 400, zoom, lerp(1100, 1180, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2))), lerp(560, 600, ease.inOut(prog(t, at(47) + 2.6, at(47) + 4.2))), () => {
    drawCylinder(t, { cx: 900, cy: 640, s: 0.78, crank, spark: 0, inj: 1, thr: 0.22, exhaust: 0.4, als: 1, th, dth: 0.5, hot: 0.6 + 0.4 * ease.out(prog(t, at(47) + 1.2, at(47) + 2.6)), labels: 0 });
    const bx = 900 + 760 * 0.78, by = 640 - 330 * 0.78;
    burst(bx, by, 70 * k + 10 * k, k, hx);
    shock(bx, by, k > 0 ? 1 - k : 0, 220);
  });
  scrim(860, 0.88);
  side(t, 'ESA GASOLINA SIN QUEMAR', ['Detonaba antes', 'de la turbina'], at(47) + 3.8, { y: 330, size: 90, maxW: 620, colors: [COLOR.paper, COLOR.fire] });
  label(ctx, 'Más de 800 grados', M, 560, COLOR.fire, prog(t, at(47) + 2.2, at(47) + 2.7), { size: 48, spacing: 0, weight: 700 });
  label(ctx, 'en los colectores de escape', M, 616, DIM, prog(t, at(47) + 2.5, at(47) + 3.0), { size: 36, spacing: 0, weight: 600 });
}
function sALS4(t, s0) {
  bg(); dots(0.03);
  const th = spinRot(t, s0, 6, 6, 1);
  drawWheel(th, 1.2, 1380, 560, 270, ease.out(prog(t, s0, s0 + 0.6)), { housing: true, hot: 0.5, blades: 12 });
  const R = rng(23); let tt = s0 + 0.4, k = 0;
  while (tt < s0 + 9) { if (t >= tt && t < tt + 0.4) k = Math.max(k, 1 - (t - tt) / 0.4); tt += 0.4 + R() * 0.6; }
  shock(1380, 560, k > 0 ? 1 - k : 0, 520);
  tag(t, 'LA ONDA EXPANSIVA MANTENÍA EL TURBO A', M, 260, at(48) + 0.3);
  const c = ease.out(prog(t, at(48) + 2.2, at(48) + 3.4));
  if (c > 0) { ctx.save(); ctx.globalAlpha = clamp(c * 3); ctx.font = FONT.display(800, 150); ctx.fillStyle = COLOR.paper; ctx.fillText(fmt(100000 * c), M, 450); ctx.restore(); }
  label(ctx, 'revoluciones por minuto', M, 530, COLOR.yellow, prog(t, at(48) + 3.0, at(48) + 3.5), { size: 44, spacing: 0, weight: 700 });
  label(ctx, 'incluso con el coche frenando', M, 640, DIM, prog(t, at(48) + 5.0, at(48) + 5.5), { size: 40, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// World Rally Car: el cerebro de todo el vehículo.

function sBrainCar(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const d = [prog(t, at(55) + 1.4, at(55) + 1.9), prog(t, at(56), at(56) + 0.4), prog(t, at(56) + 0.5, at(56) + 0.9)];
  drawCarECU(t, { ...o, appear: ease.out(prog(t, s0, s0 + 0.6)), nerves: 0, power: prog(t, at(54) + 4.0, at(54) + 5.0), ecuGlow: prog(t, at(54) + 3.0, at(54) + 4.0), diffs: d });
  [[300, 'DELANTERO'], [0, 'CENTRAL'], [-300, 'TRASERO']].forEach(([x, s], i) => { const [sx, sy] = carToScreen(o, x, 0); pin(t, sx, sy + 40, sx, 900, s, [at(55) + 1.4, at(56), at(56) + 0.5][i], COLOR.fire, 'center'); });
  side(t, 'LAS CENTRALITAS DEJARON DE SER MERAS CONTROLADORAS DEL MOTOR', ['El cerebro', 'de todo', 'el vehículo'], at(54) + 2.6, { y: 330, size: 96, maxW: 520 });
}

function sSensorsWRC(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const sn = [prog(t, at(57), at(57) + 0.6), prog(t, at(58), at(58) + 0.6), prog(t, at(59), at(59) + 0.6), prog(t, at(59) + 1.6, at(59) + 2.2)];
  const slipK = prog(t, at(60) + 0.4, at(60) + 1.0);
  const slip = [0.18, 0.22, 0.12, 0.15].map((v, i) => v + 0.08 * Math.sin(t * 2.4 + i * 1.7));
  drawCarECU(t, { ...o, nerves: 1, sensors: sn, power: 0.7, ecuGlow: slipK });
  slipBars(t, o, slip, slipK);
  const names = [['VELOCIDAD DE RUEDA', 300, -226, at(57) + 0.3], ['ACELERÓMETRO DE TRES EJES', -20, 70, at(58) + 0.2], ['ÁNGULO DEL VOLANTE', 150, -110, at(59) + 0.2], ['PRESIÓN DE FRENADA', 230, -170, at(59) + 1.8]];
  const lab = [[1780, 200, 'right'], [870, 960, 'left'], [870, 200, 'left'], [1780, 960, 'right']];
  names.forEach(([s, x, y, t0], i) => { const [sx, sy] = carToScreen(o, x, y); pin(t, sx, sy, lab[i][0], lab[i][1], s, t0, COLOR.blue, lab[i][2]); });
  side(t, 'MEDIANTE SENSORES', ['La ECU calculaba', 'el deslizamiento'], at(57) + 0.1, { y: 330, size: 80, maxW: 560 });
  label(ctx, 'de cada neumático, en tiempo real', M, 520, DIM, prog(t, at(60) + 1.4, at(60) + 1.9), { size: 34, spacing: 0, weight: 600 });
}

function sFrontSlip(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  const k = ease.out(prog(t, at(61) + 0.6, at(61) + 1.4));
  drawCarECU(t, { ...o, nerves: 1, sensors: [1, 1, 1, 1], power: 0.8, split: lerp(0.5, 0.25, k), slip: [k, k, 0, 0], ecuGlow: k });
  slipBars(t, o, [0.2 + 0.7 * k, 0.2 + 0.68 * k, 0.15, 0.17], 1);
  side(t, 'EN UNA CURVA DE GRAVA', ['El eje delantero', 'pierde tracción'], at(61) + 0.1, { y: 330, size: 80, maxW: 600, colors: [COLOR.paper, COLOR.red] });
}

function sClutch(t, s0) {
  bg(); dots(0.03);
  const t0 = at(62) + 5.0;
  const oil = ease.out(prog(t, t0, t0 + 0.6)), press = prog(t, t0 + 0.3, t0 + 1.2), tq = prog(t, t0 + 1.0, t0 + 1.6);
  drawClutchPack(t, { cx: 1180, cy: 560, s: 0.92, appear: ease.out(prog(t, s0, s0 + 0.6)), press, oil, torque: tq, labels: prog(t, s0 + 0.5, s0 + 2.5) });
  label(ctx, 'AL EJE TRASERO', 1180 + 600 * 0.92, 560 - 60, COLOR.yellow, tq, { size: 22, spacing: 6, weight: 700, align: 'center' });
  side(t, 'DEL DIFERENCIAL CENTRAL', ['Embragues', 'multidisco'], at(62) + 2.9, { y: 300, size: 96, maxW: 560 });
  // Cronómetro del cierre: menos de 10 ms.
  const ms = 9.6 * ease.out(prog(t, t0, t0 + 1.2));
  if (t > t0 - 0.2) {
    ctx.save(); ctx.globalAlpha = ease.out(prog(t, t0 - 0.2, t0 + 0.2));
    ctx.font = FONT.display(800, 130); ctx.fillStyle = COLOR.paper; ctx.fillText(ms.toFixed(1).replace('.', ','), M, 720); ctx.restore();
    label(ctx, 'MILISEGUNDOS', M, 780, COLOR.yellow, prog(t, t0, t0 + 0.4), { size: 26, spacing: 7, weight: 700 });
    label(ctx, 'menos de 10 para transferir par atrás', M, 850, DIM, prog(t, t0 + 1.4, t0 + 1.9), { size: 34, spacing: 0, weight: 600 });
  }
}

// El coche rota de forma neutra: trayectoria real frente a la del subviraje.
function sNeutral(t, s0) {
  bg(); dots(0.03);
  const cxr = 1300, cyr = 1150, R0 = 640;
  const u = ease.inOut(prog(t, s0 + 0.2, s0 + 3.4)) * 0.7;
  const arc = (r, a0, a1) => { ctx.beginPath(); for (let i = 0; i <= 80; i++) { const a = lerp(a0, a1, i / 80); if (i) ctx.lineTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); else ctx.moveTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); } ctx.stroke(); };
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.18)'; ctx.lineWidth = 140; arc(R0, Math.PI * 1.05, Math.PI * 1.95); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(215,38,45,0.6)'; ctx.lineWidth = 4; ctx.setLineDash([14, 12]); ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const a = lerp(Math.PI * 1.05, Math.PI * 1.75, i / 80), r = R0 + 260 * ((i / 80) ** 2); if (i) ctx.lineTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); else ctx.moveTo(cxr + Math.cos(a) * r, cyr + Math.sin(a) * r); }
  ctx.stroke(); ctx.restore();
  label(ctx, 'SUBVIRAJE', 1880 - 40, 260, COLOR.red, prog(t, s0 + 0.6, s0 + 1.1), { size: 22, spacing: 6, weight: 700, align: 'right' });
  ctx.save(); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 5; arc(R0, Math.PI * 1.05, lerp(Math.PI * 1.05, Math.PI * 1.95, u)); ctx.restore();
  const a = lerp(Math.PI * 1.05, Math.PI * 1.95, u);
  drawCarECU(t, { cx: cxr + Math.cos(a) * R0, cy: cyr + Math.sin(a) * R0, s: 0.3, rot: a + Math.PI / 2, power: 1, split: 0.62, nerves: 0 });
  side(t, 'TRANSFERIR PAR AL EJE TRASERO', ['El coche rota', 'de forma neutra'], at(63) + 0.1, { y: 330, size: 84, maxW: 620 });
}

// Telemetría por radioenlace: el tramo en el bosque y el box.
function sRadio(t, s0) {
  bg(); dots(0.03);
  const road = poly(catmull([[760, 860], [900, 700], [860, 560], [1020, 420], [1220, 470], [1300, 330], [1480, 260]], false, 14));
  const a = ease.out(prog(t, s0, s0 + 0.6));
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(232,233,230,0.3)'; ctx.lineWidth = 26; trace(ctx, road, 1); ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 3; trace(ctx, road, 1); ctx.restore();
  const u = (prog(t, s0 + 0.4, s0 + 9) * 0.92) % 1;
  const [x, y] = pointAt(road, u);
  ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
  label(ctx, '180 KM/H', x + 30, y - 24, COLOR.yellow, prog(t, at(68) + 0.4, at(68) + 0.9), { size: 22, spacing: 6, weight: 700 });
  // Ondas de radio del coche al box.
  const bxp = 1720, byp = 820;
  ctx.save();
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.8 + k / 4) % 1;
    ctx.globalAlpha = a * (1 - ph) * 0.8; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 20 + ph * 140, -0.6, 0.9); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = COLOR.blue; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 120;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bxp, byp - 40); ctx.stroke(); ctx.restore();
  node(t, bxp, byp, 160, 90, 'BOX', null, a, COLOR.blue);
  side(t, 'APARECIÓ LA TELEMETRÍA POR RADIOENLACE', ['Sin esperar', 'al final', 'del tramo'], at(66) + 0.4, { y: 330, size: 90, maxW: 560 });
  label(ctx, 'ni descargar los datos por cable', M, 690, DIM, prog(t, at(66) + 3.6, at(66) + 4.1), { size: 34, spacing: 0, weight: 600 });
}

// Interfaz genérica de telemetría con los colores del canal.
function sTeleUI(t, s0) {
  bg();
  const a = ease.out(prog(t, s0, s0 + 0.6));
  const x0 = M, x1 = W - M, y0 = 320;
  const tr = [
    ['RÉGIMEN DEL MOTOR', COLOR.paper, (u) => 0.55 + 0.3 * Math.sin(u * 23) * Math.sin(u * 5.1) + 0.1 * Math.sin(u * 71)],
    ['PRESIÓN DE ACEITE', COLOR.yellow, (u) => 0.6 + 0.12 * Math.sin(u * 17) + 0.05 * Math.sin(u * 53)],
    ['SISTEMA ELÉCTRICO', COLOR.blue, (u) => 0.5 + 0.04 * Math.sin(u * 40) - (u > 0.72 && u < 0.76 ? 0.35 : 0)],
  ];
  const sweep = prog(t, s0 + 0.5, s1Of(s0, 'ui'));
  tr.forEach(([name, col, fn], i) => {
    const y = y0 + i * 200;
    const ap = ease.out(prog(t, [at(67) + 1.0, at(68) + 0.2, at(68) + 1.4][i], [at(67) + 1.5, at(68) + 0.7, at(68) + 1.9][i]));
    if (ap <= 0) return;
    ctx.save(); ctx.globalAlpha *= a * ap; ctx.fillStyle = COLOR.ink2; rr(ctx, x0, y, x1 - x0, 160, 12); ctx.fill(); ctx.restore();
    label(ctx, name, x0 + 30, y + 44, col, ap, { size: 22, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= ap; trace2(x0 + 30, y + 60, x1 - x0 - 60, 80, fn, sweep, col, 3); ctx.restore();
  });
  // Fallo eléctrico detectado.
  const fx = x0 + 30 + (x1 - x0 - 60) * 0.74;
  const fa = ease.out(prog(t, at(68) + 4.2, at(68) + 4.6)) * (sweep > 0.74 ? 1 : 0);
  if (fa > 0) { ctx.save(); ctx.globalAlpha *= fa; ctx.strokeStyle = COLOR.red; ctx.lineWidth = 3; ctx.strokeRect(fx - 50, y0 + 400 + 40, 100, 120); ctx.restore(); label(ctx, 'FALLO ELÉCTRICO', fx + 70, y0 + 400 + 48, COLOR.red, fa, { size: 20, spacing: 6, weight: 800 }); }
  tag(t, 'MONITORIZAR EN DIRECTO', M, 160, at(67) - 0.1);
  lines(t, ['Los parámetros vitales del motor'], M, 250, 80, 76, at(67) + 0.2, { maxW: GRID.w });
}
const S1 = {};
function s1Of(s0, key) { return S1[key] ?? s0 + 10; }

// Sensor de picado: la vibración delata la detonación y la ECU retrasa el encendido.
function sKnock(t, s0) {
  bg(); dots(0.03);
  const knockOn = prog(t, at(69) + 2.2, at(69) + 2.6) * (1 - prog(t, at(70) + 4.0, at(70) + 5.0));
  const crank = engineAngle(t, s0, 1.0);
  const st = drawCylinder(t, { cx: 1080, cy: 560, s: 0.75, appear: ease.out(prog(t, s0, s0 + 0.6)), crank, spark: 1, inj: 1, thr: 1, turbo: false, ducts: false, direct: true, knock: knockOn, labels: 0 });
  // Sensor de picado atornillado al bloque.
  const kx = 1080 + 160 * 0.75, ky = 560 + 120 * 0.75;
  ctx.save(); ctx.fillStyle = COLOR.blue; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(kx + Math.cos(a) * 22, ky + Math.sin(a) * 22); } ctx.closePath(); ctx.fill(); ctx.restore();
  pin(t, kx, ky, kx + 120, ky + 180, 'SENSOR DE PICADO', at(69) + 0.4, COLOR.blue, 'left');
  // Señal de vibración con ráfagas cuando hay picado.
  const gx = 1330, gy = 300, gw = 450, gh = 160;
  label(ctx, 'VIBRACIÓN', gx, gy - 20, DIM, prog(t, at(69) + 1.0, at(69) + 1.5), { size: 20, spacing: 6, weight: 700 });
  const sig = (u) => { const tt = t - 1.5 + u * 1.5; const base = 0.5 + 0.05 * Math.sin(tt * 90); const kk = knockOn * Math.max(0, Math.sin(tt * 6.3)) ** 8; return base + kk * 0.4 * Math.sin(tt * 420); };
  trace2(gx, gy, gw, gh, sig, prog(t, at(69) + 1.0, at(69) + 1.8), knockOn > 0.3 ? COLOR.red : COLOR.blue, 2.5);
  // Avance del encendido: la chispa se aleja del punto muerto superior.
  const dx = 1555, dy = 720, dr = 140;
  const ap = ease.out(prog(t, at(70) + 1.2, at(70) + 1.8));
  if (ap > 0) {
    ctx.save(); ctx.globalAlpha *= ap; ctx.strokeStyle = 'rgba(232,233,230,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COLOR.paper; ctx.fillRect(dx - 2, dy - dr - 24, 4, 34);
    const adv = lerp(0.55, 0.3, ease.inOut(prog(t, at(70) + 2.6, at(70) + 4.0)));
    const ang = -Math.PI / 2 - adv;
    ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(dx, dy, dr, ang, -Math.PI / 2); ctx.stroke();
    ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(dx + Math.cos(ang) * dr, dy + Math.sin(ang) * dr, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    label(ctx, 'PMS', dx, dy - dr - 40, COLOR.paper, ap, { size: 22, spacing: 6, weight: 700, align: 'center' });
    label(ctx, 'AVANCE DEL ENCENDIDO', dx, dy + dr + 56, COLOR.yellow, ap, { size: 22, spacing: 6, weight: 700, align: 'center' });
  }
  side(t, 'COMBUSTIBLE DE MALA CALIDAD', ['Picado', 'de biela'], at(69) + 0.1, { y: 330, size: 100, maxW: 520, colors: [COLOR.paper, COLOR.red] });
  label(ctx, 'La ECU corrige el avance', M, 600, COLOR.paper, prog(t, at(70) + 1.0, at(70) + 1.5), { size: 42, spacing: 0, weight: 700 });
  label(ctx, 'antes de que el piloto lo note', M, 660, DIM, prog(t, at(70) + 6.4, at(70) + 6.9), { size: 36, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Rally1: una centralita para todos, el ecosistema CAN y el despliegue de energía.

function sOneECU(t, s0) {
  bg(); dots(0.03);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ap = ease.outExpo(prog(t, at(74) + 0.6 + i * 0.18, at(74) + 1.4 + i * 0.18));
    const x = lerp(330, 1590, i / (n - 1));
    drawECU3D(t, { cx: x, cy: 720, s: 0.5, yaw: -0.6 + 0.04 * Math.sin(t * 0.7 + i), pitch: 0.6, appear: ap });
  }
  const x = W / 2;
  label(ctx, 'EL MISMO HARDWARE PARA TODOS LOS EQUIPOS', x, 990, DIM, prog(t, at(74) + 4.2, at(74) + 4.7), { size: 22, spacing: 7, weight: 700, align: 'center' });
  tag(t, 'SE PROHIBIÓ EL SOFTWARE LIBRE', x, 230, at(74) + 0.2, COLOR.red, { align: 'center' });
  lines(t, ['Una centralita estándar única'], x, 360, 100, 100, at(74) + 2.2, { align: 'center', maxW: GRID.w });
}

function sEngineNode(t, s0) {
  bg(); dots(0.03);
  const crank = engineAngle(t, s0, 1.2);
  drawCylinder(t, { cx: 1110, cy: 740, s: 0.66, appear: ease.out(prog(t, at(80) - 0.4, at(80) + 0.3)), crank, direct: true, restrictor: prog(t, at(80) + 3.0, at(80) + 3.6), turbo: true, th: spinRot(t, s0, 3, 3, 1), dth: 0.5, labels: 0 });
  pin(t, 1110 - 100 * 0.66, 740 - 200 * 0.66, 1400, 330, 'INYECCIÓN DIRECTA', at(80) + 2.0, COLOR.yellow, 'left');
  pin(t, 1110 - 620 * 0.66, 740 - 330 * 0.66, 700, 960, 'BRIDA DE ADMISIÓN', at(80) + 3.2, COLOR.yellow, 'left');
  side(t, 'LA ECU ACTUAL GESTIONA UN ECOSISTEMA MECATRÓNICO', ['Motor térmico', 'de 1.6 litros'], at(78) + 0.2, { y: 330, size: 90, maxW: 600 });
  label(ctx, 'por un lado', M, 520, DIM, prog(t, at(79), at(79) + 0.5), { size: 36, spacing: 0, weight: 600 });
}

function sCAN(t, s0) {
  bg(); dots(0.03);
  const y = 640;
  const ecuA = prog(t, s0 + 0.1, s0 + 0.6), busA = prog(t, at(82) + 0.6, at(82) + 2.0), pcuA = prog(t, at(82) + 3.2, at(82) + 3.8), mguA = prog(t, at(83) + 1.0, at(83) + 1.6), batA = prog(t, at(83) + 2.6, at(83) + 3.2);
  canBus(t, 260, 1700, y, busA, [[420, y - 150], [1100, y - 150], [1560, y + 150]], prog(t, at(82) + 2.0, at(82) + 2.6));
  node(t, 420, y - 210, 260, 120, 'ECU', 'MOTOR TÉRMICO', ecuA, COLOR.yellow, 1);
  node(t, 1100, y - 210, 460, 120, 'PCU', 'UNIDAD DE CONTROL DE ENERGÍA', pcuA, COLOR.blue);
  node(t, 1560, y + 210, 280, 120, 'MGU', '100 KW', mguA, COLOR.paper);
  label(ctx, 'BUS CAN DE ALTA VELOCIDAD', 260, y + 80, DIM, busA, { size: 22, spacing: 7, weight: 700 });
  label(ctx, 'SISTEMA HÍBRIDO DE COMPACT DYNAMICS', 1100, y - 300, DIM, pcuA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  // Unión PCU–MGU (alta tensión) y batería.
  if (mguA > 0) { ctx.save(); ctx.globalAlpha *= mguA; ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(1330, y - 210); ctx.lineTo(1560, y - 210); ctx.lineTo(1560, y + 150); ctx.stroke(); ctx.restore(); }
  drawBattery(t, { cx: 1100, cy: y + 260, s: 0.5, appear: ease.out(batA), temp: 0.3 });
  label(ctx, 'BATERÍA', 1100, y + 370, DIM, batA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  tag(t, 'POR OTRO LADO, SE COMUNICA CON', M, 150, at(82) - 0.2);
  lines(t, ['El sistema híbrido'], M, 240, 80, 80, at(82) + 0.2, { maxW: GRID.w });
}

// Despliegue de energía a lo largo del tramo: +134 CV a la salida de las curvas lentas y regeneración al frenar.
function sDeploy(t, s0) {
  bg(); dots(0.03);
  const gx = M, gy = 380, gw = W - 2 * M, gh = 300;
  const spd = (u) => 0.75 - 0.55 * Math.exp(-(((u - 0.3) / 0.05) ** 2)) - 0.45 * Math.exp(-(((u - 0.72) / 0.05) ** 2)) + 0.08 * Math.sin(u * 20);
  const sweep = prog(t, s0 + 0.4, s0 + 15);
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'DISTANCIA EN EL TRAMO', yl: 'VELOCIDAD' });
  // Zonas: frenada (antes de la curva) y salida (después).
  const zones = [[0.22, 0.29, 'brake'], [0.31, 0.42, 'boost'], [0.64, 0.71, 'brake'], [0.73, 0.84, 'boost']];
  zones.forEach(([u0, u1, k]) => {
    const vis = clamp((sweep - u0) / (u1 - u0));
    if (vis <= 0) return;
    const show = k === 'boost' ? prog(t, at(85) + 2.6, at(85) + 3.2) : prog(t, at(86) + 3.4, at(86) + 4.0);
    ctx.save(); ctx.globalAlpha *= 0.3 * show; ctx.fillStyle = k === 'boost' ? COLOR.yellow : COLOR.blue; ctx.fillRect(gx + u0 * gw, gy, (u1 - u0) * gw * vis, gh); ctx.restore();
  });
  trace2(gx, gy, gw, gh, spd, sweep, COLOR.paper, 4);
  label(ctx, '+134 CV ELÉCTRICOS', gx + 0.365 * gw, gy - 20, COLOR.yellow, prog(t, at(85) + 3.0, at(85) + 3.5), { size: 22, spacing: 6, weight: 800, align: 'center' });
  label(ctx, 'REGENERACIÓN', gx + 0.255 * gw, gy + gh + 50, COLOR.blue, prog(t, at(86) + 3.8, at(86) + 4.3), { size: 22, spacing: 6, weight: 800, align: 'center' });
  // Energía de la batería: baja al desplegar, sube al regenerar.
  const soc = (u) => { let e = 0.7; for (const [u0, u1, k] of zones) { const f = clamp((u - u0) / (u1 - u0)); e += (k === 'boost' ? -0.3 : 0.22) * f; } return e; };
  const by = 860;
  label(ctx, 'ENERGÍA EN LA BATERÍA', gx, by - 20, DIM, prog(t, at(86) + 4.6, at(86) + 5.1), { size: 20, spacing: 6, weight: 700 });
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(86) + 4.6, at(86) + 5.1));
  trace2(gx, by, gw, 120, soc, sweep, COLOR.blue, 4); ctx.restore();
  tag(t, 'LA CENTRALITA SABE EXACTAMENTE EN QUÉ MILISEGUNDO', M, 160, at(85) + 0.1);
  lines(t, ['Desplegar o regenerar'], M, 260, 80, 84, at(85) + 0.4, { maxW: GRID.w });
}

function sBattery(t, s0) {
  bg(); dots(0.03);
  const heat = 0.25 + 0.5 * ease.inOut(prog(t, s0 + 0.4, at(87) + 3.0)) - 0.08 * prog(t, at(87) + 3.4, at(87) + 5.0);
  drawBattery(t, { cx: 1300, cy: 520, s: 1.05, appear: ease.out(prog(t, s0, s0 + 0.6)), temp: heat });
  // Termómetro con su límite.
  const tx = 1300 - 360, ty = 800, tw = 720;
  const ap = ease.out(prog(t, at(87) + 1.0, at(87) + 1.5));
  meter(t, tx, ty, tw, heat / 0.85, ap, 'TEMPERATURA', heat > 0.65 ? COLOR.fire : COLOR.yellow);
  ctx.save(); ctx.globalAlpha *= ap; ctx.fillStyle = COLOR.red; ctx.fillRect(tx + tw * 0.88, ty - 14, 4, 50); ctx.restore();
  label(ctx, 'LÍMITE TÉRMICO', tx + tw * 0.88, ty + 76, COLOR.red, ap, { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'ASEGURANDO QUE LA BATERÍA', ['3,9 kWh'], at(87) + 0.4, { y: 400, size: 140, maxW: 520 });
  label(ctx, 'no supere sus límites', M, 520, COLOR.paper, prog(t, at(87) + 2.2, at(87) + 2.7), { size: 40, spacing: 0, weight: 700 });
  label(ctx, 'térmicos de seguridad', M, 576, COLOR.paper, prog(t, at(87) + 2.6, at(87) + 3.1), { size: 40, spacing: 0, weight: 700 });
}

// ---------------------------------------------------------------------------
// Sensores, mapas 3D y launch control.

function sSensorArmy(t, s0) {
  bg(); dots(0.03);
  const o = { cx: 1300, cy: 560, s: 1.0 };
  drawCarECU(t, { ...o, appear: 1, nerves: 0, power: 0, ecuGlow: 0.6, engine: 1 });
  const R = rng(44);
  for (let i = 0; i < 46; i++) {
    const x = lerp(-470, 470, R()), y = lerp(-220, 220, R());
    const t0 = s0 + 0.3 + i * 0.07;
    const k = ease.outExpo(prog(t, t0, t0 + 0.4));
    if (k <= 0) continue;
    const [sx, sy] = carToScreen(o, x, y);
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = i % 5 === 0 ? COLOR.yellow : COLOR.blue;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(127,180,221,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 8 + 14 * (1 - k), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const chips = [['VIBRACIONES EXTREMAS', at(89) + 2.6], ['BARRO', at(90)], ['MÁS DE MIL GRADOS', at(90) + 0.9]];
  chips.forEach(([s, t0], i) => label(ctx, s, M, 560 + i * 60, i === 2 ? COLOR.fire : COLOR.paper, prog(t, t0, t0 + 0.5), { size: 30, spacing: 6, weight: 800 }));
  side(t, 'SENSORES AERONÁUTICOS', ['Un ejército', 'de sensores'], s0 + 0.3, { y: 330, size: 96, maxW: 560 });
}

function sMapIntro(t, s0) {
  bg(); dots(0.03);
  const u = prog(t, s0, s0 + 8);
  drawSurface(t, { cx: 1250, cy: 750, s: 1.2, yaw: lerp(-0.95, -0.7, ease.inOut(u)), pitch: 0.5, build: prog(t, at(91) + 1.2, at(91) + 4.0), rise: ease.inOut(prog(t, at(91) + 2.0, at(91) + 4.6)), axes: 0 });
  tag(t, 'EN EL CORAZÓN DEL SOFTWARE', M, 240, at(91) - 0.1);
  lines(t, ['Mapas', 'tridimensionales'], M, 370, 100, 100, at(91) + 0.3, { maxW: 640 });
  label(ctx, 'Look-Up Tables', M, 560, COLOR.yellow, prog(t, at(91) + 3.6, at(91) + 4.1), { size: 48, spacing: 0, weight: 700 });
}

function sMap3D(t, s0) {
  bg(); dots(0.03);
  const u = prog(t, s0, at(95));
  const res = drawSurface(t, { cx: 1250, cy: 740, s: 1.15, yaw: lerp(-0.75, -0.6, ease.inOut(u)), pitch: lerp(0.5, 0.56, ease.inOut(u)), build: 1, rise: 1, axes: prog(t, at(93) + 1.2, at(93) + 2.0) });
  const f = res.f, L = f.L, Hh = f.Hh;
  const ex = f(L / 2 + 80, -L / 2, 0), ey = f(-L / 2, L / 2 + 80, 0), ez = f(-L / 2, -L / 2, Hh + 110);
  const ax = [['X · RÉGIMEN DEL MOTOR (RPM)', ex, at(93) + 3.0, 'right', 0, 50], ['Y · CARGA (MAP)', ey, at(94) + 0.4, 'left', 20, 8], ['Z · AVANCE ANTES DEL PMS', ez, at(94) + 4.6, 'center', 0, -18]];
  ax.forEach(([s, p, t0, al, dx, dy]) => label(ctx, s, p[0] + dx, p[1] + dy, COLOR.paper, prog(t, t0, t0 + 0.5), { size: 22, spacing: 6, weight: 800, align: al }));
  side(t, 'POR EJEMPLO', ['El mapa', 'de avance', 'de encendido'], at(93) - 0.2, { y: 330, size: 86, maxW: 520 });
  label(ctx, 'una malla 3D', M, 640, COLOR.yellow, prog(t, at(93) + 1.4, at(93) + 1.9), { size: 44, spacing: 0, weight: 700 });
}

function sInterp(t, s0) {
  bg(); dots(0.03);
  const pt = [0.35 + 0.25 * Math.sin((t - s0) * 0.9), 0.4 + 0.2 * Math.sin((t - s0) * 0.6 + 1)];
  const z = ease.inOut(prog(t, s0, s0 + 1.6));
  focus(1250, 600, lerp(1, 1.5, z), lerp(1250, 1300, z), lerp(600, 580, z), () => {
    drawSurface(t, { cx: 1250, cy: 740, s: 1.15, yaw: -0.6, pitch: 0.56, build: 1, rise: 1, axes: 0, pt, cell: prog(t, s0 + 1.2, s0 + 1.8) });
  });
  scrim(820, 0.9);
  tag(t, 'LA CENTRALITA INTERPOLA', M, 330, at(95) + 0.4);
  lines(t, ['Millones', 'de puntos', 'por segundo'], M, 450, 96, 96, at(95) + 1.2, { maxW: 560 });
}

function sLaunch(t, s0) {
  bg(); dots(0.03);
  const tFull = at(98) + 1.4, tLock = at(99) + 0.4;
  const rpm = t < tFull ? 0.12 : t < tLock ? lerp(0.12, 0.62, ease.out(prog(t, tFull, tLock))) : 0.62 + 0.015 * Math.sin(t * 40);
  arcGauge(t, 1340, 520, 260, rpm, 1, ease.out(prog(t, s0, s0 + 0.6)), 10, COLOR.yellow);
  // Régimen óptimo de par: marca fija.
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5, am = a0 + span * 0.62;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, tLock - 0.2, tLock + 0.3)); ctx.strokeStyle = COLOR.fire; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(1340 + Math.cos(am) * 220, 520 + Math.sin(am) * 220); ctx.lineTo(1340 + Math.cos(am) * 310, 520 + Math.sin(am) * 310); ctx.stroke(); ctx.restore();
  label(ctx, 'RÉGIMEN ÓPTIMO DE PAR', 1340, 900, COLOR.fire, prog(t, tLock, tLock + 0.5), { size: 22, spacing: 6, weight: 800, align: 'center' });
  // Cortes de inyección aleatorios (con semilla) por cilindro.
  const cutsA = ease.out(prog(t, at(100) + 0.6, at(100) + 1.2));
  if (cutsA > 0) {
    const step = Math.floor((t - at(100)) * 12), R = rng(1000 + step);
    for (let i = 0; i < 4; i++) {
      const x = 1700, y = 340 + i * 90, cutNow = R() < 0.35;
      ctx.save(); ctx.globalAlpha *= cutsA; rr(ctx, x - 50, y - 30, 100, 60, 8); ctx.fillStyle = cutNow ? COLOR.red : COLOR.yellow; ctx.fill(); ctx.restore();
      label(ctx, String(i + 1), x, y + 10, COLOR.ink, cutsA, { size: 26, spacing: 0, weight: 800, align: 'center' });
    }
    label(ctx, 'CORTES DE INYECCIÓN', 1700, 270, DIM, cutsA, { size: 20, spacing: 6, weight: 700, align: 'center' });
  }
  // Pedales.
  const ped = [['EMBRAGUE', at(98) + 0.5], ['ACELERADOR A FONDO', at(98) + 1.4]];
  ped.forEach(([s, t0], i) => { const k = ease.out(prog(t, t0, t0 + 0.4)); meter(t, M, 700 + i * 110, 480, k, ease.out(prog(t, at(98), at(98) + 0.5)), s, i ? COLOR.yellow : COLOR.paper); });
  side(t, 'CONTROL DE SALIDA', ['Launch', 'Control'], at(97) + 0.2, { y: 330, size: 120, maxW: 560 });
  label(ctx, 'para que las ruedas no patinen en la gravilla', M, 960, DIM, prog(t, at(100) + 3.6, at(100) + 4.1), { size: 32, spacing: 0, weight: 600 });
}

function sCrypto(t, s0) {
  bg(); dots(0.03);
  const scr = ease.inOut(prog(t, at(101) + 4.4, at(101) + 6.4));
  drawSurface(t, { cx: 1290, cy: 780, s: 1.0, yaw: -0.6 + 0.1 * prog(t, s0, s0 + 10), pitch: 0.56, build: 1, rise: lerp(1, 0.15, scr), scramble: scr, shade: 1 - scr });
  // Candado.
  const lk = ease.outExpo(prog(t, at(101) + 6.2, at(101) + 6.9));
  if (lk > 0) {
    const x = 1290, y = 400;
    ctx.save(); ctx.globalAlpha *= lk; ctx.translate(x, y); ctx.scale(lerp(1.3, 1, lk), lerp(1.3, 1, lk));
    ctx.strokeStyle = COLOR.paper; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(0, -60, 56, Math.PI, 0); ctx.stroke();
    rr(ctx, -90, -60, 180, 150, 18); ctx.fillStyle = COLOR.yellow; ctx.fill();
    ctx.fillStyle = COLOR.ink; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-7, 0, 14, 44);
    ctx.restore();
  }
  side(t, 'Y TODO ESTO PROTEGIDO POR', ['Redundancia', 'y cifrado'], at(101) + 0.2, { y: 330, size: 100, maxW: 560 });
  label(ctx, 'para que nadie espíe', M, 600, DIM, prog(t, at(101) + 5.6, at(101) + 6.1), { size: 38, spacing: 0, weight: 600 });
  label(ctx, 'los mapas de inyección', M, 652, DIM, prog(t, at(101) + 5.9, at(101) + 6.4), { size: 38, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Combustibles sostenibles y bucle cerrado.

function sFuelProps(t, s0) {
  bg(); dots(0.03);
  const rows = [['DENSIDAD', 0.62, 0.58], ['PUNTO DE VAPORIZACIÓN', 0.55, 0.63]];
  const x0 = 820, w = 900;
  label(ctx, 'GASOLINA DE PETRÓLEO', x0, 330, '#8C9096', prog(t, at(103) + 0.6, at(103) + 1.1), { size: 22, spacing: 6, weight: 700 });
  label(ctx, 'BIOCOMBUSTIBLE AVANZADO', x0 + 440, 330, COLOR.yellow, prog(t, at(104) + 0.4, at(104) + 0.9), { size: 22, spacing: 6, weight: 700 });
  rows.forEach(([n, a, b], i) => {
    const y = 470 + i * 220;
    const ap = ease.out(prog(t, at(105) - 0.4 + i * 0.8, at(105) + 0.2 + i * 0.8));
    label(ctx, n, x0, y - 30, COLOR.paper, ap, { size: 24, spacing: 6, weight: 700 });
    ctx.save(); ctx.globalAlpha *= ap;
    ctx.fillStyle = '#8C9096'; ctx.fillRect(x0, y, w * a * ease.out(prog(t, at(105) + i * 0.8, at(105) + 0.8 + i * 0.8)), 34);
    ctx.fillStyle = COLOR.yellow; ctx.fillRect(x0, y + 50, w * b * ease.out(prog(t, at(105) + 0.3 + i * 0.8, at(105) + 1.1 + i * 0.8)), 34);
    ctx.restore();
  });
  side(t, 'A DIFERENCIA DE LA GASOLINA TRADICIONAL', ['Propiedades', 'ligeramente', 'diferentes'], at(103) + 0.2, { y: 330, size: 90, maxW: 560 });
}

function sLoop(t, s0) {
  bg(); dots(0.03);
  const cx = 1300, cy = 560, R = 330;
  const nodes = [['INYECTOR', -Math.PI / 2], ['COMBUSTIÓN', -Math.PI / 2 + 1.26], ['ESCAPE', -Math.PI / 2 + 2.51], ['SONDA LAMBDA', -Math.PI / 2 + 3.77], ['ECU', -Math.PI / 2 + 5.03]];
  const a = ease.inOut(prog(t, s0 + 0.2, s0 + 2.2));
  ctx.save(); ctx.strokeStyle = 'rgba(232,233,230,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a); ctx.stroke(); ctx.restore();
  // Pulsos recorriendo el bucle.
  if (a >= 1) for (let k = 0; k < 3; k++) { const ph = -Math.PI / 2 + ((t * 0.6 + k / 3) % 1) * Math.PI * 2; ctx.fillStyle = COLOR.yellow; ctx.beginPath(); ctx.arc(cx + Math.cos(ph) * R, cy + Math.sin(ph) * R, 9, 0, Math.PI * 2); ctx.fill(); }
  nodes.forEach(([n, ang], i) => {
    const k = prog(t, s0 + 0.4 + i * 0.35, s0 + 0.9 + i * 0.35);
    node(t, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, n === 'SONDA LAMBDA' ? 270 : 230, 80, n, null, k, n === 'ECU' ? COLOR.yellow : n === 'SONDA LAMBDA' ? COLOR.blue : COLOR.paper, n === 'ECU' ? 1 : 0);
  });
  side(t, 'RECALIBRADA CON ALGORITMOS ADAPTATIVOS', ['Bucle', 'cerrado'], at(106) + 0.3, { y: 330, size: 130, maxW: 520 });
  label(ctx, 'closed-loop control', M, 520, COLOR.yellow, prog(t, at(106) + 4.4, at(106) + 4.9), { size: 44, spacing: 0, weight: 700 });
}

function sLambda(t, s0) {
  bg(); dots(0.03);
  const gx = 760, gy = 330, gw = 1020, gh = 420;
  axes(gx, gy, gw, gh, prog(t, s0 + 0.2, s0 + 1.0), { xl: 'TIEMPO', yl: 'OXÍGENO EN EL ESCAPE' });
  const lam = (u) => 0.5 + 0.32 * Math.exp(-u * 4.2) * Math.sin(u * 32) + 0.02 * Math.sin(u * 90) * Math.exp(-u * 2);
  const y1 = gy + gh * 0.5;
  ctx.save(); ctx.globalAlpha *= ease.out(prog(t, at(108) + 9.6, at(108) + 10.2)); ctx.strokeStyle = COLOR.yellow; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(gx, y1); ctx.lineTo(gx + gw, y1); ctx.stroke(); ctx.restore();
  label(ctx, 'RELACIÓN ESTEQUIOMÉTRICA', gx + gw, y1 - 16, COLOR.yellow, prog(t, at(108) + 9.6, at(108) + 10.2), { size: 20, spacing: 6, weight: 800, align: 'right' });
  trace2(gx, gy, gw, gh, lam, prog(t, at(108) + 0.4, at(108) + 9.4), COLOR.blue, 4);
  side(t, 'SONDAS LAMBDA DE BANDA ANCHA', ['La ECU mide', 'el oxígeno', 'residual'], at(107) + 0.2, { y: 330, size: 86, maxW: 560 });
  label(ctx, 'en tiempo real', M, 640, DIM, prog(t, at(108) + 1.6, at(108) + 2.1), { size: 40, spacing: 0, weight: 600 });
}

function sDuty(t, s0) {
  bg(); dots(0.03);
  const gx = 760, gw = 1020;
  const duty = (u) => 0.32 + 0.14 * ease.inOut(clamp((u - 0.4) / 0.3));
  label(ctx, 'MANDO DEL INYECTOR', gx, 330, DIM, prog(t, s0 + 0.2, s0 + 0.7), { size: 22, spacing: 6, weight: 700 });
  pwm(gx, 380, gw, 160, 9, duty, prog(t, s0 + 0.3, s0 + 3.0), COLOR.yellow);
  // Cota del tiempo de apertura en el último pulso.
  const ap = prog(t, s0 + 3.2, s0 + 3.8);
  const per = gw / 9, xs = gx + per * 8, xe = xs + per * duty(0.95);
  dimLine(xs, xe, 600, ap, COLOR.yellow, null);
  label(ctx, 'TIEMPO DE APERTURA', (xs + xe) / 2 - 40, 680, COLOR.yellow, ap, { size: 20, spacing: 6, weight: 700, align: 'center' });
  side(t, 'AJUSTA DINÁMICAMENTE', ['El duty cycle'], at(108) + 5.6, { y: 400, size: 96, maxW: 600 });
  label(ctx, 'Cada caballo disponible', M, 780, COLOR.paper, prog(t, at(109) + 0.8, at(109) + 1.3), { size: 48, spacing: 0, weight: 700 });
  label(ctx, 'sin importar el combustible', M, 840, DIM, prog(t, at(109) + 2.2, at(109) + 2.7), { size: 38, spacing: 0, weight: 600 });
}

// ---------------------------------------------------------------------------
// Cierre.

function sCode(t, s0, s1) {
  bg(); dots(0.03);
  const u = prog(t, s0, s1);
  drawECU3D(t, { cx: 1300, cy: 760, s: 1.1, yaw: lerp(-0.3, -0.75, ease.inOut(u)), pitch: 0.64, open: 1, lift: 1, pulse: 1, appear: ease.out(prog(t, s0, s0 + 0.6)) });
  side(t, 'EL AUTOMOVILISMO MODERNO', ['Se escribe', 'con código'], at(111) + 0.1, { y: 330, size: 110, maxW: 560 });
  label(ctx, 'Algoritmos de control predictivo', M, 560, DIM, prog(t, at(112) + 0.2, at(112) + 0.7), { size: 36, spacing: 0, weight: 600 });
  label(ctx, 'y microprocesadores', M, 610, DIM, prog(t, at(112) + 2.0, at(112) + 2.5), { size: 36, spacing: 0, weight: 600 });
}

function sRecap(t, s0) {
  bg();
  const a = ease.out(prog(t, s0, s0 + 0.6)), b = ease.out(prog(t, at(113) + 3.6, at(113) + 4.2));
  const y = 170, w = 760, h = 480;
  photo('motronic', M, y, w, h, { zoom: 1.08, fx: 0.5, fy: 0.5 }, { dark: 0.15, vig: 0.3, open: a });
  photo('marelli', W - M - w, y, w, h, { zoom: 1.08, fx: 0.5, fy: 0.5 }, { dark: 0.1, vig: 0.3, open: b });
  arrowPath([[M + w + 40, y + h / 2], [W - M - w - 40, y + h / 2]], ease.out(prog(t, at(113) + 3.0, at(113) + 3.8)), COLOR.yellow, 6, 20);
  label(ctx, 'CAJAS ANALÓGICAS', M, y + h + 70, COLOR.paper, a, { size: 26, spacing: 6, weight: 800 });
  label(ctx, 'Chips soldados a mano', M, y + h + 124, DIM, prog(t, at(113) + 1.0, at(113) + 1.5), { size: 34, spacing: 0, weight: 600 });
  label(ctx, 'CENTRALITAS MECATRÓNICAS', W - M - w, y + h + 70, COLOR.yellow, b, { size: 26, spacing: 6, weight: 800 });
  label(ctx, 'Potencia térmica e híbrida', W - M - w, y + h + 124, DIM, prog(t, at(113) + 5.6, at(113) + 6.1), { size: 34, spacing: 0, weight: 600 });
}

function sChannel(t, s0) {
  bg();
  const lg = A.logo;
  const la = ease.out(prog(t, s0 + 0.1, s0 + 0.8));
  const w = 720, h = w * (lg.height / lg.width);
  ctx.save(); ctx.globalAlpha = la; ctx.drawImage(lg, W / 2 - w / 2, 360 - h / 2, w, h); ctx.restore();
  pill(t, 'Suscríbete', W / 2, 740, at(116) - 0.3, { press: at(116) + 0.4, color: COLOR.red, size: 42 });
  label(ctx, '¿Qué otro componente del rally quieres que exploremos?', W / 2, 880, DIM, prog(t, at(118) + 0.2, at(118) + 0.7), { size: 40, spacing: 0, weight: 600, align: 'center' });
  label(ctx, 'Nos vemos en el próximo tramo', W / 2, 960, COLOR.paper, prog(t, at(119), at(119) + 0.5), { size: 44, spacing: 0, weight: 700, align: 'center' });
}

// ---------------------------------------------------------------------------
// Lista de montaje: [inicio, plano, transición de entrada].

const SHOTS = [
  [0, sIdent],
  [2.5, kClip({ seg: 'c037', from: 0.0, speed: 1, z: [1.0, 1.06], tag: 'UN MOTOR DE 500 CABALLOS Y UN SISTEMA HÍBRIDO', tagT: at(1) + 2.0, title: ['Inútil sin una mente', 'que lo gobierne'], tt: at(1) + 5.2, size: 110 }), 'dissolve'],
  [cut(2), sRate, 'whip'],
  [cut(6), sNervous, 'cube'],
  [cut(8), kPhoto3({ img: 'yarisRally1', fx: 0.5, fy: 0.45, yaw: [0.06, -0.02], dark: 0.4, tag: 'EL AGARRE CAMBIA CADA METRO', tagT: at(9) + 0.2, title: ['Asfalto, barro', 'o hielo'], tt: at(9) + 2.4, size: 120 }), 'wipe'],
  [cut(11), kPhoto3({ img: 'piloto', fx: 0.5, fy: 0.4, yaw: [-0.05, 0.03], dark: 0.5, tag: 'EL PILOTO YA NO PILOTA SOLO CONTRA EL CRONO', tagT: at(11) + 0.2, title: ['Contra algoritmos', 'matemáticos'], tt: at(12) + 0.4, size: 116, label: 'que deciden cómo entregar cada vatio al suelo', labelT: at(12) + 2.6 }), 'cube'],
  [cut(13), sOpenECU, 'slices'],
  [cut(14), kChapter({ img: 'stratosNieve', fx: 0.5, fy: 0.5, era: 1, tag: 'PARA ENTENDER LA REVOLUCIÓN ELECTRÓNICA', tagT: at(14) + 0.2, title: ['De dónde venimos'], tt: at(15) + 0.2 }), 'wipe'],
  [cut(16), kPhoto3({ img: 'weber', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.03], dark: 0.55, tag: 'EN LAS DÉCADAS DE', tagT: at(16) + 0.1, title: ['1960 y 1970'], tt: at(16) + 0.9, size: 150 }), 'cube'],
  [cut(17), kClip({ seg: 'escort', from: 1.0, speed: 1, tag: 'LOS MOTORES DE RALLY SE ALIMENTABAN CON', tagT: at(17) + 0.2, title: ['Carburadores', 'mecánicos'], tt: at(17) + 1.6, size: 120 }), 'whip'],
  [cut(18), sCarb, 'dissolve'],
  [cut(20), kPhoto3({ img: 'carburadores', fx: 0.5, fy: 0.45, yaw: [0.05, -0.02], dark: 0.5, tag: 'TEMPERAMENTALES', tagT: at(20) + 1.0, title: ['100% mecánicos'], tt: at(20) + 0.3, size: 140, label: 'Ciegos ante la altitud o la temperatura exterior', labelT: at(21) + 1.6 }), 'cube'],
  [cut(22), sAltitude, 'slices'],
  [cut(25), kClip({ seg: 'quattro', from: 0.0, speed: 0.97, tag: 'FINALES DE LOS 70 · PRINCIPIOS DE LOS 80', tagT: at(25) + 0.2, title: ['Inyección', 'electrónica'], tt: at(26) + 0.4, size: 120, label: 'Bosch K-Jetronic en los primeros Audi Quattro', labelT: at(26) + 3.0, extra: (t, s0) => drawEras(t, 2, ease.out(prog(t, s0 + 0.2, s0 + 1.0)) * (1 - prog(t, at(26) + 5, at(26) + 6)), 70) }), 'wipe'],
  [cut(27), sSuckPress, 'whip'],
  [cut(28), kPhoto3({ img: 'motronic', fx: 0.55, fy: 0.5, yaw: [-0.05, 0.03], dark: 0.45, tag: 'AQUELLAS PRIMERAS CENTRALITAS ERAN', tagT: at(28) + 0.2, title: ['Cajas analógicas'], tt: at(29) + 0.8, size: 130, label: 'Transistores básicos y circuitos impresos rígidos', labelT: at(29) + 2.6 }), 'cube'],
  [cut(30), kType({ title: ['No se podían', 'reprogramar'], colors: [COLOR.paper, COLOR.red], tt: at(30) + 0.1, size: 150, label: 'en tiempo real', labelT: at(30) + 1.8 }), 'cut'],
  [cut(31), sSolder, 'slices'],
  [cut(33), kChapter({ img: 'celicaGrupoA', fx: 0.5, fy: 0.5, era: 3, tag: 'ADIÓS AL GRUPO B · FINALES DE LOS 80 Y 90', tagT: at(33) + 0.2, title: ['Grupo A'], tt: at(33) + 2.4 }), 'wipe'],
  [cut(34), sRestrictor, 'cube'],
  [cut(35), sLag, 'dissolve'],
  [cut(41), kPhoto3({ img: 'antilagNoche', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], dark: 0.35, tag: 'EL SOFTWARE DE LA ECU DIO LUGAR AL SISTEMA', tagT: at(41) + 2.2, title: ['Anti-Lag'], tt: at(42) + 0.3, size: 180, label: 'ELS (Exhaust Gas Recirculation System)', labelT: at(42) + 2.0 }), 'slices'],
  [cut(43), sALS1, 'cube'],
  [cut(46), sALS2, 'dissolve'],
  [cut(47), sALS3, 'cut'],
  [cut(48), sALS4, 'whip'],
  [cut(49), kClip({ seg: 'noche', from: 0.0, speed: 0.92, dark: 0.0, tag: 'EL RESULTADO', tagT: at(49) + 0.2, title: ['El famoso', 'petardeo'], tt: at(49) + 2.0, size: 130, label: 'y una respuesta de par instantánea', labelT: at(49) + 5.2 }), 'whip'],
  [cut(50), kType({ title: ['Ya no solo medía datos:', 'creaba explosiones'], colors: [COLOR.paper, COLOR.fire], tt: at(50) + 0.1, size: 120, label: 'controladas dentro del escape', labelT: at(51) + 1.0 }), 'cut'],
  [cut(52), kClip({ seg: 'impreza', from: 0.0, speed: 0.95, tag: 'WORLD RALLY CAR', tagT: at(52) + 0.3, title: ['1997'], tt: at(52) + 2.8, size: 170, extra: (t, s0) => drawEras(t, 4, ease.out(prog(t, s0 + 0.2, s0 + 1.0)), 70) }), 'wipe'],
  [cut(53), kPhoto3({ img: 'impreza97', fx: 0.5, fy: 0.5, yaw: [-0.06, 0.02], dark: 0.4, title: ['La electrónica', 'desata su potencial'], tt: at(53) + 0.1, size: 110 }), 'cube'],
  [cut(54), sBrainCar, 'slices'],
  [cut(57), sSensorsWRC, 'dissolve'],
  [cut(61), sFrontSlip, 'cut'],
  [cut(62), kSplit({ img: 'diferencial', side: 'right', fx: 0.5, fy: 0.5, z: [1.08, 1.0], tag: 'UNA ORDEN HIDRÁULICA', tagT: at(62) + 0.1, title: ['Al diferencial', 'central'], tt: at(62) + 0.5, size: 100 }), 'cubeV'],
  [at(62) + 2.6, sClutch, 'dissolve'],
  [cut(63), sNeutral, 'dissolve'],
  [cut(64), kPhoto3({ img: 'telemetria', fx: 0.5, fy: 0.45, yaw: [0.05, -0.02], dark: 0.45, tag: 'ADEMÁS, APARECIÓ LA', tagT: at(64) + 0.1, title: ['Telemetría', 'por radioenlace'], tt: at(65) + 0.1, size: 120 }), 'wipe'],
  [cut(66), sRadio, 'cube'],
  [cut(67), sTeleUI, 'slices'],
  [cut(69), sKnock, 'dissolve'],
  [cut(71), kClip({ seg: 'puma', from: 0.0, speed: 1, tag: 'DE 2022 EN ADELANTE', tagT: at(71) + 2.6, title: ['Rally1 híbridos'], tt: at(71) + 0.6, size: 150, extra: (t, s0) => drawEras(t, 5, ease.out(prog(t, s0 + 0.2, s0 + 1.0)), 70) }), 'wipe'],
  [cut(73), kType({ tag: 'LA FIA INTRODUJO', tagT: at(73) + 0.1, title: ['Un cambio', 'regulatorio radical'], tt: at(73) + 0.6, size: 140, label: 'por contención de costes', labelT: at(73) + 3.0 }), 'whip'],
  [cut(74), sOneECU, 'cube'],
  [cut(75), kSplit({ img: 'marelli', side: 'right', fx: 0.5, fy: 0.5, z: [1.08, 1.0], tag: 'PROVEEDOR HOMOLOGADO', tagT: at(75) + 0.2, title: ['Especificaciones', 'Magneti Marelli'], tt: at(75) + 2.4, size: 92 }), 'slices'],
  [cut(76), kPhoto3({ img: 'placaECU', fx: 0.55, fy: 0.5, yaw: [-0.05, 0.03], dark: 0.5, tag: 'MISMO HARDWARE, MISMA UNIDAD CENTRAL', tagT: at(76) + 0.2, title: ['La guerra', 'del software'], tt: at(77) + 0.3, size: 130, label: 'Software privativo y calibración de los mapas de gestión', labelT: at(77) + 2.6 }), 'cube'],
  [cut(78), sEngineNode, 'dissolve'],
  [cut(82), sCAN, 'cube'],
  [cut(84), kPhoto3({ img: 'rally1Noche', fx: 0.5, fy: 0.5, yaw: [0.06, -0.02], dark: 0.45, tag: 'ESTRATEGIA DE DESPLIEGUE DE ENERGÍA', tagT: at(84) + 0.2, title: ['Power', 'deployment'], tt: at(84) + 2.8, size: 140 }), 'wipe'],
  [cut(85), sDeploy, 'slices'],
  [cut(87), sBattery, 'cube'],
  [cut(88), kChapter({ img: 'boschMS74', fx: 0.5, fy: 0.5, tag: 'DECISIONES EN MILISEGUNDOS', tagT: at(88) + 0.2, title: ['Los sensores'], tt: at(88) + 1.2 }), 'wipe'],
  [cut(89), sSensorArmy, 'dissolve'],
  [cut(91), sMapIntro, 'cube'],
  [cut(93), sMap3D, 'dissolve'],
  [cut(95), sInterp, 'cut'],
  [cut(97), sLaunch, 'slices'],
  [cut(101), sCrypto, 'cube'],
  [cut(102), kChapter({ img: 'combustible', fx: 0.5, fy: 0.5, tag: 'EL RETO MÁS RECIENTE', tagT: at(102) + 0.3, title: ['Combustibles', '100% sostenibles'], tt: at(102) + 4.0, label: 'Sintéticos y obligatorios por la FIA', labelT: at(102) + 6.6 }), 'wipe'],
  [cut(103), sFuelProps, 'cube'],
  [cut(106), sLoop, 'dissolve'],
  [cut(107), sLambda, 'cube'],
  [at(108) + 5.0, sDuty, 'dissolve'],
  [cut(110), kClip({ seg: 'c3', from: 0.0, speed: 1, tag: 'EL AUTOMOVILISMO MODERNO YA NO SE ESCRIBE SOLO CON', tagT: at(110) + 0.2, title: ['Llave inglesa', 'y grasa de motor'], tt: at(110) + 1.6, size: 116 }), 'whip'],
  [cut(111), sCode, 'slices'],
  [cut(113), sRecap, 'dissolve'],
  [cut(114), kPhoto3({ img: 'antilagNoche', fx: 0.35, fy: 0.5, yaw: [-0.06, 0.03], zoom: [1.3, 1.16], dark: 0.45, tag: 'LA CENTRALITA ES', tagT: at(114) + 0.1, title: ['El cerebro', 'invisible'], tt: at(114) + 0.6, size: 140, label: 'que permite al piloto desafiar los límites de la física', labelT: at(114) + 3.4 }), 'cube'],
  [cut(115), sChannel, 'wipe'],
];
S1.ui = cut(69);

// Ventanas de uso de cada tramo de vídeo: para cargar sus fotogramas y para que la mezcla
// coloque el sonido real del coche (y baje la música) mientras se ven.
export const CLIP_USE = (() => {
  const out = [];
  SHOTS.forEach(([s0, fn], i) => {
    const s1 = SHOTS[i + 1]?.[0] ?? DURATION;
    if (fn.seg) out.push([s0 - 0.6, s1 + 0.6, fn.seg, s0, s1, fn.from ?? 0, fn.speed ?? 1]);
  });
  return out;
})();
