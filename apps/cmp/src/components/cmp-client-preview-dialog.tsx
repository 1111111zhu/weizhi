"use client";

import type { CmpClient } from "@project-wing/shared";
import type { CmpClientProfile } from "@project-wing/shared/cmp-client-profile";
import {
  Button,
  ProjectWingLoadingProgress,
  projectWingToast as toast,
} from "@project-wing/ui";
import { Eye } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type LoadState =
  | { status: "idle" | "loading"; profile: null }
  | { status: "success"; profile: CmpClientProfile }
  | { status: "error"; profile: null };

export function CmpClientPreviewDialog({
  client,
  onOpenChange,
}: {
  client: CmpClient | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const profileCopy = dictionary.clientProfile;
  const requestIdRef = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    profile: null,
  });

  const loadProfile = useCallback(
    (id: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      void api
        .cmpClientProfile(id)
        .then((profile) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setLoadState({ status: "success", profile });
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          toast.error(profileCopy.unavailable, { duration: 5000 });
          setLoadState({
            status: "error",
            profile: null,
          });
        });
    },
    [profileCopy.unavailable]
  );

  useEffect(() => {
    if (client) {
      loadProfile(client.id);
    }
  }, [client, loadProfile]);

  return (
    <Dialog open={Boolean(client)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(88vh,760px)] w-[min(980px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-none"
        closeLabel={copy.close}
      >
        {client ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 pr-14">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                  <Eye aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg leading-6">
                    {copy.clientPreviewTitle.replace(
                      "{clientCode}",
                      client.clientCode
                    )}
                  </DialogTitle>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {client.nameEn || client.nameZh}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {loadState.status === "loading" || loadState.status === "idle" ? (
                <ProjectWingLoadingProgress />
              ) : loadState.status === "error" ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (client) {
                        setLoadState({ status: "loading", profile: null });
                        loadProfile(client.id);
                      }
                    }}
                  >
                    {copy.retry}
                  </Button>
                </div>
              ) : loadState.profile ? (
                <ClientPreviewDetails profile={loadState.profile} />
              ) : null}
            </div>
            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {copy.close}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ClientPreviewDetails({ profile }: { profile: CmpClientProfile }) {
  const copy = useCmpI18n().dictionary.clientProfile;
  return (
    <div className="space-y-6">
      <PreviewSection
        title={copy.basicInformation}
        fields={[
          [copy.clientCode, profile.clientCode],
          [copy.companyCode, profile.companyCode],
          [copy.status, profile.status],
          [copy.chineseName, profile.nameZh],
          [copy.englishName, profile.nameEn],
        ]}
      />
      <PreviewSection
        title={copy.registrationIndustry}
        fields={[
          [copy.companyNumber, profile.companyNumber],
          [copy.jurisdiction, profile.jurisdiction],
          [copy.incorporationDate, profile.incorporationYearMonth],
          [
            copy.industry,
            profile.industryOtherDescription ?? profile.hsicSectionCode,
          ],
        ]}
      />
      <PreviewSection
        title={copy.addressContact}
        fields={[
          [copy.registeredAddress, profile.registeredAddress],
          [copy.principalAddress, profile.principalBusinessAddress],
          [copy.contactPerson, profile.contactPerson],
          [copy.telephone, profile.telephone],
          [copy.email, profile.email],
          [copy.website, profile.website],
        ]}
      />
      <PreviewSection
        title={copy.responsiblePersons}
        fields={[
          [copy.leadingPartner, profile.clientLeadingPartner],
          [copy.pic, profile.clientPartnerPic],
          [copy.mic, profile.clientManagerMic],
          [copy.alternativeMic, profile.alternativePartnerSecondMic],
        ]}
      />
      <PreviewSection
        title={copy.sourceNotes}
        fields={[
          [copy.referredBy, profile.referredBy],
          [copy.notes, profile.remarks],
        ]}
      />
    </div>
  );
}

export function PreviewSection({
  title,
  fields,
}: {
  title: string;
  fields: [string, string | number | null | undefined][];
}) {
  return (
    <section className="rounded-xl border border-border bg-muted/15 p-4">
      <h3 className="border-b border-border pb-3 text-sm font-semibold text-foreground">
        {title}
      </h3>
      <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-foreground">
              {value === null || value === undefined || value === ""
                ? "—"
                : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
