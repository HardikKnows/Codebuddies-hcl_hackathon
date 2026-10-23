import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors } from "../theme";

/** Deep navy stage with slowly drifting violet light and a faint dot grid. */
export const Background: React.FC<{ offset?: number }> = ({ offset = 0 }) => {
  const frame = useCurrentFrame() + offset;
  const drift = (period: number, range: number) =>
    Math.sin((frame / period) * Math.PI * 2) * range;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 90% at 50% 0%, ${colors.navy} 0%, ${colors.night} 70%)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          left: -380 + drift(900, 120),
          top: -620 + drift(1300, 80),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.brand600}66 0%, transparent 65%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -420 + drift(1100, 140),
          bottom: -560 + drift(800, 90),
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.violet}55 0%, transparent 65%)`,
          filter: "blur(50px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${colors.brand300}22 1.5px, transparent 1.5px)`,
          backgroundSize: "36px 36px",
          backgroundPosition: `${interpolate(frame, [0, 3600], [0, -144])}px 0px`,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black 20%, transparent 80%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
