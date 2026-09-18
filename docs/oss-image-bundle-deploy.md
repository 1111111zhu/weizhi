# Development Blue/Green Delivery

This is the development-only ProjectWing delivery path. A successful `Build`
records an immutable image source, and `Deploy` activates that source through a
private, highly available Edge.

## Release flow

1. `Build` publishes a complete immutable GHCR generation only for image-input
   changes. Deployment-only commits reuse the recorded image source.
2. The runner reuses a schema-v2 OSS manifest for that source when its image
   list, compressed size, expanded size, and SHA-256 are valid. Older or invalid
   manifests fail closed and are rebuilt from the complete GHCR generation.
3. The inactive color host stops its old candidate containers. Under the
   host-local release lock it removes only allowlisted stopped candidate
   containers, unreferenced immutable ProjectWing image tags, and unreferenced
   release directories.
4. Every deployment runs the allowlisted candidate/release/image reclamation
   and enforces inode, memory, and disk safety margins. A host may skip bundle
   download only when a previous verified import recorded the same bundle
   SHA-256 and every required local image reference still resolves to the
   recorded Docker image ID.
5. Without matching local provenance, the candidate host requires enough free
   bytes for the compressed bundle, its expanded Docker archive, and a 2 GiB
   safety reserve. It downloads the OSS bundle, verifies its exact size and
   SHA-256, imports it, records the verified ref-to-image-ID mapping, and
   immediately removes the compressed local file.
6. The controller classifies Prisma state before activation, then obtains a
   database-backed global deployment lease and rechecks the Edge generation and
   current `main`. If migrations are pending, both Edge nodes and the HaVip must
   first return the maintenance contract; only then are old application writers
   stopped and migrations applied under a second advisory lock. Alibaba Cloud
   backup is the recovery boundary, so no host-local dump is created.
7. The inactive color starts its complete application stack and private backend
   gateway on its fixed VPC address at port `18080`. Both Edge nodes then stage
   the candidate route outside Traefik's watched directory.
   The Edge node that does not hold the HaVip switches and passes full service
   identity checks first; the HaVip holder switches second.
8. Both nodes atomically commit the same schema-v4 Edge generation. State records
   the source commit separately from the reused image source plus build/deploy
   run identities. A failure
   restores the route and state snapshots from immediately before that attempt.
Explicit single-host recovery commits `degraded: true`; it is not treated as
a healthy dual-node deployment.

Returning from a degraded generation is a separate fail-closed transaction.
The recovery controller obtains the same database-backed deployment lease used
by ordinary promotion, then performs route repair, runtime verification, and
the state commit under one uninterrupted lagging-host release lock. It requires
the authority release material on the lagging host, atomically repairs the
Traefik route, verifies the complete application and protected Prisma Studio
identity through that Edge, and commits state last. The root-owned Keepalived
health script records an atomic heartbeat containing its own SHA-256 and the
invoking Keepalived process identity. Recovery requires a fresh matching
heartbeat from the still-running parent process, marks the node with
`reconcile.in-progress` so it is ineligible for the HaVip, and waits for a new
root heartbeat after removing the marker. It also observes that the heartbeat
stops while the marker exists, rejecting a service environment that bypasses
the fail-closed guard. The root script itself reads the mode-0600 configuration
and requires the named `vrrp_script` to point to the installed script and the
ProjectWing VRRP instance to track that name. The unprivileged recovery process
therefore verifies the active binding through the root attestation without
receiving configuration contents.
Forward recovery preserves `degraded: true`; only a later normal dual promotion
may commit a non-degraded generation. Missing release material, state drift, or
failed runtime verification leaves the lagging node fail closed. The controller
treats interrupted SSH replies as indeterminate: a lease watchdog covers the
remote transaction, and the controller attempts the idempotent snapshot
rollback before releasing the global lease. If rollback cannot be confirmed,
the lease holder is intentionally left alive until its 90-minute safety timeout
so a normal deployment cannot enter the unknown state. Successful recovery
drops its small transaction snapshot; a failed cleanup leaves only metadata and
does not undo an already verified recovery.

Before the HaVip exists, exactly one manual `Deploy` may set
`edge_ha_bootstrap=true` to initialize the second Edge. Ordinary and automatic
deployments require `PROJECTWING_HAVIP_ADDRESS`, active Keepalived on both nodes,
matching Keepalived configuration, and exactly one current VIP holder.

The retained OSS object is an immutable cache for later deployments of the same
image source. Local bundle files are ephemeral; the small local provenance
record is keyed by the verified bundle SHA-256 and cannot authorize a different
tag-to-image-ID mapping. The previous application color is retired only after
the dual Edge commit; before commit, rollback uses the persisted route and state
snapshots.

GitHub concurrency reduces overlap but is not the ordering authority. Before
every production mutation the controller requires the deployment source to be
the current `main` descendant and compares the persisted Edge generation,
release, source, and route mode. A superseded workflow exits without activation.
If it already entered maintenance but migration has not started, it restores the
serving route. Once the persisted migration-started marker exists, only the same
source commit and pending release may resume that maintenance transaction.

## Hosts and network roles

| Role | Host | Private application gateway |
| --- | --- | --- |
| Blue application and Edge | ProjectWing app-blue ECS | `172.19.143.157:18080` |
| Green application and Edge | ProjectWing app-green ECS | `172.19.143.158:18080` |
| Stable client destination | Alibaba Cloud HaVip | one private `/32` in the same vSwitch |
| Deployment control plane | GitHub runner | NetBird overlay only |

The HaVip is associated with both ECS instances and is not associated with an
EIP. Keepalived uses private unicast VRRP and tracks only Docker and Traefik
health. Both instances start in `BACKUP` state with `nopreempt`; Green initially
has the higher priority, and a recovered node does not force a second flap.

NetBird exposes one `ProjectWing Development Edge` Network. Its only resource is
the HaVip `/32`, assigned to the existing `All` resource group, and its routing
peer is the existing `Development Server` peer group. The router is enabled at
metric `100` with masquerading, so both application hosts provide automatic
routing-peer failover without requiring a VPC return route. The Edge admin
allowlist accepts the NetBird range and only the two exact masquerading source
addresses, not the complete VPC range.

Provision this object graph with `scripts/ci/configure-netbird-havip.sh` from a
trusted host. The script accepts the API token only through a non-symlink mode
`0600` file, creates missing objects idempotently, and fails closed instead of
overwriting any same-name Network, resource, or routing peer with conflicting
properties.

After canary and failure acceptance, the `wing`, `emp`, `auth`, `cmp`,
`showroom`, `tms`, `intranet`, `ib`, and `traefik` records under `superfx.cn`
all resolve to the HaVip. The public DNS zone publishes a private address;
clients still require NetBird and no business TCP port is opened publicly.

Keepalived is provisioned as a separate root-owned host bootstrap after Alibaba
Cloud approves the HaVip quota. Application deployment does not install host
packages implicitly; it fails before promotion unless both services and the
configured private HaVip are present.

The recovery workflow intentionally fails closed until both hosts have been
re-provisioned with the marker-aware root health script. A normal release only
updates the user-owned copy under `/opt/projectwing/edge/health`; it cannot and
must not replace `/usr/local/libexec/projectwing/edge-ha-health.sh` implicitly.

That bootstrap also enforces the shared low-memory host baseline: at least
4 GiB of active swap and `vm.swappiness=10` persisted in
`/etc/sysctl.d/99-projectwing-swap.conf`. Edge verification waits for the host
to settle, then requires at least 256 MiB available memory and a connected
NetBird control path before committing a route generation.

The Hong Kong gateway remains the NetBird control-plane TLS entrypoint. It does
not proxy ProjectWing business traffic and is not part of the application Edge
data path.

Each Traefik Edge has only the file provider. It routes the known ProjectWing
hostnames to exactly one VPC backend gateway; it has no Docker provider, no
container-label discovery, no fallback router, and no Prisma route.
During migration it routes the business hostnames to a tiny maintenance service
that reuses the pinned Traefik image and exposes no additional host port. The
Traefik admin hostname remains outside that maintenance router.

## SSH and secrets

Native NetBird SSH on overlay port 22 requires interactive JWT login, so CI uses
a dedicated key-only OpenSSH listener on each host's NetBird address and port
`2222`. Host keys are pinned, password authentication is disabled, and the CI
key is authorized only for `ops`.

When workflow secrets are missing, the runner reads matching Edge state from
the reachable nodes and inherits only `DATABASE_URL` and `BETTER_AUTH_SECRET`.
If the active application host is unavailable, it uses the other Edge node's
persisted release secret and explicitly selects degraded single-host recovery.
Secret values are never printed and temporary files are mode `0600` and removed.

## Cleanup and rollback rules

- Cleanup requires the inherited host-local release lock and strict ProjectWing
  project, service, image, and release-path allowlists.
- Before any container, image, or directory is removed, the complete release
  tree must contain only expected immutable directories, no symlinks, and no
  directory that the deployment owner cannot traverse and remove.
- Cleanup never uses `docker system prune`, forced container removal, or volume
  deletion. Edge, the other color, and unrelated containers are protected.
- The committed active and previous releases are protected. Other unreferenced
  release directories and immutable image tags are eligible for removal.
- Candidate failure leaves the active color and retained OSS object unchanged.
- A migration failure after the persisted started marker intentionally leaves
  the maintenance route active for an idempotent same-release retry; it does not
  attempt to route the old application against a possibly changed schema.
- Edge promotion failure restores both nodes to the exact pre-attempt route and
  state when both nodes are available. Rollback is re-read and verified; an
  unverified rollback preserves the candidate for diagnosis instead of deleting
  a backend that a partially switched Edge might still reference.
- When rollback is verified, a failed promotion removes only that candidate's
  Compose project and unreferenced immutable ProjectWing image tags.
- Runner-side inherited runtime secrets, derived env files, ACME credentials,
  and the temporary deployment SSH key are removed on every terminal path.
- Host-side staging env files, deployment archives, and ACME transfer files are
  removed from both `/opt/projectwing` roots immediately after their immutable
  release copies are installed. The cleanup accepts only exact historical
  staging filename formats and refuses symlinks or non-regular matches.
