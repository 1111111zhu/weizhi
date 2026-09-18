import { CmpEngagementsClient } from "../../engagements/page-client";

export default async function NewEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    sourceEngagementId?: string;
    sourceArchived?: string;
    importSections?: string;
  }>;
}) {
  const { clientId, sourceEngagementId, sourceArchived, importSections } =
    await searchParams;
  return (
    <CmpEngagementsClient
      formMode="new"
      initialClientId={clientId}
      initialSourceEngagementId={sourceEngagementId}
      initialSourceIsArchived={sourceArchived === "1"}
      initialImportSections={importSections}
    />
  );
}
