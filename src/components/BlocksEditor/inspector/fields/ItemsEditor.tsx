import React from "react";

export type ItemsEditorItem = {
  id: string;
  title?: string; // or label
  label?: string; // optional alias
  html?: string;
};

export type ItemsEditorProps = {
  value: ItemsEditorItem[];
  onChange: (items: ItemsEditorItem[]) => void;

  /** Customize field names if your item shape differs */
  titleKey?: "title" | "label";
  bodyKey?: "html";

  disabled?: boolean;
  title?: string;
};

export default function ItemsEditor({
  value,
  onChange,
  titleKey = "title",
  bodyKey = "html",
  disabled,
  title = "Items",
}: ItemsEditorProps) {
  function addItem() {
    onChange([
      ...(value || []),
      { id: uid(), [titleKey]: "Title", [bodyKey]: "" } as any,
    ]);
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

  function update(id: string, patch: Partial<ItemsEditorItem>) {
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
          + Add Item
        </button>
      </div>

      {(value || []).length === 0 ? (
        <div className="be-subtle">No items yet.</div>
      ) : null}

      {(value || []).map((item, idx) => {
        const t = (item as any)[titleKey] ?? "";
        const b = (item as any)[bodyKey] ?? "";

        return (
          <div
            key={item.id}
            className="be-card"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div className="be-row" style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="be-label">Title</label>
                <input
                  className="be-input"
                  value={t}
                  disabled={disabled}
                  onChange={(e) =>
                    update(item.id, { [titleKey]: e.target.value } as any)
                  }
                />
                <div style={{ marginTop: 6 }}>
                  <label className="be-label">Content (HTML)</label>
                  <textarea
                    className="be-textarea"
                    rows={6}
                    value={b}
                    disabled={disabled}
                    onChange={(e) =>
                      update(item.id, { [bodyKey]: e.target.value } as any)
                    }
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
        );
      })}
    </div>
  );
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return "itm_" + Math.random().toString(36).slice(2, 10);
}
