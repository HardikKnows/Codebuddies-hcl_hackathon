import { Activity, Globe, Headset, PackageX, Smartphone, Store, Unlink, UserX, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Narration } from "../components/Narration";
import { brandGradient, clamp, colors, easeInOut, easeOut, fontFamily } from "../theme";

const HUB = { x: 960, y: 470 };

const NODES: { icon: LucideIcon; label: string; x: number; y: number }[] = [
  { icon: Store, label: "Koramangala store", x: 470, y: 250 },
  { icon: Globe, label: "Online store", x: 960, y: 150 },
  { icon: Store, label: "Andheri store", x: 1450, y: 250 },
  { icon: Smartphone, label: "Mobile shoppers", x: 1450, y: 690 },
  { icon: Warehouse, label: "Central warehouse", x: 960, y: 790 },
  { icon: Headset, label: "Support desk", x: 470, y: 690 },
];

const ISSUES: { icon: LucideIcon; text: string; at: number; x: number; y: number }[] = [
  { icon: Unlink, text: "Disconnected data", at: 3.2, x: 640, y: 420 },
  { icon: UserX, text: "Inconsistent experiences", at: 4.8, x: 1290, y: 420 },
  { icon: PackageX, text: "Inventory gaps", at: 6.8, x: 960, y: 560 },
];

const CONNECT = 9.4;
const REVEAL = 10.3;

/** 01 — The vision: scattered retail touchpoints connect into RetailPulse AI. */
export const VisionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const connect = interpolate(t, [CONNECT, CONNECT + 1], [0, 1], { ...clamp, easing: easeInOut });
  const reveal = spring({ frame: frame - REVEAL * fps, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ fontFamily, color: colors.white }}>
      <AbsoluteFill
        style={{
          opacity: interpolate(reveal, [0, 1], [1, 0.22]),
          scale: String(interpolate(reveal, [0, 1], [1, 0.9])),
        }}
      >
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {NODES.map((n, i) => {
            const appear = interpolate(t, [0.4 + i * 0.18, 1.2 + i * 0.18], [0, 1], clamp);
            const length = Math.hypot(HUB.x - n.x, HUB.y - n.y);
            return (
              <g key={n.label}>
                {/* Broken, dashed links before the platform connects them. */}
                <line
                  x1={n.x}
                  y1={n.y}
                  x2={n.x + (HUB.x - n.x) * 0.42}
                  y2={n.y + (HUB.y - n.y) * 0.42}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={3}
                  strokeDasharray="6 12"
                  opacity={appear * (1 - connect)}
                />
                <line
                  x1={n.x}
                  y1={n.y}
                  x2={HUB.x}
                  y2={HUB.y}
                  stroke={colors.brand400}
                  strokeWidth={4}
                  strokeDasharray={length}
                  strokeDashoffset={length * (1 - connect)}
                  filter="url(#glow)"
                />
                {connect > 0.6 &&
                  [0, 0.5].map((phase) => {
                    const p = (t * 0.55 + phase + i * 0.13) % 1;
                    return (
                      <circle
                        key={phase}
                        cx={n.x + (HUB.x - n.x) * p}
                        cy={n.y + (HUB.y - n.y) * p}
                        r={6}
                        fill={colors.brand200}
                        opacity={connect * Math.sin(p * Math.PI)}
                        filter="url(#glow)"
                      />
                    );
                  })}
              </g>
            );
          })}
        </svg>

        {NODES.map((n, i) => {
          const pop = spring({ frame: frame - (0.4 + i * 0.18) * fps, fps, config: { damping: 14, stiffness: 120 } });
          const Icon = n.icon;
          const wobble = (1 - connect) * Math.sin(t * 3 + i) * 4;
          return (
            <div
              key={n.label}
              style={{
                position: "absolute",
                left: n.x - 70,
                top: n.y - 70 + wobble,
                width: 140,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                opacity: pop,
                scale: String(pop),
              }}
            >
              <div
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: connect > 0 ? `rgba(100,87,216,${0.18 + 0.4 * connect})` : "rgba(255,255,255,0.07)",
                  border: `2px solid ${connect > 0.5 ? colors.brand400 : "rgba(255,255,255,0.16)"}`,
                  boxShadow: connect > 0.5 ? `0 0 40px ${colors.brand500}88` : "none",
                }}
              >
                <Icon size={48} color={connect > 0.5 ? "#fff" : colors.mist} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, whiteSpace: "nowrap", color: colors.mist }}>{n.label}</div>
            </div>
          );
        })}

        {ISSUES.map((issue) => {
          const p = interpolate(t, [issue.at, issue.at + 0.5], [0, 1], { ...clamp, easing: easeOut });
          const gone = interpolate(t, [CONNECT - 0.4, CONNECT + 0.3], [1, 0], clamp);
          const Icon = issue.icon;
          return (
            <div
              key={issue.text}
              style={{
                position: "absolute",
                left: issue.x,
                top: issue.y,
                translate: `-50% ${interpolate(p, [0, 1], [16, 0])}px`,
                opacity: p * gone,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(239,68,68,0.16)",
                border: "1.5px solid rgba(248,113,113,0.55)",
                color: "#fecaca",
                fontSize: 28,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={28} strokeWidth={2.2} />
              {issue.text}
            </div>
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            opacity: reveal,
            scale: String(interpolate(reveal, [0, 1], [0.85, 1])),
            marginTop: -60,
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 48,
              background: brandGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 30px 90px ${colors.brand600}aa, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            <Activity size={104} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
              RetailPulse <span style={{ color: colors.brand300 }}>AI</span>
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 42,
                fontWeight: 500,
                color: colors.mist,
                opacity: interpolate(t, [REVEAL + 0.6, REVEAL + 1.2], [0, 1], clamp),
              }}
            >
              Retail, reimagined with AI
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Narration scene="vision" />
    </AbsoluteFill>
  );
};
