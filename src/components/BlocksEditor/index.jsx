// src/components/BlocksEditor/index.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SortableList, { SortableItem } from "./views/SortableList";
import api from "../../api";

/* -------------------------------- Utils -------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const deepClone = (x) => JSON.parse(JSON.stringify(x));

/** Accept padding as [t,r,b,l] OR {top,right,bottom,left}. */
const toPadAny = (val, fallback = [24, 24, 24, 24]) => {
  if (Array.isArray(val)) return val.length === 4 ? val : fallback;
  if (val && typeof val === "object") {
    return [
      Number.isFinite(val.top) ? val.top : fallback[0],
      Number.isFinite(val.right) ? val.right : fallback[1],
      Number.isFinite(val.bottom) ? val.bottom : fallback[2],
      Number.isFinite(val.left) ? val.left : fallback[3],
    ];
  }
  return fallback;
};

const reorderArray = (list, newIds) => {
  const map = new Map(list.map((n) => [String(n.id), n]));
  return newIds.map((id) => map.get(String(id))).filter(Boolean);
};

const shadowStyle = (token) => {
  switch (token) {
    case "sm":
      return "0 1px 2px rgba(0,0,0,.08)";
    case "md":
      return "0 4px 12px rgba(0,0,0,.12)";
    case "lg":
      return "0 10px 30px rgba(0,0,0,.16)";
    default:
      return "none";
  }
};

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** Find a node by id and return { node, parent, index } */
function findBlockById(list, id) {
  const walk = (items, parent = null) => {
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      if (!n) continue;
      if (n.id === id) return { node: n, parent, index: i };
      if (n.type === "columns") {
        const cols = Array.isArray(n.children) ? n.children : [];
        for (const col of cols) {
          const res = walk(col, n.children);
          if (res) return res;
        }
      } else if (Array.isArray(n.children) && n.children.length) {
        const res = walk(n.children, n.children);
        if (res) return res;
      }
    }
    return null;
  };
  return walk(list);
}

/* --------------------------- Block definitions -------------------------- */
const blockDefaults = {
  section: () => ({
    id: uid(),
    type: "section",
    props: {
      padding: [24, 24, 24, 24],
      background: "",
      backgroundImage: "",
      overlay: "", // rgba(...) on top of bg image
      textAlign: "left",

      // Layout
      width: "100%",
      maxWidth: "",
      minHeightValue: 0,
      minHeightUnit: "px", // 'px' | 'vh' | 'em'
      borderRadius: 0,

      // Background styling
      backgroundPosition: "center",
      backgroundSize: "cover", // auto | cover | contain
      backgroundRepeat: "no-repeat",

      // NEW: content alignment for children inside the section
      contentHAlign: "flex-start", // flex-start | center | flex-end
      contentVAlign: "flex-start", // flex-start | center | flex-end
      contentGap: 10,
    },
    children: [],
  }),
  columns: () => ({
    id: uid(),
    type: "columns",
    props: {
      columns: 2,
      gap: 16,
      background: "",
      backgroundImage: "",
      padding: [0, 0, 0, 0],
    },
    children: [[], []],
  }),
  heading: () => ({
    id: uid(),
    type: "heading",
    props: {
      text: "Heading",
      tag: "h2",
      fontSize: 28,
      fontWeight: 700,
      textAlign: "left",
      color: "#0b1220",
    },
  }),
  text: () => ({
    id: uid(),
    type: "text",
    props: {
      text: "Start writing...",
      textAlign: "left",
      color: "#334155",
      fontSize: 16,
    },
  }),
  image: () => ({
    id: uid(),
    type: "image",
    props: { src: "", alt: "", width: "" },
  }),
  button: () => ({
    id: uid(),
    type: "button",
    props: {
      label: "Button",
      href: "#",
      textAlign: "left",
      background: "#2563eb",
      color: "#ffffff",
    },
  }),
  spacer: () => ({
    id: uid(),
    type: "spacer",
    props: { height: 24 },
  }),
  divider: () => ({
    id: uid(),
    type: "divider",
    props: { thickness: 1, color: "#E5E7EB", style: "solid", width: "100%" },
  }),
  card: () => ({
    id: uid(),
    type: "card",
    props: {
      padding: [16, 16, 16, 16],
      background: "#ffffff",
      radius: 12,
      shadow: "sm",
      maxWidth: "",
    },
    children: [],
  }),
  video: () => ({
    id: uid(),
    type: "video",
    props: { src: "", provider: "auto", title: "" },
  }),
  embed: () => ({
    id: uid(),
    type: "embed",
    props: { html: "<div style='padding:1rem'>Paste embed code here</div>" },
  }),
  hero: () => ({
    id: uid(),
    type: "hero",
    props: {
      background: "#111827",
      backgroundImage: "",
      overlay: "rgba(0,0,0,.35)",
      padding: [80, 24, 80, 24],
      align: "center",
      heading: "Hello",
      text: "Welcome to my website",
      buttonLabel: "Get started",
      buttonHref: "#",
      textColor: "#ffffff",
    },
  }),
};

const makeBlock = (type) => {
  const fn = blockDefaults[type];
  if (!fn) throw new Error(`Unknown block type "${type}"`);
  return fn();
};

/* --------------------------------- UI ---------------------------------- */
const ui = {
  col: { flex: 1, minWidth: 280 },
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    background: "#fff",
  },
  label: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  input: {
    font: "inherit",
    padding: "6px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    width: "100%",
  },
  select: {
    padding: "6px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
  },
  color: {
    width: 40,
    height: 28,
    padding: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
  },
  badge: {
    fontSize: 11,
    padding: "2px 6px",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    color: "#6b7280",
    background: "#f9fafb",
    textTransform: "uppercase",
  },
  btn: {
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
  },
  btnDanger: {
    padding: "6px 10px",
    border: "1px solid #ef4444",
    color: "#ef4444",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
  },
  handle: {
    cursor: "grab",
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    padding: 4,
    borderRadius: 8,
    background: "#f1f5f9",
    color: "#64748b",
    fontSize: 14,
    marginBottom: 8,
  },
  // Canvas item wrapper: transparent (no white card look)
  canvasItem: {
    border: "1px dashed #e5e7eb",
    borderRadius: 8,
    background: "transparent",
    padding: 8,
    marginBottom: 8,
  },
};

/* ------------------------ Upload helper (image) ------------------------- */
const UploadButton = ({ onUploaded, children }) => {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        style={ui.btn}
        onClick={() => inputRef.current?.click()}
      >
        {children || "Upload"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          try {
            const { data } = await api.post("/uploads", fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            const url =
              data?.url || data?.file?.url || data?.files?.[0]?.url || "";
            if (url) onUploaded?.(url);
          } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
          } finally {
            e.target.value = "";
          }
        }}
      />
    </>
  );
};

/* -------------------------- Live input controls ------------------------- */
const LiveTextInput = ({
  value,
  onCommit,
  beginEdit,
  endEdit,
  placeholder,
}) => {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <input
      type="text"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onFocus={beginEdit}
      onBlur={() => endEdit?.(() => onCommit?.(v))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit?.(v);
          endEdit?.();
        }
      }}
      placeholder={placeholder}
      style={ui.input}
    />
  );
};
const LiveTextArea = ({ value, onCommit, beginEdit, endEdit, rows = 4 }) => {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <textarea
      rows={rows}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onFocus={beginEdit}
      onBlur={() => endEdit?.(() => onCommit?.(v))}
      style={{ ...ui.input, resize: "vertical" }}
    />
  );
};
const LiveNumberInput = ({
  value,
  onCommit,
  beginEdit,
  endEdit,
  min,
  max,
  step = 1,
}) => {
  const [v, setV] = useState(value ?? 0);
  useEffect(() => setV(value ?? 0), [value]);
  return (
    <input
      type="number"
      value={Number.isFinite(v) ? v : ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) =>
        setV(e.target.value === "" ? "" : Number(e.target.value))
      }
      onFocus={beginEdit}
      onBlur={() => endEdit?.(() => onCommit?.(Number(v)))}
      style={ui.input}
    />
  );
};
const LiveSelect = ({ value, onCommit, beginEdit, endEdit, options }) => (
  <select
    value={value ?? options?.[0]?.value}
    onChange={(e) => onCommit?.(e.target.value)}
    onFocus={beginEdit}
    onBlur={() => endEdit?.()}
    style={ui.select}
  >
    {options?.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);
const LiveColorInput = ({ value, onCommit, beginEdit, endEdit }) => {
  const [v, setV] = useState(value || "#000000");
  useEffect(() => setV(value || "#000000"), [value]);
  return (
    <input
      type="color"
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onCommit?.(e.target.value);
      }}
      onFocus={beginEdit}
      onBlur={() => endEdit?.()}
      style={ui.color}
      title={v}
    />
  );
};

/* ----------------------------- BlocksEditor ----------------------------- */
export default function BlocksEditor(props) {
  const { blocks: blocksProp, value, onChange } = props;

  // Initialize from props
  const initial = useMemo(
    () => deepClone(blocksProp ?? value ?? []),
    [blocksProp, value]
  );
  const [blocks, setBlocks] = useState(initial);
  const [selectedId, setSelectedId] = useState(null);

  // Sync down when parent changes list reference
  const lastSigRef = useRef(
    JSON.stringify({ b: blocksProp ?? null, v: value ?? null })
  );
  useEffect(() => {
    const sig = JSON.stringify({ b: blocksProp ?? null, v: value ?? null });
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      const incoming = deepClone(blocksProp ?? value ?? []);
      setBlocks(incoming);
      if (selectedId && !findBlockById(incoming, selectedId)) {
        setSelectedId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksProp, value]);

  // Bubble changes (stable)
  const didMountRef = useRef(false);
  const lastString = JSON.stringify(blocks);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onChange && onChange(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastString]);

  // Editing lifecycle
  const editingRef = useRef(false);
  const beginEdit = useCallback(() => {
    editingRef.current = true;
  }, []);
  const endEditSoftCommit = useCallback((commitFn) => {
    if (typeof commitFn === "function") commitFn();
    editingRef.current = false;
  }, []);

  // Palette
  const palette = useMemo(
    () => [
      { type: "section", title: "Section" },
      { type: "columns", title: "Columns" },
      { type: "heading", title: "Heading" },
      { type: "text", title: "Text" },
      { type: "image", title: "Image" },
      { type: "button", title: "Button" },
      { type: "divider", title: "Divider" },
      { type: "spacer", title: "Spacer" },
      { type: "card", title: "Card" },
      { type: "video", title: "Video" },
      { type: "embed", title: "Embed (HTML)" },
      { type: "hero", title: "Hero" },
    ],
    []
  );

  const addToRoot = useCallback((type) => {
    setBlocks((prev) => [...prev, makeBlock(type)]);
  }, []);

  // palette drag → canvas drop
  const dragDataRef = useRef(null);
  const handlePaletteDragStart = useCallback((e, type) => {
    dragDataRef.current = { kind: "new", type };
    e.dataTransfer.effectAllowed = "copy";
  }, []);
  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    const d = dragDataRef.current;
    if (!d) return;
    if (d.kind === "new") setBlocks((prev) => [...prev, makeBlock(d.type)]);
    dragDataRef.current = null;
  }, []);

  const select = useCallback((b) => {
    setSelectedId(b?.id ?? null);
  }, []);
  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    const found = findBlockById(blocks, selectedId);
    return found?.node || null;
  }, [blocks, selectedId]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setBlocks((prev) => {
      const next = deepClone(prev);
      const found = findBlockById(next, selectedId);
      if (!found) return prev;
      if (!found.parent) next.splice(found.index, 1);
      else found.parent.splice(found.index, 1);
      return next;
    });
    setSelectedId(null);
  }, [selectedId]);

  const clearCanvas = useCallback(() => {
    if (!window.confirm("Clear all blocks?")) return;
    setBlocks([]);
    setSelectedId(null);
  }, []);

  /* ------------------------------- Renderers ------------------------------ */
  const BlockShell = ({ b, children }) => (
    <div
      onClick={(e) => {
        e.stopPropagation();
        select(b);
      }}
      style={{
        ...ui.panel,
        outline:
          b.id === selectedId ? "2px solid #3b82f6" : "1px solid #e5e7eb",
        boxShadow:
          b.id === selectedId ? "0 0 0 2px rgba(59,130,246,.2)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={ui.badge}>{b.type}</span>
      </div>
      {children}
    </div>
  );

  const renderBlock = (b) => {
    switch (b.type) {
      /* ------------------------------- SECTION ------------------------------ */
      case "section": {
        const p = b.props || {};
        const pad = toPadAny(p.padding, [24, 24, 24, 24]);

        // Compose layered background if overlay and backgroundImage are set
        let backgroundImage;
        if (p.backgroundImage) {
          backgroundImage = p.overlay
            ? `linear-gradient(${p.overlay}, ${p.overlay}), url(${p.backgroundImage})`
            : `url(${p.backgroundImage})`;
        } else if (p.overlay) {
          backgroundImage = `linear-gradient(${p.overlay}, ${p.overlay})`;
        }

        const minHeight =
          Number(p.minHeightValue) > 0
            ? `${Number(p.minHeightValue)}${p.minHeightUnit || "px"}`
            : undefined;

        const style = {
          width: p.width || "100%",
          maxWidth: p.maxWidth || undefined,
          margin: p.maxWidth ? "0 auto" : undefined,
          padding: `${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px`,
          background: p.background || "transparent",
          backgroundImage,
          backgroundSize: p.backgroundImage
            ? p.backgroundSize || "cover"
            : undefined,
          backgroundPosition: p.backgroundImage
            ? p.backgroundPosition || "center"
            : undefined,
          backgroundRepeat: p.backgroundImage
            ? p.backgroundRepeat || "no-repeat"
            : undefined,
          minHeight,
          borderRadius: Number(p.borderRadius) || 0,
          textAlign: p.textAlign || "left",
          // Make the outer section grow so inner can fill it
          display: "block",
        };

        // ⭐ NEW: inner container that actually fills the section
        const innerStyle = {
          display: "flex",
          flexDirection: "column",
          justifyContent: p.contentVAlign || "flex-start",
          alignItems: p.contentHAlign || "flex-start",
          gap: `${Number(p.contentGap ?? 10)}px`,
          height: "100%",
          minHeight: style.minHeight || undefined,
        };

        const ids = (b.children || []).map((c) => String(c.id));

        return (
          <BlockShell b={b} key={b.id}>
            <div
              style={style}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const d = dragDataRef.current;
                if (!d) return;
                setBlocks((prev) => {
                  const next = deepClone(prev);
                  const node = findBlockById(next, b.id)?.node;
                  if (!node) return prev;
                  if (!Array.isArray(node.children)) node.children = [];
                  node.children.push(makeBlock(d.type));
                  return next;
                });
                dragDataRef.current = null;
              }}
            >
              <div style={innerStyle}>
                {b.children?.length ? (
                  <SortableList
                    ids={ids}
                    onReorder={(newIds) =>
                      setBlocks((prev) => {
                        const next = deepClone(prev);
                        const node = findBlockById(next, b.id)?.node;
                        if (!node) return prev;
                        node.children = reorderArray(
                          node.children || [],
                          newIds
                        );
                        return next;
                      })
                    }
                  >
                    {b.children.map((child) => (
                      <SortableItem
                        key={String(child.id)}
                        id={String(child.id)}
                      >
                        {(drag) => (
                          <div
                            ref={drag.setNodeRef}
                            style={{ ...ui.canvasItem, ...drag.style }}
                            onClick={(e) => {
                              e.stopPropagation();
                              select(child);
                            }}
                          >
                            <div
                              ref={drag.setActivatorNodeRef}
                              {...drag.attributes}
                              {...(drag.listeners || {})}
                              style={ui.handle}
                              title="Drag to reorder"
                            >
                              <span style={{ letterSpacing: 2 }}>⋮⋮</span>
                            </div>
                            {renderBlock(child)}
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </SortableList>
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>
                    Drop <strong>Columns</strong>, <strong>Card</strong>, or
                    primitives here.
                  </div>
                )}
              </div>
            </div>
          </BlockShell>
        );
      }

      /* ------------------------------- COLUMNS ------------------------------ */
      case "columns": {
        const colCount = Math.max(1, Number(b.props?.columns || 2));
        const gap = Number(b.props?.gap || 16);
        const cols = Array.from({ length: colCount }).map(
          (_, i) => b.children?.[i] || []
        );
        const bg = b.props?.background || "";
        const bgImage = b.props?.backgroundImage || "";
        const pad = toPadAny(b.props?.padding, [0, 0, 0, 0]);

        return (
          <BlockShell b={b} key={b.id}>
            <div
              style={{
                padding: `${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px`,
                background:
                  bg ||
                  (bgImage
                    ? `url(${bgImage}) center/cover no-repeat`
                    : "transparent"),
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                  gap,
                  minHeight: 40,
                }}
              >
                {cols.map((col, colIdx) => {
                  const ids = col.map((n) => String(n.id));
                  return (
                    <div
                      key={colIdx}
                      style={{
                        minHeight: 40,
                        border: "1px dashed #e5e7eb",
                        borderRadius: 8,
                        padding: 8,
                        background: "transparent",
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const d = dragDataRef.current;
                        if (!d) return;
                        setBlocks((prev) => {
                          const next = deepClone(prev);
                          const node = findBlockById(next, b.id)?.node;
                          if (!node) return prev;
                          if (!Array.isArray(node.children)) node.children = [];
                          if (!Array.isArray(node.children[colIdx]))
                            node.children[colIdx] = [];
                          node.children[colIdx].push(makeBlock(d.type));
                          return next;
                        });
                        dragDataRef.current = null;
                      }}
                    >
                      {col.length ? (
                        <SortableList
                          ids={ids}
                          onReorder={(newIds) =>
                            setBlocks((prev) => {
                              const next = deepClone(prev);
                              const node = findBlockById(next, b.id)?.node;
                              if (!node) return prev;
                              const curr = node.children?.[colIdx] || [];
                              node.children[colIdx] = reorderArray(
                                curr,
                                newIds
                              );
                              return next;
                            })
                          }
                        >
                          {col.map((inner) => (
                            <SortableItem
                              key={String(inner.id)}
                              id={String(inner.id)}
                            >
                              {(drag) => (
                                <div
                                  ref={drag.setNodeRef}
                                  style={{ ...ui.canvasItem, ...drag.style }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    select(inner);
                                  }}
                                >
                                  <div
                                    ref={drag.setActivatorNodeRef}
                                    {...drag.attributes}
                                    {...(drag.listeners || {})}
                                    style={ui.handle}
                                    title="Drag to reorder"
                                  >
                                    <span style={{ letterSpacing: 2 }}>⋮⋮</span>
                                  </div>
                                  {renderBlock(inner)}
                                </div>
                              )}
                            </SortableItem>
                          ))}
                        </SortableList>
                      ) : (
                        <div style={{ color: "#9ca3af", fontSize: 13 }}>
                          Drop primitives here.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </BlockShell>
        );
      }

      /* ------------------------------ PRIMITIVES ---------------------------- */
      case "heading": {
        const p = b.props || {};
        const Tag = p.tag || "h2";
        return (
          <div>
            <Tag
              style={{
                fontSize: p.fontSize ?? 28,
                fontWeight: p.fontWeight ?? 700,
                textAlign: p.textAlign || "left",
                margin: 0,
                color: p.color || "#0b1220",
                lineHeight: 1.2,
              }}
            >
              {p.text}
            </Tag>
          </div>
        );
      }
      case "text": {
        const p = b.props || {};
        return (
          <div
            style={{
              whiteSpace: "pre-wrap",
              textAlign: p.textAlign || "left",
              color: p.color || "#334155",
              fontSize: p.fontSize ?? 16,
            }}
          >
            {p.text}
          </div>
        );
      }
      case "image": {
        const p = b.props || {};
        return p.src ? (
          <img
            src={p.src}
            alt={p.alt || "image"}
            style={{
              width: p.width || "100%",
              display: "block",
              height: "auto",
              maxWidth: "100%",
            }}
          />
        ) : (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            No image selected
          </div>
        );
      }
      case "button": {
        const p = b.props || {};
        return (
          <div style={{ textAlign: p.textAlign || "left" }}>
            <a
              href={p.href || "#"}
              onClick={(e) => e.preventDefault()}
              style={{
                display: "inline-block",
                background: p.background || "#2563eb",
                color: p.color || "#fff",
                padding: "8px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {p.label || "Button"}
            </a>
          </div>
        );
      }

      case "spacer": {
        const h = Number(b.props?.height || 24);
        return <div style={{ height: h }} />;
      }
      case "divider": {
        const p = b.props || {};
        return (
          <hr
            style={{
              border: 0,
              borderTop: `${p.thickness || 1}px ${p.style || "solid"} ${
                p.color || "#E5E7EB"
              }`,
              width: p.width || "100%",
              margin: "8px 0",
            }}
          />
        );
      }
      case "card": {
        const p = b.props || {};
        const pad = toPadAny(p.padding, [16, 16, 16, 16]);
        return (
          <BlockShell b={b} key={b.id}>
            <div
              style={{
                background: p.background || "#fff",
                borderRadius: p.radius ?? 12,
                boxShadow: shadowStyle(p.shadow),
                padding: `${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px`,
                maxWidth: p.maxWidth || undefined,
                margin: p.maxWidth ? "0 auto" : undefined,
              }}
            >
              {(b.children || []).length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {(b.children || []).map((child) => (
                    <div key={child.id}>{renderBlock(child)}</div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>
                  Drop content here.
                </div>
              )}
            </div>
          </BlockShell>
        );
      }
      case "video": {
        const p = b.props || {};
        const src = (p.src || "").trim();
        if (!src)
          return (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>No video URL</div>
          );

        // ⭐ Solid preview wrapper (always has height)
        const Wrap = ({ children }) => (
          <div style={{ width: "100%" }}>
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                {children}
              </div>
            </div>
          </div>
        );

        const isYouTube = /youtu\.be|youtube\.com/.test(src);
        const isVimeo = /vimeo\.com/.test(src);
        if (p.provider === "youtube" || (p.provider === "auto" && isYouTube)) {
          const id =
            src.split("v=")[1]?.split("&")[0] || src.split("/").pop() || "";
          return (
            <Wrap>
              <iframe
                title={p.title || "YouTube video"}
                src={`https://www.youtube.com/embed/${id}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Wrap>
          );
        }
        if (p.provider === "vimeo" || (p.provider === "auto" && isVimeo)) {
          const id = src.split("/").pop();
          return (
            <Wrap>
              <iframe
                title={p.title || "Vimeo video"}
                src={`https://player.vimeo.com/video/${id}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </Wrap>
          );
        }
        return (
          <Wrap>
            <video controls style={{ width: "100%", height: "100%" }}>
              <source src={src} />
            </video>
          </Wrap>
        );
      }
      case "embed": {
        const html = b.props?.html || "";
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
      }
      case "hero": {
        const p = b.props || {};
        const pad = toPadAny(p.padding, [80, 24, 80, 24]);

        const backgroundImage =
          p.overlay && (p.backgroundImage || p.overlay)
            ? `linear-gradient(${p.overlay}, ${p.overlay})${
                p.backgroundImage ? `, url(${p.backgroundImage})` : ""
              }`
            : p.backgroundImage
            ? `url(${p.backgroundImage})`
            : undefined;

        return (
          <div
            style={{
              position: "relative",
              padding: `${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px`,
              background: p.background || "transparent",
              backgroundImage,
              backgroundSize: p.backgroundImage ? "cover" : undefined,
              backgroundPosition: p.backgroundImage ? "center" : undefined,
              backgroundRepeat: p.backgroundImage ? "no-repeat" : undefined,
              left: "50%",
              right: "50%",
              marginLeft: "-50vw",
              marginRight: "-50vw",
              width: "100vw",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  textAlign: p.align || "center",
                  color: p.textColor || "#fff",
                  maxWidth: 980,
                  margin: "0 auto",
                }}
              >
                <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.2 }}>
                  {p.heading}
                </h1>
                <p style={{ margin: "16px 0 24px", fontSize: 18 }}>{p.text}</p>
                {p.buttonLabel ? (
                  <a
                    href={p.buttonHref || "#"}
                    onClick={(e) => e.preventDefault()}
                    style={{
                      display: "inline-block",
                      background: "#2563eb",
                      color: "#fff",
                      padding: "10px 16px",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    {p.buttonLabel}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        );
      }
      default:
        return <div>Unknown block: {b.type}</div>;
    }
  };

  const updateSelectedProps = useCallback(
    (patch) => {
      if (!selectedId) return;
      setBlocks((prev) => {
        const next = deepClone(prev);
        const found = findBlockById(next, selectedId);
        if (!found) return prev;
        found.node.props = { ...(found.node.props || {}), ...patch };
        return next;
      });
    },
    [selectedId]
  );

  /* -------------------------------- Inspector ----------------------------- */
  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={ui.label}>{label}</div>
      {children}
    </div>
  );

  const Inspector = () => {
    if (!selectedNode) {
      return (
        <div style={{ ...ui.panel, color: "#9ca3af" }}>
          Select a block to edit its fields.
        </div>
      );
    }
    const typeTitle =
      selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1);

    /* ------------------------------- SECTION ------------------------------ */
    if (selectedNode.type === "section") {
      const p = selectedNode.props || {};
      const pad = toPadAny(p.padding, [24, 24, 24, 24]);
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>

          <Field label="Padding (px)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <LiveNumberInput
                  key={i}
                  value={pad[i]}
                  min={0}
                  beginEdit={beginEdit}
                  endEdit={endEditSoftCommit}
                  onCommit={(v) => {
                    const next = [...pad];
                    next[i] = Number.isFinite(v) ? v : 0;
                    updateSelectedProps({ padding: next });
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Background color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
              <LiveTextInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
                placeholder="#111827 or rgba(...)"
              />
            </div>
          </Field>

          <Field label="Background image URL">
            <div style={{ display: "flex", gap: 8 }}>
              <LiveTextInput
                value={p.backgroundImage || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ backgroundImage: v })}
                placeholder="https://…"
              />
              <UploadButton
                onUploaded={(url) =>
                  updateSelectedProps({ backgroundImage: url })
                }
              >
                Upload
              </UploadButton>
            </div>
          </Field>

          <Field label="Overlay (rgba)">
            <LiveTextInput
              value={p.overlay || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ overlay: v })}
              placeholder="e.g. rgba(0,0,0,.35)"
            />
          </Field>

          <Field label="Text align">
            <LiveSelect
              value={p.textAlign || "left"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ textAlign: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Field label="Width (CSS)">
              <LiveTextInput
                value={p.width || "100%"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ width: v })}
                placeholder="100% / 1200px"
              />
            </Field>
            <Field label="Max width (CSS)">
              <LiveTextInput
                value={p.maxWidth || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ maxWidth: v })}
                placeholder="e.g. 1200px"
              />
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px",
              gap: 8,
            }}
          >
            <Field label="Min height">
              <LiveNumberInput
                value={Number(p.minHeightValue) || 0}
                min={0}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ minHeightValue: v })}
              />
            </Field>
            <Field label="Unit">
              <LiveSelect
                value={p.minHeightUnit || "px"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ minHeightUnit: v })}
                options={[
                  { value: "px", label: "px" },
                  { value: "vh", label: "vh" },
                  { value: "em", label: "em" },
                ]}
              />
            </Field>
          </div>

          <Field label="Border radius (px)">
            <LiveNumberInput
              value={Number(p.borderRadius) || 0}
              min={0}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ borderRadius: v })}
            />
          </Field>

          <Field label="Background position">
            <LiveTextInput
              value={p.backgroundPosition || "center"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ backgroundPosition: v })}
              placeholder="e.g. center / top / 50% 50%"
            />
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Field label="Background size">
              <LiveSelect
                value={p.backgroundSize || "cover"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ backgroundSize: v })}
                options={[
                  { value: "auto", label: "auto" },
                  { value: "cover", label: "cover" },
                  { value: "contain", label: "contain" },
                ]}
              />
            </Field>
            <Field label="Background repeat">
              <LiveSelect
                value={p.backgroundRepeat || "no-repeat"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ backgroundRepeat: v })}
                options={[
                  { value: "no-repeat", label: "no-repeat" },
                  { value: "repeat", label: "repeat" },
                  { value: "repeat-x", label: "repeat-x" },
                  { value: "repeat-y", label: "repeat-y" },
                ]}
              />
            </Field>
          </div>

          {/* NEW: content alignment */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            <Field label="Content H align">
              <LiveSelect
                value={p.contentHAlign || "flex-start"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ contentHAlign: v })}
                options={[
                  { value: "flex-start", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "flex-end", label: "Right" },
                ]}
              />
            </Field>
            <Field label="Content V align">
              <LiveSelect
                value={p.contentVAlign || "flex-start"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ contentVAlign: v })}
                options={[
                  { value: "flex-start", label: "Top" },
                  { value: "center", label: "Center" },
                  { value: "flex-end", label: "Bottom" },
                ]}
              />
            </Field>
            <Field label="Content gap (px)">
              <LiveNumberInput
                value={Number(p.contentGap ?? 10)}
                min={0}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) =>
                  updateSelectedProps({ contentGap: Math.max(0, Number(v)) })
                }
              />
            </Field>
          </div>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    /* ------------------------------- COLUMNS ------------------------------ */
    if (selectedNode.type === "columns") {
      const p = selectedNode.props || {};
      const pad = toPadAny(p.padding, [0, 0, 0, 0]);
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>

          <Field label="Columns">
            <LiveNumberInput
              value={p.columns || 2}
              min={1}
              max={6}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) =>
                updateSelectedProps({ columns: Math.max(1, Math.min(6, v)) })
              }
            />
          </Field>

          <Field label="Gap (px)">
            <LiveNumberInput
              value={p.gap || 16}
              min={0}
              max={96}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ gap: Math.max(0, v) })}
            />
          </Field>

          <Field label="Padding (px)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <LiveNumberInput
                  key={i}
                  value={pad[i]}
                  min={0}
                  beginEdit={beginEdit}
                  endEdit={endEditSoftCommit}
                  onCommit={(v) => {
                    const next = [...pad];
                    next[i] = Number.isFinite(v) ? v : 0;
                    updateSelectedProps({ padding: next });
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Background color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
              <LiveTextInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
                placeholder="#f8fafc"
              />
            </div>
          </Field>

          <Field label="Background image URL">
            <div style={{ display: "flex", gap: 8 }}>
              <LiveTextInput
                value={p.backgroundImage || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ backgroundImage: v })}
                placeholder="https://…"
              />
              <UploadButton
                onUploaded={(url) =>
                  updateSelectedProps({ backgroundImage: url })
                }
              >
                Upload
              </UploadButton>
            </div>
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    /* ------------------------------- HEADING ------------------------------ */
    if (selectedNode.type === "heading") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>

          <Field label="Text">
            <LiveTextInput
              value={p.text || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ text: v })}
            />
          </Field>

          <Field label="Tag">
            <LiveSelect
              value={p.tag || "h2"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ tag: v })}
              options={[
                { value: "h1", label: "h1" },
                { value: "h2", label: "h2" },
                { value: "h3", label: "h3" },
                { value: "h4", label: "h4" },
              ]}
            />
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Field label="Size (px)">
              <LiveNumberInput
                value={p.fontSize ?? 28}
                min={10}
                max={120}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ fontSize: v })}
              />
            </Field>
            <Field label="Weight">
              <LiveNumberInput
                value={p.fontWeight ?? 700}
                min={100}
                max={900}
                step={100}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ fontWeight: v })}
              />
            </Field>
          </div>

          <Field label="Align">
            <LiveSelect
              value={p.textAlign || "left"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ textAlign: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Text color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.color || "#0b1220"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
              <LiveTextInput
                value={p.color || "#0b1220"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
            </div>
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    /* --------------------------------- TEXT ------------------------------- */
    if (selectedNode.type === "text") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>

          <Field label="Text">
            <LiveTextArea
              value={p.text || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ text: v })}
            />
          </Field>

          <Field label="Align">
            <LiveSelect
              value={p.textAlign || "left"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ textAlign: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Font size (px)">
            <LiveNumberInput
              value={p.fontSize ?? 16}
              min={10}
              max={64}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ fontSize: v })}
            />
          </Field>

          <Field label="Text color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.color || "#334155"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
              <LiveTextInput
                value={p.color || "#334155"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
            </div>
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    /* -------------------------------- IMAGE ------------------------------- */
    if (selectedNode.type === "image") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>

          <Field label="Image URL">
            <div style={{ display: "flex", gap: 8 }}>
              <LiveTextInput
                value={p.src || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ src: v })}
              />
              <UploadButton
                onUploaded={(url) => updateSelectedProps({ src: url })}
              />
            </div>
          </Field>

          <Field label="Alt text">
            <LiveTextInput
              value={p.alt || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ alt: v })}
            />
          </Field>

          <Field label="Width (e.g. 100% / 320px)">
            <LiveTextInput
              value={p.width || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ width: v })}
            />
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    /* --------------------------- NEW BLOCKS PANELS ------------------------ */
    if (selectedNode.type === "spacer") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Spacer</div>
          <Field label="Height (px)">
            <LiveNumberInput
              value={p.height ?? 24}
              min={0}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ height: v })}
            />
          </Field>
          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    if (selectedNode.type === "divider") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Divider</div>
          <Field label="Thickness (px)">
            <LiveNumberInput
              value={p.thickness ?? 1}
              min={1}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ thickness: v })}
            />
          </Field>
          <Field label="Color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <LiveColorInput
                value={p.color || "#E5E7EB"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
              <LiveTextInput
                value={p.color || "#E5E7EB"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ color: v })}
              />
            </div>
          </Field>
          <Field label="Style">
            <LiveSelect
              value={p.style || "solid"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ style: v })}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
              ]}
            />
          </Field>
          <Field label="Width (e.g. 100% / 320px)">
            <LiveTextInput
              value={p.width || "100%"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ width: v })}
            />
          </Field>
          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    if (selectedNode.type === "card") {
      const p = selectedNode.props || {};
      const pad = toPadAny(p.padding, [16, 16, 16, 16]);
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Card</div>

          <Field label="Padding (px)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <LiveNumberInput
                  key={i}
                  value={pad[i]}
                  min={0}
                  beginEdit={beginEdit}
                  endEdit={endEditSoftCommit}
                  onCommit={(v) => {
                    const next = [...pad];
                    next[i] = Number.isFinite(v) ? v : 0;
                    updateSelectedProps({ padding: next });
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Background">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.background || "#ffffff"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
              <LiveTextInput
                value={p.background || "#ffffff"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
            </div>
          </Field>

          <Field label="Radius (px)">
            <LiveNumberInput
              value={p.radius ?? 12}
              min={0}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ radius: v })}
            />
          </Field>

          <Field label="Shadow">
            <LiveSelect
              value={p.shadow || "sm"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ shadow: v })}
              options={[
                { value: "none", label: "None" },
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
            />
          </Field>

          <Field label="Max width (e.g. 800px)">
            <LiveTextInput
              value={p.maxWidth || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ maxWidth: v })}
            />
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    if (selectedNode.type === "video") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Video</div>
          <Field label="Source URL">
            <LiveTextInput
              value={p.src || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ src: v })}
            />
          </Field>
          <Field label="Provider">
            <LiveSelect
              value={p.provider || "auto"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ provider: v })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "youtube", label: "YouTube" },
                { value: "vimeo", label: "Vimeo" },
                { value: "file", label: "Direct file" },
              ]}
            />
          </Field>
          <Field label="Title (accessibility)">
            <LiveTextInput
              value={p.title || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ title: v })}
            />
          </Field>
          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    if (selectedNode.type === "embed") {
      const p = selectedNode.props || {};
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Embed (HTML)</div>
          <Field label="HTML">
            <LiveTextArea
              rows={8}
              value={p.html || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ html: v })}
            />
          </Field>
          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    if (selectedNode.type === "hero") {
      const p = selectedNode.props || {};
      const pad = toPadAny(p.padding, [80, 24, 80, 24]);
      return (
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Hero</div>

          <Field label="Padding (px)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <LiveNumberInput
                  key={i}
                  value={pad[i]}
                  min={0}
                  beginEdit={beginEdit}
                  endEdit={endEditSoftCommit}
                  onCommit={(v) => {
                    const next = [...pad];
                    next[i] = Number.isFinite(v) ? v : 0;
                    updateSelectedProps({ padding: next });
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Background color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
              <LiveTextInput
                value={p.background || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ background: v })}
              />
            </div>
          </Field>

          <Field label="Background image URL">
            <div style={{ display: "flex", gap: 8 }}>
              <LiveTextInput
                value={p.backgroundImage || ""}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ backgroundImage: v })}
                placeholder="https://…"
              />
              <UploadButton
                onUploaded={(url) =>
                  updateSelectedProps({ backgroundImage: url })
                }
              >
                Upload
              </UploadButton>
            </div>
          </Field>

          <Field label="Overlay (rgba)">
            <LiveTextInput
              value={p.overlay || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ overlay: v })}
            />
          </Field>

          <Field label="Align">
            <LiveSelect
              value={p.align || "center"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ align: v })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>

          <Field label="Heading">
            <LiveTextInput
              value={p.heading || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ heading: v })}
            />
          </Field>

          <Field label="Text">
            <LiveTextArea
              value={p.text || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ text: v })}
            />
          </Field>

          <Field label="Text color">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LiveColorInput
                value={p.textColor || "#ffffff"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ textColor: v })}
              />
              <LiveTextInput
                value={p.textColor || "#ffffff"}
                beginEdit={beginEdit}
                endEdit={endEditSoftCommit}
                onCommit={(v) => updateSelectedProps({ textColor: v })}
              />
            </div>
          </Field>

          <Field label="Button label">
            <LiveTextInput
              value={p.buttonLabel || ""}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ buttonLabel: v })}
            />
          </Field>
          <Field label="Button link">
            <LiveTextInput
              value={p.buttonHref || "#"}
              beginEdit={beginEdit}
              endEdit={endEditSoftCommit}
              onCommit={(v) => updateSelectedProps({ buttonHref: v })}
            />
          </Field>

          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      );
    }

    // Fallback
    return (
      <div style={ui.panel}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{typeTitle}</div>
        <div>Nothing to edit for this block.</div>
        <div style={{ marginTop: 8 }}>
          <button style={ui.btnDanger} onClick={deleteSelected}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  /* --------------------------------- Layout -------------------------------- */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr 340px",
        gap: 16,
      }}
    >
      {/* Palette */}
      <div style={ui.col}>
        <div style={ui.panel}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Blocks</div>
          <div style={{ display: "grid", gap: 8 }}>
            {palette.map((p) => (
              <button
                key={p.type}
                draggable
                onDragStart={(e) => handlePaletteDragStart(e, p.type)}
                onClick={() => addToRoot(p.type)}
                style={{
                  ...ui.btn,
                  display: "block",
                  textAlign: "left",
                  padding: "10px 12px",
                }}
                title="Drag to canvas or click to add to the bottom"
              >
                {p.title}
              </button>
            ))}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>
            Tip: Drag from here into the canvas/containers. Drag cards to
            reorder or move between containers.
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{ ...ui.col, minHeight: 420 }}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div
          style={{ ...ui.panel, minHeight: 420 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {blocks.length === 0 ? (
            <div style={{ color: "#9ca3af" }}>
              No blocks yet. Drop a <strong>Section</strong> here.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {blocks.map((b) => (
                <div key={b.id}>{renderBlock(b)}</div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button style={ui.btnDanger} onClick={clearCanvas}>
              Clear canvas
            </button>
            {selectedId && (
              <button style={ui.btnDanger} onClick={deleteSelected}>
                Delete selected
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inspector */}
      <div style={ui.col}>
        <Inspector />
      </div>
    </div>
  );
}
