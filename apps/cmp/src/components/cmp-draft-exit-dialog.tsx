"use client";

import { Button, Input } from "@project-wing/ui";

import { useCmpI18n } from "../i18n/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function CmpDraftExitDialog({
  open,
  draftName,
  isSaving = false,
  onDraftNameChange,
  onKeepAndExit,
  onOpenChange,
}: {
  open: boolean;
  draftName: string;
  isSaving?: boolean;
  onDraftNameChange: (value: string) => void;
  onKeepAndExit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useCmpI18n();
  const isChinese = locale === "zh-CN";
  const validName = Boolean(draftName.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        closeLabel={isChinese ? "关闭" : "Close"}
      >
        <DialogHeader>
          <DialogTitle>{isChinese ? "退出表单？" : "Exit form?"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-6 text-muted-foreground">
          {isChinese
            ? "当前内容尚未提交审批。保留草稿后，你可以在列表中继续编辑。"
            : "This work has not been submitted. Keep a draft to continue editing it from the list."}
        </p>
        <label className="grid gap-2 text-sm font-medium">
          {isChinese ? "草稿名称" : "Draft name"}
          <Input
            autoFocus
            aria-invalid={!validName}
            maxLength={100}
            placeholder={
              isChinese ? "输入临时草稿名称" : "Enter a temporary draft name"
            }
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
          />
          {validName ? null : (
            <span className="text-xs font-normal text-destructive">
              {isChinese
                ? "保存草稿前必须填写名称。"
                : "A draft name is required."}
            </span>
          )}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            disabled={isSaving}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {isChinese ? "继续填写" : "Continue editing"}
          </Button>
          <Button
            disabled={!validName || isSaving}
            type="button"
            onClick={onKeepAndExit}
          >
            {isSaving
              ? isChinese
                ? "正在保存..."
                : "Saving..."
              : isChinese
                ? "保留草稿并退出"
                : "Keep draft and exit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
