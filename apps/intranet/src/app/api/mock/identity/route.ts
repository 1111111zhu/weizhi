import { NextResponse } from "next/server";

import {
  INTRANET_MOCK_IDENTITY_COOKIE,
  getIntranetMockIdentity,
  isIntranetMockMode,
} from "@/lib/mock-identity";

export async function POST(request: Request) {
  if (!isIntranetMockMode()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { email?: string };
  const account = getIntranetMockIdentity(body.email ?? "");
  if (!account) {
    return NextResponse.json(
      { message: "Unknown mock identity" },
      { status: 400 }
    );
  }

  const response = NextResponse.json(account);
  response.cookies.set(INTRANET_MOCK_IDENTITY_COOKIE, account.email, {
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
