import React, { useMemo, useState, useEffect, useCallback } from "react";

/* ------------------------------ utilities -------------------------------- */

const uid = () => "id_" + Math.random().toString(36).slice(2, 10);
const isPrimitive = (t) => ["heading", "text", "image", "button"].includes(t);

const createNode = (type) => {
  switch (type) {
    case "section":
      return {
        id: uid(),
        type: "section",
        style: {
          padding: { t: 24, r: 24, b: 24, l: 24 },
          background: "#ffffff",
          bgImage: "",
          textAlign: "left",
        },
        children: [],
      };
    case "columns":
      return {
        id: uid(),
        type: "columns",
        gap: 16,
        count: 2,
        cols: [
          { id: uid(), type: "column", children: [] },
          { id: uid(), type: "column", children: [] },
        ],
      };
    case "heading":
      return {
        id: uid(),
        type: "heading",
        text: "Heading",
        tag: "h2",
        style: { color: "#0b1220", size: 28, weight: 800, align: "left" },
      };
    case "text":
      return {
        id: uid(),
        type: "text",
        html: "<p>Edit me</p>",
        style: { color: "#334155", size: 16, line: 1.6, align: "left" },
      };
    case "image":
      return {
        id: uid(),
        type: "image",
        url: "",
        alt: "",
        width: 640,
        radius: 8,
        align: "center",
      };
    case "button":
      return {
        id: uid(),
        type: "button",
        label: "Click",
        href: "#",
        size: "md",
        align: "left",
        radius: 10,
        bg: "#2563eb",
        color: "#ffffff",
      };
    default:
      return { id: uid(), type };
  }
};

const emptyDoc = () => ({ root: { id: uid(), type: "page", children: [] } });
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ----- find helpers (work with page / section / columns / column trees) --- */

function findById(node, id, parent = null) {
  if (!node) return null;
  if (node.id === id) return { node, parent };

  if (node.type === "columns" && Array.isArray(node.cols)) {
    for (const col of node.cols) {
      if (col.id === id) return { node: col, parent: node };
      if (Array.isArray(col.children)) {
        for (const ch of col.children) {
          const hit = findById(ch, id, col);
          if (hit) return hit;
        }
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const ch of node.children) {
      const hit = findById(ch, id, node);
      if (hit) return hit;
    }
  }
  return null;
}

function findContainerAndIndex(node, id) {
  if (Array.isArray(node.children)) {
    for (let i = 0; i < node.children.length; i++) {
      const ch = node.children[i];
      if (ch.id === id) {
        return { parentId: node.id, key: "children", colIndex: -1, index: i };
      }
      const deeper = findContainerAndIndex(ch, id);
      if (deeper) return deeper;
    }
  }

  if (node.type === "columns" && Array.isArray(node.cols)) {
    for (let ci = 0; ci < node.cols.length; ci++) {
      const col = node.cols[ci];
      if (Array.isArray(col.children)) {
        for (let i = 0; i < col.children.length; i++) {
          const ch = col.children[i];
          if (ch.id === id) {
            return {
              parentId: node.id,
              key: "children",
              colIndex: ci,
              index: i,
            };
          }
          const deeper = findContainerAndIndex(ch, id);
          if (deeper) return deeper;
        }
      }
    }
  }
  return null;
}

function replaceNode(node, id, next) {
  if (node.id === id) return next;

  if (node.type === "columns" && Array.isArray(node.cols)) {
    const newCols = node.cols.map((col) => {
      if (col.id === id) return next;
      const newChildren = Array.isArray(col.children)
        ? col.children.map((c) => replaceNode(c, id, next))
        : [];
      return { ...col, children: newChildren };
    });
    return { ...node, cols: newCols };
  }

  if (Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map((c) => replaceNode(c, id, next)),
    };
  }
  return node;
}

function removeNode(node, id) {
  if (node.type === "columns" && Array.isArray(node.cols)) {
    const newCols = node.cols.map((col) => {
      const newChildren = Array.isArray(col.children)
        ? col.children
            .map((c) => removeNode(c, id))
            .filter((c) => c && c.id !== id)
        : [];
      return { ...col, children: newChildren };
    });
    return { ...node, cols: newCols };
  }

  if (Array.isArray(node.children)) {
    const nextChildren = node.children
      .map((c) => removeNode(c, id))
      .filter((c) => c && c.id !== id);
    return { ...node, children: nextChildren };
  }

  return node;
}

function insertChild(root, parentId, key, colIndex, index, child) {
  const info = findById(root, parentId);
  if (!info) return root;

  if (info.node.type === "columns" && colIndex >= 0) {
    const cols = info.node.cols.map((c, i) => {
      if (i !== colIndex) return c;
      const arr = Array.isArray(c.children) ? c.children.slice() : [];
      const at = Math.max(0, Math.min(index, arr.length));
      arr.splice(at, 0, child);
      return { ...c, children: arr };
    });
    const next = { ...info.node, cols };
    return replaceNode(root, info.node.id, next);
  }

  const arr = Array.isArray(info.node.children)
    ? info.node.children.slice()
    : [];
  const at = Math.max(0, Math.min(index, arr.length));
  arr.splice(at, 0, child);
  const next = { ...info.node, children: arr };
  return replaceNode(root, info.node.id, next);
}

/* -------------------------- small UI primitives --------------------------- */

const Pill = ({ children }) => (
  <span
    style={{
      fontSize: 12,
      color: "#64748b",
      border: "1px solid #e5e7eb",
      borderRadius: 999,
      padding: "2px 8px",
      background: "#fff",
    }}
  >
    {children}
  </span>
);

function Frame({ tag, selected, onSelect, draggableId, children, style }) {
  const onHeaderDragStart = (e) => {
    if (!draggableId) return;
    e.dataTransfer.setData("text/plain", `move:${draggableId}`);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      style={{
        border: selected ? "2px solid #2563eb" : "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 8,
        background: "#fff",
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={onHeaderDragStart}
        onClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onSelect && onSelect();
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          fontSize: 14,
          color: selected ? "#2563eb" : "#0b1220",
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
          cursor: "grab",
          userSelect: "none",
        }}
        title="Drag to move • Click to select"
      >
        <Pill>{tag}</Pill>
        <span style={{ marginRight: 4 }}>
          {tag[0].toUpperCase() + tag.slice(1)}
        </span>
      </div>

      <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Lane({ active, onDrop }) {
  const [over, setOver] = useState(false);
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!active) return;
    setOver(true);
  };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => {
    if (!active) return;
    setOver(false);
    onDrop(e);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        height: active ? 10 : 0,
        margin: active ? "6px 0" : "0px",
        transition: "all .12s ease",
        borderRadius: 6,
        border: active ? `1px dashed ${over ? "#60a5fa" : "#cbd5e1"}` : "none",
        background: active ? (over ? "#eff6ff" : "#f8fafc") : "transparent",
        overflow: "hidden",
      }}
    />
  );
}

function PaletteItem({ type, label, onStartDrag, onEndDrag }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
        onStartDrag && onStartDrag();
      }}
      onDragEnd={onEndDrag}
      style={{
        width: "100%",
        height: 40,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#fff",
        fontWeight: 700,
        cursor: "grab",
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------ node views -------------------------------- */

const HeadingView = ({ node }) => {
  const Tag = node.tag || "h2";
  const s = node.style || {};
  return (
    <Tag
      style={{
        color: s.color,
        fontSize: s.size,
        fontWeight: s.weight,
        textAlign: s.align,
        margin: 0,
      }}
    >
      {node.text || ""}
    </Tag>
  );
};

const TextView = ({ node }) => {
  const s = node.style || {};
  return (
    <div
      style={{
        color: s.color,
        fontSize: s.size,
        lineHeight: s.line,
        textAlign: s.align,
      }}
      dangerouslySetInnerHTML={{ __html: node.html || "" }}
    />
  );
};

const ImageView = ({ node }) => {
  const wrapAlign =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  if (!node.url) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "left" }}>
        No image selected
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: wrapAlign }}>
      <img
        src={node.url}
        alt={node.alt || ""}
        style={{
          width: node.width || 640,
          borderRadius: node.radius || 0,
          maxWidth: "100%",
        }}
      />
    </div>
  );
};

const ButtonView = ({ node }) => {
  const justify =
    node.align === "center"
      ? "center"
      : node.align === "right"
      ? "flex-end"
      : "flex-start";
  const pad =
    node.size === "sm"
      ? "8px 12px"
      : node.size === "lg"
      ? "14px 18px"
      : "10px 14px";
  return (
    <div style={{ display: "flex", justifyContent: justify }}>
      <a
        href={node.href || "#"}
        style={{
          display: "inline-block",
          padding: pad,
          borderRadius: node.radius || 10,
          background: node.bg || "#2563eb",
          color: node.color || "#fff",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        {node.label || "Button"}
      </a>
    </div>
  );
};

/* --------------------------- NodeRenderer w/ lanes ------------------------- */

function NodeRenderer({
  node,
  selectedId,
  onSelect,
  onDropInto,
  dragActive,
  setDragActive,
}) {
  switch (node.type) {
    case "section": {
      const selected = node.id === selectedId;
      const kids = Array.isArray(node.children) ? node.children : [];
      const startDragMove = (e) => {
        e.dataTransfer.setData("text/plain", `move:${node.id}`);
        e.dataTransfer.effectAllowed = "move";
        setDragActive(true);
      };
      const s = node.style || {};
      const pad = s.padding || {};
      const padding = `${pad.t ?? 0}px ${pad.r ?? 0}px ${pad.b ?? 0}px ${
        pad.l ?? 0
      }px`;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <div
            draggable
            onDragStart={startDragMove}
            onDragEnd={() => setDragActive(false)}
          >
            <Frame
              tag="section"
              draggableId={node.id}
              selected={selected}
              onSelect={() => onSelect(node.id)}
              style={{
                margin: "8px 0",
                background: s.background || "#fff",
                backgroundImage: s.bgImage ? `url(${s.bgImage})` : undefined,
                backgroundSize: s.bgImage ? "cover" : undefined,
                backgroundRepeat: "no-repeat",
                textAlign: s.textAlign || "left",
                padding,
              }}
            >
              <Lane
                active={dragActive}
                onDrop={(e) => {
                  const payload = e.dataTransfer.getData("text/plain");
                  if (!payload) return;
                  if (payload.startsWith("move:")) {
                    const id = payload.slice(5);
                    onDropInto({
                      moveId: id,
                      parentId: node.id,
                      key: "children",
                      index: 0,
                    });
                    return;
                  }
                  const type = payload;
                  if (type === "section") return;
                  if (type !== "columns" && !isPrimitive(type)) return;
                  onDropInto({
                    parentId: node.id,
                    key: "children",
                    index: 0,
                    child: createNode(type),
                  });
                }}
              />
              {kids.map((c, i) => (
                <React.Fragment key={c.id}>
                  <NodeRenderer
                    node={c}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDropInto={onDropInto}
                    dragActive={dragActive}
                    setDragActive={setDragActive}
                  />
                  <Lane
                    active={dragActive}
                    onDrop={(e) => {
                      const payload = e.dataTransfer.getData("text/plain");
                      if (!payload) return;
                      const index = i + 1;
                      if (payload.startsWith("move:")) {
                        const id = payload.slice(5);
                        onDropInto({
                          moveId: id,
                          parentId: node.id,
                          key: "children",
                          index,
                        });
                        return;
                      }
                      const type = payload;
                      if (type === "section") return;
                      if (type !== "columns" && !isPrimitive(type)) return;
                      onDropInto({
                        parentId: node.id,
                        key: "children",
                        index,
                        child: createNode(type),
                      });
                    }}
                  />
                </React.Fragment>
              ))}
            </Frame>
          </div>
        </div>
      );
    }

    case "columns": {
      const selected = node.id === selectedId;
      const cols = Array.isArray(node.cols) ? node.cols : [];
      const gap = Number(node.gap ?? 16);
      const startDragMove = (e) => {
        e.dataTransfer.setData("text/plain", `move:${node.id}`);
        e.dataTransfer.effectAllowed = "move";
        setDragActive(true);
      };
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <div
            draggable
            onDragStart={startDragMove}
            onDragEnd={() => setDragActive(false)}
          >
            <Frame
              tag="columns"
              draggableId={node.id}
              selected={selected}
              onSelect={() => onSelect(node.id)}
              style={{ margin: "8px 0" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.max(
                    cols.length || 2,
                    1
                  )}, 1fr)`,
                  gap,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {cols.map((col, idx) => {
                  const kids = Array.isArray(col.children) ? col.children : [];
                  return (
                    <div key={col.id}>
                      <Lane
                        active={dragActive}
                        onDrop={(e) => {
                          const payload = e.dataTransfer.getData("text/plain");
                          if (!payload) return;
                          if (payload.startsWith("move:")) {
                            const id = payload.slice(5);
                            onDropInto({
                              moveId: id,
                              parentId: node.id,
                              key: "children",
                              colIndex: idx,
                              index: 0,
                            });
                            return;
                          }
                          const type = payload;
                          if (!isPrimitive(type)) return;
                          onDropInto({
                            parentId: node.id,
                            key: "children",
                            colIndex: idx,
                            index: 0,
                            child: createNode(type),
                          });
                        }}
                      />
                      {kids.map((c, i) => (
                        <React.Fragment key={c.id}>
                          <NodeRenderer
                            node={c}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onDropInto={onDropInto}
                            dragActive={dragActive}
                            setDragActive={setDragActive}
                          />
                          <Lane
                            active={dragActive}
                            onDrop={(e) => {
                              const payload =
                                e.dataTransfer.getData("text/plain");
                              if (!payload) return;
                              const index = i + 1;
                              if (payload.startsWith("move:")) {
                                const id = payload.slice(5);
                                onDropInto({
                                  moveId: id,
                                  parentId: node.id,
                                  key: "children",
                                  colIndex: idx,
                                  index,
                                });
                                return;
                              }
                              const type = payload;
                              if (!isPrimitive(type)) return;
                              onDropInto({
                                parentId: node.id,
                                key: "children",
                                colIndex: idx,
                                index,
                                child: createNode(type),
                              });
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Frame>
          </div>
        </div>
      );
    }

    case "heading":
    case "text":
    case "image":
    case "button": {
      const selected = node.id === selectedId;
      const tag = node.type;
      const startDragMove = (e) => {
        e.dataTransfer.setData("text/plain", `move:${node.id}`);
        e.dataTransfer.effectAllowed = "move";
        setDragActive(true);
      };
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <div
            draggable
            onDragStart={startDragMove}
            onDragEnd={() => setDragActive(false)}
          >
            <Frame
              tag={tag}
              draggableId={node.id}
              selected={selected}
              onSelect={() => onSelect(node.id)}
              style={{ margin: "8px 0" }}
            >
              {tag === "heading" && <HeadingView node={node} />}
              {tag === "text" && <TextView node={node} />}
              {tag === "image" && <ImageView node={node} />}
              {tag === "button" && <ButtonView node={node} />}
            </Frame>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/* ---------------------------------- Inputs -------------------------------- */

const Row = ({ children, gap = 10 }) => (
  <div style={{ display: "flex", gap, alignItems: "center" }}>{children}</div>
);
const Label = ({ children }) => (
  <label
    style={{
      fontSize: 12,
      color: "#6b7280",
      display: "block",
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);
const Input = (p) => (
  <input
    {...p}
    style={{
      width: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "8px 10px",
      ...(p.style || {}),
    }}
  />
);
const TextArea = (p) => (
  <textarea
    {...p}
    style={{
      width: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "8px 10px",
      fontFamily: "inherit",
      ...(p.style || {}),
    }}
  />
);
const Select = ({ value, onChange, options }) => (
  <select
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "8px 10px",
    }}
  >
    {options.map(([v, label]) => (
      <option key={String(v)} value={v}>
        {label}
      </option>
    ))}
  </select>
);

/* ------------------------------ Inspector --------------------------------- */

function Inspector({ node, onChange }) {
  if (!node) {
    return (
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 12,
          background: "#fff",
          color: "#64748b",
        }}
      >
        Select a block to edit its fields.
      </div>
    );
  }

  const set = (k, v) => onChange({ ...node, [k]: v });

  const setStyle = (patch) => {
    const s = { ...(node.style || {}), ...patch };
    onChange({ ...node, style: s });
  };

  const sectionBody =
    node.type === "section" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Section</div>
        <Label>Padding (px)</Label>
        <Row>
          <Input
            type="number"
            value={node.style?.padding?.t ?? 0}
            onChange={(e) =>
              setStyle({
                padding: {
                  ...(node.style?.padding || {}),
                  t: Number(e.target.value),
                },
              })
            }
            placeholder="Top"
          />
          <Input
            type="number"
            value={node.style?.padding?.r ?? 0}
            onChange={(e) =>
              setStyle({
                padding: {
                  ...(node.style?.padding || {}),
                  r: Number(e.target.value),
                },
              })
            }
            placeholder="Right"
          />
          <Input
            type="number"
            value={node.style?.padding?.b ?? 0}
            onChange={(e) =>
              setStyle({
                padding: {
                  ...(node.style?.padding || {}),
                  b: Number(e.target.value),
                },
              })
            }
            placeholder="Bottom"
          />
          <Input
            type="number"
            value={node.style?.padding?.l ?? 0}
            onChange={(e) =>
              setStyle({
                padding: {
                  ...(node.style?.padding || {}),
                  l: Number(e.target.value),
                },
              })
            }
            placeholder="Left"
          />
        </Row>
        <Row>
          <div style={{ flex: 1 }}>
            <Label>Background</Label>
            <Input
              type="color"
              value={node.style?.background || "#ffffff"}
              onChange={(e) => setStyle({ background: e.target.value })}
            />
          </div>
          <div style={{ flex: 2 }}>
            <Label>Background image URL</Label>
            <Input
              value={node.style?.bgImage || ""}
              onChange={(e) => setStyle({ bgImage: e.target.value })}
            />
          </div>
        </Row>
        <div style={{ width: 160 }}>
          <Label>Text align</Label>
          <Select
            value={node.style?.textAlign || "left"}
            onChange={(v) => setStyle({ textAlign: v })}
            options={[
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
            ]}
          />
        </div>
      </>
    ) : null;

  const columnsBody =
    node.type === "columns" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Columns</div>
        <Row>
          <div style={{ width: 120 }}>
            <Label>Count</Label>
            <Select
              value={node.count ?? node.cols?.length ?? 2}
              onChange={(v) => {
                const nextCount = Number(v);
                const existing = node.cols || [];
                let cols = existing.slice(0, nextCount);
                while (cols.length < nextCount) {
                  cols.push({ id: uid(), type: "column", children: [] });
                }
                onChange({ ...node, count: nextCount, cols });
              }}
              options={[
                [2, "2"],
                [3, "3"],
                [4, "4"],
                [5, "5"],
                [6, "6"],
              ]}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Gap (px)</Label>
            <Input
              type="number"
              value={node.gap ?? 16}
              onChange={(e) =>
                onChange({ ...node, gap: Number(e.target.value) })
              }
            />
          </div>
        </Row>
      </>
    ) : null;

  const headingBody =
    node.type === "heading" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Heading</div>
        <Label>Text</Label>
        <Input
          value={node.text || ""}
          onChange={(e) => set("text", e.target.value)}
        />
        <Row>
          <div style={{ width: 100 }}>
            <Label>Tag</Label>
            <Select
              value={node.tag || "h2"}
              onChange={(v) => set("tag", v)}
              options={[
                ["h1", "H1"],
                ["h2", "H2"],
                ["h3", "H3"],
                ["h4", "H4"],
                ["h5", "H5"],
                ["h6", "H6"],
              ]}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Color</Label>
            <Input
              type="color"
              value={node.style?.color || "#0b1220"}
              onChange={(e) => setStyle({ color: e.target.value })}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Size (px)</Label>
            <Input
              type="number"
              value={node.style?.size ?? 28}
              onChange={(e) => setStyle({ size: Number(e.target.value) })}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Weight</Label>
            <Input
              type="number"
              value={node.style?.weight ?? 800}
              onChange={(e) => setStyle({ weight: Number(e.target.value) })}
            />
          </div>
          <div style={{ width: 140 }}>
            <Label>Align</Label>
            <Select
              value={node.style?.align || "left"}
              onChange={(v) => setStyle({ align: v })}
              options={[
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ]}
            />
          </div>
        </Row>
      </>
    ) : null;

  const textBody =
    node.type === "text" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Rich text</div>
        <Label>HTML</Label>
        <TextArea
          rows={8}
          value={node.html || ""}
          onChange={(e) => set("html", e.target.value)}
        />
        <Row>
          <div style={{ width: 120 }}>
            <Label>Color</Label>
            <Input
              type="color"
              value={node.style?.color || "#334155"}
              onChange={(e) => setStyle({ color: e.target.value })}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Size (px)</Label>
            <Input
              type="number"
              value={node.style?.size ?? 16}
              onChange={(e) => setStyle({ size: Number(e.target.value) })}
            />
          </div>
          <div style={{ width: 140 }}>
            <Label>Line height</Label>
            <Input
              type="number"
              step="0.1"
              value={node.style?.line ?? 1.6}
              onChange={(e) => setStyle({ line: Number(e.target.value) })}
            />
          </div>
          <div style={{ width: 140 }}>
            <Label>Align</Label>
            <Select
              value={node.style?.align || "left"}
              onChange={(v) => setStyle({ align: v })}
              options={[
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ]}
            />
          </div>
        </Row>
      </>
    ) : null;

  const imageBody =
    node.type === "image" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Image</div>
        <Label>URL</Label>
        <Input
          value={node.url || ""}
          onChange={(e) => set("url", e.target.value)}
        />
        <Label>Alt text</Label>
        <Input
          value={node.alt || ""}
          onChange={(e) => set("alt", e.target.value)}
        />
        <Row>
          <div style={{ width: 120 }}>
            <Label>Width (px)</Label>
            <Input
              type="number"
              value={node.width ?? 640}
              onChange={(e) => set("width", Number(e.target.value))}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Radius (px)</Label>
            <Input
              type="number"
              value={node.radius ?? 0}
              onChange={(e) => set("radius", Number(e.target.value))}
            />
          </div>
          <div style={{ width: 140 }}>
            <Label>Align</Label>
            <Select
              value={node.align || "center"}
              onChange={(v) => set("align", v)}
              options={[
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ]}
            />
          </div>
        </Row>
      </>
    ) : null;

  const buttonBody =
    node.type === "button" ? (
      <>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Button</div>
        <Label>Label</Label>
        <Input
          value={node.label || ""}
          onChange={(e) => set("label", e.target.value)}
        />
        <Label>URL</Label>
        <Input
          value={node.href || ""}
          onChange={(e) => set("href", e.target.value)}
        />
        <Row>
          <div style={{ width: 120 }}>
            <Label>Size</Label>
            <Select
              value={node.size || "md"}
              onChange={(v) => set("size", v)}
              options={[
                ["sm", "Small"],
                ["md", "Medium"],
                ["lg", "Large"],
              ]}
            />
          </div>
          <div style={{ width: 140 }}>
            <Label>Align</Label>
            <Select
              value={node.align || "left"}
              onChange={(v) => set("align", v)}
              options={[
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ]}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Radius (px)</Label>
            <Input
              type="number"
              value={node.radius ?? 10}
              onChange={(e) => set("radius", Number(e.target.value))}
            />
          </div>
        </Row>
        <Row>
          <div style={{ width: 120 }}>
            <Label>Background</Label>
            <Input
              type="color"
              value={node.bg || "#2563eb"}
              onChange={(e) => set("bg", e.target.value)}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label>Text color</Label>
            <Input
              type="color"
              value={node.color || "#ffffff"}
              onChange={(e) => set("color", e.target.value)}
            />
          </div>
        </Row>
      </>
    ) : null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 12,
        background: "#fff",
      }}
    >
      {sectionBody ||
        columnsBody ||
        headingBody ||
        textBody ||
        imageBody ||
        buttonBody}
    </div>
  );
}

/* --------------------------------- main ----------------------------------- */

export default function BlocksEditor({ initialDoc, value, onChange }) {
  const seed = value || initialDoc || emptyDoc();
  const [doc, setDoc] = useState(() => clone(seed));
  const [selectedId, setSelectedId] = useState(doc.root.id);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!value) return;
    setDoc(clone(value));
  }, [value]);

  const commit = useCallback(
    (next) => {
      setDoc(next);
      onChange && onChange(next);
    },
    [onChange]
  );

  const selected = useMemo(() => {
    const hit = findById(doc.root, selectedId);
    return hit?.node || null;
  }, [doc, selectedId]);

  const updateNode = (nextNode) => {
    const nextRoot = replaceNode(doc.root, nextNode.id, nextNode);
    commit({ ...doc, root: nextRoot });
  };

  const onDropInto = ({
    parentId,
    key,
    colIndex = -1,
    index,
    child,
    moveId,
  }) => {
    const parentInfo = findById(doc.root, parentId);
    if (!parentInfo) return;

    const willAddType = moveId
      ? findById(doc.root, moveId)?.node?.type
      : child?.type;

    if (parentInfo.node.type === "section") {
      if (willAddType === "section") return;
      if (willAddType !== "columns" && !isPrimitive(willAddType)) return;
    }
    if (parentInfo.node.type === "columns") {
      if (!isPrimitive(willAddType)) return;
    }

    let root = doc.root;

    if (moveId) {
      const from = findContainerAndIndex(root, moveId);
      const movingInfo = findById(root, moveId);
      if (!from || !movingInfo) return;

      root = removeNode(root, moveId);

      if (
        from.parentId === parentId &&
        from.key === key &&
        from.colIndex === colIndex &&
        typeof index === "number" &&
        from.index < index
      ) {
        index -= 1;
      }

      root = insertChild(root, parentId, key, colIndex, index, movingInfo.node);
      commit({ ...doc, root });
      setSelectedId(moveId);
      return;
    }

    if (child) {
      root = insertChild(root, parentId, key, colIndex, index, child);
      commit({ ...doc, root });
      setSelectedId(child.id);
    }
  };

  const palette = [
    ["section", "Section"],
    ["columns", "Columns"],
    ["heading", "Heading"],
    ["text", "Text"],
    ["image", "Image"],
    ["button", "Button"],
  ];

  const pageKids = Array.isArray(doc.root.children) ? doc.root.children : [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr 320px",
        gap: 12,
      }}
    >
      {/* Palette */}
      <div
        style={{
          position: "sticky",
          top: 12,
          alignSelf: "start",
          height: "fit-content",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 12,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Blocks</div>
        <div style={{ display: "grid", gap: 8 }}>
          {palette.map(([type, label]) => (
            <PaletteItem
              key={type}
              type={type}
              label={label}
              onStartDrag={() => setDragActive(true)}
              onEndDrag={() => setDragActive(false)}
            />
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tip: Drag from here into the canvas/containers. Drag cards to reorder
          or move between containers.
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          minHeight: 480,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
        }}
        onClick={() => setSelectedId(doc.root.id)}
        onDragEnd={() => setDragActive(false)}
      >
        <Lane
          active={dragActive}
          onDrop={(e) => {
            const payload = e.dataTransfer.getData("text/plain");
            if (!payload) return;

            if (payload.startsWith("move:")) {
              const id = payload.slice(5);
              onDropInto({
                moveId: id,
                parentId: doc.root.id,
                key: "children",
                index: 0,
              });
              return;
            }

            const type = payload;
            if (type !== "section" && !isPrimitive(type)) return;
            onDropInto({
              parentId: doc.root.id,
              key: "children",
              index: 0,
              child: createNode(type),
            });
          }}
        />

        {pageKids.length > 0 ? (
          pageKids.map((n, i) => (
            <React.Fragment key={n.id}>
              <NodeRenderer
                node={n}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDropInto={onDropInto}
                dragActive={dragActive}
                setDragActive={setDragActive}
              />
              <Lane
                active={dragActive}
                onDrop={(e) => {
                  const payload = e.dataTransfer.getData("text/plain");
                  if (!payload) return;
                  const index = i + 1;

                  if (payload.startsWith("move:")) {
                    const id = payload.slice(5);
                    onDropInto({
                      moveId: id,
                      parentId: doc.root.id,
                      key: "children",
                      index,
                    });
                    return;
                  }

                  const type = payload;
                  if (type !== "section" && !isPrimitive(type)) return;
                  onDropInto({
                    parentId: doc.root.id,
                    key: "children",
                    index,
                    child: createNode(type),
                  });
                }}
              />
            </React.Fragment>
          ))
        ) : (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            No blocks yet. Drag from the palette to add one.
          </div>
        )}
      </div>

      {/* Inspector */}
      <div
        style={{
          position: "sticky",
          top: 12,
          alignSelf: "start",
          height: "fit-content",
        }}
      >
        <Inspector node={selected} onChange={updateNode} />
      </div>
    </div>
  );
}
