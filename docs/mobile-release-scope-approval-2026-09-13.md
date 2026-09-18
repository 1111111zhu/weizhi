# Mobile release scope approval

Approved by: User, 2026-09-13 (Asia/Shanghai).

The user explicitly confirmed: defer unused whole-site component capabilities; complete the mobile fixes, PR, merge and deployment verification; retain all business and security checks. This followed a clarification of the ambiguous response and a separate explicit “同意”.

This is a **release-scope exception**, not global design-system approval, not approval of an unverified implementation and not acceptance of additional boundary debt. Global registry approval remains proposed. Existing user-confirmed phone presentation and desktop behavior remain the visual baseline.

Unused planned extensions, including CommandPalette, AuditTrailView and ExternalRequestWorkspace, are deferred from this release's readiness requirement. They remain recorded in the registry and must undergo implementation, state coverage, responsive/keyboard verification and explicit design review before adoption. Revisit at their first product consumer or by 2026-10-13. The cost is that future consumers cannot assume a production-ready public API today.

No further unused component-library construction is part of this release. Previously begun experimental components remain uncertified and must not be treated as approved merely because source files or catalog examples exist.

Still required for this release: fix unaccepted violations in touched product code; retain permissions, audit, persistence and workflow tests; pass normal commit/push hooks; build the affected applications; exercise the running, backend-attached flows; create/review the PR; squash-merge only after validation; follow the merge SHA through Build and Deploy; verify the live version and ingress. Existing successful deployments of older main commits do not satisfy this task.
