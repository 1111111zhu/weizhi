import type { CmpClient } from "@project-wing/shared";
import type { ReactNode } from "react";

import type { CmpDictionary } from "@/i18n/client";

import { CmpBooleanIndicator } from "./cmp-boolean-indicator";
import {
  formatCmpYearEndMonth,
  getCmpClientYearEndMonth,
  hasCmpClientServiceType,
} from "./cmp-clients-data-grid-utils";

type WorkspaceCopy = CmpDictionary["workspace"];
type DetailValue = [label: string, value: ReactNode];

export function CmpClientExpandedDetails({
  client,
  copy,
}: {
  client: CmpClient;
  copy: WorkspaceCopy;
}) {
  const registeredAddress =
    client.addresses?.find((address) => address.type === "REGISTERED")
      ?.address ?? client.address;
  const principalBusinessAddress =
    client.addresses?.find((address) => address.type === "PRINCIPAL")
      ?.address ?? client.address;

  return (
    <section
      className="grid grid-cols-1 gap-6 bg-muted/20 px-5 py-5 lg:grid-cols-3 lg:gap-8"
      aria-label={copy.dataGridClientDetails}
    >
      <div className="space-y-6">
        <DetailSection
          title={copy.dataGridGroupDetails}
          values={[
            [copy.groupCode, client.group?.groupCode],
            [copy.group, client.group?.nameEn || client.group?.nameZh],
          ]}
          emptyValue={copy.dataGridNoValue}
        />
        <DetailSection
          title={copy.dataGridCompanyDetails}
          values={[
            [copy.companyType, client.listedOrPrivate],
            [copy.placeOfIncorporation, client.placeOfIncorporation],
            [
              copy.business,
              client.industryOtherDescription ?? client.hsicSectionCode,
            ],
            [
              copy.yearEnd,
              formatCmpYearEndMonth(getCmpClientYearEndMonth(client)),
            ],
          ]}
          emptyValue={copy.dataGridNoValue}
        />
      </div>
      <div>
        <DetailSection
          title={copy.dataGridContactDetails}
          values={[
            [copy.contact, client.contactPerson],
            [copy.email, client.email],
            [copy.contactPosition, client.contactPosition],
            [copy.contactDepartment, client.contactDepartment],
            [copy.telephone, client.telephone],
            [copy.contactMobile, client.contactMobile],
            [copy.website, client.website],
            [copy.contactRemarks, client.contactRemarks],
            [copy.registeredAddress, registeredAddress],
            [copy.principalBusinessAddress, principalBusinessAddress],
            [copy.pic, client.clientPartnerPic],
            [copy.mic, client.clientManagerMic],
          ]}
          emptyValue={copy.dataGridNoValue}
        />
      </div>
      <div className="space-y-6">
        <DetailSection
          title={copy.dataGridServiceDetails}
          values={[
            [copy.audit, serviceIndicator(client, "Audit", copy.audit, copy)],
            [copy.tax, serviceIndicator(client, "Tax", copy.tax, copy)],
            [copy.risk, serviceIndicator(client, "Risk", copy.risk, copy)],
            [
              copy.expectedJobOrEngagementType,
              client.expectedJobOrEngagementType,
            ],
          ]}
          emptyValue={copy.dataGridNoValue}
        />
        <DetailSection
          title={copy.dataGridApprovalDetails}
          values={[
            [copy.approvalNumber, client.approvalReferenceNumber],
            [copy.approvalDate, client.approvalDate],
            [copy.remarks, client.remarks],
          ]}
          emptyValue={copy.dataGridNoValue}
        />
      </div>
    </section>
  );
}

function DetailSection({
  emptyValue,
  title,
  values,
}: {
  emptyValue: string;
  title: string;
  values: DetailValue[];
}) {
  return (
    <section className="min-w-0">
      <div className="flex min-h-8 items-center">
        <h3 className="text-sm leading-5 font-semibold text-foreground">
          {title}
        </h3>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 min-w-0 text-sm leading-5 font-medium break-words text-foreground">
              {hasDetailValue(value) ? (
                value
              ) : (
                <span className="font-normal text-muted-foreground">
                  {emptyValue}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function hasDetailValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

function serviceIndicator(
  client: CmpClient,
  service: "Audit" | "Tax" | "Risk",
  label: string,
  copy: WorkspaceCopy
) {
  return (
    <CmpBooleanIndicator
      value={hasCmpClientServiceType(client, service)}
      label={label}
      yesLabel={copy.yes}
      noLabel={copy.no}
    />
  );
}
