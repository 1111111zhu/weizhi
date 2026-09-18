"use client";

import { buildApplicationHomePath } from "@project-wing/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "../../api/client";
import { useCmpI18n } from "../../i18n/client";

export function CmpLandingClient() {
  const router = useRouter();
  const { locale } = useCmpI18n();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });

  useEffect(() => {
    if (me.data) {
      router.replace(
        buildApplicationHomePath("cmp", locale, me.data.globalRole)
      );
    }
  }, [locale, me.data, router]);

  return null;
}
