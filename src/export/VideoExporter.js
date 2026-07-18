/* ── VideoExporter.js ──────────────────────────────────────────────── *
 *  Handles video capture and export from the canvas.                 *
 *  Supports resolution presets and frame-rate options.                *
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Resolution presets.
 */
export const RESOLUTIONS = {
  "1080p": { w: 1920, h: 1080 },
  "1440p": { w: 2560, h: 1440 },
  "4K":    { w: 3840, h: 2160 },
};

/**
 * Start recording from a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} fps – 30 or 60
 * @returns {{ recorder: MediaRecorder, stop: () => Promise<Blob> }}
 */
export function startRecording(canvas, fps = 30) {
  const stream = canvas.captureStream(fps);
  const chunks = [];

  // Try VP9 first for better quality, fall back to VP8
  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000, // 8 Mbps for quality
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };
  });

  recorder.start();

  return {
    recorder,
    stop: () => {
      recorder.stop();
      return stopPromise;
    },
  };
}

/**
 * Trigger a file download for a blob.
 */
export function downloadBlob(blob, filename = "storyboard-video.webm") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
