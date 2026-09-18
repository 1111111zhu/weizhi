"use client";

import { Badge, Button, ButtonGroup } from "@project-wing/ui";
import {
  Check,
  FileCheck2,
  Files,
  FileText,
  GitBranch,
  Languages,
  ListTree,
  Paperclip,
  TableProperties,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

const procedureRows = [
  {
    procedure: "1 取得并检查本年度相关数据，核对总账与明细账。",
    performed: "是",
    result: "满意",
    reference: "1100.5.2 · 银行函证",
    note: "无例外",
  },
  {
    procedure: "2(a) 将本期数据与以前期间数据进行比较。",
    performed: "是",
    result: "满意",
    reference: "A1-1200-F003",
    note: "变动 8.4%",
  },
  {
    procedure: "2(b) 复核并比较关键比率或其他绩效指标。",
    performed: "是",
    result: "满意",
    reference: "A1-1200-F004",
    note: "已复核",
  },
  {
    procedure: "3 复核超过执行重要性水平或其他异常的项目。",
    performed: "不适用",
    result: "—",
    reference: "—",
    note: "本期无异常",
  },
] as const;

const documentCoverage = [
  "章节与分组",
  "富文本",
  "七类字段",
  "条件分支",
  "固定表格",
  "可重复表格",
  "跨页与双语",
] as const;

type Specimen =
  | "programme"
  | "fields"
  | "rich-text"
  | "paged"
  | "signoffs"
  | "english";
type BranchState = "matched" | "otherwise" | "unanswered";
type Signatory = { date: string; name: string };

const paperClass =
  "mx-auto flex aspect-[210/297] w-full max-w-[50rem] flex-col bg-white px-[9.5%] py-[7%] font-serif text-slate-900 shadow-[0_18px_45px_rgb(15_23_42/0.16)] ring-1 ring-slate-950/10";

function DocumentMasthead({
  approvalPending = false,
  approvers,
  language = "zh",
  preparers,
  title,
}: {
  approvalPending?: boolean;
  approvers?: readonly Signatory[];
  language?: "zh" | "en";
  preparers?: readonly Signatory[];
  title: string;
}) {
  const isEnglish = language === "en";
  const metadata = isEnglish
    ? [
        ["Client", "Orchid Technology Limited"],
        ["Engagement", "ORC-2026-AUD"],
        ["Reporting date", "31 December 2026"],
        ["Status", approvalPending ? "Pending approval" : "Complete"],
      ]
    : [
        ["客户", "Orchid Technology Limited"],
        ["业务编号", "ORC-2026-AUD"],
        ["财务报表日期", "2026-12-31"],
        ["状态", approvalPending ? "待审批签核" : "已完成"],
      ];
  const preparerList = preparers ?? [
    { date: isEnglish ? "4 Sep 2026" : "2026-09-04", name: "Jony Ma" },
  ];
  const approverList = approvalPending
    ? [{ date: isEnglish ? "Pending" : "待签核", name: "—" }]
    : (approvers ?? [
        { date: isEnglish ? "5 Sep 2026" : "2026-09-05", name: "Eden Chan" },
      ]);
  const signatoryGroups = [
    {
      label: isEnglish ? "Prepared and signed by" : "编制签核人",
      people: preparerList,
    },
    {
      label: isEnglish ? "Approved and signed by" : "审批签核人",
      people: approverList,
    },
  ];

  return (
    <header className="mb-5 text-center font-serif text-slate-950">
      <h3 className="font-sans text-[24px] leading-tight font-normal">
        {title}
      </h3>
      <div className="mx-auto mt-4 grid max-w-[34rem] grid-cols-2 gap-10 text-left">
        {signatoryGroups.map((group) => (
          <div key={group.label}>
            <p className="border-b border-slate-300 pb-1 font-sans text-[8px] font-normal text-slate-600">
              {group.label}
            </p>
            <div className="mt-1.5 grid gap-1">
              {group.people.map((person) => (
                <p
                  className="flex items-baseline justify-between gap-3 text-[10px]"
                  key={`${group.label}-${person.name}-${person.date}`}
                >
                  <span className="font-normal">{person.name}</span>
                  <span className="font-sans text-[8px] text-slate-600">
                    {person.date}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-4 border-y border-slate-400 py-2 text-left font-serif">
        {metadata.map(([label, value], index) => (
          <div
            className={index === 0 ? "pr-3" : "border-l border-slate-200 px-3"}
            key={label}
          >
            <dt className="font-sans text-[8px] font-normal text-slate-600">
              {label}
            </dt>
            <dd className="mt-0.5 truncate text-[9px] font-medium text-slate-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function DocumentFooter({ page }: { page: string }) {
  return (
    <footer className="mt-auto border-t border-slate-300 pt-2 text-center font-serif text-[8px] text-slate-500">
      <span className="font-mono">— {page} —</span>
    </footer>
  );
}

function SectionHeading({
  children,
  level = 1,
  title,
  description,
}: {
  children?: ReactNode;
  level?: 1 | 2 | 3;
  title: string;
  description?: string;
}) {
  const containerClass = {
    1: "mt-9",
    2: "mt-4",
    3: "mt-3 ml-4",
  }[level];
  const headingClass = level === 1 ? "text-center" : "";
  const titleClass = {
    1: "text-[18px]",
    2: "text-[16px]",
    3: "text-[14px]",
  }[level];

  return (
    <section className={containerClass}>
      <div className="min-w-0">
        <div className={headingClass}>
          <h4 className={`${titleClass} font-sans font-normal text-slate-950`}>
            {title}
          </h4>
          {description ? (
            <p className="mt-1.5 text-left font-serif text-[10px] leading-relaxed text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function ProcedureSpecimen() {
  return (
    <article aria-label="审计程序表 PDF 提案" className={paperClass}>
      <DocumentMasthead title="递延收入审计程序" />

      <section className="mt-5 text-[11px] leading-relaxed text-slate-800">
        <p className="font-semibold">审计目标</p>
        <ol className="mt-2 grid gap-1 pl-[2em]">
          <li>1. 确保递延收入已正确核算且记录完整。</li>
          <li>2. 确认余额已获得适当列报和说明。</li>
        </ol>
      </section>

      <SectionHeading
        description="执行程序、记录结论，并保留可追溯的底稿引用。"
        title="一般审计程序"
      >
        <SectionHeading
          description="了解收入模式与关键流程，识别本期显著变动和异常关系。"
          level={2}
          title="风险识别与分析性复核"
        >
          <SectionHeading
            description="将本年度数据与以前期间、预算及关键经营指标进行比较。"
            level={3}
            title="收入趋势与关键比率"
          >
            <table className="mt-3 w-full table-fixed border-collapse text-left font-serif text-[9px] leading-[1.45]">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[23%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-y-2 border-slate-700 text-slate-800">
                  {["审计程序", "执行", "结果", "底稿引用", "备注"].map(
                    (label) => (
                      <th
                        className="px-2 py-1.5 font-sans font-normal"
                        key={label}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {procedureRows.map((row) => (
                  <tr
                    className="align-top last:border-b-2 last:border-slate-700"
                    key={row.procedure}
                  >
                    <td className="px-2 py-2 font-medium text-slate-800">
                      {row.procedure}
                    </td>
                    <td className="px-2 py-2">{row.performed}</td>
                    <td className="px-2 py-2">{row.result}</td>
                    <td className="px-2 py-2 font-mono text-[7.3px] text-slate-700">
                      {row.reference}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionHeading>
        </SectionHeading>
      </SectionHeading>

      <SectionHeading
        description="评估程序是否充分覆盖认定，并记录尚待取得的审计证据。"
        title="列报与披露"
      >
        <div className="mt-3 border-y-2 border-slate-700 font-serif text-[9px]">
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] border-b border-slate-500 px-2 py-1.5 font-semibold text-slate-800">
            <span className="font-sans">审计程序</span>
            <span className="text-center font-sans">结果</span>
            <span className="font-sans">底稿引用</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem] items-start border-t border-slate-200 px-2 py-2">
            <span>确认会计估计充分，并由适当证据支持。</span>
            <span className="text-center text-slate-600">未填写</span>
            <span className="font-mono text-slate-600">—</span>
          </div>
        </div>
      </SectionHeading>
      <DocumentFooter page="1 / 2" />
    </article>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-slate-200 py-2.5 last:border-b-0">
      <div className="pr-4 font-sans text-[9.5px] font-normal text-slate-700">
        {label}
      </div>
      <div className="font-serif text-[10px] leading-relaxed text-slate-900">
        {children}
      </div>
    </div>
  );
}

function ConditionalOutcome({ state }: { state: BranchState }) {
  if (state === "unanswered") {
    return (
      <p className="mt-3 bg-slate-50 px-4 py-3 font-serif text-[10px] text-slate-600 italic">
        分支问题尚未回答。条件内容不会进入 PDF，底稿保留“待判断”状态。
      </p>
    );
  }

  const matched = state === "matched";
  return (
    <div className="mt-3 rounded-sm bg-sky-50 px-4 py-3 font-serif text-[10px] leading-relaxed text-slate-700">
      <p className="font-semibold text-slate-900">
        {matched ? "命中分支：发现控制偏差" : "否则分支：未发现控制偏差"}
      </p>
      <p className="mt-1">
        {matched
          ? "已识别 1 项审批时间差异；经检查属于时区记录差异，对控制结论无影响。"
          : "本期抽取的样本均按既定审批流程执行，无需追加偏差测试。"}
      </p>
    </div>
  );
}

function MixedFormSpecimen({ branchState }: { branchState: BranchState }) {
  return (
    <article aria-label="混合 SmartForm PDF 提案" className={paperClass}>
      <DocumentMasthead
        approvalPending={branchState === "unanswered"}
        title="收入确认控制测试记录"
      />

      <div className="mt-5 rounded-sm bg-sky-50 px-4 py-3 text-[10px] leading-relaxed text-slate-700">
        本底稿记录关键控制的设计与执行情况。条件问题只展示当前有效分支，未触发内容不会进入归档快照。
      </div>

      <SectionHeading title="测试范围与结论">
        <div className="mt-1">
          <FieldRow label="控制负责人">
            <span className="font-medium">
              Eden Chan · Financial Controller
            </span>
          </FieldRow>
          <FieldRow label="测试期间">
            <span className="font-mono">2026-01-01 — 2026-12-31</span>
          </FieldRow>
          <FieldRow label="控制是否按设计执行">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
              <Check className="size-3" /> 是，未发现例外
            </span>
          </FieldRow>
          <FieldRow label="测试样本数量">
            <span className="font-mono">25</span>
          </FieldRow>
          <FieldRow label="审计结论">
            控制在测试期间持续运行。<strong>除已说明事项外</strong>
            ，未发现影响控制有效性的例外。
          </FieldRow>
          <FieldRow label="底稿引用">
            <span className="font-mono">B2-3100-F005 · 销售样本测试</span>
          </FieldRow>
          <FieldRow label="支持性附件">
            <span className="inline-flex items-center gap-1.5">
              <Paperclip className="size-3 text-slate-500" />
              approval-workflow-evidence.pdf
            </span>
          </FieldRow>
        </div>
      </SectionHeading>

      <SectionHeading
        description="仅当存在控制偏差时展示此条件分支。"
        title="偏差评估"
      >
        <ConditionalOutcome state={branchState} />
      </SectionHeading>

      <SectionHeading title="偏差明细">
        <table className="mt-3 w-full table-fixed border-collapse text-left font-serif text-[9px] leading-[1.45]">
          <thead>
            <tr className="border-y-2 border-slate-700 text-slate-800">
              {["样本", "测试日期", "金额", "测试结果", "处理结论"].map(
                (label) => (
                  <th className="px-2 py-1.5 font-sans font-normal" key={label}>
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[
              ["INV-260184", "2026-06-30", "HKD 128,400", "通过", "无例外"],
              ["INV-260317", "2026-09-29", "HKD 86,250", "偏差", "已解释"],
              ["INV-260491", "2026-12-18", "HKD 214,000", "通过", "无例外"],
            ].map((row) => (
              <tr
                className="last:border-b-2 last:border-slate-700"
                key={row[0]}
              >
                {row.map((cell, index) => (
                  <td
                    className={
                      index < 3
                        ? "px-2 py-2 font-mono text-[7.3px]"
                        : "px-2 py-2"
                    }
                    key={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionHeading>
      <DocumentFooter page="1 / 1" />
    </article>
  );
}

function RichTextSpecimen() {
  return (
    <article aria-label="富文本与静态内容 PDF 提案" className={paperClass}>
      <DocumentMasthead title="会计估计审计说明" />

      <SectionHeading
        description="静态内容直接形成正式正文，不显示为可填写字段或输入框。"
        title="审计背景"
      >
        <p className="mt-3 indent-[2em] text-[11px] leading-[1.8] text-slate-800">
          管理层于报告期末对预计信用损失模型进行了更新。本段由 SmartForm
          静态文本节点生成，支持<strong>重点结论</strong>、<em>专业判断</em>、
          <span className="border-b border-slate-500">外部链接</span>及
          <code className="mx-1 bg-slate-100 px-1 font-mono text-[9px]">
            IFRS_9
          </code>
          等行内标记。
        </p>

        <SectionHeading title="已执行工作" level={2}>
          <div className="mt-3 grid grid-cols-2 gap-8 text-[10px] leading-relaxed">
            <ol className="grid gap-1.5 pl-[2em]">
              <li>1. 获取模型及关键参数清单。</li>
              <li>2. 复核历史损失率和前瞻性调整。</li>
              <li>3. 与独立预期区间进行比较。</li>
            </ol>
            <ul className="grid gap-1.5 pl-[1.5em]">
              <li>• 数据完整性已核对</li>
              <li>• 关键假设已质询</li>
              <li>• 敏感性分析已复核</li>
            </ul>
          </div>
        </SectionHeading>

        <SectionHeading title="关键专业判断" level={3}>
          <blockquote className="mt-3 border-l-2 border-slate-500 pl-4 text-[10px] leading-[1.8] text-slate-700">
            “在可获得证据的范围内，管理层采用的宏观经济权重处于合理区间。”
          </blockquote>
          <p className="mt-3 text-[10px] text-slate-600">
            嵌入引用：
            <span className="font-mono text-slate-900">
              C1-2100-F003 · ECL 模型测试
            </span>
          </p>
        </SectionHeading>
      </SectionHeading>

      <SectionHeading title="静态表格">
        <table className="mt-3 w-full table-fixed border-collapse text-left font-serif text-[9px] leading-[1.45]">
          <thead>
            <tr className="border-y-2 border-slate-700">
              {["情景", "权重", "损失率", "独立区间", "评价"].map((label) => (
                <th className="px-2 py-1.5 font-sans font-normal" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["基准", "60%", "1.84%", "1.70%–2.05%", "合理"],
              ["上行情景", "15%", "1.21%", "1.10%–1.35%", "合理"],
              ["下行情景", "25%", "2.96%", "2.75%–3.10%", "合理"],
            ].map((row) => (
              <tr
                className="last:border-b-2 last:border-slate-700"
                key={row[0]}
              >
                {row.map((cell) => (
                  <td className="px-2 py-2" key={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionHeading>
      <DocumentFooter page="1 / 1" />
    </article>
  );
}

const pagedRows = Array.from({ length: 18 }, (_, index) => ({
  sample: `INV-26${String(index + 101).padStart(4, "0")}`,
  date: `2026-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 24) + 1).padStart(2, "0")}`,
  amount: `HKD ${(48_000 + index * 7350).toLocaleString("en-US")}`,
  result: index === 12 ? "偏差" : "通过",
  reference: `C3-${String(4201 + index)}`,
}));

function PagedSheetTable({ rows }: { rows: typeof pagedRows }) {
  return (
    <table className="mt-4 w-full table-fixed border-collapse text-left font-serif text-[9px] leading-[1.45]">
      <thead>
        <tr className="border-y-2 border-slate-700">
          {["样本编号", "测试日期", "金额", "测试结果", "底稿引用"].map(
            (label) => (
              <th className="px-2 py-2 font-sans font-normal" key={label}>
                {label}
              </th>
            )
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            className="last:border-b-2 last:border-slate-700"
            key={row.sample}
          >
            <td className="px-2 py-2 font-mono text-[8px]">{row.sample}</td>
            <td className="px-2 py-2 font-mono text-[8px]">{row.date}</td>
            <td className="px-2 py-2 font-mono text-[8px]">{row.amount}</td>
            <td className="px-2 py-2">{row.result}</td>
            <td className="px-2 py-2 font-mono text-[8px]">{row.reference}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PagedSheetSpecimen() {
  return (
    <div aria-label="可重复表格跨页 PDF 提案" className="grid gap-8">
      <article className={paperClass}>
        <DocumentMasthead title="销售样本测试明细" />
        <SectionHeading
          description="可重复表格在分页处自动拆分；表头会在下一页重新出现。"
          title="样本测试结果"
        >
          <PagedSheetTable rows={pagedRows.slice(0, 10)} />
        </SectionHeading>
        <DocumentFooter page="1 / 2" />
      </article>
      <article className={paperClass}>
        <header className="flex items-center justify-between border-b border-slate-500 pb-2 font-serif text-[9px] text-slate-600">
          <span>销售样本测试明细</span>
          <span className="font-mono">C3-4200-F008</span>
        </header>
        <SectionHeading
          description="连续页保留文档识别信息和重复表头，但不重复完整封面信息。"
          title="样本测试结果（续）"
        >
          <PagedSheetTable rows={pagedRows.slice(10)} />
          <p className="mt-5 bg-sky-50 px-4 py-3 text-[10px] leading-relaxed text-slate-700">
            总体结论：18 个样本中发现 1 项时间性偏差，已取得解释及支持文件。
          </p>
        </SectionHeading>
        <DocumentFooter page="2 / 2" />
      </article>
    </div>
  );
}

function EnglishSpecimen() {
  return (
    <article
      aria-label="English SmartForm PDF proposal"
      className={paperClass}
      lang="en"
    >
      <DocumentMasthead
        language="en"
        title="Revenue Recognition Control Test"
      />
      <SectionHeading
        description="Long localized content follows the same EasyPaper typographic hierarchy without switching to a template-specific layout."
        title="Scope and conclusion"
      >
        <p className="mt-3 text-[11px] leading-[1.75] text-slate-800">
          We evaluated whether the monthly revenue cut-off control was designed
          and implemented effectively throughout the reporting period. The
          control owner reconciles dispatch records to invoices and documents
          all exceptions before the ledger is closed.
        </p>
        <div className="mt-3">
          <FieldRow label="Control owner">
            Eden Chan · Financial Controller
          </FieldRow>
          <FieldRow label="Population">12 monthly reconciliations</FieldRow>
          <FieldRow label="Conclusion">
            Operating effectively; no exception affected the financial
            statements.
          </FieldRow>
          <FieldRow label="Working-paper reference">
            <span className="font-mono">D1-5100-F007</span>
          </FieldRow>
        </div>
      </SectionHeading>
      <SectionHeading title="Test results">
        <table className="mt-3 w-full table-fixed border-collapse text-left font-serif text-[9px] leading-[1.45]">
          <thead>
            <tr className="border-y-2 border-slate-700">
              {["Period", "Prepared", "Reviewed", "Result"].map((label) => (
                <th className="px-2 py-2 font-sans font-normal" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["March 2026", "03 Apr 2026", "05 Apr 2026", "Pass"],
              ["June 2026", "04 Jul 2026", "06 Jul 2026", "Pass"],
              ["September 2026", "03 Oct 2026", "05 Oct 2026", "Pass"],
            ].map((row) => (
              <tr
                className="last:border-b-2 last:border-slate-700"
                key={row[0]}
              >
                {row.map((cell) => (
                  <td className="px-2 py-2" key={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionHeading>
      <DocumentFooter page="1 / 1" />
    </article>
  );
}

function MultiSignoffSpecimen() {
  const preparers = [
    { date: "2026-09-02", name: "Jony Ma" },
    { date: "2026-09-03", name: "King Su" },
    { date: "2026-09-03", name: "Senior Wang" },
  ] as const;
  const approvers = [
    { date: "2026-09-04", name: "Manager Li" },
    { date: "2026-09-05", name: "Eden Chan" },
    { date: "2026-09-06", name: "Partner Chen" },
  ] as const;

  return (
    <article aria-label="多人签核 PDF 提案" className={paperClass}>
      <DocumentMasthead
        approvers={approvers}
        preparers={preparers}
        title="集团审计最终结论"
      />
      <SectionHeading
        description="签核人员按角色分组，姓名和日期只在作者位置出现一次；不会以“+N”折叠审计证据。"
        title="最终结论"
      >
        <p className="mt-4 indent-[2em] text-[11px] leading-[1.8] text-slate-800">
          根据已执行的审计程序及取得的审计证据，项目组认为本业务不存在需要调整总体审计结论的未解决事项。所有编制和审批层级均已完成签核。
        </p>
      </SectionHeading>
      <DocumentFooter page="1 / 1" />
    </article>
  );
}

export function SmartFormPdfWorkpaperProposal() {
  const [specimen, setSpecimen] = useState<Specimen>("programme");
  const [branchState, setBranchState] = useState<BranchState>("matched");
  const specimenOptions: {
    icon: ReactNode;
    label: string;
    value: Specimen;
  }[] = [
    { icon: <TableProperties />, label: "审计程序", value: "programme" },
    { icon: <FileText />, label: "字段与条件", value: "fields" },
    { icon: <ListTree />, label: "富文本", value: "rich-text" },
    { icon: <Files />, label: "跨页表格", value: "paged" },
    { icon: <UsersRound />, label: "多人签核", value: "signoffs" },
    { icon: <Languages />, label: "English", value: "english" },
  ];

  return (
    <section
      aria-label="SmartForm PDF 审计底稿提案"
      className="overflow-hidden rounded-xl border bg-background shadow-sm"
      id="smart-form-pdf-workpaper"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileCheck2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              EasyPaper · SmartForm 审计底稿
            </h3>
            <p className="text-xs text-muted-foreground">
              EasyPaper 0.2.2 排版基础 · ProjectWing AST 语义适配层
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {specimenOptions.map((option) => (
            <Button
              aria-pressed={specimen === option.value}
              key={option.value}
              onClick={() => setSpecimen(option.value)}
              size="sm"
              variant={specimen === option.value ? "secondary" : "outline"}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap gap-2">
          {documentCoverage.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
        {specimen === "fields" ? (
          <ButtonGroup aria-label="条件分支映射状态">
            {(
              [
                ["matched", "命中：是"],
                ["otherwise", "否则"],
                ["unanswered", "未回答"],
              ] as const
            ).map(([value, label]) => (
              <Button
                aria-pressed={branchState === value}
                key={value}
                onClick={() => setBranchState(value)}
                size="sm"
                variant={branchState === value ? "secondary" : "outline"}
              >
                <GitBranch />
                {label}
              </Button>
            ))}
          </ButtonGroup>
        ) : null}
      </div>
      <div className="overflow-auto bg-slate-200/65 p-5 sm:p-8 dark:bg-slate-950/55">
        {specimen === "programme" ? <ProcedureSpecimen /> : null}
        {specimen === "fields" ? (
          <MixedFormSpecimen branchState={branchState} />
        ) : null}
        {specimen === "rich-text" ? <RichTextSpecimen /> : null}
        {specimen === "paged" ? <PagedSheetSpecimen /> : null}
        {specimen === "signoffs" ? <MultiSignoffSpecimen /> : null}
        {specimen === "english" ? <EnglishSpecimen /> : null}
      </div>
    </section>
  );
}
