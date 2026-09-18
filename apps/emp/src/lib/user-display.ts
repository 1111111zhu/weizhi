import { formatDisplayName } from "./project-layout";

export type AccountDisplayUser = {
  email?: string | null;
  name?: string | null;
};

export function formatAccountDisplayName(
  user?: AccountDisplayUser | null,
  fallback = ""
) {
  const email = user?.email?.trim();
  if (email) {
    const atIndex = email.indexOf("@");
    const localPart = atIndex > 0 ? email.slice(0, atIndex) : email;
    const displayName = localPart.trim();
    if (displayName) {
      return displayName;
    }
  }

  const name = user?.name?.trim();
  return name ? formatDisplayName(name) : fallback;
}
