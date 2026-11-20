
// ---------------------------------------------------------------------------
// 3D con perspectiva real en Canvas 2D: una imagen plana se proyecta en franjas finas,
// cada una con su propia escala según su profundidad. Sin librerías, determinista.

const FOCAL = 1700;

// Proyecta `src` como un plano de w×h. map(x) devuelve [X, Z] del punto horizontal x ∈ [-w/2, w/2]
// (X lateral respecto a cx, Z profundidad: 0 = plano de pantalla, positivo = más lejos).
function stripsY(src, w, h, cx, cy, map, { n = 96, shade = 0, alpha = 1, sx0 = 0, sw = src.width, sh = src.height } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const [X0, Z0] = map((u0 - 0.5) * w), [X1, Z1] = map((u1 - 0.5) * w);
    if (FOCAL + Z0 <= 10 || FOCAL + Z1 <= 10) continue;
    const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
    const p0 = cx + X0 * s0, p1 = cx + X1 * s1;
    if (p1 <= p0) continue; // cara de espaldas
    const s = (s0 + s1) / 2;
    ctx.drawImage(src, sx0 + u0 * sw, 0, Math.max(1, (u1 - u0) * sw), sh, p0, cy - (h * s) / 2, p1 - p0 + 0.7, h * s);
  }
  if (shade > 0) {
    // Sombreado de la cara según su giro (se repite la silueta con negro translúcido).
    ctx.globalAlpha = alpha * shade;
    ctx.fillStyle = COLOR.ink;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const [X0, Z0] = map((u0 - 0.5) * w), [X1, Z1] = map((u1 - 0.5) * w);
      const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
      const p0 = cx + X0 * s0, p1 = cx + X1 * s1;
      if (p1 <= p0) continue;
      const s = (s0 + s1) / 2;
      ctx.fillRect(p0, cy - (h * s) / 2, p1 - p0 + 0.7, h * s);
    }
  }
  ctx.restore();
}

// Lo mismo girando alrededor del eje horizontal (franjas por filas).
function stripsX(src, w, h, cx, cy, map, { n = 120, shade = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const v0 = i / n, v1 = (i + 1) / n;
    const [Y0, Z0] = map((v0 - 0.5) * h), [Y1, Z1] = map((v1 - 0.5) * h);
    if (FOCAL + Z0 <= 10 || FOCAL + Z1 <= 10) continue;
    const s0 = FOCAL / (FOCAL + Z0), s1 = FOCAL / (FOCAL + Z1);
    const p0 = cy + Y0 * s0, p1 = cy + Y1 * s1;
    if (p1 <= p0) continue;
    const s = (s0 + s1) / 2;
    ctx.drawImage(src, 0, v0 * src.height, src.width, Math.max(1, (v1 - v0) * src.height), cx - (w * s) / 2, p0, w * s, p1 - p0 + 0.7);
    if (shade > 0) { ctx.globalAlpha = alpha * shade; ctx.fillStyle = COLOR.ink; ctx.fillRect(cx - (w * s) / 2, p0, w * s, p1 - p0 + 0.7); ctx.globalAlpha = alpha; }
  }
  ctx.restore();
}

// Plano girado `a` radianes sobre su eje vertical, desplazado en profundidad.
const planeY = (src, a, { w = W, h = H, cx = W / 2, cy = H / 2, z = 0, x = 0, ...o } = {}) =>
  stripsY(src, w, h, cx, cy, (u) => [x + u * Math.cos(a), z + u * Math.sin(a)], o);
// Plano inclinado `a` radianes sobre su eje horizontal (positivo: la parte de arriba se aleja).
const planeX = (src, a, { w = W, h = H, cx = W / 2, cy = H / 2, z = 0, y = 0, ...o } = {}) =>
  stripsX(src, w, h, cx, cy, (v) => [y + v * Math.cos(a), z - v * Math.sin(a)], o);

// Transición de cubo: el plano saliente gira como la cara de un cubo y entra el siguiente.
function cube(t, t0, A_, B_, vertical = false, dir = 1) {
  const p = ease.inOut(prog(t, t0 - 0.22, t0 + 0.22));
  const a = toLayer('a', A_), b = toLayer('b', B_);
  const half = (vertical ? H : W) / 2;
  const pull = Math.sin(Math.PI * p) * 700;
  const face = (src, phi) => {
    const c = Math.cos(phi), s = Math.sin(phi);
    if (c <= 0.01) return;
    const map = (u) => [u * c - half * s, pull + half - u * s - half * c];
    const shade = (1 - c) * 0.75;
    if (vertical) stripsX(src, W, H, W / 2, H / 2, map, { shade });
    else stripsY(src, W, H, W / 2, H / 2, map, { shade });
  };
  bg();
  const phiA = -dir * p * Math.PI / 2, phiB = dir * (1 - p) * Math.PI / 2;
  // Primero la cara más alejada.
  if (Math.cos(phiA) < Math.cos(phiB)) { face(a, phiA); face(b, phiB); } else { face(b, phiB); face(a, phiA); }
}

// Transición de vuelo: la cámara atraviesa el plano saliente y el siguiente llega desde el fondo.
function fly(t, t0, A_, B_) {
  const p = prog(t, t0 - 0.2, t0 + 0.2);
  const a = toLayer('a', A_), b = toLayer('b', B_);
  bg();
  const pb = ease.out(clamp(p * 1.4 - 0.2));
  const zb = lerp(1400, 0, pb);
  ctx.save();
  ctx.globalAlpha = clamp(p * 2);
  const sb = FOCAL / (FOCAL + zb);
  ctx.drawImage(b, W / 2 - (W * sb) / 2, H / 2 - (H * sb) / 2, W * sb, H * sb);
  ctx.restore();
  const pa = ease.inExpo(clamp(p * 1.25));
  if (pa < 1) {
    // Desenfoque radial: copias escaladas del plano saliente.
    for (let k = 0; k < 6; k++) {
      const sa = 1 + pa * 2.4 * (1 + k * 0.06);
      ctx.save();
      ctx.globalAlpha = (1 - pa) * (k === 0 ? 1 : 0.22);
      ctx.drawImage(a, W / 2 - (W * sa) / 2, H / 2 - (H * sa) / 2, W * sa, H * sa);
      ctx.restore();
    }
  }
}

// Foto como plano 3D a sangre: sobredimensionada para que al girar nunca asomen los bordes.
function photo3D(key, t, s0, s1, { yaw = [-0.07, 0.04], pitch = null, zoom = [1.18, 1.06], fx = 0.5, fy = 0.5, dark = 0.3, gray = false } = {}) {
  const u = ease.inOut(span(t, s0, s1));
  const L = toLayer('p', () => {
    bg();
    photo(key, 0, 0, W, H, { zoom: 1, fx, fy }, { dark, vig: 0.55, gray });
  });
  bg();
  const k = lerp(zoom[0], zoom[1], u);
  const o = 1 + 0.75 * Math.max(Math.abs(yaw[0]), Math.abs(yaw[1]), Math.abs(pitch?.[0] ?? 0), Math.abs(pitch?.[1] ?? 0));
  if (pitch) planeX(L, lerp(pitch[0], pitch[1], u), { w: W * k * o, h: H * k * o });
  else planeY(L, lerp(yaw[0], yaw[1], u), { w: W * k * o, h: H * k * o });
}
