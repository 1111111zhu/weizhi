# Mobile PR / merge preflight — 2026-09-13

## Requested delivery

The user authorized PR creation and merge after the mobile work is complete. Repository: `fin-agent-lab/ProjectWing`; current worktree: `D:/Project_wing/.worktrees/mobile-app-experience`; branch: `codex/mobile-app-experience`.

No PR, remote branch, published commit, merge or manual deployment was created during this preflight. Original source edits and untracked artifacts remain in place. The only diagnostic Git objects created are an unreferenced tracked-worktree snapshot and the simulated merge tree; no merge was applied to the working tree.

## Verified state

- GitHub CLI is authenticated and can read the repository. No existing PR was found for `codex/mobile-app-experience`.
- Local HEAD: `d441d5011c42656a4f1e10f98a325351b1c12be4`.
- Fetched `origin/main`: `1ee97a4c`; local HEAD is 0 commits ahead and 8 commits behind.
- The accumulated working tree has 487 changed/untracked paths, including mobile application code, shared UI, showroom material and many evidence images. Generated `next-env.d.ts` paths and local preview settings must not be blindly included in a release commit.
- Latest main includes EMP project-home/workspace/tablet adaptations, confirmation/response-warehouse work and toast lifecycle fixes. There are 24 overlapping paths with the current local work.
- The repository only enables squash merge. Its pre-push guard requires a Conventional Commit-style branch (`feat/...`, `fix/...`, etc.) and the current remote main as an ancestor. The existing `codex/...` branch cannot be published through that guard unchanged; do not disable the guard.
- Main merges trigger Build; successful main Build triggers Deploy. No separate manual deployment is authorized by this preflight.

## Merge simulation

Commands run:

```powershell
git fetch origin main
gh auth status
gh pr list --repo fin-agent-lab/ProjectWing --head codex/mobile-app-experience --state all --json number,title,state,url,baseRefName,headRefName
git rev-list --left-right --count HEAD...origin/main
git diff --name-only HEAD origin/main
gh api repos/fin-agent-lab/ProjectWing --jq '{default_branch,allow_merge_commit,allow_squash_merge,allow_rebase_merge,delete_branch_on_merge}'
$mobileMergeSnapshot = git stash create 'Mobile PR read-only merge preflight'
git merge-tree --write-tree --messages origin/main $mobileMergeSnapshot
git diff --name-only --diff-filter=U
```

The snapshot command does not stash away or reset local files. Snapshot object: `01baabb545ba20758f9306cd55f4da02ccc6ed17`; simulated merge tree: `1f478febb82f51729b7728bb54b208e50bbb0139`. This covers tracked edits only; untracked files have not been committed. `merge-tree` exited 1 with 12 conflicted paths:

1. `apps/emp/src/components/confirmation-response-warehouse-grid.tsx`
2. `apps/emp/src/components/confirmations/project-confirmation-editor.tsx`
3. `apps/emp/src/components/project-confirmations-panel.tsx`
4. `apps/emp/src/components/project-page-header.tsx`
5. `apps/emp/src/components/project-wing-top-bar-controls.tsx`
6. `apps/emp/src/components/workbench-paper-section.tsx`
7. `apps/emp/src/views/members.test.tsx`
8. `apps/emp/src/views/members.tsx`
9. `apps/emp/src/views/projects.tsx`
10. `apps/emp/src/views/workspace.tsx`
11. `packages/ui/src/project-wing-toaster.tsx`
12. `packages/ui/src/select.tsx`

The final diff-filter command returned no working-tree unmerged paths: the simulation did not place conflict markers in the live app files.

## Decision needed before reconciliation

This is not just a textual conflict. Main introduced a compact phone/tablet project header and workspace behavior, while this task introduced a separate phone title/folder navigation presentation. The shared Select default alignment and Toaster also changed on both sides. Repository guidance requires stopping before ambiguous shared-UI conflict resolution rather than choosing an entire side.

Proposed policy for approval: retain main's current business, permissions, bug fixes and tablet behavior; retain this task's approved phone presentation below 768px; combine compatible shared-component behavior. Resolve each overlapping file explicitly and test both sides. Do not blanket-select ours/theirs or discard main's newer confirmation functionality.

After that policy is confirmed, prepare a dedicated integration checkout/branch based on the latest main, preserve this original worktree, include the intended mobile code and dependencies, exclude generated/local-only outputs, reconcile conflicts, and rerun merge-readiness validation before creating and squash-merging the PR.

Previous CMP/TMS reports document successful scoped tests/builds on the old local baseline, not on a reconciled main. They also disclose repository-wide lint/design readiness debt. No root/combined merge tests, reconciled browser flow, push checks, PR checks or deployment verification were claimed passed during this preflight.
