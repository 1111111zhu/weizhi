"use client";

import {
  CollectionState,
  ViewSwitcher,
  Badge,
  Button,
  DataGridColumnHeader,
  Input,
  ProjectWingMasterDataGrid,
  ProjectWingPaginationFooter,
  ProjectWingTopBarAvatar,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { Download, Plus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

type SampleRecord = {
  id: string;
  title: string;
  owner: string;
  status: string;
};
const records: SampleRecord[] = Array.from({ length: 65 }, (_, index) => ({
  id: `AUD-${String(index + 1).padStart(4, "0")}`,
  title:
    index % 3 === 0
      ? "跨境业务年度审计资料与关联方交易复核 / Annual audit supporting documentation"
      : `审计资料 ${index + 1}`,
  owner: index % 2 ? "Jony Ma" : "Eden Chan",
  status: index === 2 ? "已归档" : index % 3 ? "已完成" : "待复核",
}));
const columns: ProjectWingMasterDataGridProps<SampleRecord>["columns"] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="编号" />
    ),
    meta: { headerTitle: "编号" },
    size: 120,
  },
  {
    accessorKey: "title",
    header: "文件名",
    size: 360,
    minSize: 220,
    meta: { autoSize: true },
    cell: ({ row }) => (
      <span title={row.original.title}>{row.original.title}</span>
    ),
  },
  {
    accessorKey: "owner",
    header: "最近修改人",
    size: 160,
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <ProjectWingTopBarAvatar
          label={row.original.owner}
          name={row.original.owner}
          size="compact"
        />
        {row.original.owner}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "状态",
    size: 110,
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.status === "待复核" ? "warning-light" : "secondary"
        }
      >
        {row.original.status}
      </Badge>
    ),
  },
];

export function DataWorkbenchSpecimen() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(49);
  const [pageSize, setPageSize] = useState(30);
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [feedback, setFeedback] = useState<
    "loading" | "error" | "empty" | "filtered"
  >("error");
  return (
    <div
      className={
        dark
          ? "dark w-full bg-background text-foreground"
          : "w-full bg-background text-foreground"
      }
    >
      <SpecimenSection
        id="data-workbench"
        title="数据工作台 · 共享组件"
        description="同一套工具栏、长文本表格、分页与头像。缩小窗口检查“更多操作”；主操作始终可见。状态：Experimental，供本次自主优化检查。"
        source={{
          scope: "shared",
          library: "@project-wing/ui",
          detail: "ProjectWingMasterDataGrid",
        }}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link aria-label="检查设置框架" href="/specimens/Settings" />
            }
          >
            检查设置框架
          </Button>
          <Button variant="outline" onClick={() => setDark((value) => !value)}>
            {dark ? "浅色模式" : "深色模式"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setNarrow((value) => !value)}
          >
            {narrow ? "恢复宽布局" : "窄容器检查"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setQuery(query ? "" : "没有匹配内容")}
          >
            空结果状态
          </Button>
        </div>
        <div
          className={narrow ? "h-96 w-full max-w-sm min-w-0" : "h-96 min-w-0"}
        >
          <ProjectWingMasterDataGrid
            locale="zh-CN"
            columnVisibilityLabel="显示列"
            columns={columns}
            data={records.filter((row) =>
              `${row.id} ${row.title} ${row.owner}`.includes(query)
            )}
            getRowId={(row) => row.id}
            isRowSelectable={(row) => row.status !== "已归档"}
            onRowClick={(row) => setNotice(`已打开 ${row.id}：${row.title}`)}
            title="项目资料"
            tableLabel="项目资料示例"
            testId="workbench-specimen-grid"
            emptyMessage="没有匹配的资料，请调整搜索条件。"
            overflowLabel="更多操作"
            paginationPageSize={10}
            paginationPageSizeLabel="每页条数"
            paginationPageSizeOptions={[10, 30, 50]}
            paginationResetKey={query}
            persistentActions={
              <Input
                aria-label="搜索资料"
                placeholder="搜索资料…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            }
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setNotice("已选择导出示例")}
                >
                  <Download />
                  导出
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setNotice("已打开列设置示例")}
                >
                  <Settings2 />
                  列设置
                </Button>
              </>
            }
            primaryAction={
              <Button onClick={() => setNotice("已选择新建资料示例")}>
                <Plus />
                新建
              </Button>
            }
          />
        </div>
        <output aria-live="polite" className="text-sm text-muted-foreground">
          {notice}
        </output>
        <div className="overflow-hidden rounded-lg border bg-card">
          <ProjectWingPaginationFooter
            locale="zh-CN"
            label="每页条数"
            page={page}
            pageSize={pageSize}
            recordCount={30_000}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(0);
            }}
          />
        </div>
        <div className="grid gap-3">
          <p className="text-sm font-medium">列表状态与恢复入口</p>
          <ViewSwitcher
            label="状态样例"
            value={feedback}
            onValueChange={(value) => setFeedback(value as typeof feedback)}
            options={[
              { value: "loading", label: "正在加载" },
              { value: "error", label: "加载失败" },
              { value: "empty", label: "暂无内容" },
              { value: "filtered", label: "搜索无结果" },
            ]}
          />
          <div className="rounded-lg border bg-card">
            <CollectionState
              kind={feedback}
              locale="zh-CN"
              onRetry={() => setFeedback("empty")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            此处为组件交互样例：点击重试模拟成功加载一个空列表。
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          <Search className="mr-1 inline size-4" />
          支持搜索、列排序、选择行、翻页、键盘焦点和无匹配内容；以下分页使用
          30,000 条数据检验大页数。
        </p>
      </SpecimenSection>
    </div>
  );
}
