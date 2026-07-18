/* ── helpers.js ────────────────────────────────────────────────────── *
 *  Shared math, easing and formatting utilities.                     *
 * ─────────────────────────────────────────────────────────────────── */

export const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (t) => clamp(t, 0, 1);
export const lerp    = (a, b, t) => a + (b - a) * t;
export const mix     = lerp;

/** Smoothstep – Hermite interpolation */
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* ─── Easing functions ─────────────────────────────────────────── */
export const easeInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutBack = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
};

export const easeOutBounce = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d)     return n * t * t;
  if (t < 2 / d)     return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d)   return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

export const easeInQuad  = (t) => t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

/** Spring solver – damped oscillation */
export const spring = (t, stiffness = 12, damping = 4) => {
  return 1 - Math.exp(-damping * t) * Math.cos(stiffness * t);
};

/* ─── Formatting ───────────────────────────────────────────────── */
export const fmt = (s) => {
  const m  = Math.floor(s / 60);
  const sc = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sc.toFixed(1).padStart(4, "0")}`;
};

/* ─── Color utilities ──────────────────────────────────────────── */

/** Parse any CSS hex (#RGB, #RRGGBB) into [r,g,b] 0-255 */
export function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Lighten a hex colour by amount (0-1) */
export function lighten(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(Math.min(255, c + (255 - c) * amount));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Darken a hex colour by amount (0-1) */
export function darken(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(Math.max(0, c * (1 - amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Linear interpolation between two hex colours */
export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}

/* ─── Noise (simple 1D value noise for organic motion) ─────────── */
const _noiseCache = {};
export function noise1D(seed) {
  if (_noiseCache[seed] === undefined) {
    _noiseCache[seed] = Math.sin(seed * 127.1 + 311.7) * 43758.5453 % 1;
  }
  return _noiseCache[seed];
}

export function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(noise1D(i), noise1D(i + 1), u);
}
