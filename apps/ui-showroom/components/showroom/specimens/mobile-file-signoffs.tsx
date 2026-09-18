"use client";

import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
  validateSmartFormV2Response,
} from "@project-wing/shared";
import {
  Button,
  MobileActionSheet,
  ProjectWingTopBarAvatar,
} from "@project-wing/ui";
import { Check, FilePenLine } from "lucide-react";
import { useState } from "react";

import { mobileAccountFixture } from "./mobile-account-model";
import {
  applyMobileSignoff,
  canRevokeMobileSignoff,
  currentMobileSignoffs,
  revokeMobileSignoff,
} from "./mobile-signoff-model";
import type { MobileSignoffActor } from "./mobile-signoff-model";
import {
  isImportedMobileSmartForm,
  mobileFileKey,
} from "./mobile-workspace-model";
import type { MobileFile } from "./mobile-workspace-model";
import { updateMobileState } from "./mobile-workspace-state";
import type { MobileWorkspaceContext } from "./mobile-workspace-state";

// Explicit preview membership, not inferred production authority from the account grade.
const actor: MobileSignoffActor = {
  id: "mobile-preview-alex",
  name: mobileAccountFixture.name,
  globalRole: mobileAccountFixture.globalRole,
  projectRole: "REVIEWER",
};
const importedComplete = validateSmartFormV2Response(
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
).success;

export function MobileFileSignoffs({
  workspace,
  file,
}: {
  workspace: MobileWorkspaceContext;
  file: MobileFile;
}) {
  const [kind, setKind] = useState<"P" | "R" | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openedAt, setOpenedAt] = useState(0);
  const target = mobileFileKey(workspace.route.project, file.id);
  const records = workspace.state.signoffs.filter(
    (item) => item.target === target
  );
  const current = currentMobileSignoffs(records);
  const complete = !isImportedMobileSmartForm(file) || importedComplete;
  const noPreparer = !current.some((item) => item.type === "P");
  const selfReview = current.some(
    (item) => item.type === "P" && item.userId === actor.id
  );
  const reviewCoolingDown = records.some(
    (item) =>
      item.type === "R" &&
      item.userId === actor.id &&
      !item.revokedAt &&
      openedAt - Date.parse(item.signedAt) < 86_400_000
  );
  const blockedReason = complete
    ? kind === "R" && noPreparer
      ? "请先完成 P 签署"
      : kind === "R" && reviewCoolingDown
        ? "同一复核人需间隔 24 小时再次签署 R"
        : ""
    : "请先完成必填内容";
  const sign = (confirmed = false) => {
    if (!kind) {
      return;
    }
    if (kind === "R" && selfReview && !confirmed) {
      setConfirmation("self-review");
      return;
    }
    let failure = "";
    updateMobileState((state) => {
      const result = applyMobileSignoff(state.signoffs, {
        target,
        actor,
        type: kind,
        now: new Date().toISOString(),
        id: crypto.randomUUID(),
        confirmSelfReview: confirmed,
        mutable: true,
        complete,
      });
      failure = result.error ?? "";
      return { ...state, signoffs: result.records };
    });
    setError(failure);
    setConfirmation(null);
  };
  const revoke = (id: string) => {
    let failure = "";
    updateMobileState((state) => {
      const result = revokeMobileSignoff(
        state.signoffs,
        id,
        target,
        actor,
        new Date().toISOString(),
        true
      );
      failure = result.error ?? "";
      return { ...state, signoffs: result.records };
    });
    setError(failure);
    setConfirmation(null);
  };
  return (
    <>
      {(["P", "R"] as const).map((type) => {
        const count = current.filter((item) => item.type === type).length;
        return (
          <Button
            key={type}
            variant="quiet"
            className="pw-mobile-icon-action"
            aria-label={`查看${file.name}的${type}签署，${count}条记录`}
            aria-haspopup="dialog"
            onClick={() => {
              setOpenedAt(Date.now());
              setKind(type);
              setError("");
              setConfirmation(null);
            }}
          >
            <span
              className={
                type === "P" ? "text-success-text" : "text-warning-text"
              }
            >
              {type}
            </span>
            {count ? <span className="text-xs">{count}</span> : null}
          </Button>
        );
      })}
      <MobileActionSheet
        open={kind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setKind(null);
            setConfirmation(null);
          }
        }}
        title={`${kind ?? "P"} 签署`}
        closeLabel="关闭签署"
      >
        {records.filter((item) => item.type === kind).length ? (
          <ul
            aria-label="签署记录"
            className="max-h-64 divide-y divide-border overflow-y-auto border-t border-border"
          >
            {records
              .filter((item) => item.type === kind)
              .toReversed()
              .map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <ProjectWingTopBarAvatar
                    name={item.userName}
                    label={item.userName}
                    size="sm"
                    aria-hidden
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold break-words">
                        {item.userName}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${!item.revokedAt && current.includes(item) ? (kind === "P" ? "text-success-text" : "text-warning-text") : "text-muted-foreground"}`}
                      >
                        {!item.revokedAt && current.includes(item) ? (
                          <Check className="size-3" aria-hidden />
                        ) : null}
                        {item.revokedAt
                          ? "已撤销"
                          : current.includes(item)
                            ? "已签署"
                            : "历史签署"}
                      </span>
                    </div>
                    <time
                      dateTime={item.signedAt}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {new Date(item.signedAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </time>
                  </div>
                  {canRevokeMobileSignoff(item, actor, true) ? (
                    <Button
                      variant="quiet"
                      aria-label={`撤销${item.userName}的${kind}签署`}
                      onClick={() => {
                        setConfirmation(item.id);
                        setError("");
                      }}
                    >
                      <span className="text-xs font-normal">撤销</span>
                    </Button>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 border-t border-border py-3 text-muted-foreground">
            <FilePenLine className="size-5" aria-hidden />
            <p className="text-sm">尚未签署 {kind}</p>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {confirmation ? (
          <div className="pw-mobile-sheet-footer grid gap-3 border-t border-border pt-3">
            <p className="text-sm">
              {confirmation === "self-review"
                ? "你已签署 P，确定继续进行自我复核？"
                : "确定撤销这条签署？"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                fullWidth
                variant="outline"
                onClick={() => setConfirmation(null)}
              >
                <span className="w-full text-center">取消</span>
              </Button>
              <Button
                fullWidth
                variant={
                  confirmation === "self-review" ? "default" : "destructive"
                }
                onClick={() =>
                  confirmation === "self-review"
                    ? sign(true)
                    : revoke(confirmation)
                }
              >
                <span className="w-full text-center">
                  {confirmation === "self-review" ? "确认复核" : "确认撤销"}
                </span>
              </Button>
            </div>
          </div>
        ) : blockedReason ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {blockedReason}
          </p>
        ) : (
          <div className="pw-mobile-sheet-footer border-t border-border pt-3">
            <Button fullWidth onClick={() => sign()}>
              <span className="w-full text-center">
                {current.some(
                  (item) => item.type === kind && item.userId === actor.id
                )
                  ? "再次签署"
                  : "签署"}{" "}
                {kind}
              </span>
            </Button>
          </div>
        )}
      </MobileActionSheet>
    </>
  );
}
