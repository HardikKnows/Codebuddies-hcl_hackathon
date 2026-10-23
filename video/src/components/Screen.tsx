import { Lock } from "lucide-react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Box, shot, ShotName } from "../footage";
import { clamp, colors, easeInOut, easeOut, fontFamily } from "../theme";

export type CameraKey = { at: number; focus?: Box; zoom?: number };
export type Highlight = { box: Box; from: number; until?: number; label?: string; dim?: boolean };

const PAGE = { width: 1440, height: 810 };
const WINDOW_WIDTH = 1560;
const CHROME = 46;
const VIEW_HEIGHT = (WINDOW_WIDTH * PAGE.height) / PAGE.width;

/** Camera position (page-space center + zoom) at a time, eased between keys. */
const cameraAt = (keys: CameraKey[], t: number) => {
  const resolve = (k: CameraKey) => ({
    cx: k.focus ? k.focus.x + k.focus.w / 2 : PAGE.width / 2,
    cy: k.focus ? k.focus.y + k.focus.h / 2 : PAGE.height / 2,
    zoom: k.zoom ?? 1,
  });
  if (t <= keys[0].at) return resolve(keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.at) {
      const p = easeInOut((t - a.at) / (b.at - a.at));
      const ra = resolve(a);
      const rb = resolve(b);
      return {
        cx: ra.cx + (rb.cx - ra.cx) * p,
        cy: ra.cy + (rb.cy - ra.cy) * p,
        zoom: ra.zoom + (rb.zoom - ra.zoom) * p,
      };
    }
  }
  return resolve(keys[keys.length - 1]);
};

/** A real app screenshot in a browser window, with an eased camera and spotlight highlights. */
export const Screen: React.FC<{
  shot: ShotName;
  camera?: CameraKey[];
  highlights?: Highlight[];
  fadeIn?: boolean;
  fadeOut?: boolean;
}> = ({ shot: name, camera = [{ at: 0 }], highlights = [], fadeIn = true, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const footage = shot(name);

  const cam = cameraAt(camera, t);
  // A slow push-in keeps still footage alive.
  const zoom = cam.zoom * (1 + 0.025 * (frame / durationInFrames));
  const scale = (WINDOW_WIDTH / PAGE.width) * zoom;
  const tx = Math.min(0, Math.max(WINDOW_WIDTH - PAGE.width * scale, WINDOW_WIDTH / 2 - cam.cx * scale));
  const ty = Math.min(0, Math.max(VIEW_HEIGHT - PAGE.height * scale, VIEW_HEIGHT / 2 - cam.cy * scale));

  const opacity =
    (fadeIn ? interpolate(frame, [0, 12], [0, 1], clamp) : 1) *
    (fadeOut ? interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp) : 1);
  const rise = fadeIn ? interpolate(frame, [0, 18], [24, 0], { ...clamp, easing: easeOut }) : 0;

  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 58, opacity, fontFamily }}>
      <div
        style={{
          width: WINDOW_WIDTH,
          borderRadius: 18,
          overflow: "hidden",
          translate: `0px ${rise}px`,
          boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)",
          background: "#fff",
        }}
      >
        <div
          style={{
            height: CHROME,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 20px",
            background: "#eef0f7",
            borderBottom: "1px solid #dfe3ee",
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
          ))}
          <div
            style={{
              marginLeft: 24,
              flex: "0 1 520px",
              height: 28,
              borderRadius: 8,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 14px",
              fontSize: 15,
              color: "#64748b",
            }}
          >
            <Lock size={13} strokeWidth={2.5} />
            RetailPulse · NovaMart
          </div>
        </div>
        <div style={{ position: "relative", width: WINDOW_WIDTH, height: VIEW_HEIGHT, overflow: "hidden" }}>
          <Img
            src={footage.src}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: PAGE.width,
              height: PAGE.height,
              transformOrigin: "0 0",
              translate: `${tx}px ${ty}px`,
              scale: String(scale),
            }}
          />
          {highlights.map((h, i) => (
            <Ring key={i} highlight={h} t={t} fps={fps} place={(b) => ({
              left: tx + b.x * scale,
              top: ty + b.y * scale,
              width: b.w * scale,
              height: b.h * scale,
            })} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Animated focus ring; with `dim`, everything outside it darkens. Shared by screens and panels. */
export const Ring: React.FC<{
  highlight: Highlight;
  t: number;
  fps: number;
  place: (b: Box) => { left: number; top: number; width: number; height: number };
}> = ({ highlight, t, fps, place }) => {
  const { box, from, until, label, dim } = highlight;
  if (t < from || (until !== undefined && t > until)) return null;
  const local = (t - from) * fps;
  const outro = until === undefined ? 1 : interpolate((until - t) * fps, [0, 8], [0, 1], clamp);
  const appear = interpolate(local, [0, 14], [0, 1], { ...clamp, easing: easeOut }) * outro;
  const pad = 10;
  const p = place(box);
  return (
    <div
      style={{
        position: "absolute",
        left: p.left - pad,
        top: p.top - pad,
        width: p.width + pad * 2,
        height: p.height + pad * 2,
        borderRadius: 16,
        border: `4px solid ${colors.brand500}`,
        opacity: appear,
        scale: String(interpolate(appear, [0, 1], [1.08, 1])),
        boxShadow: `0 0 0 6px ${colors.brand400}40, 0 0 48px ${colors.brand500}aa${dim ? `, 0 0 0 4000px rgba(6,10,28,${0.42 * appear})` : ""}`,
        pointerEvents: "none",
      }}
    >
      {label && (
        <div
          style={{
            position: "absolute",
            left: -4,
            bottom: "100%",
            marginBottom: 12,
            whiteSpace: "nowrap",
            padding: "8px 18px",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${colors.brand500}, ${colors.violet})`,
            color: "#fff",
            fontFamily,
            fontWeight: 700,
            fontSize: 26,
            boxShadow: "0 12px 30px rgba(49,38,111,0.45)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
