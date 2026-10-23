import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Background } from "./components/Background";
import { ClosingScene } from "./scenes/ClosingScene";
import { OperationsScene } from "./scenes/OperationsScene";
import { ShoppingScene } from "./scenes/ShoppingScene";
import { TrustScene } from "./scenes/TrustScene";
import { VisionScene } from "./scenes/VisionScene";
import { clamp } from "./theme";

/** "Retail, Reimagined with AI": the full 2-minute explainer. */
export const RetailPulseVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background />
      <Sequence name="01 Vision" durationInFrames={420} premountFor={fps}>
        <VisionScene />
      </Sequence>
      <Sequence name="02 Shopping" from={420} durationInFrames={825} premountFor={fps}>
        <ShoppingScene />
      </Sequence>
      <Sequence name="03 Trust" from={1245} durationInFrames={720} premountFor={fps}>
        <TrustScene />
      </Sequence>
      <Sequence name="04 Operations" from={1965} durationInFrames={915} premountFor={fps}>
        <OperationsScene />
      </Sequence>
      <Sequence name="05 Closing" from={2880} durationInFrames={720} premountFor={fps}>
        <ClosingScene />
      </Sequence>
      <Audio
        name="Music bed"
        src={staticFile("audio/music.wav")}
        // Sits low under the voice, and comes up where the picture carries the story alone.
        volume={(f) =>
          interpolate(f, [0, 300, 330, 400, 430, 2870, 2895, 3045, 3070, 3320, 3350], [0.3, 0.3, 0.45, 0.45, 0.2, 0.2, 0.5, 0.5, 0.24, 0.24, 0.38], clamp)
        }
      />
    </AbsoluteFill>
  );
};
