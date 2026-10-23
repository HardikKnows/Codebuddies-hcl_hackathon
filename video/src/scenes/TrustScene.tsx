import { BookMarked, FileCheck2, LifeBuoy, ListFilter, SearchX } from "lucide-react";
import { Sequence, useVideoConfig } from "remotion";
import { Callouts } from "../components/Callouts";
import { Narration } from "../components/Narration";
import { PanelCard } from "../components/PanelCard";
import { shotBox } from "../footage";

/** 03 — Trustworthy AI: a cited policy answer, then the "can't verify" safeguard. */
export const TrustScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence name="Cited answer" durationInFrames={15 * fps} premountFor={fps}>
        <PanelCard
          shot="ai-policy"
          highlights={[
            { box: { x: 268, y: 221, w: 135, h: 27 }, from: 1.2, until: 3.5 },
            { box: shotBox("ai-policy", "sources"), from: 3.8, dim: true },
          ]}
        />
        <Callouts
          chapter="03 · Trustworthy AI"
          title="Answers you can trace"
          items={[
            { icon: FileCheck2, title: "Grounded in approved policies", detail: "Retrieved from NovaMart's policy documents", from: 0.6 },
            { icon: BookMarked, title: "Cited to section and version", detail: "Online Return Policy › Opened Electronics · v2026.2", from: 3.7 },
            { icon: ListFilter, title: "Only the rules that apply", detail: "Filtered by country, membership tier and effective date", from: 8.8 },
          ]}
        />
      </Sequence>
      <Sequence name="Can't verify" from={14.6 * fps} premountFor={fps}>
        <PanelCard
          shot="ai-fallback"
          fadeOut={false}
          highlights={[
            { box: { x: 17, y: 195, w: 396, h: 39 }, from: 1, until: 3.6 },
            { box: { x: 17, y: 323, w: 396, h: 50 }, from: 3.9, dim: true },
          ]}
        />
        <Callouts
          fadeOut={false}
          chapter="03 · Trustworthy AI"
          title="No evidence? No guessing."
          items={[
            { icon: SearchX, title: "Not in approved policies", detail: "Weak evidence never reaches the model", from: 0.9, tone: "warning" },
            { icon: LifeBuoy, title: "A clear next step", detail: "Offers a ticket so a specialist can confirm", from: 3.8 },
          ]}
        />
      </Sequence>
      <Narration scene="trust" />
    </>
  );
};
