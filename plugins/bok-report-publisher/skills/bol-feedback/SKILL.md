---
name: bol-feedback
description: Turn a BOK section or chart review ID plus feedback and test conditions into an OpenSpec review, and implement a fix only when requested.
---

# Feedback

Read ../bok-report-publishing/SKILL.md and its references/review-workflow.md and references/fidelity-contract.md. Resolve scripts relative to that skill (scripts/ in installed copies, ../../scripts/ in plugin source).

Require a review ID, feedback text and at least one test condition. Use the existing .bok-review/registry.json to resolve IDs; never guess an ID from a figure number. Create a feedback JSON {id,feedback,tests,sourceHash,context}; use apply_patch for authoring local files. Run scripts/review.mjs feedback --repo <repo> --input <json>. Read the created OpenSpec change and show its path.

If the user requests correction, reproduce, add regression tests, make only permitted source-content/series changes, verify source values and inherited presentation, and record evidence. Feedback-only requests do not authorize implementation. Stale feedback must be reproduced on a fresh review build.
