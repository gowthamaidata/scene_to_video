/* ── Renderer.js ───────────────────────────────────────────────────── *
 *  Main scene renderer — orchestrates all layers:                    *
 *    1. Camera transform                                             *
 *    2. Environment (sky, mountains, ground)                         *
 *    3. Cloud shadows                                                *
 *    4. Scene elements (sorted by depth)                             *
 *    5. Particles                                                    *
 *    6. Caption overlay                                              *
 *    7. Scene lighting overlay                                       *
 *    8. Post-processing                                              *
 * ─────────────────────────────────────────────────────────────────── */

import { OUTLINE } from "../utils/constants.js";
import { clamp01, easeOutBack } from "../utils/helpers.js";
import { computeCamera, applyCamera, restoreCamera } from "./Camera.js";
import { deriveLighting, drawSceneLightingOverlay } from "./Lighting.js";
import { drawCloudShadows } from "./ShadowEngine.js";
import { drawEnvironment } from "./Environment.js";
import { deriveParticles, initParticles, drawParticles } from "./Particles.js";
import { applyPostProcessing } from "./PostProcessing.js";
import { drawElement } from "./shapes/index.js";

/** Cache: particles are init'd once per scene, not per frame */
let _particleSceneId = null;

/**
 * Render a complete frame for one scene.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object}  spec     – compiled scene spec
 * @param {number}  W, H     – canvas dimensions
 * @param {number}  sceneT   – normalised 0→1 scene progress
 * @param {number}  absT     – absolute time in seconds
 */
export function renderScene(ctx, spec, W, H, sceneT, absT) {
  const lighting = deriveLighting(spec);
  const cam = computeCamera(spec, sceneT, absT, W, H);

  // ── 1. Camera ──
  applyCamera(ctx, cam, W, H);

  // ── 2. Environment background ──
  drawEnvironment(ctx, spec, W, H, sceneT, absT, cam);

  // ── 3. Cloud shadows ──
  drawCloudShadows(ctx, W, H, absT, lighting);

  // ── 4. Scene elements ──
  //   Sort by implicit depth: hills/waves first, then objects, then foreground
  const depthOrder = { wave: 0, hill: 1, city: 2, tree: 3, house: 4, flower: 5,
    cat: 6, bunny: 6, car: 6, fish: 6, bird: 7, butterfly: 8, balloon: 9,
    rocket: 7, rainbow: 3, cloud: 10, rain: 11, star: 0, sun: 0, moon: 0 };

  const sorted = [...(spec.elements || [])].sort(
    (a, b) => (depthOrder[a.shape] ?? 5) - (depthOrder[b.shape] ?? 5)
  );

  sorted.forEach((e) => drawElement(ctx, e, W, H, absT, sceneT, lighting));

  // ── 5. Particles ──
  const sceneId = JSON.stringify(spec.bg) + spec.elements?.length;
  if (_particleSceneId !== sceneId) {
    const defs = deriveParticles(spec);
    initParticles(defs, W, H);
    _particleSceneId = sceneId;
  }
  drawParticles(ctx, W, H, absT, sceneT);

  // ── 6. Caption ──
  if (spec.caption) {
    drawCaption(ctx, spec.caption, W, H, sceneT);
  }

  // ── 7. Lighting overlay ──
  drawSceneLightingOverlay(ctx, W, H, lighting);

  // ── Camera restore ──
  restoreCamera(ctx);

  // ── 8. Post-processing (applied after camera restore, in screen space) ──
  applyPostProcessing(ctx, W, H, absT);
}

/* ── Caption renderer ─────────────────────────────────────────────── */

function drawCaption(ctx, text, W, H, sceneT) {
  ctx.save();
  const pop = easeOutBack(clamp01((sceneT - 0.3) * 2.5));
  ctx.globalAlpha = clamp01((sceneT - 0.3) * 4);
  ctx.translate(W / 2, H * 0.42);
  ctx.scale(pop, pop);

  const fontSize = H * 0.1;
  ctx.font = `800 ${fontSize}px 'Bricolage Grotesque', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Shadow
  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.filter = "blur(8px)";
  ctx.fillText(text, 3, 5);
  ctx.filter = "none";
  ctx.restore();

  // Outline
  ctx.lineWidth = H * 0.018;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = "round";
  ctx.strokeText(text, 0, 0);

  // Fill with gradient
  const tg = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
  tg.addColorStop(0, "#FFF8B0");
  tg.addColorStop(0.5, "#FFE066");
  tg.addColorStop(1, "#FFB830");
  ctx.fillStyle = tg;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

/**
 * Render the scene-transition crossfade between two specs.
 * Called by the main loop when transitioning.
 */
export function renderTransition(ctx, specA, specB, W, H, blend, absT) {
  // Draw outgoing scene
  renderScene(ctx, specA, W, H, 1.0, absT);

  // Blend incoming scene on top
  ctx.save();
  ctx.globalAlpha = blend;
  renderScene(ctx, specB, W, H, 0, absT);
  ctx.restore();
}
