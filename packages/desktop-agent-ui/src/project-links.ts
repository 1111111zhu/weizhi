export function readProjectsUrl(locale = readLocale()) {
  const routeLocale = locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
  return `https://emp.superfx.cn/${routeLocale}/engagement`;
}

export function readProjectUrl(projectId: string, locale?: string | undefined) {
  return `${readProjectsUrl(locale)}/${encodeURIComponent(projectId)}`;
}

function readLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en-US";
  }
}
