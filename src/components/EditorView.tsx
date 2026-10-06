import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent,
} from "react";
import { ThemePicker } from "./ThemePicker";
import { ThemeToggle } from "./ThemeToggle";
import {
  TITLE_MAX_LENGTH,
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
  onContentChange: (content: string) => void;
  // Used to migrate older HTML pads into the Markdown-only editor format.
  onContentFormatChange: (
    contentFormat: "html" | "markdown",
    content: string,
  ) => void;
  onTitleChange: (title: string) => boolean;
};

const MarkdownImageAltText = Extension.create({
  name: "markdownImageAltText",
  markdownTokenName: "image",
  parseMarkdown: (token) => ({ type: "text", text: token.text || "" }),
});

function looksLikeMarkdown(text: string): boolean {
  return (
    /^ {0,3}(?:#{1,6}\s|[-*+]\s+|\d{1,9}[.)]\s+|>\s?|```|~~~|(?:[-*_]\s*){3,}$)/m.test(
      text,
    ) ||
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(text) ||
    /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|!?\[[^\]]+\]\([^\s)]+\)/.test(
      text,
    ) ||
    /(?:^|[^\w])(?:\*[^*\n]+\*|_[^_\n]+_)(?:$|[^\w])/.test(text)
  );
}

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
  onContentFormatChange,
  onTitleChange,
}: EditorViewProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const initialContentFormat = pad.contentFormat ?? "html";
  const currentFormatRef = useRef(initialContentFormat);
  const onContentChangeRef = useRef(onContentChange);
  const onContentFormatChangeRef = useRef(onContentFormatChange);
  currentFormatRef.current = initialContentFormat;
  onContentChangeRef.current = onContentChange;
  onContentFormatChangeRef.current = onContentFormatChange;

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TaskList,
        TaskItem,
        TableKit,
        MarkdownImageAltText,
        Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
      ],
      content: pad.content || "",
      contentType: initialContentFormat === "markdown" ? "markdown" : "html",
      autofocus: "end",
      editorProps: {
        attributes: {
          class: "otepad-editor-body",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Editor",
          spellcheck: "true",
        },
      },
      onCreate: ({ editor: createdEditor }) => {
        if (currentFormatRef.current === "markdown") return;
        const markdown = createdEditor.isEmpty ? "" : createdEditor.getMarkdown();
        currentFormatRef.current = "markdown";
        onContentFormatChangeRef.current("markdown", markdown);
      },
      onUpdate: ({ editor: updatedEditor }) => {
        onContentChangeRef.current(
          updatedEditor.isEmpty ? "" : updatedEditor.getMarkdown(),
        );
      },
    },
    [pad.id],
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(pad.title);
  const titleBeforeEdit = useRef(pad.title);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(pad.title);
  }, [pad.title, isEditingTitle]);

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
    if (!ok) setTitleDraft(pad.title);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit() {
    setTitleDraft(titleBeforeEdit.current);
    setIsEditingTitle(false);
  }

  function focusContentEditor() {
    editor?.commands.focus();
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitleEdit();
      focusContentEditor();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
      focusContentEditor();
    }
  }

  function onPaste(e: ReactClipboardEvent<HTMLDivElement>) {
    if (!editor) return;
    const text = e.clipboardData.getData("text/plain");
    const shiftPaste = (e.nativeEvent as unknown as { shiftKey?: boolean })
      .shiftKey;

    if (shiftPaste) {
      e.preventDefault();
      editor.commands.insertContent(text, {
        parseOptions: { preserveWhitespace: "full" },
      });
      return;
    }

    if (!text || !looksLikeMarkdown(text) || !editor.markdown) return;
    e.preventDefault();
    editor.commands.insertContent(editor.markdown.parse(text));
  }

  function saveOnBlur() {
    if (isEditingTitle) commitTitleEdit();
    if (!editor) return;
    const content = editor.isEmpty
      ? ""
      : editor.getMarkdown();
    onContentChange(content);
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

        <EditorContent
          editor={editor}
          className="otepad-editor-content no-drag"
          onPaste={onPaste}
          onBlur={saveOnBlur}
        />
      </VStack>
    </VStack>
  );
}
