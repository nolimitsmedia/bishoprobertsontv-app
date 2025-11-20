import React from "react";
import { REGISTRY } from "../core/registry";

/** Broad, editor-friendly node shape */
export type EditorNode = {
  id?: string | number;
  type: string;
  style?: any;
  props?: any;
  children?: EditorNode[];
  [k: string]: any;
};

type NodeRendererProps = {
  node: EditorNode;
  selectedId?: string | number;
  onSelect?: (id: string | number) => void;
  onReorder?: (
    parentId: string | number,
    key: "children" | "cols",
    newIds: string[]
  ) => void;
  [key: string]: any;
};

// Treat clicks from inputs/contenteditable as "interactive" and ignore for selection
const isInteractiveEvent = (e: React.SyntheticEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el?.closest(
    'input, textarea, select, button, [contenteditable=""], [contenteditable="true"], a[href]'
  );
};

function NodeRendererBase({
  node,
  selectedId,
  onSelect,
  ...rest
}: NodeRendererProps) {
  if (!node || !node.type) return null;

  const entry = (REGISTRY as any)[node.type];
  const Cmp = (entry?.View as React.ComponentType<any>) || null;
  if (!Cmp) return null;

  const isSel = node.id != null && node.id === selectedId;

  const wrapStyle: React.CSSProperties = {
    outline: isSel ? "2px solid #2563eb" : "1px dashed rgba(0,0,0,.1)",
    outlineOffset: 2,
    borderRadius: 8,
    padding: 4,
    margin: 4,
    background: "#fff",
  };

  return (
    <div
      style={wrapStyle}
      data-nodeid={node.id}
      onClick={(e) => {
        if (isInteractiveEvent(e)) return; // don't reselect while typing
        e.stopPropagation();
        if (onSelect && node.id != null) onSelect(node.id);
      }}
    >
      <Cmp node={node} selectedId={selectedId} onSelect={onSelect} {...rest} />
    </div>
  );
}

export default React.memo(NodeRendererBase);
