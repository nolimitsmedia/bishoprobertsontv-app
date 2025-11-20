import React, { PropsWithChildren, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type Id = string | number;

type SortableListProps = {
  ids: Id[];
  onReorder?: (newIds: Id[]) => void;
  strategy?: typeof rectSortingStrategy;
};

type RenderDrag = (ctx: {
  setNodeRef: (el: HTMLElement | null) => void;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners?: Record<string, any>;
  isDragging: boolean;
  style: React.CSSProperties;
}) => React.ReactNode;

type SortableItemProps = {
  id: Id;
  children: RenderDrag;
};

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo<React.CSSProperties>(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
      touchAction: "manipulation",
      willChange: "transform",
    };
  }, [transform, transition, isDragging]);

  return (
    <>
      {children({
        setNodeRef,
        setActivatorNodeRef,
        attributes,
        listeners,
        isDragging,
        style,
      })}
    </>
  );
}

export default function SortableList({
  ids,
  onReorder,
  strategy = rectSortingStrategy,
  children,
}: PropsWithChildren<SortableListProps>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const items = useMemo(() => ids.map(String), [ids]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    const next = arrayMove(items, oldIndex, newIndex);
    // Cast back to Id[] (string | number) — we only coerced to string for sorting
    onReorder?.(next as unknown as Id[]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={strategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
