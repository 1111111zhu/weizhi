"use client";

import {
  Badge,
  Button,
  Input,
  ProjectWingMasterDataGrid,
  ProjectWingTopBarAvatar,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { Check, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const states = [
  { tone: "success", label: "已完成 · Completed", icon: Check },
  { tone: "warning", label: "待处理 · Attention", icon: TriangleAlert },
  { tone: "info", label: "处理中 · In progress", icon: Info },
  { tone: "destructive", label: "失败 · Failed", icon: CircleAlert },
] as const;

type ColorRecord = {
  id: string;
  name: string;
  status: string;
  tone:
    | "warning-light"
    | "secondary"
    | "success-light"
    | "info-light"
    | "destructive-light";
};
const records: ColorRecord[] = [
  {
    id: "ORC-2026-01",
    name: "Orchid 年度审计 · 客户承接",
    status: "员工编辑中",
    tone: "warning-light",
  },
  {
    id: "ORC-2026-02",
    name: "关联方交易资料",
    status: "草稿",
    tone: "secondary",
  },
  {
    id: "ORC-2026-03",
    name: "银行函证申请",
    status: "已批准",
    tone: "success-light",
  },
  {
    id: "ORC-2026-04",
    name: "业务信息核验",
    status: "处理中",
    tone: "info-light",
  },
  {
    id: "ORC-2026-05",
    name: "缺失资料补充",
    status: "需处理",
    tone: "destructive-light",
  },
];
const columns: ProjectWingMasterDataGridProps<ColorRecord>["columns"] = [
  { accessorKey: "id", header: "编号", size: 160 },
  {
    accessorKey: "name",
    header: "事项",
    size: 360,
    minSize: 200,
    meta: { autoSize: true },
  },
  {
    accessorKey: "status",
    header: "状态",
    size: 150,
    cell: ({ row }) => (
      <Badge variant={row.original.tone}>{row.original.status}</Badge>
    ),
  },
  {
    id: "signoff",
    header: "签核",
    size: 130,
    cell: () => (
      <div className="flex gap-2">
        <Button size="xs" variant="success" aria-label="添加编制签核示例">
          P
        </Button>
        <Button size="xs" variant="warning" aria-label="添加审批签核示例">
          R
        </Button>
      </div>
    ),
  },
];

export function ColorSpecimen() {
  const [dark, setDark] = useState(false);
  return (
    <SpecimenSection
      id="color-contract"
      title="明亮中性 · 鲜明强调"
      description="大面积白与浅中性灰，炭黑正文；绿色、橙色、蓝色和红色负责动作与状态。控制彩色面积，不降低色相辨识度。"
      source={{
        scope: "shared",
        library: "@project-wing/ui",
        detail: "color-palette.css · Badge · Button · Input",
      }}
    >
      <Button variant="outline" onClick={() => setDark((value) => !value)}>
        {dark ? "查看浅色模式" : "检查深色模式"}
      </Button>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-6">
        <section
          className={dark ? "dark min-w-0" : "min-w-0"}
          aria-label={dark ? "深色配色" : "浅色配色"}
        >
          <div className="min-w-0 space-y-6 rounded-lg border border-border bg-background p-6 text-foreground">
            <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-4">
              {["Jony Ma", "Eden Chan", "Manager Li", "Partner Chen"].map(
                (name) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <ProjectWingTopBarAvatar
                      name={name}
                      label={name}
                      size="sm"
                    />
                    {name}
                  </div>
                )
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {dark ? "深色兼容" : "项目级色彩分工"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                强调色与文字色分开：鲜明色块承载信号，清晰文字承载信息。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {states.map(({ tone, label }) => (
                <div key={tone} className="space-y-2">
                  <Badge variant={tone} size="xl">
                    {label}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>保存更改</Button>
              <Button variant="outline">取消</Button>
              <Button variant="danger">删除</Button>
              <Button disabled>不可用</Button>
            </div>
            <Input
              aria-label={dark ? "深色搜索" : "浅色搜索"}
              placeholder="搜索项目名称或编号"
            />
            <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border text-sm">
              <div className="bg-card p-3">内容面</div>
              <div className="bg-muted p-3">表头 / 分组</div>
              <div className="bg-accent p-3 text-accent-foreground">选中</div>
            </div>
            <div className="space-y-4 rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="warning-light">员工编辑中</Badge>
                <Badge variant="secondary">草稿</Badge>
                <span className="text-sm text-muted-foreground">
                  编辑状态与中性草稿保持明确区分。
                </span>
              </div>
              <p className="text-sm font-medium text-card-foreground">
                常驻状态用浅底；实色仅用于重点提示
              </p>
              {states.map(({ tone, label, icon: Icon }) => (
                <div className="flex flex-wrap gap-3" key={tone}>
                  <Badge variant={`${tone}-light`}>
                    <Icon aria-hidden="true" />
                    {label}
                  </Badge>
                  <Badge variant={tone}>
                    <Icon aria-hidden="true" />
                    {label}
                  </Badge>
                  <Badge variant={`${tone}-outline`}>
                    <Icon aria-hidden="true" />
                    {label}
                  </Badge>
                </div>
              ))}
              <Badge variant="secondary">草稿 · Draft</Badge>
            </div>
            <div className="space-y-3 rounded-md border border-border bg-card p-4">
              <p className="text-sm font-medium">
                重复操作不争夺主操作的注意力
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs" variant="success" aria-label="添加编制签核">
                  P
                </Button>
                <Button size="xs" variant="warning" aria-label="添加审批签核">
                  R
                </Button>
                <Button
                  size="xs"
                  variant="warning"
                  disabled
                  aria-label="暂不可审批"
                >
                  R
                </Button>
                <span className="text-sm text-muted-foreground">
                  客户硬性约定：P 编制绿色，R 审批橙色。小面积实色保留辨识度。
                </span>
              </div>
            </div>
            <div className="rounded-md border border-primary/25 bg-accent p-3 text-sm text-accent-foreground">
              ✓ 当前选择：审计项目资料
            </div>
            <ProjectWingMasterDataGrid
              columns={columns}
              data={records}
              getRowId={(row) => row.id}
              title="真实密度下的状态区分"
              tableLabel="色彩状态对照表"
              testId="color-status-grid"
              emptyMessage="暂无示例数据"
              locale="zh-CN"
              paginationPageSize={10}
            />
          </div>
        </section>
      </div>
    </SpecimenSection>
  );
}
