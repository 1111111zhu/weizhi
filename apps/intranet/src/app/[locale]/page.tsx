import { buildLocalizedLoginPath } from "@project-wing/shared";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { intranetDictionaries } from "@/i18n/dictionaries";
import { isLocale, locales } from "@/i18n/settings";
import { getCurrentAccount } from "@/lib/current-user";
import { getKnowledgeDocuments } from "@/lib/knowledge-api.server";
import { buildSystemLinks } from "@/lib/system-links";

import { IntranetHomeClient } from "../page-client";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function IntranetHomeContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    redirect("/zh-CN");
  }
  const [account, knowledgeItems] = await Promise.all([
    getCurrentAccount(),
    getKnowledgeDocuments(),
  ]);
  if (!account) {
    redirect(buildLocalizedLoginPath(locale));
  }
  const dictionary = intranetDictionaries[locale === "en-US" ? "enUS" : "zhCN"];
  const systems = buildSystemLinks({
    domainSuffix: process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX,
    locale,
    tmsUrl: process.env.NEXT_PUBLIC_TMS_URL,
    empUrl: process.env.NEXT_PUBLIC_EMP_URL,
    cmpUrl: process.env.NEXT_PUBLIC_CMP_URL,
  });

  return (
    <IntranetHomeClient
      account={account}
      canManageKnowledge={
        account.globalRole === "SUPER_ADMIN" || account.globalRole === "PARTNER"
      }
      copy={dictionary}
      knowledgeItems={knowledgeItems}
      locale={locale}
      systems={systems}
    />
  );
}

export default function IntranetHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <IntranetHomeContent params={params} />
    </Suspense>
  );
}
