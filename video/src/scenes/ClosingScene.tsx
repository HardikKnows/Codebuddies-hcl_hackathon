import { Activity, ArrowRight, Database, LayoutDashboard, Server, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Narration } from "../components/Narration";
import { shot, ShotName } from "../footage";
import { brandGradient, clamp, colors, easeOut, fontFamily } from "../theme";

const MONTAGE: ShotName[][] = [
  ["shop-catalog", "ai-reco-screen", "shop-availability", "ops-overview", "shop-search"],
  ["ops-audit", "ai-support-confirmed-screen", "login", "ai-stock-confirmed-screen", "shop-product"],
  ["ops-inventory", "ai-reco-asking", "ops-tickets", "shop-catalog", "ai-support-confirmed-screen"],
];

/** Fast montage: rows of real screens sliding on a tilted plane. */
const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity =
    interpolate(frame, [0, 10], [0, 1], clamp) * interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity, perspective: 1800, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 36,
          rotate: "x 24deg",
          transform: "rotateZ(-10deg)",
          scale: String(interpolate(frame, [0, durationInFrames], [1.15, 1.3])),
        }}
      >
        {MONTAGE.map((row, r) => (
          <div
            key={r}
            style={{
              display: "flex",
              gap: 36,
              translate: `${(r % 2 ? -1 : 1) * interpolate(frame, [0, durationInFrames], [-260, 260]) - 300}px 0px`,
            }}
          >
            {row.map((name, i) => (
              <Img
                key={i}
                src={shot(name).src}
                style={{
                  width: 640,
                  height: 360,
                  borderRadius: 18,
                  boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(6,10,28,0.85) 85%)" }} />
    </AbsoluteFill>
  );
};

const LAYERS: { icon: LucideIcon; title: string; subtitle: string; chips: string[]; at: number }[] = [
  { icon: LayoutDashboard, title: "React + Vite", subtitle: "Single-page app", chips: ["Storefront", "AI assistant", "Operations"], at: 0.3 },
  { icon: Server, title: "FastAPI", subtitle: "JWT · thin routes · services", chips: ["Catalog & orders", "Inventory", "Tickets & audit"], at: 1.3 },
  { icon: Sparkles, title: "AI agents", subtitle: "Validate → authorize → confirm → audit", chips: ["Shopping", "Policy", "Support", "Inventory"], at: 2.3 },
  { icon: Database, title: "PostgreSQL", subtitle: "with pgvector", chips: ["Products & stock", "Policy embeddings", "Append-only audit"], at: 3.3 },
];

/** Architecture: the four layers build left to right, with the model on the side. */
const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const appear = (at: number) => interpolate(t, [at, at + 0.6], [0, 1], { ...clamp, easing: easeOut });
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ fontFamily, color: colors.white, opacity: exit }}>
      <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.22em", color: colors.brand300, opacity: appear(0) }}>
          ARCHITECTURE
        </div>
        <div style={{ marginTop: 14, fontSize: 64, fontWeight: 800, letterSpacing: "-0.02em", opacity: appear(0.1) }}>
          One modular platform
        </div>
      </div>
      <div style={{ position: "absolute", top: 380, left: 110, right: 110, display: "flex", alignItems: "stretch", gap: 18 }}>
        {LAYERS.map((layer, i) => {
          const p = appear(layer.at);
          const Icon = layer.icon;
          const isAi = layer.title === "AI agents";
          return (
            <div key={layer.title} style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
              <div
                style={{
                  flex: 1,
                  height: 400,
                  opacity: p,
                  translate: `0px ${interpolate(p, [0, 1], [30, 0])}px`,
                  borderRadius: 26,
                  padding: "30px 28px",
                  background: isAi ? "rgba(100,87,216,0.22)" : "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${isAi ? colors.brand400 : "rgba(255,255,255,0.14)"}`,
                  boxShadow: isAi ? `0 0 60px ${colors.brand600}66` : "none",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: brandGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={34} color="#fff" strokeWidth={2.2} />
                </div>
                <div style={{ marginTop: 22, fontSize: 38, fontWeight: 800 }}>{layer.title}</div>
                <div style={{ marginTop: 6, fontSize: 21, color: colors.mist }}>{layer.subtitle}</div>
                <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {layer.chips.map((chip, c) => (
                    <span
                      key={chip}
                      style={{
                        opacity: appear(layer.at + 0.25 + c * 0.12),
                        padding: "8px 16px",
                        borderRadius: 999,
                        fontSize: 21,
                        fontWeight: 600,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.14)",
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              {i < LAYERS.length - 1 && (
                <ArrowRight size={40} color={colors.brand300} style={{ opacity: appear(LAYERS[i + 1].at - 0.2), flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 820,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: appear(4.4),
        }}
      >
        <div
          style={{
            padding: "14px 28px",
            borderRadius: 999,
            border: `2px dashed ${colors.brand400}`,
            fontSize: 26,
            fontWeight: 600,
            color: colors.brand200,
          }}
        >
          OpenAI Responses API · the model proposes, the server decides
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TAGLINES = [
  { text: "Smarter shopping.", at: 2.6 },
  { text: "Connected operations.", at: 4.1 },
  { text: "AI you can trust.", at: 5.7 },
];

/** Branded end frame: logo, name and the three promises in time with the voiceover. */
const EndFrame: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const logo = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ fontFamily, color: colors.white, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: logo, scale: String(interpolate(logo, [0, 1], [0.9, 1])) }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 40,
              background: brandGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 30px 90px ${colors.brand600}aa, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          >
            <Activity size={88} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 128, fontWeight: 800, letterSpacing: "-0.04em" }}>
            RetailPulse <span style={{ color: colors.brand300 }}>AI</span>
          </div>
        </div>
        <div style={{ marginTop: 70, display: "flex", gap: 34 }}>
          {TAGLINES.map((line) => {
            const p = interpolate(t, [line.at, line.at + 0.5], [0, 1], { ...clamp, easing: easeOut });
            return (
              <div
                key={line.text}
                style={{
                  opacity: p,
                  translate: `0px ${interpolate(p, [0, 1], [18, 0])}px`,
                  fontSize: 46,
                  fontWeight: 700,
                  color: line.at > 5 ? colors.brand200 : colors.white,
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 90,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.mist,
            opacity: interpolate(t, [6.6, 7.2], [0, 0.8], clamp),
          }}
        >
          Built for NovaMart · HCLTech Hackathon
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 05 — Closing: montage, architecture, brand frame. */
export const ClosingScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence name="Montage" durationInFrames={6.2 * fps} premountFor={fps}>
        <Montage />
      </Sequence>
      <Sequence name="Architecture" from={5.9 * fps} durationInFrames={9.6 * fps} premountFor={fps}>
        <Architecture />
      </Sequence>
      <Sequence name="End frame" from={15.4 * fps} premountFor={fps}>
        <EndFrame />
      </Sequence>
      <Narration scene="closing" hideCaptions={["c02", "c03"]} />
    </>
  );
};
