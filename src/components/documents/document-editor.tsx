"use client";

import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Redo2, Underline, Undo2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field, TextInput } from "@/components/auth/form-parts";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, type DocumentData } from "@/lib/api/browser";
import { cn } from "@/lib/utils";

type T = Dictionary["documents"];
type SaveState = "saved" | "dirty" | "saving";
type ErrorKey = keyof T["errors"];

/**
 * Только элементы, которые принимает сервер (ADR-0039): без ссылок, кода, изображений и HTML.
 * Заголовки 1–4, списки, таблицы, жирный/курсив/подчёркнутый/зачёркнутый.
 */
export const editorExtensions = [
  StarterKit.configure({ link: false, code: false, codeBlock: false, heading: { levels: [1, 2, 3, 4] } }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];

const contentClass = cn(
  "min-h-[50vh] px-4 py-3 outline-none",
  "[&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_h4]:font-semibold [&_p]:my-1.5",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:pl-3",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:align-top",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_th]:align-top",
);

function Toolbar({ editor, t }: { editor: Editor; t: T["toolbar"] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });

  const buttons: [keyof T["toolbar"], LucideIcon, () => void, boolean, boolean][] = [
    ["bold", Bold, () => editor.chain().focus().toggleBold().run(), state.bold, true],
    ["italic", Italic, () => editor.chain().focus().toggleItalic().run(), state.italic, true],
    ["underline", Underline, () => editor.chain().focus().toggleUnderline().run(), state.underline, true],
    ["h2", Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), state.h2, true],
    ["h3", Heading3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), state.h3, true],
    ["bullet", List, () => editor.chain().focus().toggleBulletList().run(), state.bullet, true],
    ["ordered", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), state.ordered, true],
    ["undo", Undo2, () => editor.chain().focus().undo().run(), false, state.undo],
    ["redo", Redo2, () => editor.chain().focus().redo().run(), false, state.redo],
  ];

  return (
    <div role="toolbar" aria-label={t.label} className="flex flex-wrap gap-1 border-b border-border bg-muted/50 p-1">
      {buttons.map(([key, Icon, run, active, enabled]) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={active ? "secondary" : "ghost"}
          aria-label={t[key]}
          title={t[key]}
          aria-pressed={key === "undo" || key === "redo" ? undefined : active}
          disabled={!enabled}
          onClick={run}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}

/** Редактор документа: правка, сохранение по версии, восстановление при конфликте (ADR-0039). */
export function DocumentEditor({ t, locale, initial }: { t: T; locale: Locale; initial: DocumentData }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [version, setVersion] = useState(Number(initial.version));
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [conflict, setConflict] = useState<DocumentData | null>(null);
  // Содержимое, которое считается сохранённым: после загрузки (редактор нормализует документ) и после каждого сохранения.
  const baseline = useRef<string>("");

  const editor = useEditor({
    extensions: editorExtensions,
    content: initial.content as object,
    immediatelyRender: false,
    editorProps: { attributes: { class: contentClass, "aria-label": initial.title, role: "textbox", "aria-multiline": "true" } },
    onCreate: ({ editor: e }) => {
      baseline.current = JSON.stringify(e.getJSON());
    },
    onUpdate: ({ editor: e }) => setState(JSON.stringify(e.getJSON()) === baseline.current ? "saved" : "dirty"),
  });

  const save = useCallback(
    async (baseVersion: number) => {
      if (!editor) return;
      setState("saving");
      setError(null);
      const content = editor.getJSON();
      const response = await api("PUT", `/documents/${initial.id}`, { title: title.trim() || initial.title, content, version: baseVersion });
      if (response.ok) {
        baseline.current = JSON.stringify(content);
        const saved = (await response.json()) as DocumentData;
        setVersion(Number(saved.version));
        setConflict(null);
        setState("saved");
        return;
      }

      setState("dirty");
      if (response.status === 409) setConflict((await response.json()) as DocumentData);
      else setError(response.status === 400 ? "invalid" : response.status === 404 ? "notFound" : "unknown");
    },
    [editor, initial.id, initial.title, title],
  );

  // Ctrl+S / Cmd+S — сохранить; предупреждение при уходе с несохранёнными правками.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(version);
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (state !== "saved") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, state, version]);

  function loadServer() {
    if (!conflict || !editor) return;
    editor.commands.setContent(conflict.content as object, { emitUpdate: false });
    baseline.current = JSON.stringify(editor.getJSON());
    setTitle(conflict.title);
    setVersion(Number(conflict.version));
    setConflict(null);
    setState("saved");
  }

  async function remove() {
    if (!window.confirm(t.deleteConfirm)) return;
    const response = await api("DELETE", `/documents/${initial.id}`);
    if (response.ok || response.status === 404) {
      router.replace(`/${locale}/teacher/documents`);
      router.refresh();
    } else {
      setError("unknown");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field label={t.titleLabel}>
            {(a) => (
              <TextInput
                {...a}
                name="title"
                maxLength={200}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setState("dirty");
                }}
              />
            )}
          </Field>
        </div>
        <p role="status" className="pb-2 text-sm text-muted-foreground" data-testid="save-state">
          {state === "saving" ? t.saving : state === "dirty" ? t.unsaved : t.saved}
        </p>
        <Button onClick={() => save(version)} disabled={state === "saving" || !editor}>
          {t.save}
        </Button>
        <Button variant="outline" onClick={remove}>
          {t.delete}
        </Button>
      </div>

      {error ? <StatePanel variant="error" title={t.errors[error]} /> : null}
      {conflict ? (
        <StatePanel variant="error" title={t.conflictTitle}>
          <p>{t.conflictText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadServer}>
              {t.loadServer}
            </Button>
            <Button onClick={() => save(Number(conflict.version))}>{t.overwrite}</Button>
          </div>
        </StatePanel>
      ) : null}

      <div className="border border-border bg-card">
        {editor ? <Toolbar editor={editor} t={t.toolbar} /> : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
