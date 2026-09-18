"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "./button";

export type TreeViewItem = {
  id: string;
  label: string;
  disabled?: boolean;
  children?: readonly TreeViewItem[];
};
export type TreeViewProps = {
  label: string;
  items: readonly TreeViewItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  expandedIds?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  expandLabel: string;
  collapseLabel: string;
  emptyMessage: string;
};
type VisibleItem = {
  item: TreeViewItem;
  depth: number;
  parentId?: string;
  position: number;
  size: number;
};
export function TreeView({
  label,
  items,
  selectedId,
  onSelect,
  expandedIds,
  onExpandedChange,
  expandLabel,
  collapseLabel,
  emptyMessage,
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const expanded = expandedIds ?? internalExpanded;
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const focusInside = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => {
    const result: VisibleItem[] = [];
    const seen = new Set<string>();
    function visit(
      list: readonly TreeViewItem[],
      depth: number,
      parentId?: string
    ) {
      list.forEach((item, position) => {
        if (seen.has(item.id)) {
          throw new Error("Tree item IDs must be unique");
        }
        seen.add(item.id);
        result.push({
          item,
          depth,
          parentId,
          position: position + 1,
          size: list.length,
        });
        if (expanded.includes(item.id) && item.children) {
          visit(item.children, depth + 1, item.id);
        }
      });
    }
    visit(items, 0);
    return result;
  }, [items, expanded]);
  const enabled = visible.filter((entry) => !entry.item.disabled);
  const focusId =
    enabled.find((entry) => entry.item.id === focusedId)?.item.id ??
    enabled.find((entry) => entry.item.id === selectedId)?.item.id ??
    enabled[0]?.item.id;
  useEffect(() => {
    if (focusInside.current && focusId) {
      nodes.current.get(focusId)?.focus();
    }
  }, [focusId, nodes, focusInside]);
  function changeExpanded(id: string) {
    const next = expanded.includes(id)
      ? expanded.filter((key) => key !== id)
      : [...expanded, id];
    if (expandedIds === undefined) {
      setInternalExpanded(next);
    }
    onExpandedChange?.(next);
  }
  function moveFocus(id?: string) {
    if (id) {
      setFocusedId(id);
      nodes.current.get(id)?.focus();
    }
  }
  if (!items.length) {
    return (
      <output className="text-muted-foreground block p-3 text-sm">
        {emptyMessage}
      </output>
    );
  }
  return (
    <div
      ref={root}
      role="tree"
      aria-label={label}
      className="min-w-0"
      onFocusCapture={() => {
        focusInside.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focusInside.current = false;
        }
      }}
    >
      {visible.map(({ item, depth, parentId, position, size }) => (
        <div
          key={item.id}
          ref={(element) => {
            if (element) {
              nodes.current.set(item.id, element);
            } else {
              nodes.current.delete(item.id);
            }
          }}
          role="treeitem"
          aria-level={depth + 1}
          aria-posinset={position}
          aria-setsize={size}
          aria-selected={selectedId === item.id}
          aria-expanded={
            item.children?.length ? expanded.includes(item.id) : undefined
          }
          aria-disabled={item.disabled || undefined}
          tabIndex={!item.disabled && focusId === item.id ? 0 : -1}
          style={{ "--pw-tree-depth": depth } as CSSProperties}
          className="hover:bg-muted focus-visible:ring-ring aria-selected:bg-accent flex min-h-11 min-w-0 items-center gap-1 rounded-md py-1 pr-2 pl-[calc(var(--pw-tree-depth)*var(--pw-tree-indent))] text-sm outline-none focus-visible:ring-2 aria-disabled:opacity-50"
          onFocus={() => setFocusedId(item.id)}
          onClick={() => {
            if (!item.disabled) {
              onSelect(item.id);
            }
          }}
          onKeyDown={(event) => {
            if (item.disabled || event.target !== event.currentTarget) {
              return;
            }
            const index = enabled.findIndex(
              (entry) => entry.item.id === item.id
            );
            switch (event.key) {
              case "ArrowDown": {
                event.preventDefault();
                moveFocus(enabled[index + 1]?.item.id);
                break;
              }
              case "ArrowUp": {
                event.preventDefault();
                moveFocus(enabled[index - 1]?.item.id);
                break;
              }
              case "Home": {
                event.preventDefault();
                moveFocus(enabled[0]?.item.id);
                break;
              }
              case "End": {
                event.preventDefault();
                moveFocus(enabled.at(-1)?.item.id);
                break;
              }
              case "ArrowRight": {
                event.preventDefault();
                if (item.children?.length) {
                  if (expanded.includes(item.id)) {
                    moveFocus(
                      item.children.find((child) => !child.disabled)?.id
                    );
                  } else {
                    changeExpanded(item.id);
                  }
                }
                break;
              }
              case "ArrowLeft": {
                event.preventDefault();
                if (item.children?.length && expanded.includes(item.id)) {
                  changeExpanded(item.id);
                } else {
                  moveFocus(parentId);
                }
                break;
              }
              case "Enter":
              case " ": {
                event.preventDefault();
                onSelect(item.id);
                break;
              }
              default: {
                break;
              }
            }
          }}
        >
          {item.children?.length ? (
            <Button
              type="button"
              variant="quiet"
              size="icon-sm"
              tabIndex={-1}
              disabled={item.disabled}
              aria-label={`${expanded.includes(item.id) ? collapseLabel : expandLabel} ${item.label}`}
              onClick={(event) => {
                event.stopPropagation();
                moveFocus(item.id);
                changeExpanded(item.id);
              }}
            >
              {expanded.includes(item.id) ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : (
            <span aria-hidden="true" className="w-7 shrink-0" />
          )}
          <span className="min-w-0 truncate" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
