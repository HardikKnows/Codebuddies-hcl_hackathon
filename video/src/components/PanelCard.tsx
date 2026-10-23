import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { conversationBottom, shot, ShotName } from "../footage";
import { clamp, easeInOut, easeOut } from "../theme";
import { Highlight, Ring } from "./Screen";

export type ScrollKey = { at: number; y: number };

const WIDTH = 700;
const MAX_HEIGHT = 880;

/** The assistant panel from a real conversation, cropped to its content, as a floating card. */
export const PanelCard: React.FC<{
  shot: ShotName;
  scroll?: ScrollKey[];
  highlights?: Highlight[];
  fadeIn?: boolean;
  fadeOut?: boolean;
}> = ({ shot: name, scroll = [{ at: 0, y: 0 }], highlights = [], fadeIn = true, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const footage = shot(name);
  const scale = WIDTH / footage.width;
  const height = Math.min((conversationBottom(name) + 24) * scale, MAX_HEIGHT);

  let y = scroll[0].y;
  for (let i = 0; i < scroll.length - 1; i++) {
    const a = scroll[i];
    const b = scroll[i + 1];
    if (t >= a.at) y = a.y + (b.y - a.y) * easeInOut(Math.min(1, (t - a.at) / (b.at - a.at)));
  }
  const offset = -y * scale;

  const opacity =
    (fadeIn ? interpolate(frame, [0, 14], [0, 1], clamp) : 1) *
    (fadeOut ? interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp) : 1);
  const slide = fadeIn ? interpolate(frame, [0, 22], [60, 0], { ...clamp, easing: easeOut }) : 0;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          right: 150,
          top: 70,
          width: WIDTH,
          height,
          translate: `${slide}px 0px`,
          borderRadius: 26,
          overflow: "hidden",
          background: "#f8f9fc",
          boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12), 0 0 80px rgba(100,87,216,0.25)",
        }}
      >
        <Img
          src={footage.src}
          style={{ position: "absolute", left: 0, top: offset, width: WIDTH, height: footage.height * scale }}
        />
        {highlights.map((h, i) => (
          <Ring
            key={i}
            highlight={h}
            t={t}
            fps={fps}
            place={(b) => ({ left: b.x * scale, top: offset + b.y * scale, width: b.w * scale, height: b.h * scale })}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
