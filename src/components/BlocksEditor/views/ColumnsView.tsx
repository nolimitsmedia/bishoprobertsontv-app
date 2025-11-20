import React from "react";
import ColumnView from "./ColumnView";
import SortableList, { SortableItem, type Id } from "./SortableList";
import DroppableWrap from "./dnd/DroppableWrap";

type AnyNode = {
  id: string | number;
  type: string;
  style?: any;
  cols?: AnyNode[];
};

export default function ColumnsView({
  node,
  selectedId,
  onSelect,
  onReorder,
}: {
  node: AnyNode;
  selectedId?: string | number;
  onSelect?: (id: string | number) => void;
  onReorder?: (
    parentId: string | number,
    key: "children" | "cols",
    newIds: (string | number)[]
  ) => void;
}) {
  const cols = Array.isArray(node.cols) ? node.cols : [];
  const ids: Id[] = cols.map((c) => c.id);

  const gap = node.style?.gap ?? 16;
  const align = node.style?.align ?? "stretch";
  const wrap = node.style?.wrap ? "wrap" : "nowrap";
  const width = node.style?.width ?? "100%";

  return (
    <div
      style={{
        display: "flex",
        gap: typeof gap === "number" ? `${gap}px` : gap,
        alignItems: align,
        flexWrap: wrap,
        width,
      }}
    >
      <DroppableWrap
        id={`drop:${node.id}:cols`}
        data={{ parentId: node.id, key: "cols" }}
      >
        <SortableList
          ids={ids}
          onReorder={(newIds) => onReorder?.(node.id, "cols", newIds)}
        >
          {cols.map((col) => (
            <SortableItem key={String(col.id)} id={col.id}>
              {(drag) => (
                <div ref={drag.setNodeRef} style={drag.style}>
                  {/* HANDLE ONLY */}
                  <div
                    ref={drag.setActivatorNodeRef}
                    {...drag.attributes}
                    {...(drag.listeners || {})}
                    style={{
                      cursor: "grab",
                      userSelect: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "#f1f5f9",
                      color: "#64748b",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                    title="Drag column"
                  >
                    ⋮⋮
                  </div>

                  <ColumnView
                    node={col}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onReorder={onReorder}
                  />
                </div>
              )}
            </SortableItem>
          ))}
        </SortableList>
      </DroppableWrap>
    </div>
  );
}
