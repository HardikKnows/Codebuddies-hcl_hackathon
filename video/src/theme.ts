import { loadFont } from "@remotion/google-fonts/Inter";
import { Easing } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// The app's violet brand (frontend/src/index.css) on a deep navy stage.
export const colors = {
  night: "#060a1c",
  navy: "#0b1130",
  brand950: "#1e1748",
  brand900: "#30266f",
  brand700: "#4337b0",
  brand600: "#5145cd",
  brand500: "#6457d8",
  brand400: "#8479e2",
  brand300: "#aca5ee",
  brand200: "#cfcbf6",
  violet: "#7c3aed",
  white: "#ffffff",
  mist: "rgba(226, 232, 255, 0.72)",
  good: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

export const brandGradient = `linear-gradient(135deg, ${colors.brand500} 0%, ${colors.violet} 100%)`;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const FPS = 30;

// Scene lengths in seconds; they add up to the 2:00 runtime.
export const SCENES = {
  vision: 14,
  shopping: 27.5,
  trust: 24,
  operations: 30.5,
  closing: 24,
} as const;

export type SceneId = keyof typeof SCENES;
