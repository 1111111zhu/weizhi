import { CmpEngagementsClient } from "../page-client";

export default async function NewEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    sourceEngagementId?: string;
    importSections?: string;
  }>;
}) {
  const { clientId, sourceEngagementId, importSections } = await searchParams;
  return (
    <CmpEngagementsClient
      formMode="new"
      initialClientId={clientId}
      initialSourceEngagementId={sourceEngagementId}
      initialImportSections={importSections}
    />
  );
}
