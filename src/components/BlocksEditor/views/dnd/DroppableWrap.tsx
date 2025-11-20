import React from "react";
import { useDroppable } from "@dnd-kit/core";

export default function DroppableWrap({
  id,
  data,
  children,
}: {
  id: string;
  data: any;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data });
  return (
    <div
      ref={setNodeRef}
      style={{
        outline: isOver ? "2px solid #60a5fa" : undefined,
        outlineOffset: 2,
        borderRadius: 8,
        minHeight: 32,
      }}
    >
      {children}
    </div>
  );
}
