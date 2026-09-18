"use client";

import { buildApplicationHomePath } from "@project-wing/shared";
import { Button, ProjectWingLoadingProgress } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "../../../api/client";
import { CmpAppShell } from "../../../components/cmp-app-shell";
import { useCmpSignOut } from "../../../components/cmp-auth-adapter";
import { CmpDashboardView } from "../../../components/cmp-dashboard-view";
import { useCmpI18n } from "../../../i18n/client";

export function CmpDashboardClient() {
  const router = useRouter();
  const { dictionary, locale } = useCmpI18n();
  const signOut = useCmpSignOut();
  const dashboardCopy = dictionary.dashboard;
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ["cmp-dashboard"],
    queryFn: api.cmpDashboard,
    enabled: me.data?.globalRole === "SUPER_ADMIN",
  });

  useEffect(() => {
    if (
      !me.isLoading &&
      !me.isError &&
      me.data &&
      me.data.globalRole !== "SUPER_ADMIN"
    ) {
      router.replace(
        buildApplicationHomePath("cmp", locale, me.data?.globalRole)
      );
    }
  }, [locale, me.data, me.isError, me.isLoading, router]);

  if (
    me.isLoading ||
    (me.data?.globalRole === "SUPER_ADMIN" && dashboard.isLoading)
  ) {
    return <ProjectWingLoadingProgress />;
  }

  if (!me.data) {
    return null;
  }

  if (me.data.globalRole !== "SUPER_ADMIN") {
    return <ProjectWingLoadingProgress />;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <main className="cmp-centered">
        <section className="cmp-auth-card">
          <Button fullWidth size="lg" onClick={() => dashboard.refetch()}>
            {dashboardCopy.retry}
          </Button>
        </section>
      </main>
    );
  }

  return (
    <CmpAppShell
      activeSection="dashboard"
      user={me.data}
      onSignOut={() => {
        void signOut();
      }}
    >
      <CmpDashboardView summary={dashboard.data} />
    </CmpAppShell>
  );
}
