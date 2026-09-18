import { NewProjectPage } from "../../../../../views/new-project";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    attempt?: string | string[];
    folderId?: string | string[];
  }>;
}) {
  const resolved = await searchParams;
  const value = resolved.folderId;
  const folderId = Array.isArray(value) ? value[0] : value;
  const attemptValue = resolved.attempt;
  const attempt = Array.isArray(attemptValue) ? attemptValue[0] : attemptValue;
  return (
    <NewProjectPage
      key={`${folderId ?? "default"}:${attempt ?? "direct"}`}
      folderId={folderId}
    />
  );
}
