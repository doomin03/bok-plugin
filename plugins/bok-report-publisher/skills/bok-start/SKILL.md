---
name: bok-start
description: Prepare BOK document data and an owner comparison review against a previous report branch, without implementing the site or registering Jira.
---

# Prepare an owner review, not a site
Read ../bok-report-publishing/SKILL.md and references/fidelity-contract.md there.
Use the extraction procedure in ../bol-start/SKILL.md, then STOP before implementation.
Resolve scripts in ../bok-report-publishing/scripts when installed, otherwise ../../scripts.
Identify the previous monetary-policy branch and resolve its immutable commit with git rev-parse. Inspect via git show; do not switch a dirty checkout. Do not assume annual-report charts are monetary-policy donors.
Read ../bok-chart/references/monetary-policy-patterns.md for the inspected repository patterns.
Create a unit-plan.json: one unit per body/notes/chart/table/image, with slug, kind, title, section, files, sourceRefs and acceptance.
For chart units also record strategy (reuse/new/undecided), baseline {branch,commit,files}, comparison (series/type/axes/units/period/annotations/responsive differences), sourceEvidence (repo-relative evidence files), and questions.
A visually similar picture or historical numeric match alone does not prove reuse suitability.
Keep source images under OpenSpec evidence, never public assets or a chart fallback. Distinguish genuine photos/diagrams from statistical charts.
On Windows render a comparison with scripts/render-comparison.ps1 -Repo <repo> -Change <change-id> -SourceImage <extracted image>. It only writes under the change's evidence/source-images. Link that PNG in owner-review.md, not in Vue.
Run workflow.mjs prepare --repo <repo> --plan <plan>.
Present owner-review.md with source image links, prior chart source/preview, differences, proposal and open questions. Owner can edit the review or reply in chat.
The next command is bok-spec. Start never approves its own proposal, registers Jira, or implements any unit.
