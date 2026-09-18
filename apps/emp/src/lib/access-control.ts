export function requiresProjectDeclaration(
  status?: { accepted: boolean } | null
) {
  return Boolean(status && !status.accepted);
}

export function requiresSystemDeclaration(
  user?: { declarationAccepted?: boolean } | null
) {
  return user?.declarationAccepted === false;
}

export function canAccessAdmin(user?: { globalRole?: string } | null) {
  return user?.globalRole === "SUPER_ADMIN";
}

export function canAccessAllConfirmations(
  user?: { globalRole?: string } | null
) {
  return (
    user?.globalRole === "SUPER_ADMIN" ||
    user?.globalRole === "CONFIRMATION_OFFICER"
  );
}

export function getUserScopedQueryKey(
  scope: string,
  user?: { id?: string } | null
) {
  return [scope, user?.id ?? "anonymous"] as const;
}
