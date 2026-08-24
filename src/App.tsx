import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmState } from "./components/ConfirmDialog";
import { EditorView } from "./components/EditorView";
import { SurfaceView } from "./components/SurfaceView";
import { getAppTheme } from "./theme/catalog";
import {
  buildOtpBlob,
  downloadBlob,
  importNotesFromFiles,
  otpFileName,
  uniqueTitle,
} from "./lib/transfer";
import {
  createPad,
  debounce,
  generateId,
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

export type TransferNotice = {
  status: "error" | "warning" | "success" | "info";
  title: string;
  description: string;
  details?: string[];
} | null;

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
  const [notice, setNotice] = useState<TransferNotice>(null);
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

  useEffect(() => {
    if (!notice || notice.status !== "success") return;
    const t = setTimeout(() => {
      setNotice(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const commitStore = useCallback((next: PadStore) => {
    setStore(next);
    persistStore(next, canStore);
  }, []);

  const updatePads = useCallback((updater: (pads: Pad[]) => Pad[]) => {
    setStore((prev) => {
      const nextPads = updater(prev.pads);
      const next = { version: 1 as const, pads: nextPads };
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

  function handleExportSurfacePads() {
    const selectedIds = Array.from(selectedPadIds).filter((id) =>
      store.pads.some((pad) => pad.id === id),
    );
    const targetPads =
      selectedIds.length > 0
        ? store.pads.filter((pad) => selectedPadIds.has(pad.id))
        : sortedPads(store.pads);

    if (targetPads.length === 0) {
      setNotice({
        status: "info",
        title: "No pads to export",
        description: "Create or import some pads first before exporting.",
      });
      return;
    }

    try {
      const blob = buildOtpBlob(targetPads);
      const filename = otpFileName();
      downloadBlob(blob, filename);
      const count = targetPads.length;
      setNotice({
        status: "success",
        title: "Export complete",
        description: `Saved ${count} ${count === 1 ? "pad" : "pads"} to ${filename}.`,
      });
    } catch (err) {
      setNotice({
        status: "error",
        title: "Export failed",
        description:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while creating the export archive. Please try again.",
      });
    }
  }

  async function handleImportSurfaceFiles(files: FileList | File[]) {
    try {
      const result = await importNotesFromFiles(files);

      if (result.errors.length > 0 && result.notes.length === 0) {
        setNotice({
          status: "error",
          title:
            result.errors.length === 1
              ? "Import failed"
              : `Failed to import ${result.errors.length} files`,
          description: result.errors[0],
          details: result.errors.length > 1 ? result.errors : undefined,
        });
        return;
      }

      if (result.notes.length === 0) {
        if (result.warnings.length > 0) {
          setNotice({
            status: "warning",
            title: "Nothing imported",
            description: result.warnings[0],
            details: result.warnings.length > 1 ? result.warnings : undefined,
          });
        }
        return;
      }

      let quotaFailed = false;
      updatePads((currentPads) => {
        const isBlankDefault =
          currentPads.length === 1 &&
          currentPads[0].title === "sample" &&
          !currentPads[0].content.trim();

        const existingPads = isBlankDefault ? [] : currentPads;
        const takenTitles = new Set(
          existingPads.map((p) => p.title.toLowerCase()),
        );

        const createdPads: Pad[] = result.notes.map((imported) => {
          const title = uniqueTitle(imported.title, takenTitles);
          return {
            id: generateId(),
            title,
            content: imported.html,
            updatedAt: imported.updatedAt || Date.now(),
          };
        });

        const nextPads = [...existingPads, ...createdPads];
        try {
          persistStore({ version: 1, pads: nextPads }, canStore);
        } catch {
          quotaFailed = true;
          return currentPads;
        }
        return nextPads;
      });

      if (quotaFailed) {
        setNotice({
          status: "error",
          title: "Local storage full",
          description:
            "Could not save imported pads because your browser's local storage is full. Please delete unnecessary pads to free up space, then try importing again.",
        });
        return;
      }

      const count = result.notes.length;
      const noteLabel = count === 1 ? "1 pad" : `${count} pads`;
      if (result.warnings.length > 0 || result.errors.length > 0) {
        setNotice({
          status: "warning",
          title: `Imported ${noteLabel} with warnings`,
          description: `Successfully imported ${noteLabel}. Some items or files were skipped.`,
          details: [...result.errors, ...result.warnings],
        });
      } else {
        setNotice({
          status: "success",
          title: "Import successful",
          description: `Successfully imported ${noteLabel} into otepad.`,
        });
      }
    } catch (err) {
      setNotice({
        status: "error",
        title: "Import failed",
        description:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while reading the files. Please try again.",
      });
    }
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
            notice={notice}
            theme={colorMode}
            themeId={themeId}
            showModeToggle={!appTheme.darkOnly}
            onToggleTheme={toggleTheme}
            onThemeIdChange={handleThemeIdChange}
            onOpenPad={handleOpenPad}
            onToggleSelect={handleToggleSelect}
            onAddPad={handleAddPad}
            onDeletePads={handleDeleteSurfacePads}
            onExportPads={handleExportSurfacePads}
            onImportFiles={handleImportSurfaceFiles}
            onDismissNotice={() => setNotice(null)}
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
