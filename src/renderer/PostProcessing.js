/* ── PostProcessing.js ─────────────────────────────────────────────── *
 *  Subtle cinematic post-processing on the final composited frame.   *
 *  All effects are deliberately understated — Disney, not Instagram.  *
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Apply all post-processing effects in order.
 * Call after the entire scene has been drawn.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W – canvas width
 * @param {number} H – canvas height
 * @param {number} absT – absolute time (for grain/flicker)
 * @param {object} opts – optional overrides { bloom, vignette, grain, colorGrade }
 */
export function applyPostProcessing(ctx, W, H, absT, opts = {}) {
  if (opts.bloom !== false)      drawBloom(ctx, W, H);
  if (opts.vignette !== false)   drawVignette(ctx, W, H);
  if (opts.grain !== false)      drawFilmGrain(ctx, W, H, absT);
  if (opts.colorGrade !== false) drawColorGrade(ctx, W, H);
}

/* ── Bloom ─────────────────────────────────────────────────────────── *
 *  Soft glow around bright areas via additive radial highlight.       */
function drawBloom(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.globalCompositeOperation = "screen";
  const g = ctx.createRadialGradient(W * 0.5, H * 0.3, W * 0.05, W * 0.5, H * 0.5, W * 0.8);
  g.addColorStop(0, "#FFF8E0");
  g.addColorStop(0.3, "rgba(255,248,224,0.3)");
  g.addColorStop(1, "rgba(255,248,224,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ── Vignette ──────────────────────────────────────────────────────── *
 *  Subtle darkening around edges to focus the eye.                    */
function drawVignette(ctx, W, H) {
  ctx.save();
  const g = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.28, W * 0.5, H * 0.5, W * 0.82);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.7, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(15,10,30,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ── Film Grain ────────────────────────────────────────────────────── *
 *  Very faint noise overlay for that cinematic celluloid feel.        *
 *  Uses a cached offscreen canvas that's updated every few frames.    */
let _grainCanvas = null;
let _grainFrame = -1;

function drawFilmGrain(ctx, W, H, absT) {
  // Regenerate grain texture every ~4 frames
  const frame = Math.floor(absT * 8);
  if (!_grainCanvas || _grainCanvas.width !== W || frame !== _grainFrame) {
    if (!_grainCanvas) {
      _grainCanvas = document.createElement("canvas");
    }
    _grainCanvas.width = W;
    _grainCanvas.height = H;
    const gc = _grainCanvas.getContext("2d");
    const img = gc.createImageData(W, H);
    const data = img.data;
    // Sparse grain — only write every 3rd pixel for perf
    for (let i = 0; i < data.length; i += 12) {
      const v = Math.random() * 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 12; // very low alpha
    }
    gc.putImageData(img, 0, 0);
    _grainFrame = frame;
  }

  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(_grainCanvas, 0, 0);
  ctx.restore();
}

/* ── Colour Grade ──────────────────────────────────────────────────── *
 *  A very subtle warm tint across the frame.                          */
function drawColorGrade(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "#FFE8C0";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
