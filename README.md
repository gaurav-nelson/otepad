# Otepad

A minimal free temporary note-taking app. Not your regular text editor.

## What people use it for

- **Scratch space that outlives a tab.** Paste a link, a code snippet, or a phone number you'll only need for a few days — it's still there when you come back, and gone for good when you delete it.
- **Drafting in Markdown.** Write a README, a comment, or a post in Markdown, flip between the rendered view and the raw source to check your syntax, then copy it out wherever it's headed.
- **Notes that stay on your machine.** Nothing leaves the browser — no account, no sync, no cloud. If you need to hand a note to someone, export it as a file; otherwise it stays private to your device.
- **Working offline.** After the first visit, Otepad loads on a plane, on train wifi, or with the router unplugged. Your notes are in the browser, so they don't need a network to exist.
- **A notepad that feels like yours.** Seven theme packs and light/dark modes, so it's comfortable to look at whether you use it twice a year or twenty times a day.
- **Decluttering when you're done.** Search what you've accumulated, delete a few pads or wipe the whole slate — temporary means temporary.

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
