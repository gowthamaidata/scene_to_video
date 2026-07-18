/* ── WalkCycle.js ──────────────────────────────────────────────────── *
 *  Procedural walk / hop cycle for cartoon characters.               *
 *  Computes skeletal offsets: hip, shoulders, feet, head, tail.      *
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Compute walk-cycle skeletal offsets for a given frame.
 *
 * @param {number} phase – normalised walk phase 0→many (speed × time)
 * @param {number} size  – character reference size
 * @returns {object} offsets to apply to body parts
 */
export function computeWalkCycle(phase, size) {
  const t = phase * Math.PI * 2; // convert to radians

  // Hip bob — up/down with double-frequency
  const hipY = -Math.abs(Math.sin(t)) * size * 0.06;
  // Hip sway — subtle left/right
  const hipX = Math.sin(t * 0.5) * size * 0.01;

  // Shoulder counter-rotation
  const shoulderTilt = Math.sin(t) * 0.06; // radians

  // Front legs — alternating stride
  const frontLegL = Math.sin(t) * size * 0.08;
  const frontLegR = Math.sin(t + Math.PI) * size * 0.08;

  // Back legs
  const backLegL = Math.sin(t + Math.PI * 0.5) * size * 0.07;
  const backLegR = Math.sin(t + Math.PI * 1.5) * size * 0.07;

  // Foot plant — legs stretch down when on ground
  const frontLiftL = Math.max(0, Math.sin(t)) * size * 0.04;
  const frontLiftR = Math.max(0, Math.sin(t + Math.PI)) * size * 0.04;

  // Head lag — slight delay behind hip
  const headLag = Math.sin(t - 0.3) * size * 0.015;
  const headTilt = Math.sin(t * 0.5) * 0.04;

  // Tail secondary motion — follows body with phase offset
  const tailPhase = t - 0.6;
  const tailSwing = Math.sin(tailPhase) * 0.3;
  const tailBob = Math.sin(tailPhase * 2) * size * 0.02;

  // Ear bounce — springy follow-through
  const earBounce = Math.sin(t * 2 + 0.5) * size * 0.02;

  return {
    hipX, hipY,
    shoulderTilt,
    frontLegL, frontLegR,
    backLegL, backLegR,
    frontLiftL, frontLiftR,
    headLag, headTilt,
    tailSwing, tailBob,
    earBounce,
  };
}

/**
 * Compute a hopping cycle (for rabbits, birds).
 */
export function computeHopCycle(phase, size) {
  const t = phase * Math.PI * 2;

  // Higher, sharper bounces
  const hopY = -Math.abs(Math.pow(Math.sin(t), 0.6)) * size * 0.18;

  // Squash on land, stretch on rise
  const squash = 1 + Math.sin(t) * 0.08;
  const stretch = 1 / squash;

  // Ear flop
  const earFlop = Math.sin(t * 2 + 0.8) * 0.35;

  return {
    hipY: hopY,
    hipX: 0,
    squashX: squash,
    squashY: stretch,
    earFlop,
    tailBob: Math.sin(t * 2) * size * 0.03,
  };
}

/**
 * Simple sinusoidal flutter for butterflies / birds in flight.
 */
export function computeFlutter(phase, size) {
  const t = phase * Math.PI * 2;
  return {
    wingAngle: Math.abs(Math.sin(t * 3)) * 0.7 + 0.3,
    bodyBob: Math.sin(t * 1.5) * size * 0.5,
    bodyTilt: Math.sin(t * 0.8) * 0.1,
  };
}
