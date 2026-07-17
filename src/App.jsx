import React, { useState, useRef, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Storyboard Studio — kids-cartoon edition                           */
/*  Same scene→spec→playback flow, but the render engine now draws     */
/*  outlined, big-eyed cartoon characters with bouncy motion.          */
/* ------------------------------------------------------------------ */

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Inter:wght@400;500;600&family=Spline+Sans+Mono:wght@400;500&display=swap";

const T = {
  ink: "#101319", panel: "#171B24", panel2: "#1D2230", line: "#2A3040",
  text: "#E8EBF2", muted: "#8A93A6", violet: "#8B7CFF", amber: "#FFC466",
};
const SCENE_TINTS = ["#8B7CFF", "#FFC466", "#5AD1B3", "#FF8FA3", "#6EB7FF", "#D6A2FF"];
const OUTLINE = "#432E24"; // warm chocolate cartoon outline

const DEFAULT_SCENES = [
  { id: 1, text: "A smiling sun rises over a green meadow full of flowers, a butterfly flutters by", duration: 5 },
  { id: 2, text: "A happy orange cat walks past a little house chasing the butterfly, clouds drift", duration: 6 },
  { id: 3, text: "A rainbow appears over the hills and balloons float up into the sky, title says THE END", duration: 5 },
];

/* ----------------------------- helpers ----------------------------- */

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const fmt = (s) => { const m = Math.floor(s / 60); const sec = s - m * 60; return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`; };

/* ------------------- local fallback scene compiler ------------------ */

function localCompile(sceneText) {
  const s = sceneText.toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));
  const night = has("night", "star", "moon", "dark");
  const water = has("ocean", "sea", "wave", "lake", "fish", "rain");

  let bg = night ? ["#2B2160", "#4A3A8C"] : water ? ["#8FD0FF", "#DFF6FF"] : ["#9BDBFF", "#E8FBFF"];
  if (has("dusk", "sunset")) bg = ["#5A3E8E", "#FFB07A"];
  if (has("meadow", "grass", "hill", "flower") && !night) bg = ["#8FD4FF", "#DFF8E8"];

  const el = [];
  if (has("sun", "sunrise", "sunny", "smiling sun"))
    el.push({ shape: "sun", color: "#FFC93C", size: 0.24, from: { x: 0.78, y: 0.9 }, to: { x: 0.78, y: 0.22 }, face: true });
  if (has("moon")) el.push({ shape: "moon", color: "#FFF3C4", size: 0.18, from: { x: 0.78, y: 0.45 }, to: { x: 0.78, y: 0.18 }, face: true });
  if (night) for (let i = 0; i < 12; i++)
    el.push({ shape: "star", color: "#FFE58A", size: 0.03, from: { x: Math.random(), y: Math.random() * 0.5 }, to: null, pulse: true, delay: Math.random() * 0.5 });
  if (has("cloud") || (!night && !water))
    for (let i = 0; i < 2; i++)
      el.push({ shape: "cloud", color: "#FFFFFF", size: 0.1, from: { x: -0.25, y: 0.14 + i * 0.13 }, to: { x: 1.25, y: 0.14 + i * 0.13 }, delay: i * 0.35 });
  if (has("rainbow"))
    el.push({ shape: "rainbow", color: "#FF6B6B", size: 0.5, from: { x: 0.5, y: 0.75 }, to: null, grow: true });
  if (water && has("wave", "ocean", "sea")) {
    el.push({ shape: "wave", color: "#3D9BE9", size: 0.28, from: { x: 0, y: 0.86 }, to: null });
    el.push({ shape: "wave", color: "#6FC0FF", size: 0.24, from: { x: 0.1, y: 0.92 }, to: null, delay: 0.2 });
  }
  if (has("meadow", "grass", "hill", "garden") || (!water && !has("city")))
    el.push({ shape: "hill", color: "#6FCB7C", size: 0.32, from: { x: 0.5, y: 1 }, to: null });
  if (has("flower", "garden", "meadow"))
    for (let i = 0; i < 4; i++)
      el.push({ shape: "flower", color: ["#FF8FA3", "#FFC93C", "#B78BFF", "#FF9A6B"][i], size: 0.09, from: { x: 0.12 + i * 0.16, y: 0.88 }, to: null, delay: 0.1 + i * 0.1, grow: true });
  if (has("tree", "forest"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "tree", color: "#4CAF6D", size: 0.24, from: { x: 0.18 + i * 0.3, y: 0.82 }, to: null, delay: i * 0.1, grow: true });
  if (has("house", "home", "cottage"))
    el.push({ shape: "house", color: "#FFB0A0", size: 0.28, from: { x: 0.22, y: 0.78 }, to: null, grow: true });
  if (has("cat", "kitten", "dog", "puppy", "fox"))
    el.push({ shape: "cat", color: has("fox") ? "#FF8C42" : "#F5A25D", size: 0.17, from: { x: -0.2, y: 0.8 }, to: { x: 0.65, y: 0.8 }, walk: true });
  if (has("bunny", "rabbit"))
    el.push({ shape: "bunny", color: "#F2F2F2", size: 0.16, from: { x: 1.2, y: 0.8 }, to: { x: 0.4, y: 0.8 }, walk: true });
  if (has("butterfly"))
    el.push({ shape: "butterfly", color: "#B78BFF", size: 0.07, from: { x: -0.1, y: 0.45 }, to: { x: 1.1, y: 0.3 }, flutter: true });
  if (has("bird", "seagull"))
    for (let i = 0; i < 2; i++)
      el.push({ shape: "bird", color: ["#5FB8FF", "#FF8FA3"][i], size: 0.07, from: { x: -0.15 - i * 0.15, y: 0.25 + i * 0.1 }, to: { x: 1.15, y: 0.2 + i * 0.08 }, delay: i * 0.1 });
  if (has("fish"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "fish", color: ["#FF9A6B", "#5FB8FF", "#FFC93C"][i], size: 0.09, from: { x: 1.15, y: 0.55 + i * 0.13 }, to: { x: -0.15, y: 0.55 + i * 0.13 }, delay: i * 0.15 });
  if (has("balloon"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "balloon", color: ["#FF6B6B", "#FFC93C", "#5AD1B3"][i], size: 0.1, from: { x: 0.3 + i * 0.2, y: 1.15 }, to: { x: 0.32 + i * 0.2, y: 0.25 + i * 0.08 }, delay: i * 0.12, sway: true });
  if (has("rocket", "launch", "space"))
    el.push({ shape: "rocket", color: "#FF6B6B", size: 0.18, from: { x: 0.5, y: 0.85 }, to: { x: 0.55, y: -0.25 } });
  if (has("car"))
    el.push({ shape: "car", color: "#FF6B6B", size: 0.14, from: { x: -0.25, y: 0.84 }, to: { x: 1.25, y: 0.84 } });
  if (has("city", "skyline", "building", "town"))
    el.push({ shape: "city", color: "#B9A6E8", size: 0.42, from: { x: 0.5, y: 1 }, to: null });
  if (has("rain"))
    for (let i = 0; i < 16; i++)
      el.push({ shape: "rain", color: "#7FB8FF", size: 0.05, from: { x: Math.random(), y: -0.1 }, to: { x: Math.random() - 0.05, y: 1.1 }, delay: Math.random() * 0.8 });
  if (el.length === 0)
    el.push({ shape: "star", color: "#FFC93C", size: 0.2, from: { x: 0.3, y: 0.4 }, to: { x: 0.7, y: 0.4 }, pulse: true, face: true });

  const title = s.match(/(?:says|title|text)\s+["']?([^"',.]+)/);
  return { bg, caption: title ? title[1].toUpperCase().trim() : "", elements: el };
}

/* --------------------- AI compiler (Claude API) --------------------- */

async function aiCompile(scenes) {
  const prompt = `You compile scene descriptions into JSON specs for a KIDS CARTOON 2D canvas engine (cute, bright, friendly).

Scenes:
${scenes.map((s, i) => `${i + 1}. ${s.text}`).join("\n")}

Respond with ONLY a JSON array (no markdown), one object per scene:
{
 "bg": ["#hex","#hex"],          // cheerful vertical sky gradient
 "caption": "",                   // short on-screen text only if asked, else ""
 "elements": [                    // 4-12 elements, back-to-front
   {"shape":"sun|moon|star|cloud|rainbow|hill|tree|flower|house|cat|bunny|butterfly|bird|fish|balloon|rocket|car|city|wave|rain|circle|rect",
    "color":"#hex",               // bright kid-friendly colors
    "size":0.03-0.5,              // fraction of canvas height
    "from":{"x":0-1,"y":0-1},     // start (offscreen like -0.2 or 1.2 is fine)
    "to":{"x":..,"y":..} or null, // end position; null = static
    "delay":0-0.5,
    "face":true,                  // for sun/moon/star: draws a happy face
    "grow":true,                  // pops in with a bounce
    "walk":true,                  // cat/bunny: hopping walk cycle
    "flutter":true,               // butterfly: wavy flight
    "sway":true,                  // balloon: gentle sway
    "pulse":true}                 // gentle twinkle
 ]
}
Compose real little stories: characters enter, travel, things pop in with bounces. Always include ground (hill) or water (wave) unless it's space.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const text = data.content.map((c) => c.text || "").join("");
  const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
  if (!Array.isArray(arr) || arr.length !== scenes.length) throw new Error("bad spec");
  return arr;
}

/* ------------------------ cartoon draw helpers ----------------------- */

function stroke(ctx, w) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }

function eyes(ctx, size, t, dx = 0.22, dy = -0.05) {
  // blink every ~3s
  const blink = (t % 3.2) < 0.12 ? 0.12 : 1;
  ctx.fillStyle = OUTLINE;
  [-1, 1].forEach((s) => {
    ctx.save();
    ctx.translate(s * size * dx, size * dy);
    ctx.scale(1, blink);
    ctx.beginPath(); ctx.arc(0, 0, size * 0.06, 0, Math.PI * 2); ctx.fill();
    if (blink === 1) { ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(-size * 0.02, -size * 0.02, size * 0.02, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = OUTLINE; }
    ctx.restore();
  });
}

function smile(ctx, size, dy = 0.08, w = 0.12) {
  ctx.beginPath(); ctx.arc(0, size * dy, size * w, 0.15 * Math.PI, 0.85 * Math.PI);
  stroke(ctx, Math.max(2, size * 0.035));
}

function cheeks(ctx, size, dx = 0.3, dy = 0.06) {
  ctx.fillStyle = "rgba(255,120,140,0.4)";
  [-1, 1].forEach((s) => { ctx.beginPath(); ctx.arc(s * size * dx, size * dy, size * 0.06, 0, Math.PI * 2); ctx.fill(); });
}

function drawShape(ctx, e, W, H, t, sceneT) {
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
  if (e.grow) scale = raw <= 0 ? 0 : easeOutBack(clamp01(raw * 1.6)); // bouncy pop-in
  if (e.walk) y += -Math.abs(Math.sin(raw * 26)) * size * 0.14;       // hop
  if (e.flutter) y += Math.sin(raw * 14) * size * 1.4;                // wavy flight
  if (e.sway) x += Math.sin(t * 1.6 + dl * 8) * size * 0.25;
  const facing = to.x < from.x ? -1 : 1;
  const alpha = clamp01(sceneT * 6);
  const ow = Math.max(2.5, size * 0.05); // outline width

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = e.color || "#FFC93C";

  switch (e.shape) {
    case "sun": {
      // rotating rays
      ctx.save(); ctx.rotate(t * 0.25);
      ctx.fillStyle = e.color;
      for (let i = 0; i < 10; i++) {
        ctx.rotate(Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(size * 0.55, -size * 0.09); ctx.lineTo(size * 0.8, 0); ctx.lineTo(size * 0.55, size * 0.09);
        ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.6);
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      if (e.face !== false) { eyes(ctx, size, t); smile(ctx, size); cheeks(ctx, size); }
      break;
    }
    case "moon":
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      [[-0.15, -0.1, 0.1], [0.18, 0.12, 0.07], [0.02, 0.25, 0.05]].forEach(([cx, cy, r]) => {
        ctx.beginPath(); ctx.arc(cx * size, cy * size, r * size, 0, Math.PI * 2); ctx.fill();
      });
      if (e.face) { eyes(ctx, size, t, 0.18); smile(ctx, size, 0.1, 0.1); }
      break;
    case "star": {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? size * 0.26 : size * 0.55;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); stroke(ctx, ow);
      if (e.face) { eyes(ctx, size, t, 0.14, 0); smile(ctx, size, 0.12, 0.08); }
      break;
    }
    case "cloud":
      ctx.beginPath();
      ctx.arc(-size * 0.7, 0, size * 0.5, 0, Math.PI * 2);
      ctx.arc(0, -size * 0.3, size * 0.65, 0, Math.PI * 2);
      ctx.arc(size * 0.7, 0, size * 0.5, 0, Math.PI * 2);
      ctx.arc(0, size * 0.15, size * 0.55, 0, Math.PI * 2);
      ctx.fill(); stroke(ctx, ow * 0.7);
      break;
    case "rainbow": {
      const g = raw; // grows with scene
      const bands = ["#FF6B6B", "#FFA94D", "#FFE066", "#69DB7C", "#4DABF7", "#B197FC"];
      bands.forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(0, 0, size * (1.6 - i * 0.13), Math.PI, Math.PI + Math.PI * clamp01(g * 1.4));
        ctx.strokeStyle = c; ctx.lineWidth = size * 0.11; ctx.lineCap = "round"; ctx.stroke();
      });
      break;
    }
    case "hill":
      ctx.beginPath(); ctx.ellipse(0, 0, W * 0.8, size, 0, Math.PI, 0); ctx.fill(); stroke(ctx, ow * 0.8);
      // grass tufts
      ctx.fillStyle = "#57B96A";
      for (let i = 0; i < 8; i++) {
        const gx = -W * 0.4 + i * (W * 0.11);
        ctx.beginPath(); ctx.ellipse(gx, -size * 0.35 + (i % 2) * size * 0.15, size * 0.18, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case "tree":
      ctx.fillStyle = "#8A5A38";
      ctx.beginPath(); ctx.roundRect(-size * 0.07, -size * 0.25, size * 0.14, size * 0.4, size * 0.05); ctx.fill(); stroke(ctx, ow * 0.6);
      ctx.fillStyle = e.color;
      [[-0.25, -0.45, 0.3], [0.25, -0.45, 0.3], [0, -0.7, 0.36], [0, -0.35, 0.32]].forEach(([cx, cy, r]) => {
        ctx.beginPath(); ctx.arc(cx * size, cy * size, r * size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.beginPath(); ctx.arc(0, -size * 0.5, size * 0.52, 0, Math.PI * 2); stroke(ctx, ow * 0.6);
      break;
    case "flower": {
      const wob = Math.sin(t * 2 + dl * 9) * 0.06;
      ctx.rotate(wob);
      ctx.strokeStyle = "#57B96A"; ctx.lineWidth = size * 0.12;
      ctx.beginPath(); ctx.moveTo(0, size * 0.1); ctx.quadraticCurveTo(size * 0.1, size * 0.6, 0, size * 1.1); ctx.stroke();
      ctx.fillStyle = e.color;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, size * 0.22, size * 0.14, a, 0, Math.PI * 2);
        ctx.fill(); stroke(ctx, ow * 0.5);
      }
      ctx.fillStyle = "#FFE066";
      ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
      break;
    }
    case "house":
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.roundRect(-size * 0.5, -size * 0.45, size, size * 0.75, size * 0.04); ctx.fill(); stroke(ctx, ow);
      ctx.fillStyle = "#E8604C";
      ctx.beginPath(); ctx.moveTo(-size * 0.62, -size * 0.45); ctx.lineTo(0, -size * 0.95); ctx.lineTo(size * 0.62, -size * 0.45); ctx.closePath(); ctx.fill(); stroke(ctx, ow);
      ctx.fillStyle = "#8A5A38";
      ctx.beginPath(); ctx.roundRect(-size * 0.12, -size * 0.1, size * 0.24, size * 0.4, size * 0.06); ctx.fill(); stroke(ctx, ow * 0.6);
      ctx.fillStyle = "#BFE9FF";
      ctx.beginPath(); ctx.arc(size * 0.26, -size * 0.2, size * 0.12, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.6);
      break;
    case "cat": {
      ctx.scale(facing, 1);
      const wag = Math.sin(t * 5) * 0.4;
      // tail
      ctx.strokeStyle = e.color; ctx.lineWidth = size * 0.16; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-size * 0.55, 0); ctx.quadraticCurveTo(-size * 0.95, -size * 0.3 + wag * size * 0.3, -size * 0.85, -size * 0.7 + wag * size * 0.2); ctx.stroke();
      // body
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(-size * 0.15, size * 0.1, size * 0.5, size * 0.35, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      // head + ears
      ctx.beginPath(); ctx.moveTo(size * 0.18, -size * 0.5); ctx.lineTo(size * 0.3, -size * 0.85) ; ctx.lineTo(size * 0.45, -size * 0.55); ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.7);
      ctx.beginPath(); ctx.moveTo(size * 0.62, -size * 0.5); ctx.lineTo(size * 0.78, -size * 0.82); ctx.lineTo(size * 0.86, -size * 0.48); ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.7);
      ctx.beginPath(); ctx.arc(size * 0.5, -size * 0.3, size * 0.36, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      ctx.save(); ctx.translate(size * 0.5, -size * 0.3);
      eyes(ctx, size * 0.9, t, 0.16, -0.03); smile(ctx, size * 0.7, 0.1, 0.1); cheeks(ctx, size * 0.8, 0.28, 0.05);
      ctx.restore();
      // legs
      ctx.fillStyle = e.color;
      [-0.4, -0.1, 0.15].forEach((lx) => {
        ctx.beginPath(); ctx.roundRect(lx * size, size * 0.3, size * 0.16, size * 0.28, size * 0.08); ctx.fill(); stroke(ctx, ow * 0.6);
      });
      break;
    }
    case "bunny": {
      ctx.scale(facing, 1);
      ctx.fillStyle = e.color;
      // ears
      [[0.32, -1.0, -0.1], [0.55, -0.98, 0.12]].forEach(([ex, ey, rot]) => {
        ctx.save(); ctx.translate(ex * size, ey * size); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, 0, size * 0.12, size * 0.38, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.7);
        ctx.fillStyle = "#FFB9C6"; ctx.beginPath(); ctx.ellipse(0, 0, size * 0.05, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.color; ctx.restore();
      });
      ctx.beginPath(); ctx.ellipse(-size * 0.1, size * 0.1, size * 0.45, size * 0.36, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      ctx.beginPath(); ctx.arc(size * 0.42, -size * 0.35, size * 0.34, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
      ctx.save(); ctx.translate(size * 0.42, -size * 0.35);
      eyes(ctx, size * 0.9, t, 0.15, -0.02); smile(ctx, size * 0.6, 0.12, 0.1); cheeks(ctx, size * 0.75, 0.26, 0.06);
      ctx.restore();
      break;
    }
    case "butterfly": {
      const flap = Math.abs(Math.sin(t * 9)) * 0.7 + 0.3;
      ctx.fillStyle = e.color;
      [-1, 1].forEach((s) => {
        ctx.save(); ctx.scale(s * flap, 1);
        ctx.beginPath(); ctx.ellipse(size * 0.55, -size * 0.25, size * 0.5, size * 0.38, -0.4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
        ctx.beginPath(); ctx.ellipse(size * 0.45, size * 0.3, size * 0.36, size * 0.28, 0.4, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
        ctx.restore();
      });
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.09, size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "bird": {
      ctx.scale(facing, 1);
      const flap = Math.sin(t * 9 + dl * 12) * 0.6;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.38, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.7);
      // wing
      ctx.save(); ctx.rotate(flap);
      ctx.beginPath(); ctx.ellipse(-size * 0.1, -size * 0.15, size * 0.32, size * 0.18, -0.5, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
      ctx.restore();
      // beak + eye
      ctx.fillStyle = "#FFA94D";
      ctx.beginPath(); ctx.moveTo(size * 0.45, -size * 0.05); ctx.lineTo(size * 0.72, 0); ctx.lineTo(size * 0.45, size * 0.1); ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.4);
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(size * 0.22, -size * 0.1, size * 0.06, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "fish": {
      ctx.scale(facing, 1);
      const wig = Math.sin(t * 6 + dl * 9) * 0.15;
      ctx.rotate(wig);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.32, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.7);
      ctx.beginPath(); ctx.moveTo(-size * 0.4, 0); ctx.lineTo(-size * 0.75, -size * 0.28); ctx.lineTo(-size * 0.75, size * 0.28); ctx.closePath(); ctx.fill(); stroke(ctx, ow * 0.5);
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(size * 0.24, -size * 0.06, size * 0.05, 0, Math.PI * 2); ctx.fill();
      smile(ctx, size * 0.8, 0.1, 0.08);
      break;
    }
    case "balloon":
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, size * 0.55);
      ctx.quadraticCurveTo(size * 0.15 * Math.sin(t * 2), size * 1.0, 0, size * 1.4); ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.42, size * 0.52, 0, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.7);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(-size * 0.15, -size * 0.18, size * 0.1, size * 0.15, -0.4, 0, Math.PI * 2); ctx.fill();
      break;
    case "rocket": {
      ctx.fillStyle = "#FFA94D";
      const fl = size * (0.5 + 0.2 * Math.sin(t * 20));
      ctx.beginPath(); ctx.moveTo(-size * 0.16, size * 0.5); ctx.lineTo(0, size * 0.5 + fl); ctx.lineTo(size * 0.16, size * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.moveTo(0, -size * 0.6);
      ctx.quadraticCurveTo(size * 0.34, -size * 0.1, size * 0.26, size * 0.5);
      ctx.lineTo(-size * 0.26, size * 0.5);
      ctx.quadraticCurveTo(-size * 0.34, -size * 0.1, 0, -size * 0.6);
      ctx.fill(); stroke(ctx, ow);
      ctx.fillStyle = "#BFE9FF"; ctx.beginPath(); ctx.arc(0, -size * 0.08, size * 0.14, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.6);
      break;
    }
    case "car": {
      ctx.scale(facing, 1);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.roundRect(-size * 0.7, -size * 0.25, size * 1.4, size * 0.42, size * 0.14); ctx.fill(); stroke(ctx, ow * 0.8);
      ctx.beginPath(); ctx.roundRect(-size * 0.35, -size * 0.55, size * 0.7, size * 0.35, size * 0.12); ctx.fill(); stroke(ctx, ow * 0.7);
      ctx.fillStyle = "#BFE9FF"; ctx.beginPath(); ctx.roundRect(-size * 0.25, -size * 0.48, size * 0.5, size * 0.24, size * 0.08); ctx.fill();
      [-0.4, 0.4].forEach((wx) => {
        ctx.save(); ctx.translate(wx * size, size * 0.2); ctx.rotate(t * 6);
        ctx.fillStyle = "#3A3F4A"; ctx.beginPath(); ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow * 0.5);
        ctx.strokeStyle = "#BBB"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-size * 0.12, 0); ctx.lineTo(size * 0.12, 0); ctx.stroke();
        ctx.restore();
      });
      break;
    }
    case "city": {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const bw = W / n;
        const bh = size * (0.5 + ((i * 37) % 10) / 15);
        const bx = -W / 2 + i * bw;
        ctx.fillStyle = ["#B9A6E8", "#9BC4F5", "#F5B9C9", "#A8DEC2"][i % 4];
        ctx.beginPath(); ctx.roundRect(bx + 4, -bh, bw - 8, bh + 10, 8); ctx.fill(); stroke(ctx, ow * 0.6);
        ctx.fillStyle = "#FFE58A";
        const rows = Math.floor(bh / 30);
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < 2; c++) {
            const idx = (i * 31 + r * 7 + c * 13) % 30;
            if (idx / 30 < sceneT) { ctx.beginPath(); ctx.roundRect(bx + 12 + c * (bw / 2 - 8), -bh + 10 + r * 30, 12, 14, 3); ctx.fill(); }
          }
      }
      break;
    }
    case "wave": {
      ctx.beginPath(); ctx.moveTo(-W, 0);
      for (let i = -W; i <= W * 2; i += 8)
        ctx.lineTo(i, Math.sin(i / 70 + t * 1.8 + dl * 5) * size * 0.14);
      ctx.lineTo(W * 2, H * 1.5); ctx.lineTo(-W, H * 1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      for (let i = -W; i <= W * 2; i += 8) {
        const yy = Math.sin(i / 70 + t * 1.8 + dl * 5) * size * 0.14;
        i === -W ? ctx.moveTo(i, yy) : ctx.lineTo(i, yy);
      }
      stroke(ctx, ow * 0.6);
      break;
    }
    case "rain":
      ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size * 4, size * 16); ctx.stroke(); break;
    case "rect":
      ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.15); ctx.fill(); stroke(ctx, ow); break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); stroke(ctx, ow);
  }
  ctx.restore();
}

function drawScene(ctx, spec, W, H, sceneT, absT) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, spec.bg?.[0] || "#8FD4FF");
  g.addColorStop(1, spec.bg?.[1] || "#E8FBFF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  (spec.elements || []).forEach((e) => drawShape(ctx, e, W, H, absT, sceneT));
  if (spec.caption) {
    ctx.save();
    const pop = easeOutBack(clamp01((sceneT - 0.3) * 2.5));
    ctx.globalAlpha = clamp01((sceneT - 0.3) * 4);
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(pop, pop);
    ctx.font = `800 ${H * 0.11}px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = H * 0.02; ctx.strokeStyle = OUTLINE; ctx.lineJoin = "round";
    ctx.strokeText(spec.caption, 0, 0);
    ctx.fillStyle = "#FFE066";
    ctx.fillText(spec.caption, 0, 0);
    ctx.restore();
  }
}

/* ------------------------------- app -------------------------------- */

export default function SceneToVideo() {
  const [scenes, setScenes] = useState(DEFAULT_SCENES);
  const [specs, setSpecs] = useState(null);
  const [status, setStatus] = useState("idle");
  const [engineNote, setEngineNote] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [recording, setRecording] = useState(false);

  const canvasRef = useRef(null);
  const playRef = useRef(false);
  const headRef = useRef(0);
  const specsRef = useRef(null);
  const scenesRef = useRef(scenes);
  const rafRef = useRef(null);
  const recRef = useRef(null);
  scenesRef.current = scenes;

  const total = scenes.reduce((a, s) => a + Number(s.duration || 0), 0);

  const render = useCallback((absTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const sc = scenesRef.current, sp = specsRef.current;
    if (!sp) {
      ctx.fillStyle = T.ink; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = T.muted;
      ctx.font = `500 ${H * 0.045}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Describe your scenes, then press Generate", W / 2, H / 2);
      return;
    }
    let t = headRef.current, acc = 0, idx = 0;
    for (let i = 0; i < sc.length; i++) {
      const d = Number(sc[i].duration || 0);
      if (t < acc + d || i === sc.length - 1) { idx = i; break; }
      acc += d;
    }
    const d = Number(sc[idx].duration || 1);
    const sceneT = clamp01((t - acc) / d);
    drawScene(ctx, sp[idx], W, H, sceneT, absTime / 1000);
    const fade = 0.5;
    if (sceneT > 1 - fade / d && idx < sp.length - 1) {
      ctx.save();
      ctx.globalAlpha = (sceneT - (1 - fade / d)) / (fade / d);
      drawScene(ctx, sp[idx + 1], W, H, 0, absTime / 1000);
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playRef.current) {
        headRef.current += dt;
        const tot = scenesRef.current.reduce((a, s) => a + Number(s.duration || 0), 0);
        if (headRef.current >= tot) {
          headRef.current = tot;
          playRef.current = false;
          setPlaying(false);
          if (recRef.current) { recRef.current.stop(); recRef.current = null; setRecording(false); }
        }
        setPlayhead(headRef.current);
      }
      render(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  const generate = async () => {
    setStatus("compiling");
    setEngineNote("");
    try {
      const sp = await aiCompile(scenes);
      specsRef.current = sp;
      setSpecs(sp);
      setEngineNote("Compiled by Claude");
    } catch (e) {
      const sp = scenes.map((s) => localCompile(s.text));
      specsRef.current = sp;
      setSpecs(sp);
      setEngineNote("AI unavailable — used built-in compiler");
    }
    headRef.current = 0;
    setPlayhead(0);
    setStatus("ready");
    playRef.current = true;
    setPlaying(true);
  };

  const togglePlay = () => {
    if (!specs) return;
    if (!playing && headRef.current >= total) headRef.current = 0;
    playRef.current = !playing;
    setPlaying(!playing);
  };

  const seek = (frac) => { headRef.current = frac * total; setPlayhead(headRef.current); };

  const exportVideo = () => {
    if (!specs || recording) return;
    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      const a = document.createElement("a");
      a.href = url; a.download = "my-cartoon.webm"; a.click();
      URL.revokeObjectURL(url);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    headRef.current = 0;
    playRef.current = true;
    setPlaying(true);
  };

  const updateScene = (id, patch) => setScenes((sc) => sc.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addScene = () => setScenes((sc) => [...sc, { id: Date.now(), text: "", duration: 5 }]);
  const removeScene = (id) => setScenes((sc) => sc.filter((s) => s.id !== id));

  let acc = 0, activeIdx = -1;
  if (specs) {
    for (let i = 0; i < scenes.length; i++) {
      const d = Number(scenes[i].duration || 0);
      if (playhead < acc + d) { activeIdx = i; break; }
      acc += d;
    }
    if (activeIdx === -1) activeIdx = scenes.length - 1;
  }

  const btn = (primary) => ({
    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13,
    padding: "9px 16px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${primary ? T.violet : T.line}`,
    background: primary ? T.violet : "transparent",
    color: primary ? "#0E0B1F" : T.text,
  });

  return (
    <div style={{ minHeight: "100vh", background: T.ink, color: T.text, fontFamily: "Inter, sans-serif" }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 60px" }}>

        <header style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, letterSpacing: 2, color: T.amber, textTransform: "uppercase" }}>
            Prototype · scene → video · cartoon engine
          </div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 34, margin: "6px 0 4px" }}>
            Storyboard Studio
          </h1>
          <p style={{ color: T.muted, fontSize: 14, margin: 0, maxWidth: 640 }}>
            Write each scene in plain words with a duration. Generate compiles them into a kids-cartoon video you can scrub and export.
          </p>
        </header>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

          <div style={{ flex: "1 1 320px", minWidth: 300 }}>
            {scenes.map((s, i) => (
              <div key={s.id} style={{ background: T.panel, border: `1px solid ${activeIdx === i ? SCENE_TINTS[i % 6] : T.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: SCENE_TINTS[i % 6] }}>SCENE {i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min="1" max="30" value={s.duration}
                      onChange={(e) => updateScene(s.id, { duration: Number(e.target.value) })}
                      style={{ width: 52, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, padding: "5px 7px", fontFamily: "'Spline Sans Mono', monospace", fontSize: 12 }} />
                    <span style={{ fontSize: 11, color: T.muted }}>sec</span>
                    {scenes.length > 1 && (
                      <button onClick={() => removeScene(s.id)} aria-label={`Delete scene ${i + 1}`}
                        style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                </div>
                <textarea value={s.text}
                  onChange={(e) => updateScene(s.id, { text: e.target.value })}
                  placeholder="Describe what happens in this scene…" rows={2}
                  style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, padding: 10, fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.45 }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={addScene} style={btn(false)}>+ Add scene</button>
              <button onClick={generate} disabled={status === "compiling"} style={{ ...btn(true), opacity: status === "compiling" ? 0.6 : 1 }}>
                {status === "compiling" ? "Compiling…" : specs ? "Regenerate" : "Generate video"}
              </button>
            </div>
            {engineNote && <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>{engineNote}</div>}

            <div style={{ marginTop: 18, padding: 12, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              The cartoon engine understands: sun, moon, stars, clouds, rainbow, hills, trees, flowers, house, cat, bunny, butterfly, birds, fish, balloons, rocket, car, city, ocean waves, rain — plus on-screen titles ("title says …").
            </div>
          </div>

          <div style={{ flex: "2 1 480px", minWidth: 320 }}>
            <div style={{ background: "#000", borderRadius: 14, overflow: "hidden", border: `1px solid ${T.line}` }}>
              <canvas ref={canvasRef} width={960} height={540} style={{ width: "100%", display: "block" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={togglePlay} disabled={!specs} style={{ ...btn(false), width: 44, textAlign: "center", opacity: specs ? 1 : 0.4 }} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, color: T.text }}>
                {fmt(playhead)} <span style={{ color: T.muted }}>/ {fmt(total)}</span>
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={exportVideo} disabled={!specs || recording} style={{ ...btn(false), borderColor: T.amber, color: recording ? T.muted : T.amber, opacity: specs ? 1 : 0.4 }}>
                {recording ? "Recording…" : "Export .webm"}
              </button>
            </div>

            <div role="slider" aria-label="Timeline" aria-valuemin={0} aria-valuemax={total} aria-valuenow={playhead} tabIndex={0}
              onKeyDown={(e) => { if (e.key === "ArrowRight") seek(clamp01((playhead + 1) / total)); if (e.key === "ArrowLeft") seek(clamp01((playhead - 1) / total)); }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(clamp01((e.clientX - r.left) / r.width)); }}
              style={{ position: "relative", marginTop: 14, height: 54, borderRadius: 10, overflow: "hidden", display: "flex", cursor: specs ? "pointer" : "default", border: `1px solid ${T.line}`, outlineColor: T.violet }}>
              {scenes.map((s, i) => (
                <div key={s.id} style={{
                  width: `${(Number(s.duration || 0) / (total || 1)) * 100}%`,
                  background: activeIdx === i ? `${SCENE_TINTS[i % 6]}33` : T.panel,
                  borderRight: i < scenes.length - 1 ? `1px solid ${T.line}` : "none",
                  padding: "6px 8px", boxSizing: "border-box", overflow: "hidden",
                }}>
                  <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: SCENE_TINTS[i % 6] }}>S{i + 1}</div>
                  <div style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{s.text || "—"}</div>
                </div>
              ))}
              {specs && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(playhead / (total || 1)) * 100}%`, width: 2, background: T.amber, boxShadow: `0 0 8px ${T.amber}` }} />
              )}
            </div>

            <p style={{ fontSize: 12, color: T.muted, marginTop: 14, lineHeight: 1.5 }}>
              Characters now have outlines, blinking eyes, smiles, hopping walk cycles, flapping wings, and bouncy pop-in entrances — the core tricks of 2D kids animation. The same JSON spec format drives it, so upgrading art quality never changes the user flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
