/* ── ShadowEngine.js ───────────────────────────────────────────────── *
 *  Draws soft ground shadows, contact shadows, and cloud shadows.    *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01 } from "../utils/helpers.js";

/**
 * Draw a soft elliptical ground shadow beneath an object.
 * Call BEFORE drawing the object itself.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x        – object centre X
 * @param {number} y        – object ground-line Y
 * @param {number} width    – shadow ellipse width
 * @param {number} height   – shadow ellipse height (squash)
 * @param {number} opacity  – 0-1
 * @param {number} blur     – gaussian-ish blur radius
 */
export function drawGroundShadow(ctx, x, y, width, height, opacity = 0.18, blur = 8) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = `blur(${blur}px)`;

  const grad = ctx.createRadialGradient(x, y, 0, x, y, width);
  grad.addColorStop(0, "rgba(30,20,50,0.7)");
  grad.addColorStop(0.6, "rgba(30,20,50,0.3)");
  grad.addColorStop(1, "rgba(30,20,50,0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y + height * 0.3, width, height, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.filter = "none";
  ctx.restore();
}

/**
 * Draw a contact shadow — a small, tight darkening directly under an object.
 */
export function drawContactShadow(ctx, x, y, width, opacity = 0.22) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = "blur(3px)";
  ctx.fillStyle = "rgba(20,10,30,0.8)";
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.5, width * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();
}

/**
 * Draw slow-moving cloud shadows across the landscape.
 * Called once per frame over the whole scene.
 */
export function drawCloudShadows(ctx, W, H, absT, lighting) {
  if (!lighting || lighting.ambient > 0.65) return; // skip on night / overcast
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = "multiply";

  for (let i = 0; i < 3; i++) {
    const speed = 0.012 + i * 0.005;
    const cx = ((absT * speed * W + i * W * 0.4) % (W * 1.6)) - W * 0.3;
    const cy = H * (0.35 + i * 0.15);
    const rw = W * (0.25 + i * 0.08);
    const rh = H * 0.15;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
    g.addColorStop(0, "rgba(80,60,120,0.5)");
    g.addColorStop(1, "rgba(80,60,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
