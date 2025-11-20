import React from "react";

type Props = {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export default function SortableItem({
  id,
  className,
  style,
  children,
}: Props) {
  // placeholder: just render children. Later swap to dnd-kit useSortable here.
  return (
    <div data-id={id} className={className} style={style}>
      {children}
    </div>
  );
}
