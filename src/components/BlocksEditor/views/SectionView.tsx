import React from "react";
import NodeRenderer from "./NodeRenderer";
import SortableList, { SortableItem, type Id } from "./SortableList";
import DroppableWrap from "./dnd/DroppableWrap";

type AnyNode = {
  id: string | number;
  type: string;
  style?: any;
  children?: AnyNode[];
};

function buildStyle(s: any = {}): React.CSSProperties {
  return {
    display: "block",
    width: s.width ?? "100%",
    margin: s.center ? "0 auto" : undefined,
    padding: s.pad ?? s.padding ?? 0,
    borderRadius: s.radius ? Number(s.radius) : undefined,
    color: s.color ?? undefined,
    background: s.background ?? undefined,
    boxShadow: s.shadow ?? undefined,
    border: s.border ?? undefined,
  };
}

export default function SectionView({
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

  return (
    <section style={buildStyle(node.style)}>
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
                <div
                  ref={drag.setNodeRef}
                  style={{
                    ...drag.style,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#fff",
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  {/* HANDLE ONLY */}
                  <div
                    ref={drag.setActivatorNodeRef}
                    {...drag.attributes}
                    {...(drag.listeners ?? {})}
                    style={{
                      cursor: "grab",
                      userSelect: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "#f1f5f9",
                      color: "#64748b",
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                    title="Drag to reorder"
                  >
                    ⋮⋮ Move
                  </div>

                  <NodeRenderer
                    node={child as any}
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
    </section>
  );
}
