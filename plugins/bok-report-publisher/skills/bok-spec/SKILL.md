---
name: bok-spec
description: Apply a BOK report owner's comparison review to revisioned OpenSpec decisions before scope selection and implementation.
---

# Apply the owner's review
Read ../bok-report-publishing/SKILL.md and its references/owner-workflow.md.
Read owner-review.md, review.json, unit-plan.json and the owner's actual response. Do not infer approval from silence or a generated default.
Translate only the owner's decisions to decisions.json: planHash, owner, decisions [{slug,decision: reuse|new|hold,comment}].
Resolve questions and correct source mapping/comparison first; if the plan materially changes, run workflow.mjs prepare --revise with the updated plan to archive the previous draft and ask the owner to review the changed proposal. Never rewrite an approved plan hash to bypass the gate.
Run workflow.mjs apply --repo <repo> --plan <plan> --decisions <json> --authorization <actual owner request reference>.
The runner creates revisioned OpenSpec requirements/design/tasks and preserves prior revisions. It does not implement code.
Show approved, held and unresolved units. Ask for implementation scope only if not already explicitly supplied. Jira registration remains a separate bok-jira command.
