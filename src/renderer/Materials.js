/* ── Materials.js ──────────────────────────────────────────────────── *
 *  Rich material helpers replacing flat fills. Every shape should     *
 *  call these instead of plain ctx.fillStyle.                         *
 * ─────────────────────────────────────────────────────────────────── */

import { darken, lighten } from "../utils/helpers.js";

/**
 * Create a vertical body gradient — lighter on top, darker below.
 */
export function bodyGradient(ctx, color, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, lighten(color, 0.18));
  g.addColorStop(0.45, color);
  g.addColorStop(1, darken(color, 0.15));
  return g;
}

/**
 * Create a radial "globe" gradient — centre highlight, darker edges.
 * Great for sun, balloons, fruit, character heads.
 */
export function sphereGradient(ctx, color, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
  g.addColorStop(0, lighten(color, 0.3));
  g.addColorStop(0.55, color);
  g.addColorStop(1, darken(color, 0.2));
  return g;
}

/**
 * Glossy specular highlight — a small white ellipse near the top.
 */
export function drawSpecular(ctx, cx, cy, w, h, angle = -0.3) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Sky gradient with multiple stops for richer atmosphere.
 */
export function skyGradient(ctx, colors, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (colors.length === 2) {
    g.addColorStop(0,    colors[0]);
    g.addColorStop(0.6,  lerpHex(colors[0], colors[1], 0.4));
    g.addColorStop(1,    colors[1]);
  } else {
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  }
  return g;
}

/**
 * Grass/foliage noise texture overlay — draw after the base fill.
 */
export function drawGrassTexture(ctx, x, y, w, h, color, t) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  const blades = Math.floor(w / 6);
  for (let i = 0; i < blades; i++) {
    const bx = x + (i / blades) * w;
    const sway = Math.sin(t * 1.6 + i * 0.8) * 4;
    const bh = h * (0.3 + (Math.sin(i * 2.7) * 0.5 + 0.5) * 0.5);
    ctx.strokeStyle = darken(color, 0.15 + Math.sin(i * 1.3) * 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + sway, y - bh * 0.6, bx + sway * 1.2, y - bh);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Water material — depth gradient with specular band.
 */
export function waterGradient(ctx, color, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, lighten(color, 0.15));
  g.addColorStop(0.15, color);
  g.addColorStop(0.5, darken(color, 0.12));
  g.addColorStop(1, darken(color, 0.3));
  return g;
}

/* ── Internal ─────────────────────────────────────────────────────── */
function lerpHex(a, b, t) {
  const pa = parseHex(a), pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
