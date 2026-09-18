"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  DragEndEvent,
  DraggableSyntheticListeners,
  DropAnimation,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { AnimateLayoutChanges, SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import { useSpatialDropAnimation } from "./sortable-drop-animation";
import type { SortableProps } from "./sortable-types";
import { cn } from "./utils";

const SortableItemContext = createContext<{
  disabled?: boolean;
  isDragging?: boolean;
  listeners?: DraggableSyntheticListeners;
}>({});
const IsOverlayContext = createContext(false);
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });
const spatialSortingStrategy: SortingStrategy = () => null;
const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};
const subscribeToNothing = () => () => {};
const getIsMounted = () => true;
const getIsMountedOnServer = () => false;

function Sortable<T>({
  activationMode = "default",
  accessibility,
  children,
  className,
  collisionDetection,
  dropAnimationMode = "default",
  getItemValue,
  getValueAfterMove,
  modifiers,
  onDragCancel,
  onDragEnd,
  onDragOver,
  onDragStart,
  onValueChange,
  onValueCommit,
  render,
  strategy = "vertical",
  value,
  ...props
}: SortableProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const dropTargetIdRef = useRef<UniqueIdentifier | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getIsMounted,
    getIsMountedOnServer
  );
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint:
        activationMode === "long-press"
          ? { delay: 250, tolerance: 5 }
          : { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const itemIds = useMemo(() => value.map(getItemValue), [getItemValue, value]);
  const spatialDropAnimation = useSpatialDropAnimation(dropTargetIdRef);
  const strategyValue =
    strategy === "vertical"
      ? verticalListSortingStrategy
      : strategy === "spatial"
        ? spatialSortingStrategy
        : rectSortingStrategy;
  const activeChild = useMemo(() => {
    let result: ReactNode = null;
    const childItems = Array.isArray(children) ? children : [children];
    childItems.forEach((child) => {
      if (!isValidElement<SortableItemProps>(child)) {
        return;
      }
      if (child.props.value !== activeId) {
        return;
      }
      result = cloneElement(child as ReactElement<SortableItemProps>, {
        className: cn(child.props.className, "z-50"),
      });
    });
    return result;
  }, [activeId, children]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      dropTargetIdRef.current = event.over?.id ?? null;
      setActiveId(null);
      onDragEnd?.(event);
      if (!event.over) {
        return;
      }
      const activeIndex = value.findIndex(
        (item) => getItemValue(item) === event.active.id
      );
      const overIndex = value.findIndex(
        (item) => getItemValue(item) === event.over?.id
      );
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return;
      }
      const meta = { activeIndex, event, overIndex, previousValue: value };
      const nextValue = getValueAfterMove
        ? getValueAfterMove(value, meta)
        : arrayMove(value, activeIndex, overIndex);
      onValueChange(nextValue);
      onValueCommit?.(nextValue, meta);
    },
    [
      getItemValue,
      getValueAfterMove,
      onDragEnd,
      onValueChange,
      onValueCommit,
      value,
    ]
  );
  const defaultProps = {
    "data-dragging": activeId !== null,
    "data-slot": "sortable",
    className: cn(activeId && "cursor-grabbing!", className),
    children,
  };

  return (
    <DndContext
      accessibility={accessibility}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      modifiers={modifiers}
      sensors={sensors}
      onDragCancel={(event) => {
        dropTargetIdRef.current = null;
        setActiveId(null);
        onDragCancel?.(event);
      }}
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver}
      onDragStart={(event) => {
        setActiveId(event.active.id);
        onDragStart?.(event);
      }}
    >
      <SortableContext items={itemIds} strategy={strategyValue}>
        {useRender({
          defaultTagName: "div",
          render,
          props: mergeProps<"div">(defaultProps, props),
        })}
      </SortableContext>
      {mounted
        ? createPortal(
            <DragOverlay
              className={cn("z-50", activeId && "cursor-grabbing")}
              dropAnimation={
                dropAnimationMode === "none"
                  ? null
                  : strategy === "spatial"
                    ? spatialDropAnimation
                    : dropAnimation
              }
              modifiers={modifiers}
            >
              <IsOverlayContext.Provider value>
                {activeChild}
              </IsOverlayContext.Provider>
            </DragOverlay>,
            document.body
          )
        : null}
    </DndContext>
  );
}

export type SortableItemProps = useRender.ComponentProps<"div"> & {
  disabled?: boolean;
  dragHandleOnly?: boolean;
  value: string;
};

function SortableItem({
  className,
  disabled,
  dragHandleOnly = true,
  render,
  value,
  ...props
}: SortableItemProps) {
  const isOverlay = useContext(IsOverlayContext);
  const sortable = useSortable({
    animateLayoutChanges,
    disabled: disabled || isOverlay,
    id: value,
  });
  const defaultProps = isOverlay
    ? {
        "data-dragging": true,
        "data-overlay": true,
        "data-slot": "sortable-item",
        "data-value": value,
        className,
        children: props.children,
      }
    : {
        ...sortable.attributes,
        ...(dragHandleOnly ? {} : sortable.listeners),
        "data-disabled": disabled,
        "data-dragging": sortable.isDragging,
        "data-overlay": false,
        "data-over": sortable.isOver,
        "data-slot": "sortable-item",
        "data-value": value,
        className: cn(sortable.isDragging && "z-50 opacity-50", className),
        ref: sortable.setNodeRef,
        style: {
          transition: sortable.transition,
          transform: CSS.Transform.toString(sortable.transform),
        } as CSSProperties,
        children: props.children,
      };
  const sortableContextValue = useMemo(
    () => ({
      disabled,
      isDragging: sortable.isDragging,
      listeners: isOverlay || !dragHandleOnly ? undefined : sortable.listeners,
    }),
    [
      disabled,
      dragHandleOnly,
      isOverlay,
      sortable.isDragging,
      sortable.listeners,
    ]
  );

  return (
    <SortableItemContext.Provider value={sortableContextValue}>
      {useRender({
        defaultTagName: "div",
        render,
        props: mergeProps<"div">(defaultProps, props),
      })}
    </SortableItemContext.Provider>
  );
}

export type SortableItemHandleProps = useRender.ComponentProps<"div"> & {
  cursor?: boolean;
};

function SortableItemHandle({
  className,
  cursor = true,
  render,
  ...props
}: SortableItemHandleProps) {
  const { disabled, isDragging, listeners } = useContext(SortableItemContext);
  const defaultProps = {
    ...listeners,
    "data-disabled": disabled,
    "data-dragging": isDragging,
    "data-slot": "sortable-item-handle",
    className: cn(
      cursor && (isDragging ? "cursor-grabbing!" : "cursor-grab!"),
      className
    ),
    children: props.children,
  };
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(defaultProps, props),
  });
}

export { Sortable, SortableItem, SortableItemHandle };
export type { SortableCommitMeta, SortableProps } from "./sortable-types";
