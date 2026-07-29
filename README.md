# Otepad

A minimal free temporary note-taking app. Not your regular text editor.

- Multiple pads, saved locally in your browser. Keep them until you want them gone.
- Works offline as a PWA after the first visit.
- Switch light/dark mode and pick from several visual themes.
- Search pads, multi-select delete, or clear everything.
- No accounts, no sync, no cloud. Copy-paste or type directly.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

`npm run build` regenerates the custom theme CSS, typechecks, then produces the production bundle (including a service worker via `vite-plugin-pwa`).

To rebuild only the Otepad theme stylesheet after editing `src/theme/otepadTheme.ts`:

```bash
npm run theme:build
```

## Changelog

### v1.1.0

- Rebuilt the app with Vite, React, and TypeScript (replacing the previous static HTML/UIKit setup).
- Redesigned the UI with the Astryx design system.
- Added a pad surface: create multiple pads, search, open via URL hash, and delete selected or all pads.
- Added a theme picker with Otepad, Neutral, Stone, Gothic, Matcha, Y2K, and Butter packs (plus light/dark where supported).
- Improved offline support with `vite-plugin-pwa`.

### Earlier

Prior releases shipped the original single-page notepad (local save, light/dark theme, PWA shell, privacy/terms). See git history for details.
