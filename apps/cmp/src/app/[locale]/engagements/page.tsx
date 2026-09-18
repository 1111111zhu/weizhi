import { CmpEngagementsClient } from "./page-client";

export const instant = false;

export default async function CmpEngagementsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; view?: string }>;
}) {
  const { clientId, view } = await searchParams;
  const groupedClientId = view === "client" ? clientId : undefined;
  return (
    <CmpEngagementsClient
      initialGroupedClientId={groupedClientId}
      initialView={view === "client" ? "client" : "list"}
    />
  );
}
