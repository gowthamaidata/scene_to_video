/* ── App.jsx ───────────────────────────────────────────────────────── *
 *  Storyboard Studio — cinematic 2.5D animation engine                *
 *  UI shell: scene editor, playback controls, timeline, export.      *
 *  All rendering is delegated to src/renderer/*.                     *
 * ─────────────────────────────────────────────────────────────────── */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FONT_LINK, T, SCENE_TINTS, DEFAULT_SCENES, BASE_W, BASE_H } from "./utils/constants.js";
import { clamp01, fmt } from "./utils/helpers.js";
import { renderScene } from "./renderer/Renderer.js";
import { compileScenes } from "./compiler/SceneCompiler.js";
import { startRecording, downloadBlob } from "./export/VideoExporter.js";

/* ── Main component ───────────────────────────────────────────────── */

export default function App() {
  const [scenes, setScenes]       = useState(DEFAULT_SCENES);
  const [specs, setSpecs]         = useState(null);
  const [status, setStatus]       = useState("idle"); // idle | compiling | ready
  const [engineNote, setEngineNote] = useState("");
  const [playing, setPlaying]     = useState(false);
  const [playhead, setPlayhead]   = useState(0);
  const [recording, setRecording] = useState(false);

  const canvasRef  = useRef(null);
  const playRef    = useRef(false);
  const headRef    = useRef(0);
  const specsRef   = useRef(null);
  const scenesRef  = useRef(scenes);
  const rafRef     = useRef(null);
  const recRef     = useRef(null);

  scenesRef.current = scenes;

  const total = scenes.reduce((a, s) => a + Number(s.duration || 0), 0);

  /* ── Render loop ──────────────────────────────────────────────── */

  const render = useCallback((absTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const sc = scenesRef.current;
    const sp = specsRef.current;

    if (!sp) {
      // Empty state
      ctx.fillStyle = T.ink; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = T.muted;
      ctx.font = `500 ${H * 0.04}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Describe your scenes, then press Generate", W / 2, H / 2);
      return;
    }

    // Determine current scene
    let t = headRef.current, acc = 0, idx = 0;
    for (let i = 0; i < sc.length; i++) {
      const d = Number(sc[i].duration || 0);
      if (t < acc + d || i === sc.length - 1) { idx = i; break; }
      acc += d;
    }
    const d = Number(sc[idx].duration || 1);
    const sceneT = clamp01((t - acc) / d);

    // Render current scene
    renderScene(ctx, sp[idx], W, H, sceneT, absTime / 1000);

    // Cross-fade transition into next scene
    const fadeDur = 0.6; // seconds
    const fadeStart = 1 - fadeDur / d;
    if (sceneT > fadeStart && idx < sp.length - 1) {
      ctx.save();
      ctx.globalAlpha = (sceneT - fadeStart) / (1 - fadeStart);
      renderScene(ctx, sp[idx + 1], W, H, 0, absTime / 1000);
      ctx.restore();
    }
  }, []);

  /* ── Animation loop ───────────────────────────────────────────── */

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
          // Stop recording if active
          if (recRef.current) {
            recRef.current.stop().then((blob) => downloadBlob(blob));
            recRef.current = null;
            setRecording(false);
          }
        }
        setPlayhead(headRef.current);
      }
      render(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  /* ── Actions ──────────────────────────────────────────────────── */

  const generate = async () => {
    setStatus("compiling");
    setEngineNote("");
    const { specs: sp, engine } = await compileScenes(scenes);
    specsRef.current = sp;
    setSpecs(sp);
    setEngineNote(engine);
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

  const seek = (frac) => {
    headRef.current = frac * total;
    setPlayhead(headRef.current);
  };

  const exportVideo = () => {
    if (!specs || recording) return;
    const canvas = canvasRef.current;
    recRef.current = startRecording(canvas, 30);
    setRecording(true);
    headRef.current = 0;
    playRef.current = true;
    setPlaying(true);
  };

  const updateScene = (id, patch) =>
    setScenes((sc) => sc.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addScene = () =>
    setScenes((sc) => [...sc, { id: Date.now(), text: "", duration: 5 }]);
  const removeScene = (id) =>
    setScenes((sc) => sc.filter((s) => s.id !== id));

  /* ── Active scene index (for timeline highlight) ────────────── */

  let acc = 0, activeIdx = -1;
  if (specs) {
    for (let i = 0; i < scenes.length; i++) {
      const d = Number(scenes[i].duration || 0);
      if (playhead < acc + d) { activeIdx = i; break; }
      acc += d;
    }
    if (activeIdx === -1) activeIdx = scenes.length - 1;
  }

  /* ── Styles ───────────────────────────────────────────────────── */

  const btn = (primary) => ({
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    fontSize: 13,
    padding: "10px 18px",
    borderRadius: 10,
    cursor: "pointer",
    border: `1px solid ${primary ? "transparent" : T.line}`,
    background: primary
      ? "linear-gradient(135deg, #8B7CFF 0%, #6A5AFF 100%)"
      : "rgba(255,255,255,0.04)",
    color: primary ? "#FFF" : T.text,
    backdropFilter: "blur(8px)",
    transition: "all 0.2s ease",
  });

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.ink} 0%, #0C0F16 100%)`, color: T.text, fontFamily: "Inter, sans-serif" }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, letterSpacing: 2.5, color: T.amber, textTransform: "uppercase", marginBottom: 4 }}>
            Cinematic 2.5D Engine
          </div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 36, margin: "0 0 6px", background: "linear-gradient(135deg, #E8EBF2 0%, #B0B8CC 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Storyboard Studio
          </h1>
          <p style={{ color: T.muted, fontSize: 14, margin: 0, maxWidth: 660, lineHeight: 1.5 }}>
            Write each scene in plain English with a duration. Generate compiles them into a cinematic animated video with parallax, lighting, particles, and camera motion.
          </p>
        </header>

        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>

          {/* ── Scene Editor ──────────────────────────────────────── */}
          <div style={{ flex: "1 1 320px", minWidth: 300 }}>
            {scenes.map((s, i) => (
              <div key={s.id} style={{
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${activeIdx === i ? SCENE_TINTS[i % 6] + "88" : T.line}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                transition: "border-color 0.3s ease",
                boxShadow: activeIdx === i ? `0 0 20px ${SCENE_TINTS[i % 6]}15` : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: SCENE_TINTS[i % 6] }} />
                    <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11, color: SCENE_TINTS[i % 6], letterSpacing: 1 }}>
                      SCENE {i + 1}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number" min="1" max="60" value={s.duration}
                      onChange={(e) => updateScene(s.id, { duration: Number(e.target.value) })}
                      style={{
                        width: 52, background: "rgba(255,255,255,0.05)", border: `1px solid ${T.line}`,
                        borderRadius: 7, color: T.text, padding: "5px 8px",
                        fontFamily: "'Spline Sans Mono', monospace", fontSize: 12,
                      }}
                    />
                    <span style={{ fontSize: 11, color: T.muted }}>sec</span>
                    {scenes.length > 1 && (
                      <button onClick={() => removeScene(s.id)} aria-label={`Delete scene ${i + 1}`}
                        style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px", borderRadius: 4 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={s.text}
                  onChange={(e) => updateScene(s.id, { text: e.target.value })}
                  placeholder="Describe what happens in this scene…"
                  rows={2}
                  style={{
                    width: "100%", boxSizing: "border-box", resize: "vertical",
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${T.line}`,
                    borderRadius: 10, color: T.text, padding: 12,
                    fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
                  }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={addScene} style={btn(false)}>+ Add scene</button>
              <button
                onClick={generate}
                disabled={status === "compiling"}
                style={{ ...btn(true), opacity: status === "compiling" ? 0.6 : 1 }}
              >
                {status === "compiling" ? "Compiling…" : specs ? "Regenerate" : "Generate video"}
              </button>
            </div>

            {engineNote && (
              <div style={{ marginTop: 10, fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: engineNote.includes("Claude") ? "#5AD1B3" : T.amber, display: "inline-block" }} />
                {engineNote}
              </div>
            )}

            <div style={{
              marginTop: 18, padding: 14, background: "rgba(255,255,255,0.02)",
              border: `1px solid ${T.line}`, borderRadius: 12,
              fontSize: 12, color: T.muted, lineHeight: 1.65,
            }}>
              <strong style={{ color: T.text, fontSize: 11, letterSpacing: 1, fontFamily: "'Spline Sans Mono', monospace" }}>SCENE VOCABULARY</strong>
              <br />
              sun · moon · stars · clouds · rainbow · hills · trees · flowers · house · cat · bunny · butterfly · birds · fish · balloons · rocket · car · city · waves · rain · snow — and titles via "title says …"
            </div>
          </div>

          {/* ── Preview + Timeline ────────────────────────────────── */}
          <div style={{ flex: "2 1 480px", minWidth: 320 }}>
            <div style={{
              background: "#000",
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${T.line}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              <canvas
                ref={canvasRef}
                width={BASE_W}
                height={BASE_H}
                style={{ width: "100%", display: "block" }}
              />
            </div>

            {/* Transport controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <button
                onClick={togglePlay} disabled={!specs}
                style={{ ...btn(false), width: 46, textAlign: "center", opacity: specs ? 1 : 0.35, padding: "10px 0" }}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 13, color: T.text }}>
                {fmt(playhead)}{" "}
                <span style={{ color: T.muted }}>/ {fmt(total)}</span>
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={exportVideo}
                disabled={!specs || recording}
                style={{
                  ...btn(false),
                  borderColor: T.amber,
                  color: recording ? T.muted : T.amber,
                  opacity: specs ? 1 : 0.35,
                }}
              >
                {recording ? "● Recording…" : "↓ Export .webm"}
              </button>
            </div>

            {/* Timeline */}
            <div
              role="slider"
              aria-label="Timeline"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={playhead}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") seek(clamp01((playhead + 1) / total));
                if (e.key === "ArrowLeft")  seek(clamp01((playhead - 1) / total));
              }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(clamp01((e.clientX - r.left) / r.width));
              }}
              style={{
                position: "relative", marginTop: 14, height: 56,
                borderRadius: 12, overflow: "hidden", display: "flex",
                cursor: specs ? "pointer" : "default",
                border: `1px solid ${T.line}`,
                background: "rgba(255,255,255,0.02)",
                outlineColor: T.violet,
              }}
            >
              {scenes.map((s, i) => (
                <div key={s.id} style={{
                  width: `${(Number(s.duration || 0) / (total || 1)) * 100}%`,
                  background: activeIdx === i ? `${SCENE_TINTS[i % 6]}22` : "transparent",
                  borderRight: i < scenes.length - 1 ? `1px solid ${T.line}` : "none",
                  padding: "7px 9px", boxSizing: "border-box", overflow: "hidden",
                  transition: "background 0.3s ease",
                }}>
                  <div style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 10, color: SCENE_TINTS[i % 6], marginBottom: 2 }}>
                    S{i + 1}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {s.text || "—"}
                  </div>
                </div>
              ))}
              {specs && (
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `${(playhead / (total || 1)) * 100}%`,
                  width: 2, background: T.amber,
                  boxShadow: `0 0 10px ${T.amber}`,
                  transition: "left 0.05s linear",
                }} />
              )}
            </div>

            <p style={{ fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.55 }}>
              Engine features: layered parallax environment · cinematic camera (zoom, pan, dolly, breathing) · sphere/body gradients & specular highlights · ground shadows & rim lighting · procedural walk/hop cycles with skeletal animation · facial rigs (blink, expressions, pupil tracking) · wind/spring/tail physics · particle systems (dust, sparkles, fireflies, leaves, pollen) · post-processing (bloom, vignette, film grain, colour grade) · crossfade scene transitions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
