/* ── Physics.js ────────────────────────────────────────────────────── *
 *  Lightweight physics for secondary motion: spring, wind, gravity,  *
 *  balloon drift, tail/ear dynamics.                                 *
 * ─────────────────────────────────────────────────────────────────── */

import { clamp01, smoothNoise } from "../utils/helpers.js";

/**
 * Damped spring oscillation.
 * Returns displacement at time t from rest position.
 *
 * @param {number} t          – time since disturbance
 * @param {number} amplitude  – initial displacement
 * @param {number} frequency  – oscillation frequency
 * @param {number} damping    – decay rate (0 = no decay)
 */
export function springMotion(t, amplitude = 1, frequency = 8, damping = 3) {
  return amplitude * Math.exp(-damping * t) * Math.cos(frequency * t);
}

/**
 * Global wind vector for the current frame.
 * Returns { x, y } force to be applied to affected elements.
 */
export function getWind(absT, intensity = 1) {
  const gustCycle = smoothNoise(absT * 0.15) * 0.6 + 0.4;
  const dir = smoothNoise(absT * 0.08 + 50) * 0.3;
  return {
    x: gustCycle * intensity * 12 * (0.7 + dir),
    y: gustCycle * intensity * 2 * Math.sin(absT * 0.4),
  };
}

/**
 * Tail physics — chain of joints affected by gravity and parent motion.
 * Returns array of { angle } for each segment.
 *
 * @param {number} segments  – number of tail joints
 * @param {number} t         – time
 * @param {number} parentVx  – parent horizontal velocity (negative = moving left)
 * @param {number} wind      – wind x force
 */
export function tailPhysics(segments, t, parentVx = 0, wind = 0) {
  const joints = [];
  for (let i = 0; i < segments; i++) {
    const lag = (i + 1) * 0.15;
    const gravity = 0.12 * (i + 1);
    const windEffect = wind * 0.004 * (i + 1);
    const velEffect = -parentVx * 0.003 * (i + 1);

    const angle = Math.sin(t * 3 - lag * 4) * (0.2 + i * 0.08)
                + gravity * 0.1
                + windEffect
                + velEffect;

    joints.push({ angle });
  }
  return joints;
}

/**
 * Ear physics — springy follow-through from head motion.
 */
export function earPhysics(t, headVy = 0) {
  const bounce = springMotion(t % 0.8, 0.15, 12, 4);
  const gravity = 0.05;
  return {
    leftAngle:  -0.1 + bounce + gravity - headVy * 0.01,
    rightAngle:  0.1 - bounce + gravity - headVy * 0.01,
  };
}

/**
 * Balloon physics — buoyancy + sway + wind.
 */
export function balloonPhysics(t, wind, idx = 0) {
  const phase = idx * 1.7;
  return {
    swayX: Math.sin(t * 1.2 + phase) * 8 + wind * 0.5,
    swayY: Math.sin(t * 0.8 + phase) * 3,
    stringCurve: Math.sin(t * 1.5 + phase) * 0.15,
    rotation: Math.sin(t * 0.6 + phase) * 0.08,
  };
}

/**
 * Sway physics for trees and flowers.
 */
export function swayPhysics(t, intensity = 1, seed = 0) {
  const base = Math.sin(t * 0.8 + seed * 2.3) * 0.03 * intensity;
  const gust = smoothNoise(t * 0.5 + seed * 7) * 0.02 * intensity;
  return base + gust;
}
