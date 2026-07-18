/* ── Camera.js ─────────────────────────────────────────────────────── *
 *  Cinematic camera with zoom, pan, tilt, shake, and breathing.      *
 *  Returns a transform to apply to the canvas context each frame.    *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01, lerp, easeInOut, smoothNoise } from "../utils/helpers.js";

/**
 * Camera preset types:
 *   "slow_zoom_in"  | "slow_zoom_out" | "pan_left" | "pan_right"
 *   "tilt_up"       | "dolly_in"      | "ken_burns" | "static"
 *
 * The spec can set `camera: { type, intensity }` per scene.
 * If not present we auto-pick based on scene content.
 */

const PRESETS = {
  slow_zoom_in:  { zoomFrom: 1.0,  zoomTo: 1.12, panX: 0, panY: 0 },
  slow_zoom_out: { zoomFrom: 1.12, zoomTo: 1.0,  panX: 0, panY: 0 },
  pan_left:      { zoomFrom: 1.06, zoomTo: 1.06, panX:  0.06, panY: 0 },
  pan_right:     { zoomFrom: 1.06, zoomTo: 1.06, panX: -0.06, panY: 0 },
  tilt_up:       { zoomFrom: 1.05, zoomTo: 1.05, panX: 0, panY: 0.04 },
  dolly_in:      { zoomFrom: 1.0,  zoomTo: 1.18, panX: 0, panY: -0.03 },
  ken_burns:     { zoomFrom: 1.0,  zoomTo: 1.1,  panX: -0.04, panY: -0.02 },
  static:        { zoomFrom: 1.0,  zoomTo: 1.0,  panX: 0, panY: 0 },
};

/** Auto-select a camera preset based on scene keywords */
export function autoCamera(spec) {
  if (spec.camera?.type && PRESETS[spec.camera.type]) return spec.camera.type;
  const types = ["slow_zoom_in", "ken_burns", "pan_right", "slow_zoom_out", "tilt_up", "dolly_in"];
  // deterministic pick from scene hash
  const hash = JSON.stringify(spec).length;
  return types[hash % types.length];
}

/**
 * Compute camera transform for a given frame.
 *
 * @param {object}  spec     – scene spec (may contain `camera`)
 * @param {number}  sceneT   – normalised scene time 0→1
 * @param {number}  absT     – absolute time in seconds (for shake/breathing)
 * @param {number}  W        – canvas width
 * @param {number}  H        – canvas height
 * @returns {{ zoom, offsetX, offsetY }} – apply before scene draw
 */
export function computeCamera(spec, sceneT, absT, W, H) {
  const type = autoCamera(spec);
  const preset = PRESETS[type] || PRESETS.static;
  const intensity = spec.camera?.intensity ?? 1;
  const t = easeInOut(sceneT);

  // Zoom interpolation
  const zoom = lerp(preset.zoomFrom, preset.zoomTo, t);

  // Pan interpolation
  let panX = preset.panX * t * W * intensity;
  let panY = preset.panY * t * H * intensity;

  // Camera breathing – subtle low-frequency oscillation
  const breathX = Math.sin(absT * 0.4) * W * 0.002;
  const breathY = Math.cos(absT * 0.55) * H * 0.0015;

  // Micro shake for organic feel
  const shakeAmt = spec.camera?.shake ?? 0.3;
  const shakeX = smoothNoise(absT * 8) * W * 0.001 * shakeAmt;
  const shakeY = smoothNoise(absT * 8 + 99) * H * 0.001 * shakeAmt;

  return {
    zoom,
    offsetX: panX + breathX + shakeX,
    offsetY: panY + breathY + shakeY,
  };
}

/**
 * Apply camera transform to the context.
 * Call before drawing the scene, and restore() after.
 */
export function applyCamera(ctx, cam, W, H) {
  ctx.save();
  ctx.translate(W / 2 + cam.offsetX, H / 2 + cam.offsetY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-W / 2, -H / 2);
}

/** Restore camera transform */
export function restoreCamera(ctx) {
  ctx.restore();
}
