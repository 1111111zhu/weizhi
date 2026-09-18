"use client";

import { Badge, Button, ButtonGroup } from "@project-wing/ui";
import {
  CircleDot,
  FileQuestion,
  GitBranch,
  GripVertical,
  Hash,
  ListChecks,
  Plus,
  Table2,
  TextQuote,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type QuestionType = "single" | "multiple" | "number";

const conditionExamples: Record<
  QuestionType,
  {
    question: string;
    operator: string;
    expected: string;
    alternateExpected: string;
    label: string;
  }
> = {
  single: {
    question: "客户业务是否包含存货？",
    operator: "选择了",
    expected: "是",
    alternateExpected: "尚不确定",
    label: "单选",
  },
  multiple: {
    question: "本项目涉及哪些审计领域？",
    operator: "包含全部",
    expected: "收入、应收款",
    alternateExpected: "存货",
    label: "多选",
  },
  number: {
    question: "预计错报金额",
    operator: "大于等于",
    expected: "50,000",
    alternateExpected: "10,000",
    label: "数字",
  },
};

function BooleanQuestionSlot({ type }: { type: QuestionType }) {
  const example = conditionExamples[type];

  return (
    <span className="bg-warning inline-flex max-w-full p-px [clip-path:polygon(0_50%,4%_0,96%_0,100%_50%,96%_100%,4%_100%)]">
      <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 bg-background px-4 py-1 text-xs font-medium text-foreground [clip-path:polygon(0_50%,4%_0,96%_0,100%_50%,96%_100%,4%_100%)]">
        {type === "number" ? (
          <Hash className="text-warning size-3.5 shrink-0" />
        ) : type === "multiple" ? (
          <ListChecks className="text-warning size-3.5 shrink-0" />
        ) : (
          <CircleDot className="text-warning size-3.5 shrink-0" />
        )}
        <span className="max-w-56 truncate">{example.question}</span>
        <span className="bg-warning/15 text-warning shrink-0 rounded px-1.5 py-0.5">
          {example.label}
        </span>
      </span>
    </span>
  );
}

function ContentBlock({
  icon,
  label,
  detail,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 shadow-xs">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
      <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
    </div>
  );
}

function EmptyBranch() {
  return (
    <div className="grid min-h-20 place-items-center rounded-lg border border-dashed border-border bg-muted/15 p-3 text-center">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          此分支不包含内容
        </p>
        <Button className="mt-2" size="sm" variant="outline">
          <Plus />
          添加内容
        </Button>
      </div>
    </div>
  );
}

function BranchLane({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="relative ml-6 overflow-hidden rounded-l-xl border border-border/70 bg-background shadow-xs">
      <span
        aria-hidden="true"
        className="bg-warning/45 absolute inset-y-0 left-0 w-1"
      />
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/15 py-2 pr-3 pl-4">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-2 p-3 pl-4">{children}</div>
    </section>
  );
}

function ConditionalControlBlock({
  type,
  nested,
  otherwiseHasContent,
  depth = 0,
}: {
  type: QuestionType;
  nested: boolean;
  otherwiseHasContent: boolean;
  depth?: number;
}) {
  const example = conditionExamples[type];
  return (
    <article
      aria-label={depth ? "嵌套分支问题" : "分支问题条件块"}
      className="border-warning/40 bg-warning/10 overflow-hidden rounded-xl border p-2 shadow-sm"
    >
      <div className="text-warning flex min-w-0 flex-wrap items-center gap-2 px-2 py-1.5 text-sm font-semibold">
        <GitBranch className="size-4 shrink-0" />
        <span className="shrink-0">分支问题</span>
        <BooleanQuestionSlot type={type} />
      </div>

      <BranchLane label="如果" hint={`${example.operator} ${example.expected}`}>
        <ContentBlock
          icon={<TextQuote />}
          label="审计说明"
          detail="记录适用该分支的判断依据"
        />
        <ContentBlock
          icon={<Table2 />}
          label="存货监盘程序表"
          detail="数据表 · 8 行程序"
        />
        {nested && depth < 1 ? (
          <ConditionalControlBlock
            depth={depth + 1}
            nested={false}
            otherwiseHasContent={false}
            type="single"
          />
        ) : null}
      </BranchLane>

      <div className="text-warning flex items-center gap-2 px-2 py-2 text-xs font-semibold">
        <span className="bg-warning/30 h-px flex-1" />
        <span>否则如果</span>
        <span className="bg-warning/30 h-px flex-1" />
      </div>

      <BranchLane
        label="否则如果"
        hint={`${example.operator} ${example.alternateExpected}`}
      >
        <EmptyBranch />
      </BranchLane>

      <div className="text-warning flex items-center gap-2 px-2 py-2 text-xs font-semibold">
        <span className="bg-warning/30 h-px flex-1" />
        <span>否则</span>
        <span className="bg-warning/30 h-px flex-1" />
      </div>

      <BranchLane label="否则" hint="未命中以上条件时使用">
        {otherwiseHasContent ? (
          <ContentBlock
            icon={<FileQuestion />}
            label="替代审计问题"
            detail="单选 · 必填"
          />
        ) : (
          <EmptyBranch />
        )}
      </BranchLane>

      <div className="h-2" aria-hidden="true" />
    </article>
  );
}

export function SmartFormConditionalBlockProposal() {
  const [questionType, setQuestionType] = useState<QuestionType>("single");
  const [nested, setNested] = useState(true);
  const [otherwiseHasContent, setOtherwiseHasContent] = useState(false);

  return (
    <section
      aria-label="SmartForm 分支问题条件块提案"
      className="overflow-hidden rounded-xl border bg-background shadow-sm"
      id="smart-form-conditional-block"
    >
      <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/15 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">分支问题条件块</h3>
            <Badge variant="outline">Approved</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            内容组合自由；分支问题与比较方式受限制。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup>
            {(Object.keys(conditionExamples) as QuestionType[]).map((type) => (
              <Button
                aria-pressed={questionType === type}
                key={type}
                onClick={() => setQuestionType(type)}
                size="sm"
                variant={questionType === type ? "secondary" : "outline"}
              >
                {conditionExamples[type].label}
              </Button>
            ))}
          </ButtonGroup>
          <Button
            aria-pressed={nested}
            onClick={() => setNested((value) => !value)}
            size="sm"
            variant={nested ? "secondary" : "outline"}
          >
            嵌套条件
          </Button>
          <Button
            aria-pressed={otherwiseHasContent}
            onClick={() => setOtherwiseHasContent((value) => !value)}
            size="sm"
            variant={otherwiseHasContent ? "secondary" : "outline"}
          >
            否则含内容
          </Button>
        </div>
      </header>

      <div className="grid gap-5 bg-muted/20 p-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 rounded-xl border border-border/70 bg-background p-3 md:p-5">
          <ConditionalControlBlock
            nested={nested}
            otherwiseHasContent={otherwiseHasContent}
            type={questionType}
          />
        </div>

        <aside className="grid content-start gap-3">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <h4 className="text-sm font-semibold text-foreground">首版约束</h4>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
              <li>每个条件块只拥有一个分支问题。</li>
              <li>允许最多八个有序、命名的条件分支。</li>
              <li>运行时执行第一个命中的分支。</li>
              <li>允许单选、多选和数字问题。</li>
              <li>分支可容纳任意 SmartForm 块。</li>
              <li>允许嵌套，最大三层。</li>
              <li>未回答时整个条件块处于待判断状态。</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <h4 className="text-sm font-semibold text-foreground">条件能力</h4>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary">单选 · 选择了</Badge>
              <Badge variant="secondary">多选 · 包含任一</Badge>
              <Badge variant="secondary">多选 · 包含全部</Badge>
              <Badge variant="secondary">数字 · &gt; ≥ = ≤ &lt;</Badge>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
