---
name: bok-implement
description: Implement only explicitly selected BOK Jira tickets, comma-separated keys, or a bounded ticket range; supports explicit local units before Jira setup.
---

# Scoped implementation
For selected-unit regression tests use ../bok-test/SKILL.md, preserving existing runner and component conventions. Add source-backed behavior assertions rather than snapshot-only tests.

Before implementation read references/owner-workflow.md under bok-report-publishing and run workflow.mjs gate for selected units. If absent, route through bok-start and bok-spec; do not approve your own proposal. Use ../bok-chart/SKILL.md for the reuse/new decision and implementation, and ../bok-verify/SKILL.md for checks. Do not run retired bulk site generators. Both strategies produce actual charts, never source-image fallbacks.

Read ../bok-report-publishing/SKILL.md and its references/fidelity-contract.md and references/ticket-workflow.md.
Read and follow references/notes-and-responsive-verification.md under bok-report-publishing. For selected body/notes units, map the exact document markers to the existing site's note trigger/data/UI and preserve the complete note text; chart footers are not body-note popups. For tables preserve source merges/headers and inherited scrolling. Run actual click/content tests and mobile/tablet/PC checks before reporting implementation verified.
Require explicit ticket selection or explicit local scope. No scope means ask, not implement the report. Only a user explicitly requesting the entire report authorizes all units; show the unit list first.
Resolve scripts in ../bok-report-publishing/scripts when installed, otherwise ../../scripts.
Run tickets.mjs select --repo <repo> --plan <unit-plan.json> --tickets "BOK-123,BOK-124" or "BOK-104~BOK-123".
Case is normalized. Reversed ranges require showing the normalized selection and user confirmation before --confirm-reversed.
Read every selected scope.json, source reference and donor. Show skipped unmapped IDs. Never implement an unrelated ticket merely because its number lies within a range.
If Jira is not configured, use tickets.mjs local --repo <repo> --plan <file> --units <explicit-slugs>. Clearly label LOCAL work as not registered in Jira.
Before coding capture dirty-state hashes; preserve user changes. Only declared content/files may change. Shared section files can be declared by multiple units, but modifications must be restricted to the selected content blocks. Dependencies outside scope need user direction, not silent expansion.
Implement, verify source parity, desktop/mobile units/labels and inherited UI, and build. Record executable checks and screenshots in each OpenSpec's evidence.md. Do not mark accepted or close Jira automatically. Stop after selected units; never continue into another ticket.
