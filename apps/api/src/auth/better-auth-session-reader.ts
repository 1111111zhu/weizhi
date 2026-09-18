import type { IncomingHttpHeaders } from "node:http";

export const BETTER_AUTH_SESSION_READER = Symbol("BETTER_AUTH_SESSION_READER");

export interface BetterAuthSessionReader {
  getSession: (headers: IncomingHttpHeaders) => Promise<{
    user: { id: string };
  } | null>;
}
