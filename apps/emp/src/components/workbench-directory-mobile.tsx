"use client";

import { Button, CollectionState, Input } from "@project-wing/ui";
import { ArrowLeft, Home, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { WorkflowNode } from "../api/client";
import { getDirectoryMobileCopy } from "../i18n/directory-mobile";
import { SidebarProvider } from "./sidebar";
import {
  DirectoryFileRow,
  DirectoryNodeRow,
  InlineCreateNodeRow,
  formatNodeLabel,
  getDirectoryDisplayNode,
  getVisibleFiles,
} from "./workbench-directory-row";
import type { DirectoryNodeRowProps } from "./workbench-directory-row";

import styles from "./workbench-directory-mobile.module.css";

type RowProps = Omit<DirectoryNodeRowProps, "node">;

function indexDirectories(
  nodes: WorkflowNode[],
  trail: WorkflowNode[] = []
): { node: WorkflowNode; trail: WorkflowNode[] }[] {
  return nodes.flatMap((node) => [
    { node, trail },
    ...indexDirectories(node.children ?? [], [...trail, node]),
  ]);
}

export function WorkbenchDirectoryMobile({
  workflow,
  rowProps,
  initialNodeId,
  locale,
  loading,
  addingRoot,
  onAddRoot,
  onCloseRoot,
}: {
  workflow: WorkflowNode[];
  rowProps: RowProps;
  initialNodeId: string | null;
  locale: string;
  loading: boolean;
  addingRoot: boolean;
  onAddRoot: () => void;
  onCloseRoot: () => void;
}) {
  const copy = getDirectoryMobileCopy(locale);
  const index = useMemo(() => indexDirectories(workflow), [workflow]);
  const [trail, setTrail] = useState(
    () =>
      index
        .find((entry) => entry.node.id === initialNodeId)
        ?.trail.map((node) => node.id) ?? []
  );
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const path: WorkflowNode[] = [];
  let children = workflow;
  for (const id of trail) {
    const node = children.find((item) => item.id === id);
    if (!node) {
      break;
    }
    path.push(node);
    children = node.children ?? [];
  }
  const current = path.at(-1);
  const creating =
    !rowProps.readOnly && (addingRoot || Boolean(rowProps.addNodeTarget));
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visible = normalizedQuery
    ? index.filter(({ node }) =>
        `${node.code} ${node.title} ${formatNodeLabel(getDirectoryDisplayNode(node))}`
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery)
      )
    : children.map((node) => ({ node, trail: path }));
  const navigate = (next: string[]) => {
    setTrail(next);
    setQuery("");
    setSearchOpen(false);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    headingRef.current?.focus({ preventScroll: true });
  };
  const files = current
    ? getVisibleFiles(
        current.workingPapers ?? [],
        rowProps.showFiles,
        rowProps.visibleFileBucket
      )
    : [];
  const clipboard = rowProps.clipboardNode;
  const fileClipboard = rowProps.clipboardFile;

  return (
    <div className={styles.page} data-testid="workbench-directory-mobile">
      <div className={styles.toolbar}>
        {path.length && !creating ? (
          <Button
            variant="quiet"
            size="icon"
            aria-label={copy.back}
            onClick={() => navigate(path.slice(0, -1).map((node) => node.id))}
          >
            <ArrowLeft aria-hidden />
          </Button>
        ) : null}
        <h3 ref={headingRef} tabIndex={-1}>
          {creating
            ? copy.create
            : current
              ? formatNodeLabel(getDirectoryDisplayNode(current))
              : copy.root}
        </h3>
        {!creating && (
          <Button
            variant="quiet"
            size="icon"
            aria-label={copy.search}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open);
              setQuery("");
            }}
          >
            <Search aria-hidden />
          </Button>
        )}
        {!creating && !rowProps.readOnly && (
          <Button
            variant="quiet"
            size="icon"
            aria-label={copy.create}
            disabled={loading || rowProps.createNodePending}
            onClick={() =>
              current ? rowProps.onStartAdd(current) : onAddRoot()
            }
          >
            <Plus aria-hidden />
          </Button>
        )}
      </div>
      {creating ? (
        <InlineCreateNodeRow
          key={addingRoot ? "root" : rowProps.addNodeTarget?.id}
          mobileLocale={locale}
          copy={rowProps.copy}
          parent={addingRoot ? null : rowProps.addNodeTarget}
          rootNodes={workflow}
          isPending={rowProps.createNodePending}
          onClose={addingRoot ? onCloseRoot : rowProps.onCloseAdd}
          onCreate={(values) => {
            rowProps.createNode(values);
          }}
        />
      ) : (
        <>
          {path.length > 0 && (
            <nav className={styles.breadcrumbs} aria-label={copy.root}>
              <Button variant="quiet" onClick={() => navigate([])}>
                <Home aria-hidden />
                {copy.root}
              </Button>
              {path.slice(0, -1).map((node, position) => (
                <Button
                  key={node.id}
                  variant="quiet"
                  onClick={() =>
                    navigate(path.slice(0, position + 1).map((item) => item.id))
                  }
                >
                  {formatNodeLabel(getDirectoryDisplayNode(node))}
                </Button>
              ))}
            </nav>
          )}
          {searchOpen && (
            <div className={styles.toolbar}>
              <Input
                autoFocus
                type="search"
                aria-label={copy.search}
                placeholder={copy.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                size="icon"
                variant="quiet"
                aria-label={copy.clear}
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
              >
                <X aria-hidden />
              </Button>
            </div>
          )}
          {clipboard || fileClipboard ? (
            <p className={styles.clipboard}>
              {(clipboard?.mode ?? fileClipboard?.mode) === "move"
                ? copy.cut
                : copy.copied}
              :{" "}
              {clipboard
                ? formatNodeLabel(getDirectoryDisplayNode(clipboard.node))
                : fileClipboard?.file.fileName}
            </p>
          ) : null}
          <div className={styles.list} ref={listRef}>
            {loading ? (
              <CollectionState
                kind="loading"
                locale={locale.startsWith("zh") ? "zh-CN" : "en-US"}
              />
            ) : (
              <>
                {current && !normalizedQuery && (
                  <DirectoryNodeRow
                    {...rowProps}
                    node={current}
                    mobileLocale={locale}
                    mobileLabel={copy.openFiles}
                  />
                )}
                <ul className="m-0 list-none p-0">
                  {visible.map(({ node, trail: parentTrail }) => (
                    <li key={node.id}>
                      <DirectoryNodeRow
                        {...rowProps}
                        node={node}
                        mobileLocale={locale}
                        mobileDescription={
                          normalizedQuery
                            ? parentTrail
                                .map((parent) =>
                                  formatNodeLabel(
                                    getDirectoryDisplayNode(parent)
                                  )
                                )
                                .join(" / ")
                            : node.children?.length
                              ? copy.children.replace(
                                  "{count}",
                                  String(node.children.length)
                                )
                              : undefined
                        }
                        onBrowse={
                          node.children?.length
                            ? () =>
                                navigate([
                                  ...parentTrail.map((parent) => parent.id),
                                  node.id,
                                ])
                            : undefined
                        }
                        onToggleExpanded={() =>
                          navigate([
                            ...parentTrail.map((parent) => parent.id),
                            node.id,
                          ])
                        }
                      />
                    </li>
                  ))}
                </ul>
                {current && !normalizedQuery && files.length > 0 && (
                  <SidebarProvider className="min-h-0">
                    <ul className="m-0 w-full list-none p-0">
                      {files.map((paper, i) => (
                        <DirectoryFileRow
                          {...rowProps}
                          key={paper.id}
                          node={current}
                          paper={paper}
                          displayIndex={i + 1}
                          isSelected={rowProps.selectedPaperId === paper.id}
                          isHighlighted={
                            rowProps.highlightedPaperId === paper.id
                          }
                        />
                      ))}
                    </ul>
                  </SidebarProvider>
                )}
                {!visible.length && (!current || normalizedQuery) ? (
                  <CollectionState
                    kind="empty"
                    title={
                      normalizedQuery
                        ? rowProps.copy.noMatchesTitle
                        : rowProps.copy.emptyStructureTitle
                    }
                    locale={locale.startsWith("zh") ? "zh-CN" : "en-US"}
                  />
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
