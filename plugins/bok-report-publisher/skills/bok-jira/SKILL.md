---
name: bok-jira
description: Preview or explicitly register granular BOK report Jira tickets from a reviewed unit plan. Does not implement report code.
---

# Register tickets separately

Require owner-approved units from bok-spec before registration. If any unit is pending/held, select a separately reviewed registration plan rather than silently registering it.

Read ../bok-report-publishing/SKILL.md and its references/ticket-workflow.md.
Find the reviewed unit-plan.json. Resolve scripts in ../bok-report-publishing/scripts when installed, otherwise ../../scripts.
Run tickets.mjs preview --plan <file>. Show report, units, destination project/parent, issue type and exact plan hash.
Registration requires the user's explicit Jira registration request and specified destination. Never register because bok-start or bok-implement was invoked.
Use Jira Cloud site origin, email and API token from JIRA_BASE_URL/JIRA_EMAIL/JIRA_API_TOKEN environment variables; never print or save secrets or ask to paste tokens in chat. If unavailable, deliver the preview and setup instructions, not fake issue keys.
Run tickets.mjs register --repo <repo> --plan <file> --project <KEY> --type <verified-type-id> --approve <reviewed-plan-hash> [--parent KEY-1].
Inspect metadata to choose actual issue type; do not assume every Jira hierarchy allows arbitrary nested subtasks. Keep existing ticket state unchanged.
A creating/uncertain ledger entry blocks retry. Reconcile with the server and verify report/slug/hash before binding a recovered ticket; do not reset the ledger to force another POST.
