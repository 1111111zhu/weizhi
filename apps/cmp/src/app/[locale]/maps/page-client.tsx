"use client";

import { ProjectWingLoadingProgress } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { CmpAppShell } from "@/components/cmp-app-shell";
import { useCmpSignOut } from "@/components/cmp-auth-adapter";
import { CmpMapPlane } from "@/components/cmp-map-plane";
import { useCmpI18n } from "@/i18n/client";

export function CmpMapsClient() {
  const { localizedPath } = useCmpI18n();
  const signOut = useCmpSignOut();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });

  if (me.isLoading) {
    return <ProjectWingLoadingProgress />;
  }
  if (!me.data) {
    return null;
  }

  return (
    <CmpAppShell
      activeSection="maps"
      user={me.data}
      onSignOut={() => void signOut()}
    >
      <CmpMapPlane
        clientHrefForId={(clientId) => localizedPath(`/client/${clientId}`)}
        engagementHref={localizedPath("/engagement/new")}
      />
    </CmpAppShell>
  );
}
