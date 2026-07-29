import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/**
 * Otepad visual theme: quiet neutrals + expressive Fraunces display type
 * and IBM Plex Mono for the editor. Accent matches the logo teal / mint.
 * Fonts are loaded separately via Fontsource.
 */
export const otepadTheme = defineTheme({
  name: "otepad",
  extends: neutralTheme,
  color: {
    // Logo notepad body (#286860); scale derives muted / on-accent variants.
    accent: "#286860",
    neutralStyle: "cool",
  },
  typography: {
    // Closer to the previous 16px-rooted UI; slightly airy ratio for display.
    scale: { base: 16, ratio: 1.25 },
    body: {
      family: "Fraunces",
      fallbacks:
        '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
      weight: "normal",
    },
    heading: {
      family: "Fraunces",
      fallbacks:
        '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
      weight: "medium",
      weights: { 1: "medium", 2: "medium", 3: "medium" },
    },
    code: {
      family: "IBM Plex Mono",
      fallbacks:
        '"Lucida Console", monaco, "Bitstream Vera Sans Mono", monospace',
      weight: "normal",
    },
  },
  tokens: {
    // Dark mode: brighter mint from the logo lines so the CTA stays vivid.
    "--color-accent": ["#286860", "#68e0c8"],
    "--color-on-accent": ["#ffffff", "#0a1f1c"],
    "--color-accent-muted": ["#e6f5f2", "#1a3330"],
    "--color-text-accent": ["#286860", "#90f8e8"],
    "--color-icon-accent": ["#286860", "#90f8e8"],
  },
});
