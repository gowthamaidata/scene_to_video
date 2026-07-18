/* ── AiCompiler.js ─────────────────────────────────────────────────── *
 *  Compiles scene descriptions via the Claude API.                   *
 *  Returns enriched specs with camera, lighting, and weather.        *
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Send all scenes to Claude for compilation into animation specs.
 *
 * @param {Array<{text: string}>} scenes
 * @returns {Promise<Array<object>>} compiled specs
 */
export async function aiCompile(scenes) {
  const prompt = `You compile scene descriptions into JSON specs for a CINEMATIC KIDS CARTOON 2.5D canvas engine (Disney Junior / Cocomelon quality — cute, bright, rich).

Scenes:
${scenes.map((s, i) => `${i + 1}. ${s.text}`).join("\n")}

Respond with ONLY a JSON array (no markdown, no prose), one object per scene:
{
 "bg": ["#hex","#hex"],
 "caption": "",
 "camera": {
   "type": "slow_zoom_in|slow_zoom_out|pan_left|pan_right|tilt_up|dolly_in|ken_burns|static",
   "intensity": 0.5-1.5
 },
 "lighting": {
   "ambient": 0.3-0.8,
   "directional": 0.2-0.7,
   "sunColor": "#hex",
   "rimStrength": 0.1-0.3
 },
 "elements": [
   {
     "shape": "sun|moon|star|cloud|rainbow|hill|tree|flower|house|cat|bunny|butterfly|bird|fish|balloon|rocket|car|city|wave|rain|circle",
     "color": "#hex",
     "size": 0.03-0.5,
     "from": {"x":0-1,"y":0-1},
     "to": {"x":..,"y":..} or null,
     "delay": 0-0.5,
     "depth": 0-10,
     "face": true/false,
     "grow": true/false,
     "walk": true/false,
     "flutter": true/false,
     "sway": true/false,
     "pulse": true/false
   }
 ]
}

Rules:
- depth: 0=sky, 3=ground, 5=objects, 7=foreground, 10=overlay
- Always include ground (hill) or water (wave) unless it's space
- Pick camera type that matches the scene mood
- Use bright, saturated, kid-friendly colors
- 4-14 elements per scene, back-to-front ordered by depth
- Make motion expressive: things enter, travel, or transform`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content.map((c) => c.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const arr = JSON.parse(clean);

  if (!Array.isArray(arr) || arr.length !== scenes.length) {
    throw new Error("AI returned invalid spec array");
  }

  return arr;
}
