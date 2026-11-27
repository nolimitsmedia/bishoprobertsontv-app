// src/components/editor/ModernPageEditor.js
import React, { useContext, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import api from "../../api";
import { MediaPickerContext } from "../media/MediaPicker";
import "./ModernPageEditor.css";
import { promptDialog } from "../ui/Dialogs";

/* -----------------------------
   helpers
----------------------------- */
function absUrl(u) {
  if (!u) return "";
  const s = String(u || "");
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  const base = (api?.defaults?.baseURL || "").replace(/\/api\/?$/i, "");
  if (!base) return s;
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
}

// Normalize any relative image/video sources so they render inside the editor on localhost:5001
function normalizeHtmlForEditor(html) {
  const raw = String(html || "");
  if (!raw.trim()) return "";
  return raw
    .replace(/(<img\b[^>]*\bsrc=)(['"])([^'"]+)(\2)/gi, (all, a, q, src) => {
      return `${a}${q}${absUrl(src)}${q}`;
    })
    .replace(
      /(<source\b[^>]*\bsrc=)(['"])([^'"]+)(\2)/gi,
      (all, a, q, src) => `${a}${q}${absUrl(src)}${q}`,
    );
}

async function uploadInlineImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await api.post("/uploads/pages?type=inline", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data.url;
}

/* -----------------------------
   optional TextAlign
   (some installs don't have @tiptap/extension-text-align)
----------------------------- */
let TextAlignExt = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  TextAlignExt = require("@tiptap/extension-text-align").default;
} catch (e) {
  TextAlignExt = null;
}

function Toolbar({ editor, onUploadImage }) {
  // Phase 4H-2: present when the page editor provides the Media Library picker.
  const pickFromLibrary = useContext(MediaPickerContext);
  if (!editor) return null;

  async function addImageFromLibrary() {
    const pick = await pickFromLibrary({ title: "Insert an image" });
    if (!pick?.url) return;
    editor
      .chain()
      .focus()
      .setImage({ src: absUrl(pick.url), alt: pick.alt || "" })
      .run();
  }

  async function addImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const uploader = onUploadImage || uploadInlineImage;
      const url = await uploader(file);

      // ✅ make sure it displays inside editor (absolute URL)
      editor
        .chain()
        .focus()
        .setImage({ src: absUrl(url) })
        .run();
    };
    input.click();
  }

  async function setLink() {
    const prev = editor.getAttributes("link").href || "";
    const url = await promptDialog({
      title: "Link",
      message: "Link address (leave empty to remove the link)",
      defaultValue: prev,
      placeholder: "https://",
    });
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }

  const supportsAlign = !!TextAlignExt;

  return (
    <div className="mpe-toolbar">
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </button>

      <div className="mpe-sep" />

      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>

      <div className="mpe-sep" />

      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
      <button
        className="mpe-btn"
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        Quote
      </button>

      <div className="mpe-sep" />

      {supportsAlign ? (
        <>
          <button
            className="mpe-btn"
            type="button"
            title="Align left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            ⬅
          </button>
          <button
            className="mpe-btn"
            type="button"
            title="Align center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            ⬌
          </button>
          <button
            className="mpe-btn"
            type="button"
            title="Align right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            ➡
          </button>
          <div className="mpe-sep" />
        </>
      ) : null}

      <button className="mpe-btn" type="button" onClick={setLink}>
        Link
      </button>

      <button
        className="mpe-btn mpe-btnPrimary"
        type="button"
        onClick={addImage}
      >
        + Image
      </button>

      {pickFromLibrary ? (
        <button
          className="mpe-btn mpe-btnPrimary"
          type="button"
          onClick={addImageFromLibrary}
          title="Insert an image from the Media Library"
        >
          From library
        </button>
      ) : null}
    </div>
  );
}

export default function ModernPageEditor({
  value,
  onChange,
  onChangeHtml,
  onUploadImage,
  placeholder = "Start writing…",
}) {
  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // TipTap 3's StarterKit includes Link; the configured Link below is used.
        link: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: false,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          style: "max-width:100%;height:auto;",
        },
      }),
      Placeholder.configure({ placeholder }),
    ];

    if (TextAlignExt) {
      base.push(
        TextAlignExt.configure({
          types: ["heading", "paragraph"],
        }),
      );
    }

    return base;
  }, [placeholder]);

  const editor = useEditor({
    extensions,
    content: normalizeHtmlForEditor(value || ""),
    editorProps: {
      attributes: { class: "mpe-editor" },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      if (onChangeHtml) onChangeHtml(html);
      if (onChange) onChange(html);
    },
  });

  // Keep external value in sync without losing cursor (only set when different)
  useEffect(() => {
    if (!editor) return;
    const next = normalizeHtmlForEditor(value || "");
    const current = editor.getHTML();
    if (next !== current) {
      editor.commands.setContent(next, false);
    }
  }, [editor, value]);

  return (
    <div className="mpe-root">
      <Toolbar editor={editor} onUploadImage={onUploadImage} />
      <div className="mpe-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
