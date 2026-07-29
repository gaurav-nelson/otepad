import {
  getAppTheme,
  isAppThemeId,
  type AppThemeId,
} from "../theme/catalog";

export const STORAGE_KEY = "otepad.pads";
export const LEGACY_CONTENT_KEY = "content";
export const THEME_KEY = "theme";
export const THEME_ID_KEY = "otepad.themeId";
export const TITLE_MAX_LENGTH = 60;

export type ThemeMode = "light" | "dark";
export type { AppThemeId };

export type Pad = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

export type PadStore = {
  version: 1;
  pads: Pad[];
};

export function storageAvailable(type: "localStorage"): boolean {
  try {
    const storage = window[type];
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
      !!window.localStorage &&
      window.localStorage.length !== 0
    );
  }
}

export function generateId(): string {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `pad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPad(title: string, content = ""): Pad {
  return {
    id: generateId(),
    title,
    content,
    updatedAt: Date.now(),
  };
}

export function nextUntitledTitle(pads: Pad[]): string {
  const titles = new Set(pads.map((pad) => String(pad.title).toLowerCase()));
  let n = 1;
  while (titles.has(`untitled${n}`)) {
    n += 1;
  }
  return `untitled${n}`;
}

export function normalizeTitle(value: string): string {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX_LENGTH);
}

export function isTitleTaken(
  pads: Pad[],
  title: string,
  excludeId?: string | null,
): boolean {
  const needle = title.toLowerCase();
  return pads.some(
    (pad) =>
      pad.id !== excludeId && String(pad.title).toLowerCase() === needle,
  );
}

export function previewText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const text = (tmp.textContent || tmp.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Empty";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

export function plainTextFromHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

export function padMatchesQuery(pad: Pad, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (String(pad.title).toLowerCase().includes(needle)) return true;
  return plainTextFromHtml(pad.content).toLowerCase().includes(needle);
}

export function filterPads(pads: Pad[], query: string): Pad[] {
  const needle = query.trim();
  if (!needle) return pads;
  return pads.filter((pad) => padMatchesQuery(pad, needle));
}

export function sortedPads(pads: Pad[]): Pad[] {
  return pads.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadStore(canStore: boolean): PadStore {
  if (!canStore) {
    return { version: 1, pads: [createPad("sample", "")] };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { pads?: Pad[] };
      if (parsed && Array.isArray(parsed.pads)) {
        if (parsed.pads.length === 0) {
          parsed.pads.push(createPad("sample", ""));
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, pads: parsed.pads }),
          );
        }
        return { version: 1, pads: parsed.pads };
      }
    } catch {
      // Fall through to migration / seed
    }
  }

  const legacy = localStorage.getItem(LEGACY_CONTENT_KEY);
  const migrated: PadStore = {
    version: 1,
    pads: [createPad("sample", legacy || "")],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  if (legacy !== null) {
    localStorage.removeItem(LEGACY_CONTENT_KEY);
  }
  return migrated;
}

export function persistStore(store: PadStore, canStore: boolean): void {
  if (!canStore) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readInitialTheme(canStore: boolean): ThemeMode {
  if (!canStore) return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function persistTheme(theme: ThemeMode, canStore: boolean): void {
  if (!canStore) return;
  localStorage.setItem(THEME_KEY, theme);
}

export function readInitialThemeId(canStore: boolean): AppThemeId {
  if (!canStore) return "otepad";
  const stored = localStorage.getItem(THEME_ID_KEY);
  if (isAppThemeId(stored)) return stored;
  return "otepad";
}

export function persistThemeId(themeId: AppThemeId, canStore: boolean): void {
  if (!canStore) return;
  localStorage.setItem(THEME_ID_KEY, themeId);
}

export function resolveColorMode(
  themeId: AppThemeId,
  preferred: ThemeMode,
): ThemeMode {
  return getAppTheme(themeId).darkOnly ? "dark" : preferred;
}

export function padIdFromHash(hash = location.hash): string | null {
  const match = hash.match(/^#\/pad\/(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function setHashForPad(id: string): void {
  const next = `#/pad/${encodeURIComponent(id)}`;
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

export function setHashSurface(): void {
  if (location.hash && location.hash !== "#/" && location.hash !== "#") {
    history.replaceState(null, "", "#/");
  } else if (!location.hash) {
    history.replaceState(null, "", "#/");
  }
}

export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export function setEndOfContenteditable(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
