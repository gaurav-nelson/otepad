import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { ThemePicker } from "./ThemePicker";
import { ThemeToggle } from "./ThemeToggle";
import {
  TITLE_MAX_LENGTH,
  setEndOfContenteditable,
  type AppThemeId,
  type Pad,
  type ThemeMode,
} from "../lib/pads";

type EditorViewProps = {
  pad: Pad;
  theme: ThemeMode;
  themeId: AppThemeId;
  showModeToggle: boolean;
  onToggleTheme: () => void;
  onThemeIdChange: (id: AppThemeId) => void;
  onBack: () => void;
  onDelete: () => void;
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => boolean;
};

export function EditorView({
  pad,
  theme,
  themeId,
  showModeToggle,
  onToggleTheme,
  onThemeIdChange,
  onBack,
  onDelete,
  onContentChange,
  onTitleChange,
}: EditorViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(pad.title);
  const titleBeforeEdit = useRef(pad.title);
  const seededPadId = useRef<string | null>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(pad.title);
    }
  }, [pad.title, isEditingTitle]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (seededPadId.current === pad.id) return;
    seededPadId.current = pad.id;
    setIsEditingTitle(false);
    setTitleDraft(pad.title);
    el.innerHTML = pad.content || "";
    setEndOfContenteditable(el);
    el.focus();
  }, [pad.id, pad.title, pad.content]);

  useEffect(() => {
    if (!isEditingTitle) return;
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditingTitle]);

  function beginTitleEdit() {
    titleBeforeEdit.current = pad.title;
    setTitleDraft(pad.title);
    setIsEditingTitle(true);
  }

  function commitTitleEdit() {
    if (!isEditingTitle) return;
    const ok = onTitleChange(titleDraft);
    if (!ok) {
      setTitleDraft(pad.title);
    }
    setIsEditingTitle(false);
  }

  function cancelTitleEdit() {
    setTitleDraft(titleBeforeEdit.current);
    setIsEditingTitle(false);
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitleEdit();
      editorRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
      editorRef.current?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    // Browsers expose modifier keys on paste; DOM typings omit them.
    if (!(e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    setEndOfContenteditable(editorRef.current);
    onContentChange(editorRef.current.innerHTML);
  }

  return (
    <VStack className="editor-view" minHeight="100%" role="main">
      <HStack
        className="otepad-editor-toolbar no-drag"
        gap={2}
        vAlign="center"
        hAlign="between"
        width="100%"
      >
        <IconButton
          variant="ghost"
          size="lg"
          label="Back to surface"
          tooltip="Back"
          icon={<ArrowLeft />}
          onClick={() => {
            if (isEditingTitle) commitTitleEdit();
            onBack();
          }}
        />
        <HStack className="otepad-header-actions" gap={1} vAlign="center">
          <IconButton
            variant="ghost"
            size="lg"
            label="Delete pad"
            tooltip="Delete pad"
            icon={<Trash2 />}
            onClick={() => {
              if (isEditingTitle) commitTitleEdit();
              onDelete();
            }}
          />
          <ThemePicker themeId={themeId} onThemeIdChange={onThemeIdChange} />
          {showModeToggle ? (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          ) : null}
        </HStack>
      </HStack>

      <VStack className="otepad-editor no-drag" gap={0} align="stretch">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            id="padTitleInput"
            className="otepad-title-input"
            type="text"
            maxLength={TITLE_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            aria-label="Pad title"
            value={titleDraft}
            onChange={(e) => {
              const cleaned = e.target.value
                .replace(/[\r\n\t]+/g, " ")
                .slice(0, TITLE_MAX_LENGTH);
              setTitleDraft(cleaned);
            }}
            onBlur={commitTitleEdit}
            onKeyDown={onTitleKeyDown}
          />
        ) : (
          <button
            type="button"
            className="otepad-title-button"
            aria-label="Rename pad"
            title="Click to rename"
            onClick={beginTitleEdit}
          >
            {pad.title}
          </button>
        )}

        <div
          ref={editorRef}
          className="otepad-editor-body"
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Editor"
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) {
              onContentChange(editorRef.current.innerHTML);
            }
          }}
          onBlur={() => {
            if (isEditingTitle) commitTitleEdit();
            if (editorRef.current) {
              onContentChange(editorRef.current.innerHTML);
            }
          }}
          onPaste={onPaste}
        />
      </VStack>
    </VStack>
  );
}
