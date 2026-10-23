import { Database, ListFilter, PackageCheck } from "lucide-react";
import { Sequence, useVideoConfig } from "remotion";
import { Callouts } from "../components/Callouts";
import { Narration } from "../components/Narration";
import { PanelCard } from "../components/PanelCard";
import { Screen } from "../components/Screen";
import { shotBox } from "../footage";

/** 02 — Intelligent shopping: storefront, store-aware stock, and a real recommendation. */
export const ShoppingScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence name="Storefront" durationInFrames={4.8 * fps} premountFor={fps}>
        <Screen
          shot="shop-catalog"
          fadeIn={false}
          camera={[{ at: 0 }, { at: 1.6 }, { at: 3.4, focus: shotBox("shop-catalog", "store"), zoom: 1.9 }]}
          highlights={[{ box: shotBox("shop-catalog", "store"), from: 3.3, label: "Shopping at your store" }]}
        />
      </Sequence>
      <Sequence name="Availability" from={4.4 * fps} durationInFrames={6 * fps} premountFor={fps}>
        <Screen
          shot="shop-availability"
          camera={[
            { at: 0, focus: shotBox("shop-availability", "availability"), zoom: 1.15 },
            { at: 1.6, focus: shotBox("shop-availability", "availability"), zoom: 1.5 },
          ]}
          highlights={[{ box: shotBox("shop-availability", "availability"), from: 1.8, label: "Live stock, store by store", dim: true }]}
        />
      </Sequence>
      <Sequence name="Ask the assistant" from={10 * fps} durationInFrames={6.2 * fps} premountFor={fps}>
        <Screen
          shot="ai-reco-asking"
          camera={[{ at: 0 }, { at: 0.5 }, { at: 1.9, focus: { x: 1020, y: 100, w: 410, h: 120 }, zoom: 1.9 }]}
          highlights={[{ box: shotBox("ai-reco-asking", "request"), from: 2, label: "A plain-language request", dim: true }]}
        />
      </Sequence>
      <Sequence name="Recommendations" from={15.8 * fps} premountFor={fps}>
        <PanelCard
          shot="ai-reco"
          fadeOut={false}
          scroll={[
            { at: 0, y: 160 },
            { at: 3.8, y: 160 },
            { at: 5, y: 470 },
          ]}
          highlights={[
            { box: shotBox("ai-reco", "interpreted"), from: 0.7, until: 3.7 },
            { box: { x: 18, y: 491, w: 396, h: 211 }, from: 4.6, until: 6.7 },
            { box: { x: 100, y: 536, w: 240, h: 34 }, from: 6.9, dim: true },
          ]}
        />
        <Callouts
          fadeOut={false}
          chapter="02 · Intelligent shopping"
          title="Recommendations grounded in real data"
          items={[
            { icon: ListFilter, title: "Words become filters", detail: "Category, budget, keywords, in stock today", from: 0.6 },
            { icon: PackageCheck, title: "Only real catalog products", detail: "Ranked from SQL candidates, never invented", from: 3.9 },
            { icon: Database, title: "Live prices and stock", detail: "Attached from PostgreSQL for your store", from: 6.8 },
          ]}
        />
      </Sequence>
      <Narration scene="shopping" />
    </>
  );
};
