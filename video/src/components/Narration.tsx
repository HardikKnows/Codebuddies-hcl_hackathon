import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import narration from "../narration.json";
import durations from "../voice-durations.json";
import { clamp, colors, fontFamily, SceneId } from "../theme";

type Line = { id: string; scene: string; start: number; text: string };

const durationOf = (id: string) => (durations as Record<string, number>)[id];

/** Splits a line into caption chunks of a few words, preferring breaks after punctuation. */
const chunk = (text: string) => {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const atPause = /[,.:;]$/.test(word);
    if ((atPause && current.length >= 4) || current.length >= 10) {
      chunks.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
};

/** A line's caption chunks, each shown for a share of the clip proportional to its length. */
const LineCaption: React.FC<{ line: Line }> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const spoken = durationOf(line.id) - 0.35;
  const chunks = chunk(line.text);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let cursor = 0.1;
  let text = chunks[chunks.length - 1];
  for (const c of chunks) {
    const length = (c.length / total) * spoken;
    if (t < cursor + length) {
      text = c;
      break;
    }
    cursor += length;
  }
  const opacity = interpolate(frame, [0, 5], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46, opacity }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "14px 30px",
          borderRadius: 16,
          background: "rgba(6, 10, 28, 0.80)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: colors.white,
          fontFamily,
          fontSize: 38,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Voiceover clips and synced captions for one scene, timed from src/narration.json.
 * `hideCaptions` lists lines whose words are already on screen as titles. */
export const Narration: React.FC<{ scene: SceneId; hideCaptions?: string[] }> = ({ scene, hideCaptions = [] }) => {
  const { fps } = useVideoConfig();
  const lines = (narration.lines as Line[]).filter((l) => l.scene === scene);
  return (
    <>
      {lines.map((line) => (
        <Sequence
          key={line.id}
          name={`Voice ${line.id}`}
          from={Math.round(line.start * fps)}
          durationInFrames={Math.ceil(durationOf(line.id) * fps)}
          premountFor={fps}
        >
          <Audio src={staticFile(`voice/${line.id}.wav`)} />
          {!hideCaptions.includes(line.id) && <LineCaption line={line} />}
        </Sequence>
      ))}
    </>
  );
};
