import { staticFile } from "remotion";
import manifest from "../public/footage/manifest.json";

// Screenshots of the running app, captured by scripts/capture.mjs. Boxes are in CSS pixels of the
// captured page (1440×810 for full screens) or of the assistant panel (430 wide) for panel shots.
export type Box = { x: number; y: number; w: number; h: number };

type Shot = { width: number; height: number; boxes: Record<string, Box | null> };

export type ShotName = keyof typeof manifest;

export const shot = (name: ShotName) => {
  const entry = manifest[name] as Shot;
  return { src: staticFile(`footage/${name}.png`), ...entry };
};

export const shotBox = (name: ShotName, key: string): Box => {
  const found = (manifest[name] as Shot).boxes[key];
  if (!found) throw new Error(`No box "${key}" in footage ${name}`);
  return found;
};

/** Where an assistant panel's conversation ends, so the empty space below it can be cropped. */
export const conversationBottom = (name: ShotName) => {
  const b = shotBox(name, "conversation");
  return b.y + b.h;
};
