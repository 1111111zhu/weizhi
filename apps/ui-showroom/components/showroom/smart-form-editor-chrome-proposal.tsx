"use client";

import { Badge, Button, ButtonGroup, Input, Separator } from "@project-wing/ui";
import {
  Check,
  ChevronDown,
  Eye,
  FileQuestion,
  Funnel,
  Languages,
  ListTree,
  MoreHorizontal,
  Pilcrow,
  Plus,
  Redo2,
  Save,
  Search,
  Table2,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

const templates = [
  {
    code: "SF-AUD-DEFERRED-INCOME",
    id: "deferred-income",
    name: "Audit Programme — Deferred income",
    status: "已发布",
    summary: "9 个分组 · 21 个问题",
  },
  {
    code: "SF-AUD-LOANS",
    id: "loans",
    name: "Audit Programme — Loans",
    status: "草稿",
    summary: "7 个分组 · 18 个问题",
  },
] as const;

const insertCommands = [
  { icon: ListTree, label: "章节" },
  { icon: Pilcrow, label: "静态文本" },
  { icon: FileQuestion, label: "问题" },
  { icon: Table2, label: "数据表" },
] as const;

function TemplateItem({
  id,
  selected,
  onSelect,
}: {
  id: (typeof templates)[number]["id"];
  selected: boolean;
  onSelect: () => void;
}) {
  const template = templates.find((item) => item.id === id);
  if (!template) {
    return null;
  }

  return (
    <div
      className={
        selected
          ? "relative rounded-md border border-primary/30 bg-primary/8 shadow-xs"
          : "relative rounded-md border border-transparent bg-transparent transition-colors hover:border-border hover:bg-background"
      }
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
        />
      ) : null}
      <div className="flex items-start gap-1 p-2 pl-3">
        <Button
          aria-pressed={selected}
          className="h-auto min-w-0 flex-1 justify-start overflow-hidden px-0 py-0 text-left hover:bg-transparent"
          onClick={onSelect}
          variant="quiet"
        >
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="truncate text-sm font-semibold text-foreground">
              {template.name}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {template.code}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-2">
              <Badge variant={selected ? "info-outline" : "outline"}>
                {template.status}
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">
                {template.summary}
              </span>
            </span>
          </span>
        </Button>
        <Button
          accessibleName={`${template.name} 的更多操作`}
          className="size-7 shrink-0"
          size="icon-sm"
          tooltip="更多操作"
          variant="quiet"
        >
          <MoreHorizontal />
        </Button>
      </div>
    </div>
  );
}

function CommandButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
}: {
  icon: typeof ListTree;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      className="h-9 gap-1.5 px-2.5 text-sm font-normal max-lg:size-8 max-lg:px-0"
      disabled={disabled}
      size="sm"
      variant={active ? "secondary" : "quiet"}
    >
      <Icon className="size-4" />
      <span className="max-lg:sr-only">{label}</span>
    </Button>
  );
}

function ProposalCommandGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-1">{children}</div>
  );
}

export function SmartFormEditorChromeProposal() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<(typeof templates)[number]["id"]>("deferred-income");
  const [previewActive, setPreviewActive] = useState(false);

  return (
    <section
      aria-label="SmartForm editor Fluent-inspired chrome proposal"
      className="overflow-hidden rounded-xl border bg-background shadow-sm"
      id="smart-form-editor-chrome"
    >
      <div className="grid min-h-160 grid-cols-[17rem_minmax(0,1fr)] max-lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r bg-muted/25">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                智能表单模板
              </p>
              <p className="text-[11px] text-muted-foreground">
                2 个可编辑模板
              </p>
            </div>
            <Button size="sm" variant="outline">
              <Plus />
              新建表单
            </Button>
          </div>

          <div className="border-b p-2.5">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="搜索智能表单模板"
                  className="h-8 bg-background pl-8 text-xs shadow-none"
                  placeholder="搜索模板、科目或底稿"
                />
              </div>
              <Button
                accessibleName="筛选智能表单"
                size="icon-sm"
                tooltip="筛选智能表单"
                variant="outline"
              >
                <Funnel />
              </Button>
            </div>
          </div>

          <div className="grid content-start gap-1 overflow-x-hidden overflow-y-auto p-2">
            {templates.map((template) => (
              <TemplateItem
                id={template.id}
                key={template.id}
                onSelect={() => setSelectedTemplate(template.id)}
                selected={selectedTemplate === template.id}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-muted/10">
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
            <div className="flex min-h-11 items-center gap-2 border-b px-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  Audit Programme — Deferred income
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  SF-AUD-DEFERRED-INCOME · 中文 · HKFRS
                </p>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Check className="size-3.5 text-primary" />
                已保存
              </span>
              <ButtonGroup>
                <Button size="sm" variant="outline">
                  <Upload />
                  发布
                </Button>
                <Button
                  className="text-destructive"
                  size="sm"
                  variant="outline"
                >
                  <Trash2 />
                  删除
                </Button>
                <Button size="sm" variant="primary">
                  <Save />
                  保存
                </Button>
              </ButtonGroup>
            </div>

            <div className="flex min-h-12 items-center gap-1 overflow-hidden px-2 py-1.5">
              <ProposalCommandGroup>
                {insertCommands.map((command) => (
                  <CommandButton
                    icon={command.icon}
                    key={command.label}
                    label={command.label}
                  />
                ))}
              </ProposalCommandGroup>
              <Separator className="mx-1 mt-1 h-7" orientation="vertical" />
              <ProposalCommandGroup>
                <CommandButton icon={Undo2} label="撤销" />
                <span className="max-lg:hidden">
                  <CommandButton disabled icon={Redo2} label="重做" />
                </span>
              </ProposalCommandGroup>
              <Separator className="mx-1 mt-1 h-7" orientation="vertical" />
              <ProposalCommandGroup>
                <Button
                  className="h-9 gap-1.5 px-2.5 text-sm font-normal max-lg:size-8 max-lg:px-0"
                  onClick={() => setPreviewActive((current) => !current)}
                  size="sm"
                  variant={previewActive ? "secondary" : "quiet"}
                >
                  <Eye className="size-4" />
                  <span className="max-lg:sr-only">实时预览</span>
                </Button>
                <Button
                  className="h-9 gap-1.5 px-2.5 text-sm font-normal max-lg:hidden"
                  size="sm"
                  variant="quiet"
                >
                  <Languages className="size-4" />
                  <span>中文</span>
                  <ChevronDown className="size-3" />
                </Button>
              </ProposalCommandGroup>
              <Button
                accessibleName="更多编辑命令"
                className="hidden size-8 max-lg:inline-flex"
                size="icon-sm"
                tooltip="更多编辑命令"
                variant="quiet"
              >
                <MoreHorizontal />
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="mx-auto grid max-w-4xl rounded-lg border bg-background px-8 py-7 shadow-xs">
              <div className="grid gap-1 border-b pb-5">
                <h3 className="text-lg font-semibold text-foreground">
                  递延收入审计程序
                </h3>
                <p className="text-sm text-muted-foreground">
                  记录审计目标、程序和结论，并保留底稿引用。
                </p>
              </div>
              {["风险评估", "详细测试", "最终结论"].map((title, index) => (
                <article className="border-t py-5" key={title}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-0.5 rounded-full bg-primary" />
                      <h4 className="text-sm font-semibold text-foreground">
                        {title}
                      </h4>
                    </div>
                    <Badge variant="outline">
                      {index === 2 ? "必填" : `${index + 2} 项`}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="h-8 rounded-md border bg-muted/20" />
                    <div className="h-8 rounded-md border bg-muted/20" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
