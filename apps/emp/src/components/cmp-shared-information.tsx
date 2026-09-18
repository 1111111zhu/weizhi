"use client";

import { Button as SharedButton } from "@project-wing/ui";
import { ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import type { Project } from "@/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CmpSharedInformationCopy = {
  associationSummary: string;
  empProject: string;
  cmpClient: string;
  cmpEngagement: string;
  syncHealthy: string;
  syncNeedsAttention: string;
  lastUpdated: string;
  businessSummary: string;
  auditYear: string;
  responsibles: string;
  clientDetails: string;
  showDetails: string;
  hideDetails: string;
  companyCode: string;
  companyRegistration: string;
  addresses: string;
  contacts: string;
  contactName: string;
  contactPosition: string;
  contactDepartment: string;
  contactOfficePhone: string;
  contactMobile: string;
  contactEmail: string;
  website: string;
  yearEndDate: string;
  reportingGaap: string;
  industry: string;
  incorporation: string;
  listing: string;
  group: string;
  parentCompany: string;
  subsidiaries: string;
  clientPic: string;
  clientMic: string;
  serviceType: string;
  status: string;
  engagementDate: string;
  reportDate: string;
  pic: string;
  mic: string;
  eqReviewer: string;
  deliverables: string;
  auditorsReport: string;
  otherServiceDescription: string;
  noContacts: string;
  notProvided: string;
  codeLabels: Record<string, string>;
};

export function CmpSharedInformation({
  project,
  copy,
  locale,
}: {
  project: Project;
  copy: CmpSharedInformationCopy;
  locale: "en-US" | "zh-CN";
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const client = project.cmpClient;
  const engagement = project.cmpEngagement;
  if (!client && !engagement) {
    return null;
  }

  const latestSourceUpdate = [client?.updatedAt, engagement?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const clientName = [client?.nameZh, client?.nameEn]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" / ");
  const registration = joinValues([
    formatCmpCode(client?.companyIdentifierType, copy.codeLabels),
    client?.companyNumber,
  ]);
  const industry = joinValues([
    client?.hsicSectionCode,
    client?.industryOtherDescription,
  ]);
  const incorporation = joinValues([
    client?.placeOfIncorporation,
    client?.incorporationYearMonth,
  ]);
  const listing = joinValues([
    formatCmpCode(client?.listedOrPrivate, copy.codeLabels),
    client?.stockExchangeOrListingPlace,
    client?.stockCode,
  ]);
  const groupName = joinValues([
    client?.groupName,
    client?.group?.nameZh,
    client?.group?.nameEn,
  ]);
  const parentCompany = joinValues([
    client?.parentClientCode,
    client?.parentHoldingCompanyName,
  ]);
  const addresses = client?.addresses?.length
    ? client.addresses
    : client?.address
      ? [
          {
            id: "legacy-address",
            type: "REGISTERED" as const,
            label: null,
            address: client.address,
            sortOrder: 0,
          },
        ]
      : [];
  const deliverables =
    engagement?.deliverables?.map((deliverable) => ({
      id: deliverable.key,
      primary:
        deliverable.code === "AUDITORS_REPORT"
          ? copy.auditorsReport
          : deliverable.description ||
            formatCmpCode(deliverable.code, copy.codeLabels),
      secondary: "",
    })) ?? [];
  const yearEndDate = engagement?.yearEndDate || client?.yearEndDate;
  const syncHealthy = Boolean(
    client?.status === "ACTIVE" && engagement?.status === "ACTIVE"
  );

  return (
    <section className="divide-y divide-border/60">
      <section aria-label={copy.associationSummary} className="pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {copy.associationSummary}
            </h2>
          </div>
          <SyncStatus
            healthy={syncHealthy}
            latestSourceUpdate={latestSourceUpdate}
            copy={copy}
            locale={locale}
          />
        </div>

        <div className="mt-4 grid overflow-hidden rounded-xl border border-border/70 bg-muted/10 lg:grid-cols-3">
          <LinkedIdentity
            label={copy.empProject}
            primary={project.name}
            secondary={project.projectCode}
            fallback={copy.notProvided}
          />
          <LinkedIdentity
            className="border-t border-border/60 lg:border-t-0 lg:border-l"
            label={copy.cmpClient}
            primary={clientName}
            secondary={client?.clientCode}
            fallback={copy.notProvided}
          />
          <LinkedIdentity
            className="border-t border-border/60 lg:border-t-0 lg:border-l"
            label={copy.cmpEngagement}
            primary={engagement?.engagementCode}
            secondary={formatCmpCode(engagement?.serviceType, copy.codeLabels)}
            fallback={copy.notProvided}
          />
        </div>
      </section>

      <InformationSection title={copy.businessSummary}>
        <DefinitionGrid columns="three">
          <DefinitionField
            label={copy.auditYear}
            value={yearEndDate?.slice(0, 4)}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.yearEndDate}
            value={formatDate(yearEndDate, locale)}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.reportDate}
            value={formatDate(engagement?.reportDate, locale)}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.reportingGaap}
            value={client?.reportingGaap}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.serviceType}
            value={formatCmpCode(engagement?.serviceType, copy.codeLabels)}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.status}
            value={formatCmpCode(engagement?.status, copy.codeLabels)}
            fallback={copy.notProvided}
          />
          {engagement?.otherServiceDescription ? (
            <DefinitionField
              label={copy.otherServiceDescription}
              value={engagement.otherServiceDescription}
              fallback={copy.notProvided}
            />
          ) : null}
        </DefinitionGrid>
      </InformationSection>

      <InformationSection title={copy.responsibles}>
        <DefinitionGrid columns="three">
          <DefinitionField
            label={copy.pic}
            value={engagement?.pic}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.mic}
            value={engagement?.mic}
            fallback={copy.notProvided}
          />
          <DefinitionField
            label={copy.eqReviewer}
            value={engagement?.eqReviewer}
            fallback={copy.notProvided}
          />
        </DefinitionGrid>
      </InformationSection>

      <section aria-label={copy.clientDetails} className="py-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            {copy.clientDetails}
          </h3>
          <SharedButton
            variant="quiet"
            size="sm"
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-expanded={detailsExpanded}
            onClick={() => setDetailsExpanded((current) => !current)}
          >
            {detailsExpanded ? copy.hideDetails : copy.showDetails}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform",
                detailsExpanded && "rotate-180"
              )}
            />
          </SharedButton>
        </div>
        {detailsExpanded ? (
          <div className="mt-4 grid gap-6">
            <DefinitionGrid columns="two">
              <DefinitionField
                label={copy.companyCode}
                value={client?.companyCode}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.companyRegistration}
                value={registration}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.incorporation}
                value={incorporation}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.listing}
                value={listing}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.industry}
                value={industry}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.group}
                value={groupName}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.parentCompany}
                value={parentCompany}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.subsidiaries}
                value={client?.subsidiariesOrAssociates}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.clientPic}
                value={client?.clientPartnerPic}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.clientMic}
                value={client?.clientManagerMic}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.website}
                value={client?.website}
                fallback={copy.notProvided}
              />
              <DefinitionField
                label={copy.engagementDate}
                value={formatDate(engagement?.engagementDate, locale)}
                fallback={copy.notProvided}
              />
            </DefinitionGrid>

            <InformationList
              label={copy.addresses}
              empty={copy.notProvided}
              items={addresses.map((address) => ({
                id: address.id,
                primary:
                  address.label || formatCmpCode(address.type, copy.codeLabels),
                secondary: address.address,
              }))}
            />
            <ContactTable
              label={copy.contacts}
              empty={copy.noContacts}
              contacts={client?.contacts ?? []}
              copy={copy}
            />
          </div>
        ) : null}
      </section>

      <InformationSection title={copy.deliverables}>
        <InformationList
          label={copy.deliverables}
          hideLabel
          empty={copy.notProvided}
          items={deliverables}
        />
      </InformationSection>
    </section>
  );
}

function SyncStatus({
  healthy,
  latestSourceUpdate,
  copy,
  locale,
}: {
  healthy: boolean;
  latestSourceUpdate?: string;
  copy: CmpSharedInformationCopy;
  locale: string;
}) {
  return (
    <output className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "flex items-center gap-2 font-medium",
          healthy ? "text-muted-foreground" : "text-warning-text"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            healthy ? "bg-success" : "bg-warning"
          )}
        />
        {healthy ? copy.syncHealthy : copy.syncNeedsAttention}
      </span>
      {latestSourceUpdate ? (
        <span className="flex items-center gap-1.5">
          <Clock3
            aria-hidden="true"
            className="size-3.5"
            data-testid="cmp-last-updated-icon"
          />
          {copy.lastUpdated} {formatDateTime(latestSourceUpdate, locale)}
        </span>
      ) : null}
    </output>
  );
}

function LinkedIdentity({
  label,
  primary,
  secondary,
  fallback,
  className,
}: {
  label: string;
  primary?: string | null;
  secondary?: string | null;
  fallback: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-3.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {primary || fallback}
      </p>
      {secondary ? (
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

function InformationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="py-6">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DefinitionGrid({
  children,
  columns,
}: {
  children: ReactNode;
  columns: "two" | "three";
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-8",
        columns === "three" ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"
      )}
    >
      {children}
    </dl>
  );
}

function DefinitionField({
  label,
  value,
  fallback,
}: {
  label: string;
  value?: ReactNode;
  fallback: string;
}) {
  const resolved =
    typeof value === "string" && !value.trim() ? undefined : value;
  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-border/50 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground">
        {resolved ?? fallback}
      </dd>
    </div>
  );
}

function InformationList({
  label,
  items,
  empty,
  hideLabel = false,
}: {
  label: string;
  items: { id: string; primary: string; secondary: string }[];
  empty: string;
  hideLabel?: boolean;
}) {
  return (
    <section className="grid gap-2" aria-label={hideLabel ? undefined : label}>
      {hideLabel ? null : (
        <h4 className="text-xs font-semibold text-muted-foreground">{label}</h4>
      )}
      {items.length > 0 ? (
        <div className="divide-y divide-border/50 border-y border-border/50">
          {items.map((item) => (
            <div key={item.id} className="grid gap-0.5 py-2.5">
              <span className="text-sm font-medium text-foreground">
                {item.primary}
              </span>
              {item.secondary ? (
                <span className="text-xs text-muted-foreground">
                  {item.secondary}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="border-y border-dashed border-border py-2.5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

function ContactTable({
  label,
  contacts,
  empty,
  copy,
}: {
  label: string;
  contacts: {
    id: string;
    name?: string | null;
    position?: string | null;
    department?: string | null;
    officePhone?: string | null;
    mobile?: string | null;
    email?: string | null;
  }[];
  empty: string;
  copy: CmpSharedInformationCopy;
}) {
  return (
    <section className="grid gap-2" aria-label={label}>
      <h4 className="text-xs font-semibold text-muted-foreground">{label}</h4>
      {contacts.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table label={label} className="min-w-[56rem]">
            <TableHeader className="bg-muted/30 [&_tr]:border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent hover:shadow-none">
                <TableHead>{copy.contactName}</TableHead>
                <TableHead>{copy.contactPosition}</TableHead>
                <TableHead>{copy.contactDepartment}</TableHead>
                <TableHead>{copy.contactOfficePhone}</TableHead>
                <TableHead>{copy.contactMobile}</TableHead>
                <TableHead>{copy.contactEmail}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="border-border/40">
                  <TableCell className="font-medium text-foreground">
                    {contact.name || copy.notProvided}
                  </TableCell>
                  <TableCell>{contact.position || copy.notProvided}</TableCell>
                  <TableCell>
                    {contact.department || copy.notProvided}
                  </TableCell>
                  <TableCell>
                    {contact.officePhone || copy.notProvided}
                  </TableCell>
                  <TableCell>{contact.mobile || copy.notProvided}</TableCell>
                  <TableCell>{contact.email || copy.notProvided}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="border-y border-dashed border-border py-2.5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

function joinValues(values: (string | null | undefined)[]) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function formatCmpCode(
  value: string | null | undefined,
  codeLabels: Record<string, string>
) {
  if (value && codeLabels[value]) {
    return codeLabels[value];
  }
  return value
    ? value
        .toLocaleLowerCase("en-US")
        .split("_")
        .map(
          (part) => part.charAt(0).toLocaleUpperCase("en-US") + part.slice(1)
        )
        .join(" ")
    : "";
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
