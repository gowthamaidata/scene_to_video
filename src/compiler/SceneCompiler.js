/* ── SceneCompiler.js ──────────────────────────────────────────────── *
 *  Orchestrator: tries AI compiler first, falls back to local.       *
 * ─────────────────────────────────────────────────────────────────── */

import { aiCompile } from "./AiCompiler.js";
import { localCompile } from "./LocalCompiler.js";

/**
 * Compile an array of scene descriptions into render specs.
 *
 * @param {Array<{text: string, duration: number}>} scenes
 * @returns {Promise<{ specs: Array<object>, engine: string }>}
 */
export async function compileScenes(scenes) {
  try {
    const specs = await aiCompile(scenes);
    return { specs, engine: "Compiled by Claude" };
  } catch (err) {
    console.warn("AI compiler unavailable, using local fallback:", err.message);
    const specs = scenes.map((s) => localCompile(s.text));
    return { specs, engine: "AI unavailable — used built-in compiler" };
  }
}
