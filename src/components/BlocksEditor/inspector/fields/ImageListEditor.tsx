import React, { useRef, useState } from "react";
import ImagePicker from "./ImagePicker";

export type ImageItem = {
  id: string;
  url: string;
  alt?: string;
};

export type ImageListEditorProps = {
  value: ImageItem[];
  onChange: (items: ImageItem[]) => void;

  /** optional uploader used by inner ImagePicker(s) */
  onUpload?: (file: File) => Promise<string>;
  accept?: string;
  disabled?: boolean;
  title?: string;
};

export default function ImageListEditor({
  value,
  onChange,
  onUpload,
  accept = "image/*",
  disabled,
  title = "Images",
}: ImageListEditorProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  function addItem() {
    onChange([...(value || []), { id: uid(), url: "", alt: "" }]);
  }

  function remove(id: string) {
    onChange((value || []).filter((x) => x.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const arr = [...(value || [])];
    const i = arr.findIndex((x) => x.id === id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    onChange(arr);
  }

  function update(id: string, patch: Partial<ImageItem>) {
    onChange((value || []).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <div className="be-stack" style={{ gap: 10 }}>
      <div
        className="be-title-row"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <div className="be-subtitle" style={{ fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ marginLeft: "auto" }} />
        <button
          type="button"
          className="be-btn"
          disabled={disabled}
          onClick={addItem}
        >
          + Add Image
        </button>
      </div>

      {(value || []).length === 0 ? (
        <div className="be-subtle">No images yet.</div>
      ) : null}

      {(value || []).map((item, idx) => (
        <div
          key={item.id}
          className="be-card"
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}
        >
          <div
            className="be-row"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <div style={{ flex: 1 }}>
              <ImagePicker
                value={item.url}
                onChange={(url) => update(item.id, { url })}
                onUpload={onUpload}
                accept={accept}
                disabled={disabled || busyId === item.id}
              />
              <div style={{ marginTop: 6 }}>
                <label className="be-label">Alt text</label>
                <input
                  className="be-input"
                  value={item.alt ?? ""}
                  disabled={disabled}
                  onChange={(e) => update(item.id, { alt: e.target.value })}
                />
              </div>
            </div>

            <div
              className="be-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: 90,
              }}
            >
              <button
                type="button"
                className="be-btn"
                disabled={disabled || idx === 0}
                onClick={() => move(item.id, -1)}
              >
                ↑ Up
              </button>
              <button
                type="button"
                className="be-btn"
                disabled={disabled || idx === (value?.length ?? 1) - 1}
                onClick={() => move(item.id, +1)}
              >
                ↓ Down
              </button>
              <button
                type="button"
                className="be-btn danger"
                disabled={disabled}
                onClick={() => remove(item.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return "img_" + Math.random().toString(36).slice(2, 10);
}
