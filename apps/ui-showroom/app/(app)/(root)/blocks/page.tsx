import Link from "next/link";

import { MetricStrip } from "@/components/showroom/metric-strip";
import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { PdfTemplateDesignerProposal } from "@/components/showroom/pdf-template-designer-proposal";
import { SmartFormConditionalBlockProposal } from "@/components/showroom/smart-form-conditional-block-proposal";
import { SmartFormEditorChromeProposal } from "@/components/showroom/smart-form-editor-chrome-proposal";
import { SmartFormPdfWorkpaperProposal } from "@/components/showroom/smart-form-pdf-workpaper-proposal";
import { TmsProjectApprovalHierarchyProposal } from "@/components/showroom/tms-project-approval-hierarchy-proposal";
import { Badge } from "@/components/ui/badge";

const blockConcepts = [
  {
    description: "Navigation rail, task header, and dense working canvas.",
    label: "Workspace shell",
  },
  {
    description: "Filterable evidence rows with explicit review actions.",
    label: "Approval queue",
  },
  {
    description: "Isolated specimen paired with complete source disclosure.",
    label: "Evidence inspector",
  },
] as const;

export default function BlocksPage() {
  return (
    <main className="flex flex-col gap-10 pb-16">
      <ShowroomPageHeader
        actions={<Badge variant="secondary">In review</Badge>}
        description="Block-level layouts stay provisional until rendered review produces an accepted visual vocabulary. The SmartForm PDF workpaper is the current material-change review surface."
        title="Blocks"
      />
      <MetricStrip
        items={[
          { label: "Proposed blocks", value: blockConcepts.length + 2 },
          { label: "Approved", value: 2 },
          { label: "In review", value: 3 },
          { label: "Direction", value: "Fluent-inspired" },
        ]}
      />
      <Link
        href="/mobile"
        className="rounded-lg border p-4 text-sm font-medium underline underline-offset-4"
      >
        手机工作台：导航、触控列表、底部操作面板与会话样例（Experimental）
      </Link>
      <Link
        href="/specimens/DataWorkbench"
        className="rounded-lg border p-4 text-sm font-medium underline underline-offset-4"
      >
        共享数据工作台：工具栏、分页、长文本、头像与窄窗口检查
      </Link>
      <section className="grid gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              SmartForm PDF audit workpaper
            </h2>
            <Badge variant="outline">Proposed</Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            A print-first document system that gives every legal SmartForm AST
            the identity, hierarchy, density, evidence traceability, and
            pagination discipline of a formal audit working paper.
          </p>
        </div>
        <SmartFormPdfWorkpaperProposal />
      </section>
      <section className="grid gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              TMS project approval hierarchy
            </h2>
            <Badge variant="outline">In review</Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            A focused master-detail workbench selects one CMP Engagement at a
            time, while its EMP projects expose the approval boundary, blockers,
            employee evidence, and explicit batch scope.
          </p>
        </div>
        <TmsProjectApprovalHierarchyProposal />
      </section>
      <section className="grid gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              PDF template designer
            </h2>
            <Badge variant="outline">In review</Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            An experimental pdfme adapter using a real generated PDF base,
            ProjectWing business-binding names, and a designer/form switch that
            makes viewer remounts observable while fields are edited.
          </p>
        </div>
        <PdfTemplateDesignerProposal />
      </section>
      <section className="grid gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              SmartForm editor chrome
            </h2>
            <Badge variant="outline">Approved</Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            A Fluent-inspired command surface with compact grouped actions, calm
            neutral layers, restrained ProjectWing green, and a selected
            template rail that keeps metadata readable without exposing danger
            actions by default.
          </p>
        </div>
        <SmartFormEditorChromeProposal />
      </section>
      <section className="grid gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              SmartForm conditional content
            </h2>
            <Badge variant="outline">Approved</Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            A Scratch-inspired E-shaped branch container adapted for auditors:
            one constrained branch question controls two freely composable
            SmartForm content regions, including nested conditional blocks.
          </p>
        </div>
        <SmartFormConditionalBlockProposal />
      </section>
      <section className="grid gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-3">
        {blockConcepts.map((block, index) => (
          <article
            className="flex min-h-64 flex-col bg-background p-5"
            key={block.label}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">{block.label}</h2>
              <Badge variant="outline">0{index + 1}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {block.description}
            </p>
            <div className="mt-6 flex flex-1 flex-col gap-2 rounded-lg border border-dashed p-3">
              <div className="h-7 w-2/3 rounded-md bg-muted" />
              <div className="grid flex-1 grid-cols-[4rem_minmax(0,1fr)] gap-2">
                <div className="rounded-md bg-muted/70" />
                <div className="rounded-md border bg-background" />
              </div>
            </div>
          </article>
        ))}
      </section>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        The conditional specimen is the approved visual contract for the
        first-class SmartForm conditional AST node and its product-editor
        implementation.
      </p>
    </main>
  );
}
