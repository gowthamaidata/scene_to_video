/* ── constants.js ──────────────────────────────────────────────────── *
 *  Global theme tokens, palette, and config used across the engine.  *
 * ─────────────────────────────────────────────────────────────────── */

export const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Inter:wght@400;500;600&family=Spline+Sans+Mono:wght@400;500&display=swap";

/** UI theme palette */
export const T = {
  ink:    "#101319",
  panel:  "#171B24",
  panel2: "#1D2230",
  line:   "#2A3040",
  text:   "#E8EBF2",
  muted:  "#8A93A6",
  violet: "#8B7CFF",
  amber:  "#FFC466",
};

/** Per-scene accent colours (cycled by index) */
export const SCENE_TINTS = [
  "#8B7CFF", "#FFC466", "#5AD1B3",
  "#FF8FA3", "#6EB7FF", "#D6A2FF",
];

/** Warm chocolate cartoon outline used by every shape */
export const OUTLINE = "#432E24";

/** Default scenes pre-loaded on first visit */
export const DEFAULT_SCENES = [
  { id: 1, text: "A smiling sun rises over a green meadow full of flowers, a butterfly flutters by", duration: 5 },
  { id: 2, text: "A happy orange cat walks past a little house chasing the butterfly, clouds drift", duration: 6 },
  { id: 3, text: "A rainbow appears over the hills and balloons float up into the sky, title says THE END", duration: 5 },
];

/** Canvas base resolution */
export const BASE_W = 960;
export const BASE_H = 540;
