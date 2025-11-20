import React from "react";
import { useDraggable } from "@dnd-kit/core";

export default function PaletteItem({
  type,
  children,
}: {
  type: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { type },
  });

  return (
    <button
      ref={setNodeRef}
      className="be-btn"
      style={{ opacity: isDragging ? 0.6 : 1, cursor: "grab" }}
      type="button"
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}
