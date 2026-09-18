import { buildApplicationHomePath } from "@project-wing/shared";
import type { AuthLocale } from "@project-wing/shared";

export type SystemLink = {
  name: string;
  label: string;
  href: string;
  description: string;
};

export function buildSystemLinks({
  domainSuffix,
  locale = "zh-CN",
  tmsUrl,
  empUrl,
  cmpUrl,
}: {
  domainSuffix?: string;
  locale?: AuthLocale;
  tmsUrl?: string;
  empUrl?: string;
  cmpUrl?: string;
}): SystemLink[] {
  const deployDomain = domainSuffix?.trim();
  const appHref = (subdomain: string, localUrl: string, path = "") =>
    `${deployDomain ? `https://${subdomain}.${deployDomain}` : localUrl}${path}`;
  const tmsHref = new URL(
    buildApplicationHomePath("tms", locale),
    tmsUrl ?? appHref("tms", "http://localhost:3004")
  );

  return [
    {
      name: "EMP",
      label: "Engagement Management Platform",
      href: new URL(
        buildApplicationHomePath("emp", locale),
        empUrl ?? appHref("emp", "http://localhost:3001")
      ).toString(),
      description: "Engagement execution and working paper management",
    },
    {
      name: "CMP",
      label: "Client Management Portal",
      href: new URL(
        buildApplicationHomePath("cmp", locale),
        cmpUrl ?? appHref("cmp", "http://localhost:3002")
      ).toString(),
      description: "Client, entity, contact, and engagement records",
    },
    {
      name: "TMS",
      label: "Timesheet Management System",
      href: tmsHref.toString(),
      description: "Time entry, approvals, budgets, and utilization",
    },
  ];
}
