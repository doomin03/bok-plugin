# Jira and OpenSpec

Canonical chat skills: bok-start prepares; bok-jira registers; bok-implement implements selected units. Claude Code uses /name; Codex uses $name. Legacy bol-start is preparation only.

Node 22+ tickets.mjs has preview, register, select and local subcommands. Register uses Jira Cloud REST v3 and Atlassian Document Format. Jira Data Center is not claimed supported. Official API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/

A unit-plan.json contains report and units: slug, kind, title, section, files, sourceRefs, acceptance. Use exact relative file paths, not wildcard permission to rewrite the project. Chart = one source figure, including its verification. Body = one section's prose/notes scope. Tables and images are separate units.

Preview returns planHash. Explicit registration requires that exact hash, project and issue type. Credentials come from environment, not source files. A lock prevents concurrent local registration; each attempt is journaled before POST. Failure is uncertain until reconciled; never blindly retry creating issues. Remote matching labels block duplicate registration. No bulk deletion, transitions or auto-close.

.bok-jira/<report>.json maps real Jira keys to report/slug/unit hashes. Selection rejects stale scope and foreign reports. A range includes endpoints but only mapped keys become work. Reverse ranges require confirmation. Limit: 500 ticket numbers.

OpenSpec path is openspec/changes/<jira-key-lowercase>-<slug> with scope.json, proposal, design, tasks and spec. Existing changes are reused only when their scope matches; progress isn't reset. CLI does not launch an AI agent: the selected chat skill executes the scoped implementation after reading these artifacts.

Before Jira setup local mode produces local-<slug> changes and never fabricates BOK-N keys. Local plans can later be registered explicitly.

Keep evidence separate from user acceptance. "Build passed" does not prove source/visual parity or mean accepted. Only user-authorized scope may change.
