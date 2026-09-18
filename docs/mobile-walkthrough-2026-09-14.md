# Mobile walkthrough — 2026-09-14

Status: corrective code implemented; final rendered verification blocked by the preview-server launch policy. This is a new pass on `38535dc8`, not a claim that every route/state has passed. No new commit, PR, merge or deployment has been performed.

## Scope and method

The user requested walkthrough testing across pages and corrections for awkward layout or interaction. Preserve the established mobile presentation and desktop behavior; use the shared UI boundary without introducing a second prototype or declaring global registry readiness. The earlier unused-capability deferrals remain unchanged.

Worktree: `D:/Project_wing/.worktrees/mobile-walkthrough-20260914`; branch `codex/mobile-walkthrough-20260914`. Real development ingress is reachable through NetBird. Headed Playwright CLI sessions `mobile-walkthrough` and `mobile-touch` use the application's developer-account picker with the synthetic Manager `manager@projectwing.local`; no mock API routes, injected cookies or guessed passwords. No submissions, signatures, approvals, deletes or billing mutations were performed. The applications did issue normal login/account-preference updates and a project placement/access update while opening a project; this is not described as a session with zero server writes.

The initial CLI session ran from the integration worktree at 390×844 with a fine pointer. A second session was opened from this worktree with `open --mobile --headed`; it reports width 360, `pointer: coarse` and one touch point. Both inspect the currently deployed frontend, not these uncommitted corrections. Before artifacts were consolidated under this worktree's `output/playwright/` (`walk-*.png` and `touch-*.png`). No after-change screenshots exist yet. Wide-layout and changed-code verification remain pending.

## Observed paths

- CMP: login; client list; seeded Orchid client document detail; functional navigation sheet; engagement list; Orchid engagement details; engagement billing empty state; collection overview sheet; approvals list and Harbour approval details; dashboard redirect for a non-admin account.
- TMS: current timesheet; period picker; approval business list; Harbour project and employee daily evidence (unsubmitted, all actions left untouched).
- Intranet: workbench; knowledge directory; recent items; settings sheet.
- EMP: folders; default folder project list; Project1 access-denied state; accessible Harbour workspace, directory navigation, stage file empty state, confirmation list/directory and basic information.

## Corrections implemented

1. **CMP collection overview:** one sheet heading, unframed mobile content, separate legible engagement identity/status and quieter metric separators. Reuses the owning CMP status translations; English status no longer leaks into Chinese copy. Desktop composition is retained. Before: [overview](../output/playwright/touch-cmp-overview-before.png).
2. **CMP mobile navigation:** dashboard is shown only to `SUPER_ADMIN`, matching the existing destination route guard. Manager/Partner/Staff no longer receive an entry that redirects them back to Clients. Backend authorization is unchanged.
3. **TMS action sizing:** the mobile action-row selector now wins over generic Button size CSS, making Add row and Submit consistent in narrow fine-pointer windows too. Touch mode already enforced the shared 44 px target. Before: [narrow timesheet](../output/playwright/walk-tms-timesheet-before.png).
4. **TMS period controls:** visible year/month/period labels, centered full-width Done footer, and a two-line year/month + half-month caption so 360 px touch mode does not truncate the period. Uses the existing MobileActionSheet footer contract. Before: [touch period picker](../output/playwright/touch-tms-period-before.png).
5. **TMS employee evidence:** retains an explicit date range after drilling into an employee and keeps day-column headings sticky inside the evidence scroller. Existing edit locks and project-scoped approval callbacks are preserved. Before: [employee evidence](../output/playwright/walk-tms-employee-before.png).
6. **EMP project errors:** `FORBIDDEN`, `NOT_FOUND` and `PROJECT_NOT_FOUND` get accurate localized explanations without a misleading network-retry button. Existing back navigation remains; genuine network failures retain retry. No server diagnostics or permissions are exposed/changed. This follows actual HTTP 403 observations for Project1, not a request to bypass its access restriction.

### Findings ruled out or deferred

- MobileActionSheet's actual DOM **does** associate `aria-labelledby` with the visible title. The snapshot summary omitted the name; no shared dialog change was made on that basis.
- EMP retains inactive panels in its DOM. A test click initially targeted an inactive file pane and was intercepted by the visible directory pane. Following the visible directory/file navigation worked; actual DOM inspection confirmed `inert`/`aria-hidden` for inactive panes. This was not treated as a broken visible action. `walk-emp-review-before.png` is therefore a directory screenshot, not successful Q-editor coverage.
- Deep Q/composer, file preview, archive, creation/edit forms, full keyboard/screen-reader checks, large text/dark mode and wide-layout regression are not yet comprehensively covered. CMP approval detail also warrants a later review of icon-only actions and its English `Review` label. No live approval action was clicked.

No page-level overflow was visually observed in the captured client list/detail, TMS approval list, or Intranet directory/settings. This is not yet a full size/keyboard/console pass.

## Environment notes

`corepack pnpm install --offline --frozen-lockfile` installed the locked packages and ran the normal prepare/showroom postinstall, then exited 1 with `ERR_PNPM_IGNORED_BUILDS` for `electron-winstaller@5.4.0`. Native installer build approval was not changed; its generated approval placeholder was removed. Subsequent UI tests/builds worked. The install itself is not described as a pass. Dedicated `.next-walkthrough/` build directories are ignored; generated `next-env.d.ts` changes are restored before handoff.

## Validation commands and results

All commands use the new worktree and bundled Node 24.19.0. Add the worktree `node_modules/.bin` to PATH for the direct Ultracite command.

| Exact command | Result |
| --- | --- |
| `corepack pnpm --filter @project-wing/shared build` | Passed. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/views/workspace.test.tsx --maxWorkers=1` | 75 passed, including full workspace regression and the new permission/missing-project cases. |
| `corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-app-shell.test.tsx src/components/cmp-billing-page.test.tsx --maxWorkers=1` | 30 passed, including mobile status filtering, localized overview and role-specific navigation. |
| `corepack pnpm --filter @project-wing/tms exec vitest run src/components/tms-mobile.test.tsx --maxWorkers=1` | 9 passed; period field selection, close focus, daily edits, locks and approval scope are protected. |
| `node scripts/ui-stack-guardrails.mjs` | Passed. |
| `node scripts/design-first/cli.mjs validate-registry` | Passed integrity; no global Ready/approval claim. |
| `node scripts/volatile-test-assertions.mjs` | Passed. |
| `node scripts/ui-stack-baseline-monotonic.mjs --base-ref HEAD` | Passed; no historical debt growth. |

The final test total is **114 passed** across these four test files. Initial test-only issues (select-event simulation, missing initial focus, singular Client label and conditional assertions) were corrected without removing the behavior checks. Final formatting/static checks passed on all 13 changed TypeScript/CSS files, using:

```powershell
$walkChanged = @(git diff --name-only -- '*.ts' '*.tsx' '*.css' | Where-Object { $_ -notmatch 'next-env\.d\.ts$' })
node node_modules/ultracite/dist/index.js check @walkChanged
git diff --check
```

`git diff --check` also passed. The root full-workspace suite and native installer build were not run for this scoped pass.

Production builds passed with `NEXT_DIST_DIR=.next-walkthrough`, `NEXT_PUBLIC_API_MODE=local`, `NEXT_PUBLIC_AUTH_BASE_URL=https://auth.superfx.cn`, and the owning app's `https://<app>.superfx.cn/api` base:

```powershell
corepack pnpm --filter @project-wing/cmp build
corepack pnpm --filter @project-wing/tms build
corepack pnpm --filter @project-wing/emp build
```

CMP and TMS were rebuilt after the final navigation/caption corrections. Intranet source was not modified and its build was not rerun.

## Rendered-verification blocker

The tool policy rejected starting the local production preview (`next start`) before execution. Read-only port inspection found no listeners on 3091/3092/3094. The denied launch was not retried through another executable, shell, port or helper. The browser-only frontend-forwarding preparation in `output/playwright/attach-local-frontends.js` was **not executed**, and no browser network interception was installed. API/auth traffic in the walkthroughs remained real and unmodified.

These are compiled/tested changes, **not visually accepted changes**. No PR/merge/deployment was done while this check remains blocked.

## 继续验收：需要手动启动预览

### 后续 P / R 重叠修正

用户提供的 Android 截图显示 P、R 纵向交叠，R 穿过文件分隔线。根因为 `MobileProjectFileSignoffCell` 仍使用上下排列的 grid 和两条 `h-5`（20px）容器，而触屏按钮最小高度为 44px。桌面签署单元的样式不是这个移动端分支，因此之前针对桌面签署结构的移动 CSS 没有修正它。

本次仅修改移动端分支及 `emp-mobile-navigation.css`：P/R 两组横向不换行；组不收缩，最小高度沿用触屏目标 token；外层签署单元整组参与元信息换行；元信息增加行间距和底部间距。按钮外观、签署回调、权限、自审提醒和签署人展示不变。前面的工作树修改均保留。

验证记录：

- 初始回归测试先失败，明确命中旧 grid / 固定行高结构；临时还原旧结构时也观察到布局契约失败，随后恢复修正。
- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx --maxWorkers=1`：最终 197 项通过。该测试集保护文件和签署交互；新增单元测试保护 P/R 独立权限及同一签署单元的关系，不将 jsdom 当作实际几何引擎。
- `corepack pnpm --filter @project-wing/emp build`：通过，使用前文的 `.next-walkthrough` 和真实 API 配置。
- `node node_modules/ultracite/dist/index.js check apps/emp/src/components/workbench-content.test.tsx apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/emp-mobile-navigation.css`、`node scripts/ui-stack-guardrails.mjs`、`node scripts/volatile-test-assertions.mjs`：通过；没有扩充历史基线或关闭规则。
- 独立审查未发现三文件补丁的代码缺陷，确认桌面分支及权限/签署行为未更改，同时明确仍需真实渲染验收。
- 可选 `PW_CAPTURE_SIGNOFF_FIXTURE=1` 从真实组件测试渲染结果和真实构建 CSS 生成纯测试文件行（无登录信息或业务请求）。`output/playwright/signoff-before.html` / `signoff-after.html` 及 `check-signoff-layout.js` 用于 320/360/390/430px 触屏几何验证。但浏览器工具拒绝 `file:` 导航，实际几何检查没有运行成功，不能将生成 HTML 当作截图验收。没有改用其他 URL 或服务绕过限制，测试浏览器已关闭。

**此修正尚未发布到线上，模拟器中的部署版本不会因本地代码修改而自动更新。P/R 不交叠的实际画面仍待验收。**

### 预览启动命令

后续紧凑行调整（用户已确认）：仅在移动文件行中将文件名链接最小高度从48px收至触控目标44px，元信息底部8px留白改为0。实测短行从100.925px变为88.928px（约12%减少），没有实现最初粗估的25–30%，因为仍保留两排44px操作区及分隔线。长文件名继续自动撑高。

当前运行的本地 Mock 页面中，`playwright-cli -s=compact-rows run-code --filename=output/playwright/check-compact-rows.js` 修改前因四种宽度行高超限失败，HMR完成后通过；`check-signoff-layout.js` 同样通过。覆盖320/360/390/430px、44px触控区（允许1px舍入）、P/R横排间距、操作区不交叠、不越过行边界、页面无横向溢出。已查看 `output/playwright/compact-rows-after.png` 和320px截图。

`corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t mobile --maxWorkers=1`：7通过、190未选中；`node node_modules/oxfmt/bin/oxfmt --check --config oxfmt.config.ts apps/emp/src/components/emp-mobile-navigation.css` 与 `node scripts/ui-stack-guardrails.mjs` 通过。本次两处CSS微调未重跑生产构建，未提交或部署，用户本地dev服务未停止。

后续本地运行复核：用户已手动启动 `next dev`（3001）。首次编译日志出现 `Unexpected end of JSON input`；只读扫描时生成 JSON 均可解析，后续 GET `/en-US/engagement` 返回 200。没有删除缓存、重启用户服务或修改路由；具体首次编译异常根因尚未稳定定位，不能宣称永久修复。

在 `emp-local-check` 浏览器会话中实际走通本地 Mock 的 Default Folder → Orchid Holdings → Planning → Client acceptance or continuance → A1-1000。随后在这个真实运行的应用页面（不是 file: 组件样例）执行 `run-code --filename=output/playwright/check-signoff-layout.js`，320/360/390/430px 触屏几何检查全部通过：P/R 同排、触控尺寸满足 44px（容许 1px 舍入）、间距为正且不跨行底线、页面不横向溢出。360px 实测两按钮均约 43.998px，间距约 7.998px。`output/playwright/local-pr-signoffs-confirmed.png`、`signoff-after-320.png` 和 `signoff-after-430.png` 已查看。

因此 P/R 本地 Mock 渲染验收已补齐，但未部署到线上，也不代表真实后端签署流程已验收。浏览器仍有 `localhost:3000/confirmations/logistics-unread` 请求失败，和首屏 JSON 解析错误不同；本次没有修改这个额外问题。其他走查修正的待验证项保持原状态。

请在三个 PowerShell 终端中分别进入工作目录，并设置构建目录：

```powershell
Set-Location D:\Project_wing\.worktrees\mobile-walkthrough-20260914
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
$env:NEXT_DIST_DIR = '.next-walkthrough'
$env:NEXT_PUBLIC_API_MODE = 'local'
```

每个终端选择一条启动命令，保留运行即可：

```powershell
corepack pnpm --filter @project-wing/cmp exec next start -H 127.0.0.1 -p 3092
corepack pnpm --filter @project-wing/tms exec next start -H 127.0.0.1 -p 3094
corepack pnpm --filter @project-wing/emp exec next start -H 127.0.0.1 -p 3091
```

这些是已构建的测试前端，不会重新部署主机。启动后由助手继续连接真实 API 做修改后的截图、尺寸、导航与权限提示检查；随后再完成剩余深层页面。不要把当前线上截图当作这些本地修改的验收证据。
