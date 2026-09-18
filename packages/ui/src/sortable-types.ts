import type { useRender } from "@base-ui/react/use-render";
import type {
  CollisionDetection,
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  Modifiers,
} from "@dnd-kit/core";
import type { ComponentProps, ReactNode } from "react";

export type SortableCommitMeta<T> = {
  activeIndex: number;
  event: DragEndEvent;
  overIndex: number;
  previousValue: T[];
};

export type SortableProps<T> = Omit<
  useRender.ComponentProps<"div">,
  "children" | "onDragEnd" | "onDragOver" | "onDragStart"
> & {
  activationMode?: "default" | "long-press";
  dropAnimationMode?: "default" | "none";
  accessibility?: ComponentProps<typeof DndContext>["accessibility"];
  children: ReactNode;
  collisionDetection?: CollisionDetection;
  getValueAfterMove?: (value: T[], meta: SortableCommitMeta<T>) => T[];
  getItemValue: (item: T) => string;
  modifiers?: Modifiers;
  onDragCancel?: (event: DragCancelEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onValueChange: (value: T[]) => void;
  onValueCommit?: (value: T[], meta: SortableCommitMeta<T>) => void;
  strategy?: "grid" | "horizontal" | "spatial" | "vertical";
  value: T[];
};
