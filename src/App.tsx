import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmState } from "./components/ConfirmDialog";
import { EditorView } from "./components/EditorView";
import { SurfaceView } from "./components/SurfaceView";
import { getAppTheme } from "./theme/catalog";
import {
  createPad,
  debounce,
  isTitleTaken,
  loadStore,
  nextUntitledTitle,
  normalizeTitle,
  padIdFromHash,
  persistStore,
  persistTheme,
  persistThemeId,
  readInitialTheme,
  readInitialThemeId,
  resolveColorMode,
  setHashForPad,
  setHashSurface,
  sortedPads,
  storageAvailable,
  type AppThemeId,
  type Pad,
  type PadStore,
  type ThemeMode,
} from "./lib/pads";

const canStore = storageAvailable("localStorage");
const initialStore = loadStore(canStore);

function initialActivePadId(pads: PadStore["pads"]): string | null {
  const fromHash = padIdFromHash();
  if (fromHash && pads.some((pad) => pad.id === fromHash)) {
    return fromHash;
  }
  return null;
}

export function App() {
  const [themeId, setThemeId] = useState<AppThemeId>(() =>
    readInitialThemeId(canStore),
  );
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme(canStore));
  const [store, setStore] = useState<PadStore>(initialStore);
  const [activePadId, setActivePadId] = useState<string | null>(() =>
    initialActivePadId(initialStore.pads),
  );
  const [selectedPadIds, setSelectedPadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const confirmActionRef = useRef<(() => void) | null>(null);

  const activePad = useMemo(() => {
    if (!activePadId) return null;
    return store.pads.find((pad) => pad.id === activePadId) ?? null;
  }, [activePadId, store.pads]);

  const appTheme = getAppTheme(themeId);
  const colorMode = resolveColorMode(themeId, theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorMode);
    document.documentElement.style.colorScheme = colorMode;
  }, [colorMode]);

  useEffect(() => {
    if (activePadId) {
      if (!store.pads.some((pad) => pad.id === activePadId)) {
        setActivePadId(null);
        setHashSurface();
        return;
      }
      setHashForPad(activePadId);
      return;
    }
    setHashSurface();
  }, [activePadId, store.pads]);

  useEffect(() => {
    const onHashChange = () => {
      const id = padIdFromHash();
      if (id && store.pads.some((pad) => pad.id === id)) {
        setSelectedPadIds(new Set());
        setActivePadId(id);
        return;
      }
      setActivePadId(null);
      if (id) setHashSurface();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [store.pads]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        !activePadId &&
        selectedPadIds.size > 0 &&
        e.key === "Escape" &&
        !(e.target as HTMLElement | null)?.closest?.(
          "input, textarea, [contenteditable]",
        )
      ) {
        e.preventDefault();
        setSelectedPadIds(new Set());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePadId, selectedPadIds.size]);

  const commitStore = useCallback((next: PadStore) => {
    setStore(next);
    persistStore(next, canStore);
  }, []);

  const updatePads = useCallback((updater: (pads: Pad[]) => Pad[]) => {
    setStore((prev) => {
      const next = { version: 1 as const, pads: updater(prev.pads) };
      persistStore(next, canStore);
      return next;
    });
  }, []);

  const persistContent = useMemo(
    () =>
      debounce((padId: string, html: string) => {
        updatePads((pads) =>
          pads.map((pad) =>
            pad.id === padId
              ? { ...pad, content: html, updatedAt: Date.now() }
              : pad,
          ),
        );
      }, 300),
    [updatePads],
  );

  function openConfirm(state: ConfirmState, action: () => void): void {
    confirmActionRef.current = action;
    setConfirm(state);
  }

  function toggleTheme() {
    if (appTheme.darkOnly) return;
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      persistTheme(next, canStore);
      return next;
    });
  }

  function handleThemeIdChange(nextId: AppThemeId) {
    setThemeId(nextId);
    persistThemeId(nextId, canStore);
    if (getAppTheme(nextId).darkOnly) {
      setTheme("dark");
      persistTheme("dark", canStore);
    }
  }

  function handleAddPad() {
    updatePads((pads) => [...pads, createPad(nextUntitledTitle(pads), "")]);
  }

  function handleOpenPad(id: string) {
    setSelectedPadIds(new Set());
    setActivePadId(id);
  }

  function handleBack() {
    setActivePadId(null);
  }

  function handleToggleSelect(id: string, selected: boolean) {
    setSelectedPadIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleContentChange(html: string) {
    if (!activePad) return;
    persistContent(activePad.id, html);
  }

  function handleTitleChange(rawTitle: string): boolean {
    if (!activePad) return false;
    const nextTitle = normalizeTitle(rawTitle);
    if (!nextTitle) return false;

    if (nextTitle.toLowerCase() === activePad.title.toLowerCase()) {
      if (nextTitle !== activePad.title) {
        updatePads((pads) =>
          pads.map((pad) =>
            pad.id === activePad.id
              ? { ...pad, title: nextTitle, updatedAt: Date.now() }
              : pad,
          ),
        );
      }
      return true;
    }

    if (isTitleTaken(store.pads, nextTitle, activePad.id)) {
      return false;
    }

    updatePads((pads) =>
      pads.map((pad) =>
        pad.id === activePad.id
          ? { ...pad, title: nextTitle, updatedAt: Date.now() }
          : pad,
      ),
    );
    return true;
  }

  function handleDeleteActivePad() {
    if (!activePad) return;
    const pad = activePad;
    openConfirm(
      {
        title: "Delete pad?",
        description: `Delete "${pad.title}"? This cannot be undone.`,
        actionLabel: "Delete",
      },
      () => {
        updatePads((pads) => {
          const remaining = pads.filter((item) => item.id !== pad.id);
          return remaining.length === 0
            ? [createPad("sample", "")]
            : remaining;
        });
        setConfirm(null);
        setActivePadId(null);
      },
    );
  }

  function handleDeleteSurfacePads() {
    const selectedIds = Array.from(selectedPadIds).filter((id) =>
      store.pads.some((pad) => pad.id === id),
    );

    if (selectedIds.length > 0) {
      const count = selectedIds.length;
      const label = count === 1 ? "1 pad" : `${count} pads`;
      openConfirm(
        {
          title: "Delete selected pads?",
          description: `Delete ${label}? This cannot be undone.`,
          actionLabel: "Delete",
        },
        () => {
          const selected = new Set(selectedIds);
          updatePads((pads) => {
            const remaining = pads.filter((pad) => !selected.has(pad.id));
            return remaining.length === 0
              ? [createPad("sample", "")]
              : remaining;
          });
          setSelectedPadIds(new Set());
          setConfirm(null);
        },
      );
      return;
    }

    const count = store.pads.length;
    if (count === 0) return;
    const label = count === 1 ? "1 pad" : `${count} pads`;
    openConfirm(
      {
        title: "Delete all pads?",
        description: `Delete ${label}? This cannot be undone.`,
        actionLabel: "Delete",
      },
      () => {
        commitStore({ version: 1, pads: [createPad("sample", "")] });
        setSelectedPadIds(new Set());
        setConfirm(null);
        setActivePadId(null);
      },
    );
  }

  return (
    <Theme theme={appTheme.theme} mode={colorMode}>
      <VStack className="otepad-shell" gap={0} minHeight="100%">
        {activePad ? (
          <EditorView
            pad={activePad}
            theme={colorMode}
            themeId={themeId}
            showModeToggle={!appTheme.darkOnly}
            onToggleTheme={toggleTheme}
            onThemeIdChange={handleThemeIdChange}
            onBack={handleBack}
            onDelete={handleDeleteActivePad}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
          />
        ) : (
          <SurfaceView
            pads={sortedPads(store.pads)}
            selectedPadIds={selectedPadIds}
            theme={colorMode}
            themeId={themeId}
            showModeToggle={!appTheme.darkOnly}
            onToggleTheme={toggleTheme}
            onThemeIdChange={handleThemeIdChange}
            onOpenPad={handleOpenPad}
            onToggleSelect={handleToggleSelect}
            onAddPad={handleAddPad}
            onDeletePads={handleDeleteSurfacePads}
          />
        )}
        <ConfirmDialog
          confirm={confirm}
          onCancel={() => {
            confirmActionRef.current = null;
            setConfirm(null);
          }}
          onConfirm={() => {
            const action = confirmActionRef.current;
            confirmActionRef.current = null;
            action?.();
          }}
        />
      </VStack>
    </Theme>
  );
}
