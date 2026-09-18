"use client";

import {
  Badge,
  ProjectWingMasterDataGrid,
  ProjectWingTopBarAvatar,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { FileText, Megaphone } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";

import type { IntranetDictionary } from "@/i18n/dictionaries";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";

function KnowledgeOwnerAvatar({ item }: { item: KnowledgeItem }) {
  const [failedImage, setFailedImage] = useState<string>();
  return item.ownerAvatar && failedImage !== item.ownerAvatar ? (
    <Image
      className="size-6 shrink-0 rounded-full object-cover"
      src={item.ownerAvatar}
      alt={item.owner}
      height={24}
      width={24}
      unoptimized
      onError={() => setFailedImage(item.ownerAvatar)}
    />
  ) : (
    <ProjectWingTopBarAvatar
      label={item.owner}
      name={item.owner}
      size="compact"
    />
  );
}

export function KnowledgeDataGrid({
  locale,
  items,
  copy,
  renderActions,
  content,
}: {
  locale: "zh-CN" | "en-US";
  items: KnowledgeItem[];
  copy: IntranetDictionary;
  renderActions: (item: KnowledgeItem) => ReactNode;
  content?: ReactNode;
}) {
  const columns: ProjectWingMasterDataGridProps<KnowledgeItem>["columns"] = [
    {
      id: "reference",
      header: copy.knowledge.columns.referenceCode,
      accessorFn: (item) => item.referenceCode ?? "—",
      size: 140,
      minSize: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {String(getValue())}
        </span>
      ),
    },
    {
      id: "title",
      header: copy.knowledge.columns.title,
      accessorKey: "title",
      size: 360,
      minSize: 220,
      meta: { autoSize: true },
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-muted-foreground">
            {row.original.kind === "NOTICE" ? (
              <Megaphone className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </span>
          <span className="truncate font-medium" title={row.original.title}>
            {row.original.title}
          </span>
        </div>
      ),
    },
    {
      id: "type",
      header: copy.knowledge.columns.type,
      accessorFn: (item) => copy.types[item.type],
      size: 100,
      minSize: 80,
      cell: ({ getValue }) => (
        <Badge variant="secondary">{String(getValue())}</Badge>
      ),
    },
    {
      id: "owner",
      header: copy.knowledge.columns.owner,
      accessorKey: "owner",
      size: 180,
      minSize: 140,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <KnowledgeOwnerAvatar item={row.original} />
          <span className="truncate">{row.original.owner}</span>
        </div>
      ),
    },
    {
      id: "updatedAt",
      header: copy.knowledge.columns.updatedAt,
      accessorKey: "updatedAt",
      size: 132,
      minSize: 110,
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {String(getValue())}
        </span>
      ),
    },
    {
      id: "actions",
      header: copy.knowledge.actions.title,
      size: 160,
      minSize: 160,
      enableSorting: false,
      cell: ({ row }) => renderActions(row.original),
    },
  ];
  return (
    <ProjectWingMasterDataGrid
      locale={locale}
      columns={columns}
      data={items}
      content={content}
      emptyMessage={copy.knowledge.noResults}
      getRowId={(item) => item.id ?? item.referenceCode ?? item.title}
      showToolbar={false}
      showRowSelection={false}
      tableLabel={copy.knowledge.title}
      title={copy.knowledge.title}
      testId="knowledge-data-grid"
    />
  );
}
