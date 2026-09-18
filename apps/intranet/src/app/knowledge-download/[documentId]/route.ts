import { cookies } from "next/headers";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const upstream = await fetch(
    `${apiBaseUrl}/knowledge-documents/${encodeURIComponent(documentId)}/download`,
    {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    }
  );
  const headers = new Headers();
  for (const name of [
    "content-disposition",
    "content-length",
    "content-type",
  ]) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, {
    headers,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}
