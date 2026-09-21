---
name: bol-verify
description: Verify BOK report source parity, inherited UI, chart labels and responsive behavior for a report or review ID.
---

# Verify

Compatibility entry: follow ../bok-verify/SKILL.md and its mandatory notes-and-responsive-verification reference, including note clicks and tablet portrait/landscape. Do not stop at this shorter legacy checklist.

Read ../bok-report-publishing/SKILL.md and references/fidelity-contract.md under that skill.
Resolve the report's OpenSpec and chart specs; inspect source DOCX/XLSX evidence and the saved donor hashes. Run source parity tests, scripts/verify-fidelity.mjs if a contract exists, and the applicable target build. Inspect desktop/mobile including percent-unit labels when relevant and LazyChart mounting. Check missing notes, all series/axes/nulls, source-cell provenance and frozen shared files. Keep pending mappings and unrendered source figures as failures/pending, not passed. Report exact commands/results and evidence. Do not modify application code under a verification-only request.
