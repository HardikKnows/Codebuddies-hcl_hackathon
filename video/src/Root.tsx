import { AbsoluteFill, Composition, Folder } from "remotion";
import { Background } from "./components/Background";
import { RetailPulseVideo } from "./RetailPulseVideo";
import { ClosingScene } from "./scenes/ClosingScene";
import { OperationsScene } from "./scenes/OperationsScene";
import { ShoppingScene } from "./scenes/ShoppingScene";
import { TrustScene } from "./scenes/TrustScene";
import { VisionScene } from "./scenes/VisionScene";

// Scenes render on a transparent stage inside the main video; on their own they get the background.
const standalone = (Scene: React.FC): React.FC => {
  const Standalone: React.FC = () => (
    <AbsoluteFill>
      <Background />
      <Scene />
    </AbsoluteFill>
  );
  return Standalone;
};

const Vision = standalone(VisionScene);
const Shopping = standalone(ShoppingScene);
const Trust = standalone(TrustScene);
const Operations = standalone(OperationsScene);
const Closing = standalone(ClosingScene);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RetailPulseAI"
        component={RetailPulseVideo}
        durationInFrames={3600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition id="Vision" component={Vision} durationInFrames={420} fps={30} width={1920} height={1080} />
        <Composition id="Shopping" component={Shopping} durationInFrames={825} fps={30} width={1920} height={1080} />
        <Composition id="Trust" component={Trust} durationInFrames={720} fps={30} width={1920} height={1080} />
        <Composition id="Operations" component={Operations} durationInFrames={915} fps={30} width={1920} height={1080} />
        <Composition id="Closing" component={Closing} durationInFrames={720} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
};
