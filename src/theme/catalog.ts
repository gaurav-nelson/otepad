import type { DefinedTheme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";
import { gothicTheme } from "@astryxdesign/theme-gothic/built";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { stoneTheme } from "@astryxdesign/theme-stone/built";
import { y2kTheme } from "@astryxdesign/theme-y2k/built";
import { otepadTheme } from "./otepad";

export const THEME_IDS = [
  "otepad",
  "neutral",
  "stone",
  "gothic",
  "matcha",
  "y2k",
  "butter",
] as const;

export type AppThemeId = (typeof THEME_IDS)[number];

export type AppThemeOption = {
  id: AppThemeId;
  label: string;
  description: string;
  theme: DefinedTheme;
  /** Gothic (and similar) only expose a dark palette. */
  darkOnly?: boolean;
};

export const APP_THEMES: AppThemeOption[] = [
  {
    id: "otepad",
    label: "Otepad",
    description: "Default teal accent; Fraunces + IBM Plex Mono.",
    theme: otepadTheme,
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Quiet warm grays; Figtree.",
    theme: neutralTheme,
  },
  {
    id: "stone",
    label: "Stone",
    description: "Warm stone & slate; Montserrat + Figtree.",
    theme: stoneTheme,
  },
  {
    id: "gothic",
    label: "Gothic",
    description: "Dark-only; Fustat + display serif.",
    theme: gothicTheme,
    darkOnly: true,
  },
  {
    id: "matcha",
    label: "Matcha",
    description: "Earthy greens; DM Sans + Playwrite.",
    theme: matchaTheme,
  },
  {
    id: "y2k",
    label: "Y2K",
    description: "Playful pop; Poppins.",
    theme: y2kTheme,
  },
  {
    id: "butter",
    label: "Butter",
    description: "Golden surfaces; Outfit.",
    theme: butterTheme,
  },
];

const byId = Object.fromEntries(
  APP_THEMES.map((option) => [option.id, option]),
) as Record<AppThemeId, AppThemeOption>;

export function isAppThemeId(value: string | null | undefined): value is AppThemeId {
  return THEME_IDS.includes(value as AppThemeId);
}

export function getAppTheme(id: AppThemeId): AppThemeOption {
  return byId[id];
}
