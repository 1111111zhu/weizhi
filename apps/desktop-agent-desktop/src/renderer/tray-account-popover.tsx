import { ProjectWingTopBarAccountPopover } from "@project-wing/ui";
import { LogOutIcon } from "lucide-react";

import { useDesktopAgentI18n } from "./i18n";

type TrayAccountPopoverProps = {
  email: string;
  globalRole: string;
  name: string;
  onSignOut: () => void;
};

export default function TrayAccountPopover({
  email,
  globalRole,
  name,
  onSignOut,
}: TrayAccountPopoverProps) {
  const { copy } = useDesktopAgentI18n();
  return (
    <ProjectWingTopBarAccountPopover
      accountAvatarName={name}
      accountDisplayName={name}
      accountLabel={copy.currentAccount}
      accountMenuLabel={copy.accountMenu}
      accountRank={formatAccountRank(globalRole, copy.roleLabels)}
      onSignOut={onSignOut}
      signOutIcon={<LogOutIcon data-icon="inline-start" />}
      signOutLabel={copy.signOut}
      triggerMode="click"
      userEmail={email}
    />
  );
}

function formatAccountRank(
  globalRole: string,
  roleLabels: Record<string, string>
) {
  if (roleLabels[globalRole]) {
    return roleLabels[globalRole];
  }
  return globalRole
    .split("_")
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
