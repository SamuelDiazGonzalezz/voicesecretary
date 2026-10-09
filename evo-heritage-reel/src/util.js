// Utilidades deterministas: todo el vídeo es una función pura de t (segundos).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (t, a, b) => clamp((t - a) / (b - a));
export const pulse = (t, a, b) => (t >= a && t < b ? 1 : 0);

export const ease = {
  linear: (x) => x,
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
export function shake(t, freq, seed = 0) {
  return [noise1(t * freq + seed * 13.7), noise1(t * freq + seed * 31.1 + 100), noise1(t * freq + seed * 7.3 + 200)];
}

// Interpolación de keyframes [[t, v], ...]
export function keys(arr, t, step = false) {
  if (t <= arr[0][0]) return arr[0][1];
  for (let i = 0; i < arr.length - 1; i++) {
    const [t0, v0] = arr[i], [t1, v1] = arr[i + 1];
    if (t < t1) return step ? v0 : lerp(v0, v1, ease.inOutSine((t - t0) / (t1 - t0)));
  }
  return arr[arr.length - 1][1];
}

export const C = {
  navy: '#0b2550', blue: '#1f78c8', light: '#6cc0ee', red: '#d8232c', yellow: '#f4b31b',
  cream: '#f1ece1', ink: '#0b0b0e', grey: '#8b9097', white: '#f7f6f2', orange: '#ee6a1f',
};
