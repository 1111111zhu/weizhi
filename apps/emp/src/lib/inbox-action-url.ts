type LocalizedPath = (pathname: string) => string;

export function resolveInboxActionHref(
  actionUrl: string,
  localizedPath: LocalizedPath,
  input: {
    hostname?: string | null;
    domainSuffix?: string | null;
  } = {}
) {
  if (!isCmpActionUrl(actionUrl)) {
    return localizedPath(normalizeEmpActionUrl(actionUrl));
  }

  const hostname =
    input.hostname ??
    (typeof window === "undefined" ? undefined : window.location.hostname);
  const cmpOrigin = resolveCmpOrigin({
    hostname,
    domainSuffix:
      input.domainSuffix ?? process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX,
  });
  const cmpPath = actionUrl.replace(/^\/cmp(?=\/|\?|$)/, "") || "/";
  return new URL(localizedPath(cmpPath), cmpOrigin).toString();
}

function normalizeEmpActionUrl(actionUrl: string) {
  return actionUrl.replace(/^\/projects(?=\/|\?|#|$)/, "/engagement");
}

export function appendInboxActionSearchParam(
  actionUrl: string,
  key: string,
  value: string
) {
  const parsed = new URL(actionUrl, "http://project-wing.local");
  parsed.searchParams.set(key, value);
  if (/^https?:\/\//i.test(actionUrl)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendInboxReviewQuestionActionParams(
  actionUrl: string,
  input: {
    reviewQuestionId: string;
    attachmentId?: string | null;
    smartFormNodeId?: string | null;
    smartFormRowId?: string | null;
    smartFormTargetLabel?: string | null;
  }
) {
  let result = appendInboxActionSearchParam(
    actionUrl,
    "reviewQuestionId",
    input.reviewQuestionId
  );
  if (!input.attachmentId || !input.smartFormNodeId) {
    return result;
  }

  const parameters: [string, string | null | undefined][] = [
    ["attachmentId", input.attachmentId],
    ["smartFormPreview", "1"],
    ["smartFormNodeId", input.smartFormNodeId],
    ["smartFormRowId", input.smartFormRowId],
    ["smartFormTargetLabel", input.smartFormTargetLabel],
    ["focus", "q"],
  ];
  for (const [key, value] of parameters) {
    if (value) {
      result = appendInboxActionSearchParam(result, key, value);
    }
  }
  return result;
}

function isCmpActionUrl(actionUrl: string) {
  return (
    actionUrl === "/cmp" ||
    actionUrl.startsWith("/cmp/") ||
    actionUrl.startsWith("/cmp?")
  );
}

function resolveCmpOrigin(input: {
  hostname?: string | null;
  domainSuffix?: string | null;
}) {
  const hostname = input.hostname?.trim().toLowerCase();
  const domainSuffix = input.domainSuffix?.trim().toLowerCase();

  if (domainSuffix) {
    return `https://cmp.${domainSuffix}`;
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    !hostname
  ) {
    return "http://localhost:3002";
  }

  if (hostname.endsWith(".wzcpa.hk")) {
    return "https://cmp.wzcpa.hk";
  }
  return "https://cmp.superfx.cn";
}
