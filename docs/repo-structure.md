# Repository Structure

Project Wing uses a monorepo so shared contracts, local tooling, and platform foundations can evolve together. Product systems should still keep clear module, application, API, and deployment boundaries.

## Current Structure

```text
.
├── apps
│   ├── emp
│   ├── api
│   ├── cmp
│   ├── desktop-agent
│   ├── intranet
│   ├── ib
│   ├── ib-api
│   └── tms
├── packages
│   └── shared
├── docs
└── scripts
```

## Expected Direction

EMP, CMP, TMS, and IB are represented as separate deployable app directories while staying in one source tree:

```text
apps/
├── emp
├── cmp
├── tms
├── intranet
├── ib
├── api
└── ib-api
```

The internal systems share `apps/api` as the unified internal API. IB uses `apps/ib-api` as its external API boundary, even when both APIs read from shared platform data.

## Domain Guidance

- Internal platform identity and staff permissions belong to internal systems.
- Client-facing identity and access belong to IB.
- CMP should own client, entity, contact, and engagement master data.
- EMP should own engagement execution, working papers, signoff, and archive.
- TMS should own time entry, approval, and utilization reporting.
- Intranet should stay a thin internal launchpad for other Project Wing systems.
- Shared schemas should stay minimal and stable.

## Deployment Guidance

Each product surface is expected to have a dedicated domain. Development and transition deployments use `superfx.cn`:

```text
emp.superfx.cn
cmp.superfx.cn
tms.superfx.cn
intranet.superfx.cn
ib.superfx.cn
```

Production deployments use `wzcpa.hk`:

```text
emp.wzcpa.hk
cmp.wzcpa.hk
tms.wzcpa.hk
intranet.wzcpa.hk
ib.wzcpa.hk
```

Internal domains can share more infrastructure. IB should be treated as an external boundary with its own authentication, API exposure, and operational controls.
