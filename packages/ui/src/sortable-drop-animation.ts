import type { DropAnimationFunction, UniqueIdentifier } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useCallback } from "react";
import type { RefObject } from "react";

export function useSpatialDropAnimation(
  dropTargetIdRef: RefObject<UniqueIdentifier | null>
) {
  return useCallback<DropAnimationFunction>(
    (args) => {
      const animation = animateSpatialDrop(args, dropTargetIdRef.current);
      return Promise.resolve(animation).finally(() => {
        dropTargetIdRef.current = null;
      });
    },
    [dropTargetIdRef]
  );
}

export async function animateSpatialDrop(
  {
    dragOverlay,
    droppableContainers,
    transform,
  }: Parameters<DropAnimationFunction>[0],
  dropTargetId: UniqueIdentifier | null
) {
  const targetNode = dropTargetId
    ? droppableContainers.get(dropTargetId)?.node.current
    : null;
  if (!targetNode) {
    return;
  }

  const overlayRect = dragOverlay.node.getBoundingClientRect();
  const targetRect = targetNode.getBoundingClientRect();
  const destinationTransform = {
    ...transform,
    x: transform.x + targetRect.left - overlayRect.left,
    y: transform.y + targetRect.top - overlayRect.top,
  };
  const previousTargetOpacity = targetNode.style.opacity;
  targetNode.style.opacity = "0";
  const animation = dragOverlay.node.animate(
    [
      { transform: CSS.Transform.toString(transform) },
      { transform: CSS.Transform.toString(destinationTransform) },
    ],
    {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 180,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    }
  );

  try {
    await animation.finished.catch(() => {});
  } finally {
    targetNode.style.opacity = previousTargetOpacity;
  }
}
