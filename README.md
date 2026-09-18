# Project Wing

Project Wing is a multi-system platform for CPA firm operations. It brings internal audit work, client management, timesheets, and external PBC collection into one shared product family while keeping internal and external surfaces separate.

The platform is organized around four systems:

- **EMP - Engagement Management Platform**: internal engagement projects, working papers, file versions, signoff, review notes, archive, and audit trails.
- **CMP - Client Management Portal**: clients, entities, contacts, engagement codes, service relationships, and firm-side ownership.
- **TMS - Timesheet Management System**: staff time capture, engagement budgets, approval, utilization, and reporting.
- **IB - Information Bridge**: external client-facing PBC upload channel for request lists, file submission, client comments, and auditor review.

Each system is expected to have its own deployed domain. Development and transition deployments use the `superfx.cn` suffix:

```text
emp.superfx.cn
cmp.superfx.cn
showroom.superfx.cn
tms.superfx.cn
ib.superfx.cn
traefik.superfx.cn
mail.superfx.cn
db.superfx.cn
```

Production deployments use the `wzcpa.hk` suffix:

```text
emp.wzcpa.hk
cmp.wzcpa.hk
tms.wzcpa.hk
ib.wzcpa.hk
```

## Repository

This repository is a pnpm monorepo containing the product applications, shared platform packages, native Desktop Agent shells, and deployment tooling.

```text
.
├── apps
│   ├── emp             # Internal EMP web application
│   ├── api             # Internal unified NestJS API
│   ├── cmp             # Internal CMP web application
│   ├── desktop-agent   # Local desktop integration for Office/file workflows
│   ├── desktop-agent-macos   # React Native macOS shell
│   ├── desktop-agent-windows # React Native Windows shell
│   ├── ib              # External Information Bridge web application
│   ├── ib-api          # External Information Bridge API boundary
│   ├── intranet        # Internal knowledge and workflow application
│   ├── tms             # Internal TMS web application
│   └── ui-showroom     # Shared UI and interaction showroom
├── packages
│   ├── desktop-agent-ui # Shared React Native Desktop Agent UI
│   ├── document-viewer # Shared document preview and rendering
│   ├── shared          # Shared Zod schemas and TypeScript types
│   └── ui              # Cross-application UI and interaction contracts
├── docs                # Flat project documentation
├── scripts             # Development, CI, and packaging scripts
└── docker-compose.yml  # Local PostgreSQL, Gotenberg, and Mailpit services
```

The current implementation is still evolving from an audit-first MVP into the broader platform. New work should preserve clear system boundaries instead of adding every workflow to the existing audit modules.

## Documentation

- [overview.md](docs/overview.md): platform scope and shared concepts
- [emp.md](docs/emp.md): Engagement Management Platform
- [cmp.md](docs/cmp.md): Client Management Portal
- [tms.md](docs/tms.md): Timesheet Management System
- [ib.md](docs/ib.md): Information Bridge / PBC portal
- [repo-structure.md](docs/repo-structure.md): repository and deployment shape
- [design-system-discovery.md](docs/design-system-discovery.md): DesignFirst UI inventory, constraints, and proposed design thesis
- [design-system.md](docs/design-system.md): proposed design-system contract, public boundary, and governance model
- [design-system-boundary-baseline.md](docs/design-system-boundary-baseline.md): non-blocking DesignFirst boundary scan and migration priorities
- [ci-cd-overview.md](docs/ci-cd-overview.md): CI/CD lanes, deployment flow, Desktop Agent delivery, diagnostics, and local reproduction
- [oss-image-bundle-deploy.md](docs/oss-image-bundle-deploy.md): development deployment flow
- [i18n-coding-guidelines.md](docs/i18n-coding-guidelines.md): frontend copy rules
- [desktop-agent-health-check.md](docs/desktop-agent-health-check.md): desktop agent health check notes

## Local Development

Prerequisites:

- Node.js 22
- Corepack
- pnpm 11.x, pinned by `packageManager`
- Docker Desktop or a compatible Docker runtime

Install dependencies:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

Start local infrastructure:

```bash
docker compose up -d
```

Prepare the database:

```bash
corepack pnpm demo:setup
```

This creates or updates the standard local `projectwing_demo` database, including the Project Wing 2026 demo workspace and preview assets. `local:all` also starts the preview worker.

Run the development servers:

```bash
corepack pnpm local:all
```

## Single-app Modes

```bash
corepack pnpm local:api             # NestJS API
corepack pnpm local:preview-worker  # preview worker
corepack pnpm local:emp             # EMP with the local API
corepack pnpm mock:emp              # EMP frontend mock
corepack pnpm local:cmp             # CMP with the local API
corepack pnpm mock:cmp              # CMP frontend mock
corepack pnpm local:tms             # TMS with the local API
corepack pnpm mock:tms              # TMS frontend mock
corepack pnpm local:intranet        # Intranet with the local API
corepack pnpm mock:intranet         # Intranet frontend mock
corepack pnpm local:ib              # Information Bridge frontend
corepack pnpm local:ib-api          # Information Bridge API
```

## Useful Commands

```bash
corepack pnpm test:precommit  # Run staged-file selective checks
corepack pnpm test            # Run the curated workspace test suite
corepack pnpm check           # Run the full Ultracite check
corepack pnpm fix             # Apply Ultracite/Oxfmt fixes
corepack pnpm typecheck       # Type-check workspace packages
corepack pnpm lint            # Run Ultracite and type checks
corepack pnpm build           # Build workspace packages
corepack pnpm hooks:doctor    # Verify the local Git hook installation
corepack pnpm demo:setup      # Create/update the local demo database
corepack pnpm db:generate     # Generate Prisma client
corepack pnpm db:migrate      # Run local Prisma migrations
corepack pnpm db:seed         # Seed local demo data
corepack pnpm db:seed:demo    # Seed the standard demo workspace
```

The root `test` command is resource-aware and intentionally excludes the incomplete IB and IB API workspaces. Run those workspace tests explicitly when working on them.
