import React from "react";
import NodeRenderer from "./NodeRenderer";
import SortableList, { SortableItem, type Id } from "./SortableList";
import DroppableWrap from "./dnd/DroppableWrap";

type AnyNode = {
  id: string | number;
  type: string;
  style?: any;
  span?: number;
  children?: AnyNode[];
};

export default function ColumnView({
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
  const children = Array.isArray(node.children) ? node.children : [];
  const ids: Id[] = children.map((c) => c.id);

  const span = Number.isFinite(node.span) ? Number(node.span) : 1;
  const width = node.style?.width;

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flex: width ? undefined : `${span} 1 0`,
    width: width ?? undefined,
    padding: node.style?.pad ?? node.style?.padding ?? undefined,
    gap: node.style?.gap ?? 12,
  };

  return (
    <div style={style}>
      <DroppableWrap
        id={`drop:${node.id}:children`}
        data={{ parentId: node.id, key: "children" }}
      >
        <SortableList
          ids={ids}
          onReorder={(newIds) => onReorder?.(node.id, "children", newIds)}
        >
          {children.map((child) => (
            <SortableItem key={String(child.id)} id={child.id}>
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
                    title="Drag block"
                  >
                    ⋮⋮
                  </div>

                  <NodeRenderer
                    node={child}
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
