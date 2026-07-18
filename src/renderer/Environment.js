/* ── Environment.js ────────────────────────────────────────────────── *
 *  Draws the layered background: sky, mountains, ground, water.      *
 *  Every layer has depth-based parallax and its own lighting.        *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01, lerp, smoothNoise, darken, lighten } from "../utils/helpers.js";
import { skyGradient, drawGrassTexture, waterGradient } from "./Materials.js";

/**
 * Draw the entire environment backdrop (called before any elements).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}  spec    – scene spec
 * @param {number}  W, H    – canvas dimensions
 * @param {number}  sceneT  – normalised 0→1 scene time
 * @param {number}  absT    – absolute seconds
 * @param {object}  cam     – camera { zoom, offsetX, offsetY }
 */
export function drawEnvironment(ctx, spec, W, H, sceneT, absT, cam) {
  drawSky(ctx, spec, W, H, absT);
  drawGodRays(ctx, spec, W, H, absT);
  drawDistantMountains(ctx, spec, W, H, absT, cam);
  drawGround(ctx, spec, W, H, absT, cam);
}

/* ── Sky ───────────────────────────────────────────────────────────── */

function drawSky(ctx, spec, W, H, absT) {
  const colors = spec.bg || ["#8FD4FF", "#E8FBFF"];
  ctx.fillStyle = skyGradient(ctx, colors, W, H);
  ctx.fillRect(0, 0, W, H);

  // Atmosphere haze band near horizon
  ctx.save();
  ctx.globalAlpha = 0.12;
  const haze = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.75);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(0.5, lighten(colors[1], 0.3));
  haze.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.55, W, H * 0.2);
  ctx.restore();
}

/* ── God Rays ──────────────────────────────────────────────────────── */

function drawGodRays(ctx, spec, W, H, absT) {
  // Only for non-night scenes
  const bgDark = isDark(spec.bg?.[0]);
  if (bgDark) return;

  ctx.save();
  ctx.globalAlpha = 0.04 + Math.sin(absT * 0.3) * 0.01;
  ctx.globalCompositeOperation = "screen";

  const cx = W * 0.75, cy = H * 0.05;
  for (let i = 0; i < 4; i++) {
    const angle = -0.5 + i * 0.15 + Math.sin(absT * 0.1 + i) * 0.03;
    const len = H * 1.2;
    const spread = 40 + i * 12;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len - spread, cy + Math.sin(angle + Math.PI / 2) * len);
    ctx.lineTo(cx + Math.cos(angle) * len + spread, cy + Math.sin(angle + Math.PI / 2) * len);
    ctx.closePath();

    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle + Math.PI / 2) * len);
    g.addColorStop(0, "rgba(255,250,220,0.5)");
    g.addColorStop(1, "rgba(255,250,220,0)");
    ctx.fillStyle = g;
    ctx.fill();
  }

  ctx.restore();
}

/* ── Distant Mountains (parallax back-layer) ──────────────────────── */

function drawDistantMountains(ctx, spec, W, H, absT, cam) {
  // Only draw if there are hills/mountains/trees in the scene
  const els = (spec.elements || []).map((e) => e.shape);
  if (!els.some((s) => ["hill", "tree", "house", "city", "flower"].includes(s))) return;

  const parallax = cam ? cam.offsetX * 0.15 : 0;
  const baseY = H * 0.65;

  // Layer 1 — far mountains (blurred, muted)
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = darken(spec.bg?.[1] || "#E8FBFF", 0.1);

  ctx.beginPath();
  ctx.moveTo(-20 + parallax * 0.3, baseY);
  for (let x = -20; x <= W + 20; x += 4) {
    const h = 40 + smoothNoise(x * 0.004 + 1.5) * 80 + smoothNoise(x * 0.012) * 30;
    ctx.lineTo(x + parallax * 0.3, baseY - h);
  }
  ctx.lineTo(W + 20, H);
  ctx.lineTo(-20, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Layer 2 — mid mountains
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = darken(spec.bg?.[1] || "#E8FBFF", 0.18);

  ctx.beginPath();
  ctx.moveTo(-20 + parallax * 0.5, baseY + 15);
  for (let x = -20; x <= W + 20; x += 4) {
    const h = 25 + smoothNoise(x * 0.006 + 5.5) * 55 + smoothNoise(x * 0.02 + 3) * 20;
    ctx.lineTo(x + parallax * 0.5, baseY + 15 - h);
  }
  ctx.lineTo(W + 20, H);
  ctx.lineTo(-20, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ── Ground ────────────────────────────────────────────────────────── */

function drawGround(ctx, spec, W, H, absT, cam) {
  const els = (spec.elements || []).map((e) => e.shape);
  const hasWater = els.includes("wave");
  const hasGround = els.some((s) => ["hill", "tree", "flower", "house"].includes(s));

  if (hasWater) {
    drawWaterLayer(ctx, spec, W, H, absT, cam);
  }

  if (hasGround) {
    // Subtle grass texture at the base
    const groundY = H * 0.88;
    drawGrassTexture(ctx, -20, groundY, W + 40, H * 0.14, "#57B96A", absT);
  }
}

/* ── Water layer ──────────────────────────────────────────────────── */

function drawWaterLayer(ctx, spec, W, H, absT) {
  const waterY = H * 0.78;

  // Reflection of sky (flipped gradient, muted)
  ctx.save();
  ctx.globalAlpha = 0.15;
  const bg = spec.bg || ["#8FD4FF", "#E8FBFF"];
  const rg = ctx.createLinearGradient(0, waterY, 0, H);
  rg.addColorStop(0, bg[0]);
  rg.addColorStop(1, bg[1]);
  ctx.fillStyle = rg;
  ctx.fillRect(0, waterY, W, H - waterY);
  ctx.restore();

  // Specular highlight band
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 3; i++) {
    const sy = waterY + 20 + i * 30 + Math.sin(absT * 0.5 + i) * 5;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(W * 0.5 + Math.sin(absT * 0.3 + i * 2) * 60, sy, W * 0.35, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function isDark(hex) {
  if (!hex) return false;
  const m = hex.match(/[0-9a-fA-F]{2}/g);
  if (!m) return false;
  return m.map((h) => parseInt(h, 16)).reduce((a, c) => a + c, 0) / 3 < 100;
}
