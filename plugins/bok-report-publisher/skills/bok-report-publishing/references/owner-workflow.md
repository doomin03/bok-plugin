# Review-first workflow

bok-start -> owner review -> bok-spec -> explicit scope -> bok-implement -> bok-verify -> owner feedback.
Jira creation is optional and separate via bok-jira after review.

Before donor comparison the owner supplies docs/comparison-targets.json (or report-specific docs/<report>/comparison-targets.json) with existing projectPath, description and sourcePaths. Explicit configuration paths take precedence. The agent maps charts inside that scope, records source hashes/commits and screenshots, and generates comparison HTML/MD/metrics using --targets. Read image-comparison.md for the schema and pending rules. Preserve the configuration and source snapshots as plan sourceEvidence. The current repository/previous branch is not an implicit donor.

Start creates owner-review.md and review.json from unit-plan.json. It must include source comparisons, prior branch+commit, donor candidates and unresolved questions.
AI similarity is judged first: bok-start runs match-chart-data.py for exact donor candidates and records each chart unit's `similarity`, rendered as "AI 유사성 판단"/"AI 제안" above the empty owner decision. High similarity proposes reuse (copy the donor component, change only source-backed internals); the owner still decides manually.
Owner edits markdown or replies in chat. The agent normalizes the actual response to decisions.json with planHash, owner and decisions [{slug,decision,comment}]. Never auto-approve.
workflow.mjs apply stores immutable revision directories and the current decision pointer under openspec/changes/bok-owner-review-<report>/.
workflow.mjs gate requires selected approved units and rejects hold, missing approval, plan changes and changed source evidence.
tickets.mjs local/select calls the gate before generating implementation OpenSpecs. A ticket key is a link, not an approval.
Approval hashes prevent accidental stale execution, not malicious tampering; these files are trusted workspace state, not a security signature.
Each implementation OpenSpec links the owner revision. Changing a donor/data contract requires re-review, not silently updating hashes.
Source evidence is private development material. Exclude DOCX/XLSX originals and extracted XML/media from public plugin commits.

CLI from package root:
node scripts/workflow.mjs prepare --repo <repo> --plan <plan>
node scripts/workflow.mjs apply --repo <repo> --plan <plan> --decisions <decisions> --authorization <owner-message-reference>
node scripts/workflow.mjs gate --repo <repo> --plan <plan> --units world-i-1

Legacy full-site generators were removed from the active plugin scripts and preserved locally under .verification/retired. They are not installed or published. Use render-comparison.ps1 for private review images; it cannot target public assets.
