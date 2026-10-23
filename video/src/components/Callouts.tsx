import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brandGradient, clamp, colors, easeOut, fontFamily } from "../theme";

export type CalloutItem = { icon: LucideIcon; title: string; detail?: string; from: number; tone?: "brand" | "warning" | "good" };

const TONES = {
  brand: brandGradient,
  warning: `linear-gradient(135deg, ${colors.warning}, #ea580c)`,
  good: `linear-gradient(135deg, ${colors.good}, #15803d)`,
};

/** Left-hand column for panel scenes: chapter eyebrow, headline, and points that build in on cue. */
export const Callouts: React.FC<{
  chapter: string;
  title: string;
  items: CalloutItem[];
  fadeOut?: boolean;
}> = ({ chapter, title, items, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = (at: number) => interpolate(frame - at * fps, [0, 18], [0, 1], { ...clamp, easing: easeOut });
  const exit = fadeOut ? interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp) : 1;

  return (
    <AbsoluteFill style={{ fontFamily, color: colors.white, opacity: exit }}>
      <div style={{ position: "absolute", left: 130, top: 150, width: 820 }}>
        <div
          style={{
            opacity: enter(0),
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: colors.brand300,
          }}
        >
          {chapter}
        </div>
        <div
          style={{
            opacity: enter(0.1),
            translate: `0px ${interpolate(enter(0.1), [0, 1], [20, 0])}px`,
            marginTop: 18,
            fontSize: 66,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 26 }}>
          {items.map((item) => {
            const p = enter(item.from);
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                style={{
                  opacity: p,
                  translate: `${interpolate(p, [0, 1], [-36, 0])}px 0px`,
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  padding: "20px 26px",
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: TONES[item.tone ?? "brand"],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 30px rgba(81,69,205,0.35)",
                  }}
                >
                  <Icon size={32} color="#fff" strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>{item.title}</div>
                  {item.detail && (
                    <div style={{ marginTop: 6, fontSize: 24, lineHeight: 1.35, color: colors.mist }}>{item.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
