"use client";

import type {
  CmpCompanyIdentityMatch,
  CmpCompanyIdentityResolution,
} from "@project-wing/shared/cmp-entity-graph";
import { Button, ButtonGroup } from "@project-wing/ui";
import { AlertTriangle, Building2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export type CompanyIdentityDraftSummary = {
  displayName?: string | null;
  nameZh?: string | null;
  nameEn?: string | null;
  identifierType: string;
  identifierValue: string;
  jurisdiction?: string | null;
  incorporationDate?: string | null;
  companyType?: string | null;
  registeredAddress?: string | null;
  principalBusinessAddress?: string | null;
};

export function CompanyIdentityConflictDialog({
  open,
  zh,
  current,
  match,
  busy = false,
  onCancel,
  onResolve,
}: {
  open: boolean;
  zh: boolean;
  current: CompanyIdentityDraftSummary;
  match: CmpCompanyIdentityMatch;
  busy?: boolean;
  onCancel: () => void;
  onResolve: (resolution: CmpCompanyIdentityResolution) => void;
}) {
  const existing = match.entity;
  const existingProfile = existing.companyProfile;
  const rows = [
    [
      zh ? "公司名称" : "Company name",
      current.displayName,
      existing.displayName,
    ],
    [
      zh ? "编号" : "Identifier",
      `${current.identifierType} · ${current.identifierValue}`,
      existingProfile
        ? `${existingProfile.identifierType} · ${existingProfile.identifierValue}`
        : existing.registrationNumber,
    ],
    [
      zh ? "注册成立地" : "Jurisdiction",
      current.jurisdiction,
      existing.jurisdiction,
    ],
    [
      zh ? "成立日期" : "Incorporation date",
      current.incorporationDate,
      existingProfile?.incorporationDate,
    ],
    [
      zh ? "公司类型" : "Company type",
      current.companyType,
      existingProfile?.companyType,
    ],
    [
      zh ? "公司注册地址" : "Registered address",
      current.registeredAddress,
      existingProfile?.registeredAddress,
    ],
    [
      zh ? "主要经营地址" : "Principal business address",
      current.principalBusinessAddress,
      existingProfile?.principalBusinessAddress,
    ],
  ] as const;
  const resolution = (action: CmpCompanyIdentityResolution["action"]) => ({
    action,
    entityId: existing.id,
    expectedUpdatedAt: existing.updatedAt,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
              <AlertTriangle className="size-5" />
            </span>
            {zh ? "发现相同公司" : "Matching company found"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
            {zh
              ? "该编号类型和编号已属于一个公司主体。请选择引用已有资料，或用本次资料更新该公司。"
              : "This identifier already belongs to a company. Link the existing record or update it with the current information."}
          </div>

          <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-[auto_1fr]">
            <Building2 className="mt-1 size-5 text-emerald-700" />
            <div>
              <div className="font-semibold">{existing.displayName}</div>
              <div className="mt-1 text-sm text-slate-500">
                {zh ? "当前被引用" : "Referenced by"}: {match.clients.length}
                {zh
                  ? " 个客户"
                  : match.clients.length === 1
                    ? " client"
                    : " clients"}
              </div>
              {match.clients.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {match.clients.map((client) => (
                    <span
                      key={`${client.id}-${client.role}`}
                      className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-600"
                    >
                      {client.clientCode} · {client.nameEn || client.nameZh}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[10rem_1fr_1fr] bg-slate-50 text-sm font-semibold">
              <div className="p-3" />
              <div className="border-l p-3">
                {zh ? "当前填写" : "Current entry"}
              </div>
              <div className="border-l p-3">
                {zh ? "已有公司" : "Existing company"}
              </div>
            </div>
            {rows.map(([label, currentValue, existingValue]) => {
              const left = String(currentValue ?? "").trim() || "—";
              const right = String(existingValue ?? "").trim() || "—";
              const differs =
                left.toLocaleLowerCase() !== right.toLocaleLowerCase();
              return (
                <div
                  key={label}
                  className="grid grid-cols-[10rem_1fr_1fr] border-t text-sm"
                >
                  <div className="p-3 font-medium text-slate-600">{label}</div>
                  <div
                    className={
                      differs ? "border-l bg-amber-50 p-3" : "border-l p-3"
                    }
                  >
                    {left}
                  </div>
                  <div
                    className={
                      differs ? "border-l bg-emerald-50 p-3" : "border-l p-3"
                    }
                  >
                    {right}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-slate-500">
            {zh
              ? `“更新已有公司并引用”会同步影响引用该主体的 ${match.clients.length} 个客户。`
              : `Updating the existing company will affect all ${match.clients.length} linked client records.`}
          </p>
        </div>

        <ButtonGroup className="justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            {zh ? "取消" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onResolve(resolution("LINK_EXISTING"))}
          >
            {zh ? "引用已有公司" : "Link existing company"}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onResolve(resolution("UPDATE_EXISTING"))}
          >
            {zh ? "更新已有公司并引用" : "Update and link"}
          </Button>
        </ButtonGroup>
      </DialogContent>
    </Dialog>
  );
}
