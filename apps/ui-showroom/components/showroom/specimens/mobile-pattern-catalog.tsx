"use client";

import {
  Button,
  CollectionState,
  MobileActionSheet,
  MobileListItem,
  MobileNavigation,
  MobilePageHeader,
  MobileSelectionRow,
  MobileComposer,
  MobileTextArea,
  MobileMessage,
  MobileAttachmentLink,
  MobileImageAttachment,
  ReviewNoteRichText,
  ProjectWingFileTypeIcon,
  ProjectWingTopBarAvatar,
} from "@project-wing/ui";
import { FileText, FolderClosed, ListTodo, UserRound } from "lucide-react";
import { useState } from "react";

export function MobilePatternCatalog() {
  const [open, setOpen] = useState(false);
  const [showError, setShowError] = useState(true);
  const [checked, setChecked] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState("");
  return (
    <div className="grid gap-10">
      <section id="file-icons" className="grid gap-4">
        <h2 className="text-xl font-semibold">文件类型图标</h2>
        <div className="grid gap-3">
          {[
            "Audit.sf",
            "Evidence.pdf",
            "Balances.xlsx",
            "Letter.docx",
            "Slides.pptx",
            "Other.archive",
          ].map((name) => (
            <div key={name} className="flex items-center gap-3">
              <ProjectWingFileTypeIcon fileName={name} size="sm" />
              <ProjectWingFileTypeIcon fileName={name} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </section>
      <section id="messages" className="grid gap-4">
        <h2 className="text-xl font-semibold">问题与回复</h2>
        <div className="max-w-lg">
          <MobileMessage
            author="Jony Ma"
            avatar={
              <ProjectWingTopBarAvatar
                name="Jony Ma"
                label="Jony Ma"
                size="sm"
              />
            }
            time="09/03 10:01"
            variant="initial"
          >
            <ReviewNoteRichText value="请核对**银行余额**并补充差异说明。" />
          </MobileMessage>
          <MobileMessage
            author="Eden Chan"
            avatar={
              <ProjectWingTopBarAvatar
                name="Eden Chan"
                label="Eden Chan"
                size="sm"
              />
            }
            time="09/10 11:08"
            attachments={
              <>
                <MobileAttachmentLink
                  fileName="银行余额核对及未达账项明细表.xlsx"
                  icon={
                    <ProjectWingFileTypeIcon
                      fileName="Balances.xlsx"
                      size="sm"
                    />
                  }
                  href="/specimens/MobileWorkspace#files"
                />
                <MobileImageAttachment
                  src="/mobile-media/balance-check.svg"
                  alt="余额核对示意图"
                  label="放大余额核对示意图"
                  onOpen={() => setImageOpen(true)}
                />
              </>
            }
          >
            <ReviewNoteRichText value="**已核对**，_差异说明_见附件。" />
          </MobileMessage>
        </div>
        <MobileActionSheet
          open={imageOpen}
          onOpenChange={setImageOpen}
          title="余额核对示意图"
          closeLabel="关闭图片"
        >
          <MobileImageAttachment
            src="/mobile-media/balance-check.svg"
            alt="余额核对示意图"
            label="关闭放大图片"
            expanded
            onOpen={() => setImageOpen(false)}
          />
        </MobileActionSheet>
      </section>
      <section id="navigation" className="grid gap-4">
        <h2 className="text-xl font-semibold">导航与返回</h2>
        <p className="text-sm text-muted-foreground">
          一级入口稳定留在底部；进入文件和批注后，改为带上下文的独立页面。
        </p>
        <div className="max-w-lg overflow-hidden rounded-xl border border-border">
          <MobilePageHeader
            title="银行存款核对"
            context="A-01 · Orchid 年度审计"
            back={{
              label: "返回底稿",
              href: "/specimens/MobileWorkspace#files",
            }}
          />
          <MobileNavigation
            label="底部导航样例"
            activeId="projects"
            items={[
              {
                id: "projects",
                label: "项目",
                href: "/specimens/MobileWorkspace#projects",
                icon: <FolderClosed aria-hidden />,
              },
              {
                id: "tasks",
                label: "待办",
                href: "/specimens/MobileWorkspace#tasks",
                icon: <ListTodo aria-hidden />,
              },
              {
                id: "account",
                label: "我的",
                href: "/specimens/MobileWorkspace#account",
                icon: <UserRound aria-hidden />,
              },
            ]}
          />
        </div>
      </section>
      <section id="lists" className="grid gap-4">
        <h2 className="text-xl font-semibold">触控列表</h2>
        <p className="text-sm text-muted-foreground">
          先显示名称、上下文和待办状态；整行可点，其他字段进入详情，不要求横向拖表格。
        </p>
        <div className="max-w-lg overflow-hidden rounded-xl border border-border">
          <MobileListItem
            title="Orchid 集团及附属公司合并财务报表审计"
            description="Orchid Technology Limited"
            meta="AUD-2026-018 · 3 条待处理"
            href="/specimens/MobileWorkspace#files"
            icon={<FolderClosed />}
          />
          <MobileListItem
            title="银行回函.pdf"
            description="A-03 · PDF · 256 KB"
            href="/specimens/MobileWorkspace#attachment"
            icon={<FileText />}
            showChevron={false}
            secondaryAction={
              <>
                <Button variant="quiet" disabled aria-label="P 签署">
                  P
                </Button>
                <Button variant="quiet" disabled aria-label="R 签署">
                  R
                </Button>
              </>
            }
          />
        </div>
      </section>
      <section id="overlays" className="grid gap-4">
        <h2 className="text-xl font-semibold">操作面板</h2>
        <p className="text-sm text-muted-foreground">
          短操作从底部打开，有明确关闭入口；长表单进入独立页面。样例不依赖滑动或长按才能找到操作。
        </p>
        <div>
          <Button onClick={() => setOpen(true)}>打开操作面板</Button>
        </div>
        <MobileActionSheet
          open={open}
          onOpenChange={setOpen}
          title="文件操作"
          description="组件样例，不修改业务数据。"
          closeLabel="关闭操作面板"
        >
          <Button variant="quiet" onClick={() => setOpen(false)}>
            查看文件详情
          </Button>
          <Button variant="quiet" disabled>
            离线时不可提交
          </Button>
          <label htmlFor="mobile-sheet-input">面板内输入</label>
          <MobileTextArea
            id="mobile-sheet-input"
            value={sheetDraft}
            onChange={(event) => setSheetDraft(event.currentTarget.value)}
            rows={2}
          />
        </MobileActionSheet>
      </section>
      <section id="selection-composer" className="grid gap-4">
        <h2 className="text-xl font-semibold">多选与会话输入</h2>
        <div className="max-w-lg overflow-hidden rounded-xl border border-border">
          <MobileSelectionRow
            title="银行回函.pdf"
            description="A-03 · PDF"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <MobileComposer
            label="样例回复"
            submitLabel="发送样例回复"
            value={draft}
            onValueChange={setDraft}
            onSubmit={() => {
              setSent(draft);
              setDraft("");
            }}
          />
        </div>
        {sent ? (
          <output className="text-sm text-muted-foreground">{sent}</output>
        ) : null}
        <p className="text-sm text-muted-foreground">
          选择模式中整行切换选中状态，不同时打开文件；输入支持换行，发送按钮明确提交当前会话。
        </p>
      </section>
      <section id="states" className="grid gap-4">
        <div id="multiline" className="grid max-w-lg gap-3">
          <label htmlFor="mobile-notes-default">备注</label>
          <MobileTextArea
            id="mobile-notes-default"
            rows={3}
            defaultValue="核对本期余额。"
          />
          <MobileTextArea aria-label="不可编辑的备注" disabled value="已锁定" />
          <MobileTextArea
            aria-label="需要修正的备注"
            aria-invalid
            aria-describedby="mobile-notes-error"
          />
          <p id="mobile-notes-error" className="text-sm text-destructive">
            请检查备注内容
          </p>
        </div>
        <h2 className="text-xl font-semibold">状态与恢复</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CollectionState kind="empty" locale="zh-CN" />
          <CollectionState
            kind={showError ? "error" : "empty"}
            locale="zh-CN"
            onRetry={() => setShowError(false)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          统一采用 48 CSS px
          的主要触控目标。手机键盘、真实安全区与文件能力仍需真机验证，不把窄窗口模拟当作真机验收。
        </p>
      </section>
    </div>
  );
}
