# CI/CD Overview

ProjectWing has separate Web/API and Desktop Agent release lanes. The development Web/API path is `Build` followed by `Deploy`; it does not run pull-request or broad scoped validation. The reusable delivery workflow runs only its focused image-reuse contracts before packaging.

## Web/API delivery

Every push to `main` starts `Build`. A successful `Build` then starts `Deploy` for the same immutable image source.

- `Build` publishes a complete immutable GHCR generation only when image inputs change. Workflow, deployment, and documentation-only changes reuse the last successful image source instead of rebuilding applications.
- `Deploy` reads that source from the Build artifact. Manual recovery may still supply an explicit `image_source_sha`.
- The runner reuses a retained OSS bundle first. If it is absent, it replays the complete immutable GHCR generation through OSS and does not rebuild applications. An incomplete GHCR generation fails closed.
- Blue/Green hosts load only the verified OSS bundle. They never pull GHCR directly. A repeated image generation may reuse local images only when the verified bundle SHA and every recorded ref-to-image-ID mapping still match.
- The inactive candidate is stopped before allowlisted image/release reclamation on every path, including local image reuse. Capacity and provenance are rechecked immediately before activation. The host always enforces memory, inode, and safety-reserve capacity; a fresh import additionally reserves the compressed and expanded bundle sizes.
- Both static file-provider Traefik Edge nodes stage the healthy candidate route. The non-HaVip node switches and passes service-identity checks first, then the HaVip holder switches. Both commit one generation or restore their pre-attempt snapshots.
- The only promotion permitted before HaVip provisioning is an explicitly authorized one-time manual Edge HA bootstrap. All later promotions require healthy Keepalived on both nodes and exactly one VIP holder.
- Every deployment carries both its authoritative `source_commit_sha` and the possibly older immutable `image_source_sha`. A database-backed global lease, Edge compare-and-swap state, and a live `main` ancestry check prevent an older workflow from activating after a newer release.
- Pending Prisma migrations are automatic. The controller first verifies a maintenance response through both Edge nodes and the HaVip, stops the old application writers, and then runs the migration under advisory locks. Alibaba Cloud backup is the recovery boundary; deployment does not create a host-local dump.
- Degraded Edge reconciliation uses the global deployment lease and one uninterrupted lagging-host lock, repairs its live Traefik route, verifies the runtime, and commits state in one local transaction. A lease watchdog covers the remote transaction. SSH-ambiguous failures restore the snapshot and leave the node fail closed; an unconfirmed rollback deliberately retains the advisory lease until its safety timeout. Keepalived must prove that its installed marker-aware health script is actively running before recovery. Forward recovery preserves `degraded: true`. The reusable OSS workflow has no independent dispatch entry; all deployments are serialized through `Deploy`.

Read [oss-image-bundle-deploy.md](oss-image-bundle-deploy.md) for topology, host roles, SSH names, and cleanup behavior.

## Desktop Agent delivery

`.github/workflows/desktop-agent-native.yml` is intentionally separate. It verifies and packages the Electron/VeloPack host, then publishes Windows release assets through GHCR and the existing relay path. Stable GitHub Releases contain notes only, and the workflow does not retain installers in GitHub Actions artifacts. It may use GHCR and WARP, but does not share the Web/API blue/green controller.

The workflow checks GitHub-hosted Actions capacity before dispatching Windows and macOS jobs. When the GitHub Windows job is skipped or fails, `azure-windows` starts the Electron-compatible Azure pipeline, verifies its VeloPack bundle, and continues the same preview or stable release path. Preview assets are validated before a GitHub pre-release is created, so a failed platform build cannot create an empty release.

## Runtime diagnostics

`.github/workflows/runtime-diagnostics.yml` remains an on-demand read-only investigation lane. Its legacy single-host SSH configuration must not be used to activate Web/API releases.

## Evidence expectations

A workflow dispatch, image bundle upload, or merge is not deployment evidence. A completed release requires a healthy candidate, successful Edge swap, and per-host verification from the final workflow run.
