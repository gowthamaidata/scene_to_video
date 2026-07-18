/* ── LocalCompiler.js ──────────────────────────────────────────────── *
 *  Keyword-based scene compiler — fallback when the AI API is        *
 *  unavailable. Parses plain-English scene text into a JSON spec.    *
 *                                                                    *
 *  Now also generates: camera, lighting, weather, particles.         *
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Compile a single scene description into a render spec.
 *
 * @param {string} sceneText – plain English scene description
 * @returns {object} scene spec
 */
export function localCompile(sceneText) {
  const s = sceneText.toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));

  /* ── Background ─────────────────────────────────────────────────── */
  const night  = has("night", "star", "moon", "dark");
  const water  = has("ocean", "sea", "wave", "lake", "fish", "rain");
  const sunset = has("dusk", "sunset", "golden");

  let bg = night   ? ["#2B2160", "#4A3A8C"]
         : water   ? ["#8FD0FF", "#DFF6FF"]
         : sunset  ? ["#5A3E8E", "#FFB07A"]
         : ["#9BDBFF", "#E8FBFF"];
  if (has("meadow", "grass", "hill", "flower") && !night) bg = ["#8FD4FF", "#DFF8E8"];
  if (has("snow", "winter")) bg = ["#C8DCF0", "#F0F5FF"];

  /* ── Camera ─────────────────────────────────────────────────────── */
  let camera = { type: "slow_zoom_in", intensity: 1 };
  if (has("pan", "across"))    camera = { type: "pan_right", intensity: 1 };
  if (has("zoom in"))          camera = { type: "dolly_in",  intensity: 1 };
  if (has("zoom out"))         camera = { type: "slow_zoom_out", intensity: 1 };
  if (has("follow"))           camera = { type: "pan_right", intensity: 0.8 };

  /* ── Lighting ───────────────────────────────────────────────────── */
  let lighting = undefined;
  if (night)  lighting = { ambient: 0.3, directional: 0.15, sunColor: "#8899CC" };
  if (sunset) lighting = { ambient: 0.5, directional: 0.5,  sunColor: "#FFB070", sunAngle: -0.4 };

  /* ── Elements ───────────────────────────────────────────────────── */
  const el = [];

  if (has("sun", "sunrise", "sunny", "smiling sun"))
    el.push({ shape: "sun", color: "#FFC93C", size: 0.24, from: { x: 0.78, y: 0.9 }, to: { x: 0.78, y: 0.22 }, face: true, depth: 0 });
  if (has("moon"))
    el.push({ shape: "moon", color: "#FFF3C4", size: 0.18, from: { x: 0.78, y: 0.45 }, to: { x: 0.78, y: 0.18 }, face: true, depth: 0 });
  if (night)
    for (let i = 0; i < 12; i++)
      el.push({ shape: "star", color: "#FFE58A", size: 0.03, from: { x: Math.random(), y: Math.random() * 0.5 }, to: null, pulse: true, delay: Math.random() * 0.5, depth: 0 });
  if (has("cloud") || (!night && !water))
    for (let i = 0; i < 2; i++)
      el.push({ shape: "cloud", color: "#FFFFFF", size: 0.1, from: { x: -0.25, y: 0.14 + i * 0.13 }, to: { x: 1.25, y: 0.14 + i * 0.13 }, delay: i * 0.35, depth: 1 });
  if (has("rainbow"))
    el.push({ shape: "rainbow", color: "#FF6B6B", size: 0.5, from: { x: 0.5, y: 0.75 }, to: null, grow: true, depth: 2 });
  if (water && has("wave", "ocean", "sea")) {
    el.push({ shape: "wave", color: "#3D9BE9", size: 0.28, from: { x: 0, y: 0.86 }, to: null, depth: 3 });
    el.push({ shape: "wave", color: "#6FC0FF", size: 0.24, from: { x: 0.1, y: 0.92 }, to: null, delay: 0.2, depth: 4 });
  }
  if (has("meadow", "grass", "hill", "garden") || (!water && !has("city")))
    el.push({ shape: "hill", color: "#6FCB7C", size: 0.32, from: { x: 0.5, y: 1 }, to: null, depth: 3 });
  if (has("flower", "garden", "meadow"))
    for (let i = 0; i < 4; i++)
      el.push({ shape: "flower", color: ["#FF8FA3", "#FFC93C", "#B78BFF", "#FF9A6B"][i], size: 0.09, from: { x: 0.12 + i * 0.16, y: 0.88 }, to: null, delay: 0.1 + i * 0.1, grow: true, depth: 5 });
  if (has("tree", "forest"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "tree", color: "#4CAF6D", size: 0.24, from: { x: 0.18 + i * 0.3, y: 0.82 }, to: null, delay: i * 0.1, grow: true, depth: 4 });
  if (has("house", "home", "cottage"))
    el.push({ shape: "house", color: "#FFB0A0", size: 0.28, from: { x: 0.22, y: 0.78 }, to: null, grow: true, depth: 5 });
  if (has("cat", "kitten", "dog", "puppy", "fox"))
    el.push({ shape: "cat", color: has("fox") ? "#FF8C42" : "#F5A25D", size: 0.17, from: { x: -0.2, y: 0.8 }, to: { x: 0.65, y: 0.8 }, walk: true, depth: 6 });
  if (has("bunny", "rabbit"))
    el.push({ shape: "bunny", color: "#F2F2F2", size: 0.16, from: { x: 1.2, y: 0.8 }, to: { x: 0.4, y: 0.8 }, walk: true, depth: 6 });
  if (has("butterfly"))
    el.push({ shape: "butterfly", color: "#B78BFF", size: 0.07, from: { x: -0.1, y: 0.45 }, to: { x: 1.1, y: 0.3 }, flutter: true, depth: 8 });
  if (has("bird", "seagull"))
    for (let i = 0; i < 2; i++)
      el.push({ shape: "bird", color: ["#5FB8FF", "#FF8FA3"][i], size: 0.07, from: { x: -0.15 - i * 0.15, y: 0.25 + i * 0.1 }, to: { x: 1.15, y: 0.2 + i * 0.08 }, delay: i * 0.1, depth: 7 });
  if (has("fish"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "fish", color: ["#FF9A6B", "#5FB8FF", "#FFC93C"][i], size: 0.09, from: { x: 1.15, y: 0.55 + i * 0.13 }, to: { x: -0.15, y: 0.55 + i * 0.13 }, delay: i * 0.15, depth: 6 });
  if (has("balloon"))
    for (let i = 0; i < 3; i++)
      el.push({ shape: "balloon", color: ["#FF6B6B", "#FFC93C", "#5AD1B3"][i], size: 0.1, from: { x: 0.3 + i * 0.2, y: 1.15 }, to: { x: 0.32 + i * 0.2, y: 0.25 + i * 0.08 }, delay: i * 0.12, sway: true, depth: 9 });
  if (has("rocket", "launch", "space"))
    el.push({ shape: "rocket", color: "#FF6B6B", size: 0.18, from: { x: 0.5, y: 0.85 }, to: { x: 0.55, y: -0.25 }, depth: 7 });
  if (has("car"))
    el.push({ shape: "car", color: "#FF6B6B", size: 0.14, from: { x: -0.25, y: 0.84 }, to: { x: 1.25, y: 0.84 }, depth: 6 });
  if (has("city", "skyline", "building", "town"))
    el.push({ shape: "city", color: "#B9A6E8", size: 0.42, from: { x: 0.5, y: 1 }, to: null, depth: 3 });
  if (has("rain"))
    for (let i = 0; i < 16; i++)
      el.push({ shape: "rain", color: "#7FB8FF", size: 0.05, from: { x: Math.random(), y: -0.1 }, to: { x: Math.random() - 0.05, y: 1.1 }, delay: Math.random() * 0.8, depth: 10 });
  if (has("snow"))
    for (let i = 0; i < 20; i++)
      el.push({ shape: "circle", color: "#FFFFFF", size: 0.015 + Math.random() * 0.01, from: { x: Math.random(), y: -0.1 }, to: { x: Math.random(), y: 1.1 }, delay: Math.random() * 0.8, pulse: true, depth: 10 });

  if (el.length === 0)
    el.push({ shape: "star", color: "#FFC93C", size: 0.2, from: { x: 0.3, y: 0.4 }, to: { x: 0.7, y: 0.4 }, pulse: true, face: true, depth: 5 });

  /* ── Caption ────────────────────────────────────────────────────── */
  const titleMatch = s.match(/(?:says|title|text)\s+["']?([^"',.]+)/);
  const caption = titleMatch ? titleMatch[1].toUpperCase().trim() : "";

  return {
    bg,
    caption,
    elements: el,
    camera,
    lighting,
  };
}
