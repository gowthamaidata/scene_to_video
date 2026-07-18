/* ── Lighting.js ───────────────────────────────────────────────────── *
 *  Scene-wide lighting: ambient, directional, rim, time-of-day.      *
 *  Each shape renderer calls `applyLighting()` for per-element fx.   *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01, lerp, darken, lighten } from "../utils/helpers.js";

/**
 * Derive a lighting context from a scene spec.
 * `spec.lighting` is optional; defaults are auto-derived from bg.
 */
export function deriveLighting(spec) {
  const bg0 = spec.bg?.[0] || "#8FD4FF";
  const isNight = isDark(bg0);
  const isSunset = isSunsetPalette(bg0);

  return {
    ambient:      isNight ? 0.35 : 0.7,
    directional:  isNight ? 0.2  : 0.6,
    sunAngle:     isSunset ? -0.6 : -0.85,     // radians, -PI/2 = top
    sunColor:     isSunset ? "#FFB070" : isNight ? "#8899CC" : "#FFFBE0",
    rimStrength:  isNight ? 0.25 : 0.15,
    rimColor:     isNight ? "#6688CC" : "#FFFFFFAA",
    bounceColor:  isNight ? "#332255" : "#E8F4E0",
    bounceStrength: 0.12,
    ...(spec.lighting || {}),
  };
}

/** Apply ambient + directional overlay to a ctx fill/stroke region */
export function applyObjectLighting(ctx, color, size, lighting) {
  // Top highlight
  const hg = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
  hg.addColorStop(0, `rgba(255,255,255,${0.18 * lighting.directional})`);
  hg.addColorStop(0.5, "rgba(255,255,255,0)");
  hg.addColorStop(1, `rgba(0,0,0,${0.12 * (1 - lighting.ambient)})`);
  ctx.fillStyle = hg;
  ctx.globalCompositeOperation = "soft-light";
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/** Draw a soft rim-light arc on the upper edge of a circular shape */
export function drawRimLight(ctx, size, lighting) {
  if (lighting.rimStrength < 0.01) return;
  ctx.save();
  ctx.globalAlpha = lighting.rimStrength;
  ctx.globalCompositeOperation = "screen";
  const rg = ctx.createRadialGradient(
    size * 0.15, -size * 0.3, size * 0.05,
    0, 0, size * 0.55
  );
  rg.addColorStop(0, lighting.rimColor || "#FFFFFF");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Apply a global colour-grade overlay (vignette + tint) */
export function drawSceneLightingOverlay(ctx, W, H, lighting) {
  // Warm/cool wash
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = lighting.sunColor || "#FFF8E0";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ── Internal helpers ─────────────────────────────────────────────── */

function isDark(hex) {
  const m = hex.match(/[0-9a-fA-F]{2}/g);
  if (!m) return false;
  const lum = m.map((h) => parseInt(h, 16)).reduce((a, c) => a + c, 0) / 3;
  return lum < 100;
}

function isSunsetPalette(hex) {
  const [r, g, b] = (hex.match(/[0-9a-fA-F]{2}/g) || []).map((h) => parseInt(h, 16));
  return r > 150 && g < 140 && b < 140;
}
