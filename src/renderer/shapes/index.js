/* ── shapes/index.js ───────────────────────────────────────────────── *
 *  Master shape registry. Each shape is a draw function that         *
 *  receives (ctx, e, W, H, t, sceneT, lighting, wind) and renders   *
 *  itself at the current ctx origin.                                 *
 * ─────────────────────────────────────────────────────────────────── */

import { OUTLINE } from "../../utils/constants.js";
import { clamp01, easeInOut, easeOutBack, darken, lighten, smoothNoise } from "../../utils/helpers.js";
import { bodyGradient, sphereGradient, drawSpecular, waterGradient } from "../Materials.js";
import { drawGroundShadow, drawContactShadow } from "../ShadowEngine.js";
import { applyObjectLighting, drawRimLight } from "../Lighting.js";
import { drawFace, getBreathScale } from "../../animation/FaceRig.js";
import { computeWalkCycle, computeHopCycle, computeFlutter } from "../../animation/WalkCycle.js";
import { getWind, swayPhysics, balloonPhysics, tailPhysics } from "../../animation/Physics.js";

/* ── Outline helper ───────────────────────────────────────────────── */
function stroke(ctx, w) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/* ── computePosition: shared position / motion logic ─────────────── */
export function computeElementTransform(e, W, H, t, sceneT) {
  const dl = e.delay || 0;
  const raw = clamp01((sceneT - dl) / Math.max(0.001, 1 - dl));
  const p = e.to ? easeInOut(raw) : 1;
  const from = e.from || { x: 0.5, y: 0.5 };
  const to = e.to || from;
  let x = (from.x + (to.x - from.x) * p) * W;
  let y = (from.y + (to.y - from.y) * p) * H;
  let size = (e.size || 0.1) * H;
  if (e.pulse) size *= 1 + 0.08 * Math.sin(t * 4 + dl * 10);

  let scale = 1;
  if (e.grow) scale = raw <= 0 ? 0 : easeOutBack(clamp01(raw * 1.6));

  const wind = getWind(t);
  if (e.walk) {
    const cycle = computeWalkCycle(raw * 4, size);
    y += cycle.hipY;
    x += cycle.hipX;
  }
  if (e.flutter) {
    const fl = computeFlutter(raw * 2, size);
    y += fl.bodyBob;
  }
  if (e.sway) {
    const bp = balloonPhysics(t, wind.x, e.delay ? e.delay * 100 : 0);
    x += bp.swayX;
    y += bp.swayY;
  }

  const facing = (to.x < from.x) ? -1 : 1;
  const alpha = clamp01(sceneT * 6);

  return { x, y, size, scale, facing, alpha, raw, wind };
}

/* ── Shape draw functions ─────────────────────────────────────────── */

function drawSun(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Glow aura
  ctx.save();
  ctx.globalAlpha = 0.15;
  const aura = ctx.createRadialGradient(0, 0, size * 0.4, 0, 0, size * 1.2);
  aura.addColorStop(0, "#FFF8B0");
  aura.addColorStop(1, "rgba(255,248,176,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Rotating rays
  ctx.save(); ctx.rotate(t * 0.2);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    const rayLen = size * (0.72 + Math.sin(t * 2 + i * 0.7) * 0.06);
    ctx.fillStyle = lighten(e.color || "#FFC93C", 0.1);
    ctx.beginPath();
    ctx.moveTo(size * 0.48, -size * 0.06);
    ctx.lineTo(rayLen, 0);
    ctx.lineTo(size * 0.48, size * 0.06);
    ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.5);
  }
  ctx.restore();

  // Body sphere
  ctx.fillStyle = sphereGradient(ctx, e.color || "#FFC93C", 0, 0, size * 0.5);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
  drawRimLight(ctx, size, lighting);

  if (e.face !== false) drawFace(ctx, size, t, { emotion: "happy" });
  ctx.restore();
}

function drawMoon(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.12;
  const glow = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.0);
  glow.addColorStop(0, "#FFF8D0");
  glow.addColorStop(1, "rgba(255,248,208,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = sphereGradient(ctx, e.color || "#FFF3C4", 0, 0, size * 0.5);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);

  // Craters with soft shading
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  [[-0.15, -0.1, 0.1], [0.18, 0.12, 0.07], [0.02, 0.25, 0.05], [-0.08, 0.18, 0.04]].forEach(([cx, cy, r]) => {
    ctx.beginPath(); ctx.arc(cx * size, cy * size, r * size, 0, Math.PI * 2); ctx.fill();
  });

  drawRimLight(ctx, size, lighting);
  if (e.face) drawFace(ctx, size, t, { emotion: "happy", dx: 0.18, mouthScale: 0.8 });
  ctx.restore();
}

function drawStar(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(1.5, size * 0.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Twinkle glow
  const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + (e.delay || 0) * 10));
  ctx.save();
  ctx.globalAlpha = 0.3 * twinkle;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
  glow.addColorStop(0, e.color || "#FFE58A");
  glow.addColorStop(1, "rgba(255,229,138,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = e.color || "#FFE58A";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? size * 0.24 : size * 0.55;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill(); stroke(ctx, ow);
  drawSpecular(ctx, -size * 0.1, -size * 0.15, size * 0.08, size * 0.05);

  if (e.face) drawFace(ctx, size * 0.8, t, { emotion: "happy", dx: 0.14, dy: 0, mouthScale: 0.7 });
  ctx.restore();
}

function drawCloud(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.03);
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Soft cloud shadow
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.translate(4, 6);
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.filter = "blur(6px)";
  drawCloudPath(ctx, size);
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  // Cloud body with gradient
  const cg = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.3);
  cg.addColorStop(0, "#FFFFFF");
  cg.addColorStop(1, "#E8EEF5");
  ctx.fillStyle = cg;
  drawCloudPath(ctx, size);
  ctx.fill(); stroke(ctx, ow);

  // Top highlight
  drawSpecular(ctx, -size * 0.1, -size * 0.3, size * 0.25, size * 0.1);

  ctx.restore();
}

function drawCloudPath(ctx, size) {
  ctx.beginPath();
  ctx.arc(-size * 0.7, 0, size * 0.5, 0, Math.PI * 2);
  ctx.arc(0, -size * 0.3, size * 0.65, 0, Math.PI * 2);
  ctx.arc(size * 0.7, 0, size * 0.5, 0, Math.PI * 2);
  ctx.arc(0, size * 0.15, size * 0.55, 0, Math.PI * 2);
}

function drawRainbow(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha, raw } = computeElementTransform(e, W, H, t, sceneT);
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const bands = ["#FF6B6B", "#FFA94D", "#FFE066", "#69DB7C", "#4DABF7", "#B197FC"];
  const grow = clamp01(raw * 1.4);
  bands.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(0, 0, size * (1.6 - i * 0.13), Math.PI, Math.PI + Math.PI * grow);
    ctx.strokeStyle = c;
    ctx.lineWidth = size * 0.1;
    ctx.lineCap = "round";
    ctx.globalAlpha = alpha * (0.5 + 0.5 * grow);
    ctx.stroke();
  });

  ctx.restore();
}

function drawHill(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.03);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Hill body with gradient
  const hg = bodyGradient(ctx, e.color || "#6FCB7C", -size, 0);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.85, size, 0, Math.PI, 0);
  ctx.fill(); stroke(ctx, ow);

  // Grass detail tufts
  ctx.save();
  ctx.globalAlpha = 0.4;
  const tufts = 12;
  for (let i = 0; i < tufts; i++) {
    const gx = -W * 0.5 + (i / tufts) * W;
    const gy = -size * 0.25 + (i % 2) * size * 0.12;
    const sway = Math.sin(t * 1.5 + i * 0.9) * 5;
    ctx.strokeStyle = darken(e.color || "#6FCB7C", 0.1 + Math.sin(i) * 0.05);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + sway, gy - size * 0.15, gx + sway * 1.5, gy - size * 0.25);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

function drawTree(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha, wind } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.035);
  const sway = swayPhysics(t, 1, e.delay || 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Shadow
  drawGroundShadow(ctx, size * 0.1, size * 0.15, size * 0.5, size * 0.08, 0.12, 6);

  // Trunk
  ctx.rotate(sway);
  ctx.fillStyle = bodyGradient(ctx, "#8A5A38", -size * 0.25, size * 0.4);
  ctx.beginPath(); ctx.roundRect(-size * 0.08, -size * 0.25, size * 0.16, size * 0.42, size * 0.04);
  ctx.fill(); stroke(ctx, ow * 0.6);

  // Foliage clusters with depth
  const foliage = [
    [-0.3, -0.55, 0.28, -0.08], [0.3, -0.55, 0.28, 0.05],
    [0, -0.78, 0.34, 0], [0, -0.4, 0.3, 0.03],
  ];
  foliage.forEach(([cx, cy, r, phase]) => {
    const leafSway = Math.sin(t * 1.2 + phase * 10) * 0.015;
    ctx.save(); ctx.rotate(leafSway);
    ctx.fillStyle = sphereGradient(ctx, e.color || "#4CAF6D", cx * size, cy * size, r * size);
    ctx.beginPath();
    ctx.arc(cx * size, cy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  // Outline around combined foliage
  ctx.beginPath();
  ctx.arc(0, -size * 0.55, size * 0.5, 0, Math.PI * 2);
  stroke(ctx, ow * 0.5);

  ctx.restore();
}

function drawFlower(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha, wind } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(1.5, size * 0.035);
  const sway = swayPhysics(t, 1.5, e.delay || 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(sway);

  // Stem
  ctx.strokeStyle = "#57B96A"; ctx.lineWidth = size * 0.1; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, size * 0.1);
  ctx.quadraticCurveTo(size * 0.08, size * 0.55, 0, size * 1.0);
  ctx.stroke();

  // Leaf on stem
  ctx.fillStyle = "#57B96A";
  ctx.save(); ctx.translate(size * 0.05, size * 0.5); ctx.rotate(0.6);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.14, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Petals with gradient
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.sin(t * 0.8) * 0.03;
    ctx.save();
    ctx.translate(Math.cos(a) * size * 0.28, Math.sin(a) * size * 0.28);
    ctx.rotate(a);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.2);
    pg.addColorStop(0, lighten(e.color || "#FF8FA3", 0.25));
    pg.addColorStop(1, e.color || "#FF8FA3");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.2, size * 0.13, 0, 0, Math.PI * 2);
    ctx.fill(); stroke(ctx, ow * 0.4);
    ctx.restore();
  }

  // Centre with glow
  ctx.fillStyle = sphereGradient(ctx, "#FFE066", 0, 0, size * 0.18);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.4);

  ctx.restore();
}

function drawHouse(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  drawGroundShadow(ctx, 0, size * 0.32, size * 0.7, size * 0.06, 0.15, 8);

  // Wall with gradient
  ctx.fillStyle = bodyGradient(ctx, e.color || "#FFB0A0", -size * 0.45, size * 0.3);
  ctx.beginPath(); ctx.roundRect(-size * 0.5, -size * 0.45, size, size * 0.75, size * 0.03);
  ctx.fill(); stroke(ctx, ow);

  // Roof with shading
  const rg = ctx.createLinearGradient(-size * 0.6, -size * 0.95, size * 0.6, -size * 0.45);
  rg.addColorStop(0, "#D44A3A");
  rg.addColorStop(0.5, "#E8604C");
  rg.addColorStop(1, "#C43A2A");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, -size * 0.45);
  ctx.lineTo(0, -size * 0.95);
  ctx.lineTo(size * 0.62, -size * 0.45);
  ctx.closePath(); ctx.fill(); stroke(ctx, ow);

  // Door
  ctx.fillStyle = bodyGradient(ctx, "#7A4A32", -size * 0.1, size * 0.3);
  ctx.beginPath(); ctx.roundRect(-size * 0.12, -size * 0.08, size * 0.24, size * 0.38, [size * 0.06, size * 0.06, 0, 0]);
  ctx.fill(); stroke(ctx, ow * 0.6);
  // Doorknob
  ctx.fillStyle = "#FFD700";
  ctx.beginPath(); ctx.arc(size * 0.06, size * 0.12, size * 0.025, 0, Math.PI * 2); ctx.fill();

  // Window with reflection
  ctx.fillStyle = "#BFE9FF";
  ctx.beginPath(); ctx.roundRect(size * 0.18, -size * 0.32, size * 0.2, size * 0.2, size * 0.03);
  ctx.fill(); stroke(ctx, ow * 0.6);
  // Window glint
  drawSpecular(ctx, size * 0.24, -size * 0.28, size * 0.04, size * 0.03);

  // Window on left side
  ctx.fillStyle = "#BFE9FF";
  ctx.beginPath(); ctx.roundRect(-size * 0.38, -size * 0.32, size * 0.2, size * 0.2, size * 0.03);
  ctx.fill(); stroke(ctx, ow * 0.6);

  // Chimney
  ctx.fillStyle = darken(e.color || "#FFB0A0", 0.2);
  ctx.beginPath(); ctx.roundRect(size * 0.2, -size * 0.95, size * 0.12, size * 0.3, size * 0.02);
  ctx.fill(); stroke(ctx, ow * 0.5);

  ctx.restore();
}

function drawCat(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha, facing, raw, wind } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);
  const walk = e.walk ? computeWalkCycle(raw * 4, size) : null;
  const breath = getBreathScale(t);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale * breath);

  drawGroundShadow(ctx, 0, size * 0.48, size * 0.55, size * 0.06, 0.15, 6);

  // Tail with physics
  const tailJoints = tailPhysics(3, t, e.to ? (e.to.x - e.from.x) * 10 : 0, wind.x);
  ctx.save();
  ctx.translate(-size * 0.5, 0);
  ctx.strokeStyle = e.color || "#F5A25D";
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  let tx = 0, ty = 0;
  tailJoints.forEach((j, i) => {
    tx -= Math.cos(j.angle + 1) * size * 0.2;
    ty -= Math.sin(j.angle + 1) * size * 0.22;
    ctx.lineTo(tx, ty);
  });
  ctx.stroke();
  // Tail outline
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = size * 0.12 + ow;
  ctx.globalCompositeOperation = "destination-over";
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // Body
  ctx.fillStyle = sphereGradient(ctx, e.color || "#F5A25D", -size * 0.15, size * 0.05, size * 0.45);
  ctx.beginPath(); ctx.ellipse(-size * 0.15, size * 0.1, size * 0.48, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow);

  // Legs with walk cycle
  const legPositions = [-0.4, -0.1, 0.15, 0.35];
  legPositions.forEach((lx, i) => {
    const legOffset = walk ? (i < 2 ? walk.frontLegL : walk.backLegL) * (i % 2 ? -1 : 1) : 0;
    ctx.fillStyle = bodyGradient(ctx, e.color || "#F5A25D", size * 0.3, size * 0.58);
    ctx.beginPath(); ctx.roundRect((lx + legOffset * 0.003) * size, size * 0.3, size * 0.14, size * 0.26, size * 0.07);
    ctx.fill(); stroke(ctx, ow * 0.5);
  });

  // Ears
  const earColors = darken(e.color || "#F5A25D", 0.05);
  [[0.2, -0.5, 0.3, -0.88, 0.45, -0.55], [0.62, -0.5, 0.78, -0.85, 0.88, -0.48]].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.fillStyle = earColors;
    ctx.beginPath();
    ctx.moveTo(x1 * size, y1 * size);
    ctx.lineTo(x2 * size, y2 * size + (walk ? walk.earBounce : 0));
    ctx.lineTo(x3 * size, y3 * size);
    ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.6);
    // Inner ear
    ctx.fillStyle = "#FFCCBB";
    ctx.beginPath();
    ctx.moveTo((x1 + 0.04) * size, (y1 + 0.03) * size);
    ctx.lineTo(x2 * size, (y2 + 0.08) * size + (walk ? walk.earBounce : 0));
    ctx.lineTo((x3 - 0.04) * size, (y3 + 0.03) * size);
    ctx.closePath(); ctx.fill();
  });

  // Head
  ctx.fillStyle = sphereGradient(ctx, e.color || "#F5A25D", size * 0.5, -size * 0.35, size * 0.36);
  ctx.beginPath(); ctx.arc(size * 0.5, -size * 0.3, size * 0.36, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow);

  // Face
  ctx.save();
  ctx.translate(size * 0.5, -size * 0.3);
  drawFace(ctx, size * 0.85, t, { emotion: "happy", dx: 0.16, dy: -0.02, mouthScale: 0.8 });
  // Whiskers
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  [[-1, -0.03], [-1, 0.05], [1, -0.03], [1, 0.05]].forEach(([side, dy]) => {
    ctx.beginPath();
    ctx.moveTo(side * size * 0.12, size * dy);
    ctx.lineTo(side * size * 0.32, size * (dy + side * 0.02));
    ctx.stroke();
  });
  ctx.restore();

  ctx.restore();
}

function drawBunny(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha, facing, raw, wind } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);
  const hop = e.walk ? computeHopCycle(raw * 3, size) : null;
  const breath = getBreathScale(t);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + (hop ? hop.hipY : 0));
  ctx.scale(scale * facing * (hop ? hop.squashX : 1), scale * breath * (hop ? hop.squashY : 1));

  drawGroundShadow(ctx, 0, size * 0.45, size * 0.45, size * 0.05, 0.12, 5);

  // Ears with droop physics
  [[0.25, -0.95, -0.12], [0.52, -0.95, 0.15]].forEach(([ex, ey, rot]) => {
    const flop = hop ? hop.earFlop * (ex > 0.4 ? 1 : -1) : 0;
    ctx.save();
    ctx.translate(ex * size, ey * size);
    ctx.rotate(rot + flop);
    ctx.fillStyle = bodyGradient(ctx, e.color || "#F2F2F2", -size * 0.35, size * 0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.11, size * 0.36, 0, 0, Math.PI * 2);
    ctx.fill(); stroke(ctx, ow * 0.6);
    // Inner ear
    ctx.fillStyle = "#FFB9C6";
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.05, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Body
  ctx.fillStyle = sphereGradient(ctx, e.color || "#F2F2F2", -size * 0.1, size * 0.05, size * 0.42);
  ctx.beginPath(); ctx.ellipse(-size * 0.1, size * 0.1, size * 0.44, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow);

  // Fluffy tail
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.arc(-size * 0.48, size * 0.05, size * 0.1, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.5);

  // Head
  ctx.fillStyle = sphereGradient(ctx, e.color || "#F2F2F2", size * 0.42, -size * 0.38, size * 0.34);
  ctx.beginPath(); ctx.arc(size * 0.42, -size * 0.35, size * 0.34, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow);

  // Face
  ctx.save();
  ctx.translate(size * 0.42, -size * 0.35);
  drawFace(ctx, size * 0.85, t, { emotion: "happy", dx: 0.15, dy: -0.02, mouthScale: 0.7 });
  ctx.restore();

  ctx.restore();
}

function drawButterfly(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha, raw } = computeElementTransform(e, W, H, t, sceneT);
  const flutter = computeFlutter(raw * 3, size);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(flutter.bodyTilt);

  const flap = flutter.wingAngle;

  // Wings with gradient
  [-1, 1].forEach((side) => {
    ctx.save(); ctx.scale(side * flap, 1);
    // Upper wing
    const ug = ctx.createRadialGradient(size * 0.5, -size * 0.15, 0, size * 0.5, -size * 0.15, size * 0.5);
    ug.addColorStop(0, lighten(e.color || "#B78BFF", 0.3));
    ug.addColorStop(1, e.color || "#B78BFF");
    ctx.fillStyle = ug;
    ctx.beginPath(); ctx.ellipse(size * 0.55, -size * 0.2, size * 0.5, size * 0.38, -0.3, 0, Math.PI * 2);
    ctx.fill(); stroke(ctx, 1.5);
    // Lower wing
    ctx.fillStyle = darken(e.color || "#B78BFF", 0.1);
    ctx.beginPath(); ctx.ellipse(size * 0.42, size * 0.3, size * 0.35, size * 0.26, 0.3, 0, Math.PI * 2);
    ctx.fill(); stroke(ctx, 1.5);
    // Wing dots
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.arc(size * 0.5, -size * 0.15, size * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Body
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.07, size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  // Antennae
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  [[-1, -0.3], [1, -0.25]].forEach(([sx, curl]) => {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.3);
    ctx.quadraticCurveTo(sx * size * 0.15, -size * 0.6, sx * size * 0.2, -size * 0.55 + curl * size * 0.05);
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(sx * size * 0.2, -size * 0.55, size * 0.03, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

function drawBird(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha, facing } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.04);
  const flap = Math.sin(t * 9 + (e.delay || 0) * 12) * 0.6;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  // Body
  ctx.fillStyle = sphereGradient(ctx, e.color || "#5FB8FF", 0, 0, size * 0.45);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.7);

  // Wing
  ctx.save(); ctx.rotate(flap);
  ctx.fillStyle = darken(e.color || "#5FB8FF", 0.1);
  ctx.beginPath(); ctx.ellipse(-size * 0.1, -size * 0.15, size * 0.35, size * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.5);
  ctx.restore();

  // Beak
  ctx.fillStyle = "#FFA94D";
  ctx.beginPath();
  ctx.moveTo(size * 0.45, -size * 0.05);
  ctx.lineTo(size * 0.72, 0);
  ctx.lineTo(size * 0.45, size * 0.1);
  ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.4);

  // Eye
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.arc(size * 0.24, -size * 0.1, size * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(size * 0.26, -size * 0.1, size * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#FFF";
  ctx.beginPath(); ctx.arc(size * 0.23, -size * 0.13, size * 0.02, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawFish(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha, facing } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.04);
  const wig = Math.sin(t * 6 + (e.delay || 0) * 9) * 0.12;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);
  ctx.rotate(wig);

  ctx.fillStyle = sphereGradient(ctx, e.color || "#FF9A6B", 0, 0, size * 0.45);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.32, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.7);

  // Tail
  ctx.fillStyle = darken(e.color || "#FF9A6B", 0.1);
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.75, -size * 0.28);
  ctx.lineTo(-size * 0.75, size * 0.28);
  ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.5);

  // Eye
  ctx.fillStyle = "#FFF";
  ctx.beginPath(); ctx.arc(size * 0.24, -size * 0.06, size * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(size * 0.26, -size * 0.06, size * 0.04, 0, Math.PI * 2); ctx.fill();

  // Fin
  ctx.fillStyle = lighten(e.color || "#FF9A6B", 0.15);
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.22, size * 0.15, size * 0.1, -0.3, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.4);

  ctx.restore();
}

function drawBalloon(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha, wind } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.04);
  const bp = balloonPhysics(t, wind.x, (e.delay || 0) * 100);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(bp.rotation);

  // String
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, size * 0.55);
  ctx.quadraticCurveTo(size * bp.stringCurve, size * 0.95, 0, size * 1.4);
  ctx.stroke();

  // Balloon body with gloss
  ctx.fillStyle = sphereGradient(ctx, e.color || "#FF6B6B", 0, -size * 0.05, size * 0.48);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.42, size * 0.52, 0, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.6);

  // Gloss highlight
  drawSpecular(ctx, -size * 0.12, -size * 0.18, size * 0.1, size * 0.14);

  // Knot
  ctx.fillStyle = darken(e.color || "#FF6B6B", 0.2);
  ctx.beginPath();
  ctx.moveTo(-size * 0.04, size * 0.52);
  ctx.lineTo(0, size * 0.6);
  ctx.lineTo(size * 0.04, size * 0.52);
  ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawRocket(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Flame
  const fl = size * (0.5 + 0.2 * Math.sin(t * 20));
  ctx.fillStyle = "#FFA94D";
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.06, size * 0.5 + fl * 0.7, 0, size * 0.5 + fl);
  ctx.quadraticCurveTo(size * 0.06, size * 0.5 + fl * 0.7, size * 0.18, size * 0.5);
  ctx.closePath(); ctx.fill();
  // Inner flame
  ctx.fillStyle = "#FFE066";
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, size * 0.5);
  ctx.quadraticCurveTo(0, size * 0.5 + fl * 0.5, size * 0.08, size * 0.5);
  ctx.closePath(); ctx.fill();

  // Fins
  [[-1, 0.4], [1, 0.4]].forEach(([side]) => {
    ctx.fillStyle = darken(e.color || "#FF6B6B", 0.15);
    ctx.beginPath();
    ctx.moveTo(side * size * 0.24, size * 0.35);
    ctx.lineTo(side * size * 0.4, size * 0.55);
    ctx.lineTo(side * size * 0.24, size * 0.5);
    ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.5);
  });

  // Body
  ctx.fillStyle = bodyGradient(ctx, e.color || "#FF6B6B", -size * 0.6, size * 0.5);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.65);
  ctx.quadraticCurveTo(size * 0.34, -size * 0.1, size * 0.26, size * 0.5);
  ctx.lineTo(-size * 0.26, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.34, -size * 0.1, 0, -size * 0.65);
  ctx.fill(); stroke(ctx, ow);

  // Window
  ctx.fillStyle = sphereGradient(ctx, "#BFE9FF", 0, -size * 0.08, size * 0.15);
  ctx.beginPath(); ctx.arc(0, -size * 0.08, size * 0.14, 0, Math.PI * 2);
  ctx.fill(); stroke(ctx, ow * 0.6);
  drawSpecular(ctx, -size * 0.04, -size * 0.12, size * 0.04, size * 0.03);

  ctx.restore();
}

function drawCar(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha, facing } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2.5, size * 0.04);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  drawGroundShadow(ctx, 0, size * 0.35, size * 0.8, size * 0.05, 0.15, 6);

  // Body
  ctx.fillStyle = bodyGradient(ctx, e.color || "#FF6B6B", -size * 0.55, size * 0.2);
  ctx.beginPath(); ctx.roundRect(-size * 0.7, -size * 0.25, size * 1.4, size * 0.42, size * 0.12);
  ctx.fill(); stroke(ctx, ow * 0.8);

  // Cabin
  ctx.fillStyle = bodyGradient(ctx, lighten(e.color || "#FF6B6B", 0.05), -size * 0.55, -size * 0.2);
  ctx.beginPath(); ctx.roundRect(-size * 0.35, -size * 0.55, size * 0.7, size * 0.35, size * 0.1);
  ctx.fill(); stroke(ctx, ow * 0.7);

  // Windshield
  ctx.fillStyle = "#BFE9FF";
  ctx.beginPath(); ctx.roundRect(-size * 0.25, -size * 0.48, size * 0.5, size * 0.24, size * 0.06);
  ctx.fill();
  drawSpecular(ctx, -size * 0.1, -size * 0.42, size * 0.12, size * 0.06);

  // Wheels
  [-0.4, 0.4].forEach((wx) => {
    ctx.save(); ctx.translate(wx * size, size * 0.2);
    ctx.rotate(t * 6 * (facing));
    ctx.fillStyle = "#3A3F4A";
    ctx.beginPath(); ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
    // Hubcap
    ctx.fillStyle = "#888";
    ctx.beginPath(); ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  ctx.restore();
}

function drawCity(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.02);
  const n = 8;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const palette = ["#B9A6E8", "#9BC4F5", "#F5B9C9", "#A8DEC2"];
  for (let i = 0; i < n; i++) {
    const bw = W / n;
    const bh = size * (0.5 + ((i * 37) % 10) / 15);
    const bx = -W / 2 + i * bw;

    // Building body with gradient
    ctx.fillStyle = bodyGradient(ctx, palette[i % 4], -bh, 10);
    ctx.beginPath(); ctx.roundRect(bx + 4, -bh, bw - 8, bh + 10, 6);
    ctx.fill(); stroke(ctx, ow);

    // Windows that light up
    ctx.fillStyle = "#FFE58A";
    const rows = Math.floor(bh / 30);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < 2; c++) {
        const idx = (i * 31 + r * 7 + c * 13) % 30;
        if (idx / 30 < sceneT) {
          ctx.beginPath();
          ctx.roundRect(bx + 12 + c * (bw / 2 - 8), -bh + 10 + r * 30, 11, 13, 2);
          ctx.fill();
        }
      }
  }

  ctx.restore();
}

function drawWave(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.03);
  const dl = e.delay || 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Water body with depth gradient
  ctx.fillStyle = waterGradient(ctx, e.color || "#3D9BE9", 0, H * 0.5);
  ctx.beginPath(); ctx.moveTo(-W, 0);
  for (let i = -W; i <= W * 2; i += 6)
    ctx.lineTo(i, Math.sin(i / 65 + t * 1.6 + dl * 5) * size * 0.14);
  ctx.lineTo(W * 2, H * 1.5); ctx.lineTo(-W, H * 1.5);
  ctx.closePath(); ctx.fill();

  // Foam line
  ctx.beginPath();
  for (let i = -W; i <= W * 2; i += 6) {
    const yy = Math.sin(i / 65 + t * 1.6 + dl * 5) * size * 0.14;
    i === -W ? ctx.moveTo(i, yy) : ctx.lineTo(i, yy);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Outline
  stroke(ctx, ow * 0.5);

  ctx.restore();
}

function drawRain(ctx, e, W, H, t, sceneT) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.translate(x, y);

  ctx.strokeStyle = e.color || "#7FB8FF";
  ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size * 3, size * 14); ctx.stroke();
  ctx.restore();
}

function drawDefault(ctx, e, W, H, t, sceneT, lighting) {
  const { x, y, size, scale, alpha } = computeElementTransform(e, W, H, t, sceneT);
  const ow = Math.max(2, size * 0.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = sphereGradient(ctx, e.color || "#FFC93C", 0, 0, size * 0.5);
  ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
  ctx.restore();
}

/* ── Shape registry ───────────────────────────────────────────────── */

const SHAPES = {
  sun: drawSun,
  moon: drawMoon,
  star: drawStar,
  cloud: drawCloud,
  rainbow: drawRainbow,
  hill: drawHill,
  tree: drawTree,
  flower: drawFlower,
  house: drawHouse,
  cat: drawCat,
  bunny: drawBunny,
  butterfly: drawButterfly,
  bird: drawBird,
  fish: drawFish,
  balloon: drawBalloon,
  rocket: drawRocket,
  car: drawCar,
  city: drawCity,
  wave: drawWave,
  rain: drawRain,
  circle: drawDefault,
  rect: drawDefault,
};

/**
 * Draw a single element by its shape name.
 */
export function drawElement(ctx, e, W, H, t, sceneT, lighting) {
  const fn = SHAPES[e.shape] || drawDefault;
  fn(ctx, e, W, H, t, sceneT, lighting);
}
