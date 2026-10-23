import { MousePointerClick, ShieldCheck, Sparkles, TicketCheck } from "lucide-react";
import { Sequence, useVideoConfig } from "remotion";
import { Callouts } from "../components/Callouts";
import { Narration } from "../components/Narration";
import { PanelCard } from "../components/PanelCard";
import { Screen } from "../components/Screen";
import { shotBox } from "../footage";

/** 04 — AI-powered operations: confirmed support ticket, manager dashboard, stock update, audit trail. */
export const OperationsScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence name="Support ticket" durationInFrames={16.2 * fps} premountFor={fps}>
        <Sequence name="Proposal" durationInFrames={13.8 * fps} premountFor={fps}>
          <PanelCard
            shot="ai-support-proposal"
            fadeOut={false}
            scroll={[{ at: 0, y: 100 }]}
            highlights={[{ box: shotBox("ai-support-proposal", "confirm"), from: 7.2, dim: true }]}
          />
        </Sequence>
        <Sequence name="Confirmed" from={13.4 * fps} premountFor={fps}>
          <PanelCard
            shot="ai-support-confirmed"
            scroll={[{ at: 0, y: 100 }]}
            highlights={[{ box: { x: 17, y: 325, w: 397, h: 232 }, from: 0.5, dim: true }]}
          />
        </Sequence>
        <Callouts
          chapter="04 · AI-powered operations"
          title="AI proposes. People approve."
          items={[
            { icon: Sparkles, title: "AI drafts the action", detail: "Order checked, high-priority ticket prepared", from: 0.8 },
            { icon: ShieldCheck, title: "Backend enforces permissions", detail: "Identity from the session, ownership re-checked", from: 4 },
            { icon: MousePointerClick, title: "Nothing runs until you confirm", detail: "Executed once, on the customer's click", from: 7 },
            { icon: TicketCheck, title: "Ticket TKT-001001 created", from: 13.7, tone: "good" },
          ]}
        />
      </Sequence>
      <Sequence name="Manager dashboard" from={16 * fps} durationInFrames={4 * fps} premountFor={fps}>
        <Screen
          shot="ops-overview"
          camera={[{ at: 0 }, { at: 0.4 }, { at: 1.8, focus: { x: 278, y: 220, w: 640, h: 420 }, zoom: 1.4 }]}
          highlights={[{ box: { x: 278, y: 265, w: 639, h: 516 }, from: 1.9, label: "Low-stock alerts, most urgent first", dim: true }]}
        />
      </Sequence>
      <Sequence name="Stock update" from={19.8 * fps} durationInFrames={3.8 * fps} premountFor={fps}>
        <Screen
          shot="ai-stock-confirmed-screen"
          camera={[{ at: 0, focus: { x: 1000, y: 150, w: 440, h: 520 }, zoom: 1.3 }, { at: 1.4, focus: { x: 1000, y: 150, w: 440, h: 520 }, zoom: 1.6 }]}
          highlights={[{ box: { x: 1028, y: 281, w: 397, h: 160 }, from: 1, label: "Manager approved: 56 → 76", dim: true }]}
        />
      </Sequence>
      <Sequence name="Audit trail" from={23.4 * fps} premountFor={fps}>
        <Screen
          shot="ops-audit"
          fadeOut={false}
          camera={[{ at: 0 }, { at: 0.6 }, { at: 2, focus: { x: 280, y: 130, w: 1080, h: 440 }, zoom: 1.25 }]}
          highlights={[
            { box: { x: 282, y: 288, w: 1072, h: 266 }, from: 2.1, until: 4.6, label: "Every AI proposal and action, recorded", dim: true },
            { box: { x: 280, y: 126, w: 1076, h: 40 }, from: 4.8, label: "Append-only: edits and deletes are rejected", dim: true },
          ]}
        />
      </Sequence>
      <Narration scene="operations" />
    </>
  );
};
