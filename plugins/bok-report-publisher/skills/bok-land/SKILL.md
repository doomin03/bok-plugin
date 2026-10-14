---
name: bok-land
description: Land finished BOK report work from an agent worktree branch into feature and then develop, with conflict dry-run, build, uncommitted-change audit and an explicit report of anything left out. Use when asked to commit, merge, land or push report changes.
---

# Land agent work: agent/* → feature → develop

Landing is part of the job, not a hand-off. Do not wait for another session to commit; do not leave verified work unlanded.

1. **Audit first.** List every worktree's uncommitted changes (`git worktree list` + `git status --porcelain`).
   For each change decide, with evidence, one of: commit and land / already in develop (compare blob hashes with `origin/develop`) /
   older than develop (would revert a fix) / tool or install files / another session's work in progress.
   Never drop a change silently: every excluded file goes into the report with its reason and impact.
2. **Verify before committing** someone else's uncommitted change: capture before/after at the affected widths (1440, 390, 360).
   Keep a fix that prevents a regression even when the original edit removed it (record why).
3. **Commit on an agent branch** with a message stating what changed and why. Stage only the decided paths; never `git add -A` across tool files.
4. **Dry-run:** `node scripts/land.mjs --repo <repo> --branch agent/<name> --dry-run` — incoming commits, dirty worktrees, conflicts.
5. **Land:** `node scripts/land.mjs --repo <repo> --branch agent/<name> --build "npm run build"`.
   It merges in a temporary worktree, builds, pushes feature, merges feature into develop, builds, pushes develop,
   stops if either branch moved meanwhile, and never force-pushes or pushes develop directly from an agent branch.
   If an agent branch is based on develop, cherry-pick its commits onto `origin/feature` first so feature stays clean.
6. **Report:** branch, feature and develop commits, build results, `feature ⊂ develop`, and the excluded-file list.
   Use the target project's own landing rules when they are stricter (read its AGENTS.md / CLAUDE.md).

Do not push other repositories (for example the plugin repository) without the owner's explicit request for that repository.
