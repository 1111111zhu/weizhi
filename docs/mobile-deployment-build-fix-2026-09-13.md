# Mobile deployment image-build correction

PR #1190 merged as `78341eb5104696909e5cab2e55662d675fd22f26`, but [Build 34757428769](https://github.com/fin-agent-lab/ProjectWing/actions/runs/34757428769) failed at the showroom image. API, EMP and CMP images completed; no successful full generation was activated.

The clean Docker context excludes every `dist` directory. `@project-wing/shared` exports `dist/index.js`, but the Next image Dockerfile compiled that package only in the non-showroom branch. The new showroom specimens legitimately import those shared contracts. Local builds had an existing shared build and therefore did not expose this image-only ordering defect.

The repair builds `@project-wing/shared` unconditionally after source copy and before app-specific preparation / Next compilation. It preserves the existing showroom registry/provenance preparation. A dependency-order contract verifies the unconditional step and the ignored-dist assumption, and is run both by normal pre-commit selection and the CI image builder. Existing cache bounds, immutable generation handling and deployment activation are unchanged.

Validation commands:

```powershell
node --test scripts/ci/next-app-build-contract.test.mjs scripts/pre-commit-selective-tests.test.mjs
node --test scripts/ci/build-registry-cache-contract.test.mjs scripts/ci/next-app-build-contract.test.mjs
bash -n scripts/ci/build-registry-images.sh
corepack pnpm --filter @project-wing/shared build
corepack pnpm --filter @project-wing/ui-showroom build
```

The targeted tests and shell syntax check passed; shared and showroom builds passed. The showroom build used `NEXT_DIST_DIR=.next-release`; generated local declarations are excluded from the repair. Docker image execution could not be reproduced locally because the Docker engine is unavailable. The next clean CI build remains the authoritative image-level verification; this document does not claim it has already passed or deployed.
