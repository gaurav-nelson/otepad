import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { Plus, Search, SearchX, Trash2 } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ThemePicker } from "./ThemePicker";
import { ThemeToggle } from "./ThemeToggle";
import {
  filterPads,
  previewText,
  type AppThemeId,
  type Pad,
  type ThemeMode,
} from "../lib/pads";

type AddPadLabelMode = "full" | "short" | "icon";

function subscribeAddPadLabelMode(onChange: () => void): () => void {
  const shortMq = window.matchMedia("(max-width: 720px)");
  const iconMq = window.matchMedia("(max-width: 420px)");
  shortMq.addEventListener("change", onChange);
  iconMq.addEventListener("change", onChange);
  return () => {
    shortMq.removeEventListener("change", onChange);
    iconMq.removeEventListener("change", onChange);
  };
}

function getAddPadLabelMode(): AddPadLabelMode {
  if (window.matchMedia("(max-width: 420px)").matches) return "icon";
  if (window.matchMedia("(max-width: 720px)").matches) return "short";
  return "full";
}

function useAddPadLabelMode(): AddPadLabelMode {
  return useSyncExternalStore(
    subscribeAddPadLabelMode,
    getAddPadLabelMode,
    () => "full",
  );
}

type SurfaceViewProps = {
  pads: Pad[];
  selectedPadIds: Set<string>;
  theme: ThemeMode;
  themeId: AppThemeId;
  showModeToggle: boolean;
  onToggleTheme: () => void;
  onThemeIdChange: (id: AppThemeId) => void;
  onOpenPad: (id: string) => void;
  onToggleSelect: (id: string, selected: boolean) => void;
  onAddPad: () => void;
  onDeletePads: () => void;
};

export function SurfaceView({
  pads,
  selectedPadIds,
  theme,
  themeId,
  showModeToggle,
  onToggleTheme,
  onThemeIdChange,
  onOpenPad,
  onToggleSelect,
  onAddPad,
  onDeletePads,
}: SurfaceViewProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const addPadLabelMode = useAddPadLabelMode();
  const searchRef = useRef<HTMLInputElement>(null);

  const visiblePads = useMemo(
    () => filterPads(pads, deferredQuery),
    [pads, deferredQuery],
  );

  const isFiltering = deferredQuery.trim().length > 0;
  const selecting = selectedPadIds.size > 0;
  const selectedCount = selectedPadIds.size;
  const deleteLabel =
    selectedCount > 0
      ? selectedCount === 1
        ? "Delete selected pad"
        : "Delete selected pads"
      : "Delete all pads";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = Boolean(
        target?.closest?.("input, textarea, [contenteditable]"),
      );

      if (
        (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) &&
        !inField
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (
        e.key === "Escape" &&
        query &&
        document.activeElement === searchRef.current
      ) {
        e.preventDefault();
        setQuery("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [query]);

  return (
    <VStack
      className="otepad-surface"
      gap={0}
      minHeight="100%"
      height="100%"
      role="main"
      aria-label="Pads"
    >
      <HStack
        className="otepad-surface-header drag"
        gap={2}
        vAlign="center"
        hAlign="between"
        width="100%"
        wrap="nowrap"
      >
        <HStack className="otepad-brand no-drag" gap={2} vAlign="center" wrap="nowrap">
          <img
            className="otepad-brand-logo"
            src="/img/icon-96x96.png"
            width={36}
            height={36}
            alt=""
            decoding="async"
          />
          <Heading level={1} type="display-2" className="otepad-brand-title">
            otepad
          </Heading>
          <Button
            className="otepad-add-pad no-drag"
            variant="primary"
            size="lg"
            label="Add pad"
            icon={<Plus />}
            isIconOnly={addPadLabelMode === "icon"}
            tooltip={addPadLabelMode === "icon" ? "Add pad" : undefined}
            onClick={onAddPad}
          >
            {addPadLabelMode === "short" ? "Add" : "Add pad"}
          </Button>
        </HStack>

        <HStack className="otepad-header-actions no-drag" gap={1} vAlign="center" wrap="nowrap">
          <IconButton
            variant="ghost"
            size="lg"
            label={deleteLabel}
            tooltip={deleteLabel}
            icon={<Trash2 />}
            isDisabled={pads.length === 0}
            onClick={onDeletePads}
          />
          <ThemePicker themeId={themeId} onThemeIdChange={onThemeIdChange} />
          {showModeToggle ? (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          ) : null}
        </HStack>
      </HStack>

      <VStack className="otepad-search-row no-drag" gap={2} width="100%">
        <TextInput
          ref={searchRef}
          className="otepad-search"
          label="Search pads"
          isLabelHidden
          placeholder="Search pads…"
          value={query}
          size="lg"
          startIcon={<Search />}
          hasClear
          width="100%"
          onChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        />
        {isFiltering ? (
          <Text
            className="otepad-search-meta"
            type="supporting"
            color="secondary"
            aria-live="polite"
          >
            {visiblePads.length === 0
              ? `No pads match “${deferredQuery.trim()}”`
              : visiblePads.length === 1
                ? `1 pad matches “${deferredQuery.trim()}”`
                : `${visiblePads.length} pads match “${deferredQuery.trim()}”`}
          </Text>
        ) : null}
      </VStack>

      {visiblePads.length === 0 && isFiltering ? (
        <EmptyState
          className="otepad-search-empty no-drag"
          isCompact
          icon={<SearchX />}
          title="No matching pads"
          description="Try a different word from a title or note, or clear the search."
          actions={
            <Button
              variant="secondary"
              label="Clear search"
              onClick={() => setQuery("")}
            >
              Clear search
            </Button>
          }
        />
      ) : (
        <Grid
          className={`otepad-pad-grid no-drag${selecting ? " is-selecting" : ""}`}
          columns={{ minWidth: 160, repeat: "fit" }}
          gap={4}
          width="100%"
          maxWidth={960}
          justify="stretch"
          align="stretch"
        >
          {visiblePads.map((pad) => {
            const isSelected = selectedPadIds.has(pad.id);
            return (
              <ClickableCard
                key={pad.id}
                className={`otepad-pad-card${isSelected ? " is-selected" : ""}`}
                label={`Open ${pad.title}`}
                padding={4}
                elevation="low"
                onClick={() => {
                  if (selecting) {
                    onToggleSelect(pad.id, !isSelected);
                    return;
                  }
                  onOpenPad(pad.id);
                }}
              >
                <CheckboxInput
                  className="otepad-pad-select"
                  label={`Select ${pad.title}`}
                  isLabelHidden
                  value={isSelected}
                  onChange={(checked) => onToggleSelect(pad.id, checked)}
                />
                <VStack gap={3} align="stretch" className="otepad-pad-card-body">
                  <Heading
                    level={2}
                    className="otepad-pad-title"
                    maxLines={2}
                    wordBreak="break-word"
                  >
                    {pad.title}
                  </Heading>
                  <Text
                    type="code"
                    className="otepad-pad-preview"
                    color="secondary"
                    maxLines={4}
                    wordBreak="break-word"
                  >
                    {previewText(pad.content)}
                  </Text>
                  <Timestamp
                    className="otepad-pad-updated"
                    value={pad.updatedAt}
                    format="auto"
                    type="supporting"
                    color="secondary"
                    isLive
                  />
                </VStack>
              </ClickableCard>
            );
          })}
        </Grid>
      )}

      <HStack
        className="otepad-footer no-drag"
        gap={2}
        hAlign="center"
        vAlign="center"
        wrap="wrap"
      >
        <Link href="/privacy.html" color="secondary">
          Privacy
        </Link>
        <Text color="secondary" aria-hidden="true">
          ·
        </Text>
        <Link href="/terms.html" color="secondary">
          Terms
        </Link>
        <Text color="secondary" aria-hidden="true">
          ·
        </Text>
        <Link
          href="https://github.com/gaurav-nelson/otepad"
          isExternalLink
          color="secondary"
        >
          GitHub
        </Link>
      </HStack>
    </VStack>
  );
}
