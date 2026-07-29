import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

import "@astryxdesign/theme-neutral/theme.css";
import "@astryxdesign/theme-stone/theme.css";
import "@astryxdesign/theme-gothic/theme.css";
import "@astryxdesign/theme-matcha/theme.css";
import "@astryxdesign/theme-y2k/theme.css";
import "@astryxdesign/theme-butter/theme.css";
import "./theme/otepad.css";

import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/playwrite-us-trad/400.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/fustat/400.css";
import "@fontsource/fustat/500.css";
import "@fontsource/fustat/600.css";
import "@fontsource/manufacturing-consent/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
