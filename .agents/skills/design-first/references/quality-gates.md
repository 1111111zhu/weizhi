# Quality gates

Use these gates to turn the approved design-system contract into repository policy. A gate must fail the pull request when its invariant is broken; a report that can be ignored is not a gate.

## Contents

1. Gate levels
2. Required gates
3. Approval lifecycle
4. Exceptions
5. Evidence

## 1. Gate levels

Apply gates in increasing cost:

1. **Structure**: package ownership, dependency direction, and public exports.
2. **Static audit**: imports, raw controls, raw styles, and local substitutes.
3. **Registry integrity**: required inventory, real files, public exports, showroom evidence, and approval.
4. **Behavior**: lint, typecheck, unit, interaction, keyboard, and accessibility tests.
5. **Rendered quality**: showroom build, responsive inspection, visual regression, and console errors.

Keep fast structural and static checks in every local verification and pull request. Run rendered checks in CI at least for design-system, showroom, token, and layout changes.

## 2. Required gates

For a long-lived product, require all of the following:

| Gate | Required evidence | Failure means |
| --- | --- | --- |
| Public boundary | Product imports only the public design-system entry | Product code bypassed the system |
| Dependency ownership | Only the design-system package owns underlying UI dependencies | The library can leak into product APIs |
| Token boundary | No unapproved raw color, spacing, shape, typography, elevation, or motion values in product UI | A parallel visual language is forming |
| Native-control boundary | Product and showroom canvas do not recreate controls already owned by the system | Behavior and appearance can drift |
| Registry integrity | Mandatory inventory, real paths, real public exports, state coverage, and evidence | `Ready` is unsupported |
| API contract | Public props follow the component API contract | The system is becoming page-specific or library-coupled |
| Behavior | Lint, typecheck, tests, keyboard, and accessibility checks pass | The API is not production-ready |
| Rendered quality | Wide and narrow showroom evidence and visual checks pass | Static correctness hides visual breakage |
| Approval | Registry records explicit system approval | Product-screen implementation is premature |

Run the bundled boundary audit and registry validator before framework-specific checks. Add the repository's native lint, typecheck, test, build, accessibility, and screenshot commands to the same required CI workflow.

## 3. Approval lifecycle

- Allow the design-system proposal branch to remain `proposed` while the showroom is being built and inspected.
- Require `--require-ready` before requesting approval.
- Record `approval.status`, `approvedBy`, and `approvedAt` only after an explicit user decision.
- Require `--require-approved` before merging product-screen implementation.
- Treat a change from `approved` back to another status as a material governance event, not a way to bypass CI.
- Require renewed approval only for changes to visual language, core layout behavior, interaction conventions, or the public contract's meaning.

## 4. Exceptions

Keep exceptions narrow, reviewable, and time-bounded:

- identify one rule and the smallest matching path;
- record reason, owner, and expiry date;
- link the matching user-approved registry exception when a baseline capability is affected;
- fail expired exceptions;
- reject project-wide globs such as `**` unless the user explicitly accepts the loss of enforcement.

Do not use an exception to make a failing implementation appear `Ready`.

## 5. Evidence

Evidence must be reproducible. A path in the registry proves only that an artifact exists; the CI command proves that it passes. Preserve:

- command names and exit status;
- test and screenshot paths;
- representative viewport coverage;
- accessibility results;
- approval identity and timestamp;
- intentional warnings and their disposition.

Do not accept screenshots, test filenames, or registry claims as substitutes for running the corresponding checks.
