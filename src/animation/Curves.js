/* ── Curves.js ─────────────────────────────────────────────────────── *
 *  Extended easing library and motion curve utilities.               *
 * ─────────────────────────────────────────────────────────────────── */

import {
  easeInOut,
  easeOutBack,
  easeOutElastic,
  easeOutBounce,
  easeInQuad,
  easeOutQuad,
  spring,
  clamp01,
} from "../utils/helpers.js";

export { easeInOut, easeOutBack, easeOutElastic, easeOutBounce, easeInQuad, easeOutQuad, spring, clamp01 };

/**
 * Cubic bezier approximation.
 * @param {number} x1 – control point 1 x
 * @param {number} y1 – control point 1 y
 * @param {number} x2 – control point 2 x
 * @param {number} y2 – control point 2 y
 * @returns {function(t: number): number}
 */
export function cubicBezier(x1, y1, x2, y2) {
  return (t) => {
    // Newton–Raphson approximation (3 iterations is enough for animation)
    let x = t;
    for (let i = 0; i < 3; i++) {
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const currentX = ((ax * x + bx) * x + cx) * x;
      const dx = (3 * ax * x + 2 * bx) * x + cx;
      if (Math.abs(dx) < 1e-6) break;
      x -= (currentX - t) / dx;
    }
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return ((ay * x + by) * x + cy) * x;
  };
}

/** Overshoot – like easeOutBack but stronger */
export const overshoot = (t) => {
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Smooth deceleration for walk/run cycles */
export const decel = (t) => 1 - Math.pow(1 - t, 3);

/** Pick an easing function by name string (for AI-generated specs) */
export function getEasing(name) {
  const map = {
    linear: (t) => t,
    ease_in_out: easeInOut,
    ease_out_back: easeOutBack,
    ease_out_elastic: easeOutElastic,
    ease_out_bounce: easeOutBounce,
    overshoot,
    spring: (t) => spring(t),
    decel,
  };
  return map[name] || map.ease_in_out;
}


