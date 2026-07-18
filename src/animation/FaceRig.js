/* ── FaceRig.js ────────────────────────────────────────────────────── *
 *  Cartoon facial animation system: eyes, blink, expressions,        *
 *  pupil tracking, mouth shapes, cheeks, breathing.                  *
 * ─────────────────────────────────────────────────────────────────── */

import { OUTLINE } from "../utils/constants.js";
import { clamp01, smoothNoise } from "../utils/helpers.js";
import { drawSpecular } from "../renderer/Materials.js";

/**
 * Draw a complete cartoon face at the current ctx origin.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size      – reference size (head diameter)
 * @param {number} t         – absolute time in seconds
 * @param {object} opts      – { emotion, eyeScale, mouthScale, dx, dy }
 */
export function drawFace(ctx, size, t, opts = {}) {
  const emotion = opts.emotion || "happy";
  const es = opts.eyeScale || 1;
  const ms = opts.mouthScale || 1;
  const dx = opts.dx || 0.22;
  const dy = opts.dy || -0.05;

  drawEyes(ctx, size, t, emotion, es, dx, dy);
  drawMouth(ctx, size, t, emotion, ms);
  drawCheeks(ctx, size, dx);
  drawBreathing(ctx, size, t);
}

/* ── Eyes ──────────────────────────────────────────────────────────── */

function drawEyes(ctx, size, t, emotion, scale, dx, dy) {
  const blinkCycle = t % 3.4;
  const blink = blinkCycle < 0.1 ? 1 - blinkCycle / 0.1 :
                blinkCycle < 0.2 ? (blinkCycle - 0.1) / 0.1 : 1;
  const squash = emotion === "happy" ? 0.85 : emotion === "surprised" ? 1.3 : 1;

  // Pupil tracking — slow drift
  const pupilX = Math.sin(t * 0.6) * size * 0.015;
  const pupilY = Math.cos(t * 0.45) * size * 0.01;

  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * size * dx, size * dy);
    ctx.scale(scale, scale * blink * squash);

    const r = size * 0.075;

    // White sclera
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sclera outline
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.2, size * 0.015);
    ctx.stroke();

    // Iris
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#1A1A2E";
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine — two small white dots
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(pupilX - r * 0.2, pupilY - r * 0.22, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pupilX + r * 0.12, pupilY + r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Eyebrows for expressive emotions
  if (emotion === "surprised" || emotion === "angry" || emotion === "sad") {
    [-1, 1].forEach((side) => {
      ctx.save();
      ctx.translate(side * size * dx, size * (dy - 0.12));
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.lineCap = "round";

      const angle = emotion === "angry" ? (side * 0.35) :
                    emotion === "sad"   ? (side * -0.3) : 0;
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-size * 0.06, 0);
      ctx.lineTo(size * 0.06, 0);
      ctx.stroke();
      ctx.restore();
    });
  }
}

/* ── Mouth ─────────────────────────────────────────────────────────── */

function drawMouth(ctx, size, t, emotion, scale) {
  ctx.save();
  ctx.translate(0, size * 0.1);
  ctx.scale(scale, scale);

  const ow = Math.max(1.5, size * 0.025);

  if (emotion === "happy" || emotion === "laugh") {
    // Open smile
    const openAmount = emotion === "laugh" ? 0.08 : 0.03;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
    if (emotion === "laugh") {
      ctx.lineTo(size * 0.06, size * openAmount);
      ctx.arc(0, size * openAmount, size * 0.06, 0, Math.PI, true);
      ctx.lineTo(-size * 0.09 * Math.cos(0.1 * Math.PI), size * 0.09 * Math.sin(0.1 * Math.PI));
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = ow;
    ctx.lineCap = "round";
    ctx.stroke();

    // Tongue for laugh
    if (emotion === "laugh") {
      ctx.fillStyle = "#FF8888";
      ctx.beginPath();
      ctx.ellipse(0, size * 0.06, size * 0.04, size * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (emotion === "surprised") {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.04, size * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (emotion === "sad") {
    ctx.beginPath();
    ctx.arc(0, size * 0.04, size * 0.07, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = ow;
    ctx.lineCap = "round";
    ctx.stroke();
  } else {
    // Neutral / talking
    const talkOpen = Math.abs(Math.sin(t * 6)) * size * 0.02;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = ow;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  ctx.restore();
}

/* ── Cheeks ─────────────────────────────────────────────────────────── */

function drawCheeks(ctx, size, dx) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  const cheekR = size * 0.055;
  [-1, 1].forEach((side) => {
    const grad = ctx.createRadialGradient(
      side * size * (dx + 0.08), size * 0.06, 0,
      side * size * (dx + 0.08), size * 0.06, cheekR
    );
    grad.addColorStop(0, "rgba(255,130,160,0.8)");
    grad.addColorStop(1, "rgba(255,130,160,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(side * size * (dx + 0.08), size * 0.06, cheekR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/* ── Breathing ─────────────────────────────────────────────────────── */

function drawBreathing(ctx, size, t) {
  // Breathing is applied as a subtle scale pulse on the parent transform
  // This function is a placeholder — actual breathing is applied in CharacterRenderer
}

/**
 * Get breathing scale factor for a character.
 */
export function getBreathScale(t) {
  return 1 + Math.sin(t * 2.2) * 0.008;
}
