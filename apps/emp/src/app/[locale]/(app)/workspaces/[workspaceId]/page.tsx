import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";

import { isLocale, localizedPath } from "../../../../../i18n/settings";

export default async function Page() {
  const locale = await rootLocale();
  redirect(localizedPath("/engagement", isLocale(locale) ? locale : "zh-CN"));
}
