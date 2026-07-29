# AGENTS.md

Project-specific guidance for AI coding agents working on **Otepad** — a minimal temporary note-taking PWA. Notes live in `localStorage` only; keep the product simple (list + editor, light/dark + theme packs, offline).

## Stack

- Vite + React + TypeScript
- UI: `@astryxdesign/core` (follow the Astryx section below)
- PWA: `vite-plugin-pwa` (service worker registered in `src/main.tsx`)
- Themes: custom `otepad` theme plus Neutral, Stone, Gothic, Matcha, Y2K, Butter

## Commands

```bash
npm run dev          # Vite dev server
npm run theme:build  # Build src/theme/otepad.css from otepadTheme.ts
npm run build        # theme:build + tsc + vite build
npm run preview      # Preview production build
```

After editing `src/theme/otepadTheme.ts`, run `npm run theme:build` (or full `npm run build`) so `otepad.css` stays in sync.

## Layout

| Path | Role |
|------|------|
| `src/App.tsx` | Root state: pads, active pad, theme id/mode, routing via hash |
| `src/components/SurfaceView.tsx` | Pad list / multi-select / create |
| `src/components/EditorView.tsx` | Single-pad editor |
| `src/components/ThemePicker.tsx` / `ThemeToggle.tsx` | Theme pack + light/dark |
| `src/components/ConfirmDialog.tsx` | Destructive confirms |
| `src/lib/pads.ts` | Pad CRUD, storage keys, hash helpers, theme persistence |
| `src/theme/catalog.ts` | Theme registry (`THEME_IDS`, labels, `darkOnly`) |
| `src/theme/otepadTheme.ts` | Custom Astryx theme source → `otepad.css` |
| `src/main.tsx` | CSS imports (Astryx reset + theme packs + fonts) + SW |

## Conventions

- Prefer Astryx layout/primitives over raw `<div>` / custom CSS (see Astryx rules below). App-level CSS is limited to `src/app.css` and generated theme CSS.
- Pad data: `localStorage` key `otepad.pads` (versioned store). Theme mode: `theme`; theme pack: `otepad.themeId`. Preserve migration from legacy `content` key in `pads.ts`.
- Hash routing: surface (`#` / empty) vs pad (`#pad/<id>`). Keep hash ↔ active pad in sync.
- Gothic is dark-only — respect `darkOnly` in the theme catalog when switching packs.
- Do not add accounts, sync, or server APIs unless explicitly requested. Stay offline-first.
- Discover UI with `npx astryx …` before inventing components or styles.

<!-- ASTRYX:START -->
Astryx v0.1.9 · 153 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   153 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
