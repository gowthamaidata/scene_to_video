/* ── Particles.js ──────────────────────────────────────────────────── *
 *  Lightweight particle system for ambient atmosphere.               *
 *  Auto-spawns particles based on scene keywords/weather.            *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01, smoothNoise } from "../utils/helpers.js";

/** Particle pool – reused across frames for zero GC */
const MAX_PARTICLES = 200;
let pool = [];

/**
 * Derive which particle preset(s) to use from a scene spec.
 * Returns an array of { type, count, config }.
 */
export function deriveParticles(spec) {
  const result = [];
  const els = (spec.elements || []).map((e) => e.shape);
  const bgDark = isDarkBg(spec.bg);

  // Always add some ambient dust/pollen
  result.push({ type: "dust", count: 18, config: { color: bgDark ? "#FFFFFF" : "#FFE8A0", speed: 0.15, size: 2 } });

  // Add sparkles for magic / night scenes
  if (bgDark || els.includes("star") || els.includes("moon")) {
    result.push({ type: "sparkle", count: 12, config: { color: "#FFE58A", speed: 0.05, size: 3 } });
  }
  if (bgDark) {
    result.push({ type: "firefly", count: 8, config: { color: "#BEFF6A", speed: 0.08, size: 4 } });
  }

  // Wind-blown leaves for nature scenes
  if (els.includes("tree") || els.includes("flower")) {
    result.push({ type: "leaf", count: 6, config: { color: "#8BC34A", speed: 0.3, size: 5 } });
  }

  // Rain
  if (els.includes("rain")) {
    result.push({ type: "rain_splash", count: 10, config: { color: "#9FC9FF", speed: 0.6, size: 3 } });
  }

  // Pollen / seeds for meadow
  if (els.includes("flower") || els.includes("hill")) {
    result.push({ type: "pollen", count: 10, config: { color: "#FFF8C0", speed: 0.1, size: 2.5 } });
  }

  // Confetti for title scenes / celebrations
  if (spec.caption || els.includes("balloon")) {
    result.push({ type: "confetti", count: 14, config: { color: "#FF8FA3", speed: 0.4, size: 4 } });
  }

  return result;
}

/**
 * Initialize particle pool for a set of particle configs.
 */
export function initParticles(particleDefs, W, H) {
  pool = [];
  particleDefs.forEach(({ type, count, config }) => {
    for (let i = 0; i < Math.min(count, MAX_PARTICLES - pool.length); i++) {
      pool.push(createParticle(type, config, W, H, i));
    }
  });
  return pool;
}

/**
 * Update and draw all particles for one frame.
 */
export function drawParticles(ctx, W, H, absT, sceneT) {
  const alpha = clamp01(sceneT * 3) * clamp01((1 - sceneT) * 4);
  if (alpha < 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  pool.forEach((p) => {
    updateParticle(p, absT, W, H);
    renderParticle(ctx, p, absT);
  });

  ctx.restore();
}

/* ── Internals ────────────────────────────────────────────────────── */

function createParticle(type, config, W, H, idx) {
  return {
    type,
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * config.speed * 30,
    vy: type === "confetti" ? Math.random() * config.speed * 60 + 20
       : type === "leaf" ? Math.random() * 20 + 10
       : (Math.random() - 0.5) * config.speed * 20,
    size: config.size * (0.6 + Math.random() * 0.8),
    color: config.color,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 4,
    life: Math.random(),
    W, H, idx,
  };
}

function updateParticle(p, t, W, H) {
  p.x += p.vx * 0.016;
  p.y += p.vy * 0.016;

  // Wrap around screen edges
  if (p.x > W + 20) p.x = -20;
  if (p.x < -20) p.x = W + 20;
  if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
  if (p.y < -20) p.y = H + 20;

  // Organic drift
  if (p.type === "dust" || p.type === "pollen") {
    p.x += Math.sin(t * 0.7 + p.phase) * 0.3;
    p.y += Math.cos(t * 0.5 + p.phase) * 0.15;
  }
  if (p.type === "firefly") {
    p.x += Math.sin(t * 1.2 + p.phase * 3) * 0.6;
    p.y += Math.cos(t * 0.9 + p.phase * 2) * 0.5;
  }
  if (p.type === "leaf") {
    p.x += Math.sin(t * 0.8 + p.phase) * 0.8;
    p.spin = Math.sin(t * 2 + p.phase) * 3;
  }
}

function renderParticle(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.spin);

  switch (p.type) {
    case "dust":
    case "pollen": {
      const a = 0.3 + 0.2 * Math.sin(t * 2 + p.phase);
      ctx.globalAlpha *= a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sparkle": {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + p.phase));
      ctx.globalAlpha *= a;
      ctx.fillStyle = p.color;
      // 4-point star
      const s = p.size * a;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.3 : s;
        const ang = (i * Math.PI) / 4;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "firefly": {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + p.phase));
      ctx.globalAlpha *= a;
      // glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 3);
      glow.addColorStop(0, p.color);
      glow.addColorStop(1, "rgba(190,255,106,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      // core
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "leaf": {
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // vein
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
      break;
    }
    case "confetti": {
      const colors = ["#FF6B6B", "#FFC93C", "#5AD1B3", "#8B7CFF", "#FF8FA3", "#6EB7FF"];
      ctx.fillStyle = colors[p.idx % colors.length];
      ctx.globalAlpha *= 0.7;
      ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5);
      break;
    }
    case "rain_splash": {
      ctx.globalAlpha *= 0.3;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 2, Math.PI, 0);
      ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
  }

  ctx.restore();
}

function isDarkBg(bg) {
  if (!bg?.[0]) return false;
  const m = bg[0].match(/[0-9a-fA-F]{2}/g);
  if (!m) return false;
  return m.map((h) => parseInt(h, 16)).reduce((a, c) => a + c, 0) / 3 < 100;
}
