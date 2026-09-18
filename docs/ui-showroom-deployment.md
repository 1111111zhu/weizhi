# UI Showroom deployment

The ProjectWing UI Showroom is deployed as an independent Next.js service and served under its own standalone subdomain:

```text
https://showroom.superfx.cn
```

## Access control

The UI Showroom is publicly accessible in the internal development environment (`https://showroom.superfx.cn`) without authentication, allowing fast design reviews and component inspection. Promotion of capabilities to `Ready` remains governed by the design-system registry and its evidence requirements.

## Deployment lifecycle

Changes under `apps/ui-showroom` or to `docs/design-system.registry.json` select the `showroom` deployment scope. Changes to `packages/ui` rebuild the product frontends and the Showroom so the rendered evidence cannot drift from the shared package.

The deployment pipeline validates and builds the app, publishes a standalone `projectwing-showroom` image, starts the container, refreshes Traefik dynamic routing, and checks the Showroom URL (`https://showroom.superfx.cn`) over the existing NetBird deployment path.

For local development, the route remains `http://127.0.0.1:3008`.
