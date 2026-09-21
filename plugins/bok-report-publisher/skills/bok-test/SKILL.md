---
name: bok-test
description: Write and run Vue component and Playwright browser regression tests for selected BOK report notes, charts, tables and responsive layouts, preserving the existing implementation and owner-approved scope.
---

# BOK behavior and visual regression tests

Read ../bok-report-publishing/references/notes-and-responsive-verification.md and ../bok-report-publishing/references/browser-testing.md. This skill applies the external Vue/browser testing practices listed there to the BOK contract; those external skills do not need a separate installation.

Inspect the selected scope, target project's test configuration, existing note UI and chart lifecycle first. Reuse its runner and component style; testing is not permission to migrate Options API, replace chart helpers or redesign shared UI. A verification-only request permits tests/evidence but not application fixes. Keep existing owner approvals and source mappings authoritative.

Use Vue Test Utils/Vitest for source-note mapping, displayed content, emitted events and mount/unmount behavior. Assert public behavior, await trigger/nextTick and flushPromises as appropriate. For Teleport attach to a real DOM container, query the actual target and clean it up after the test. Do not use DOM mocks to claim pixel/layout correctness. Do not mock the note popup or chart into a passing placeholder.

Use Playwright in a real browser for note clicks, responsive layouts, screenshot regression and runtime errors. Inspect actual rendered locators; never guess selectors. Start only the target's documented development command or reuse its running server. Wait for the selected chart/note readiness condition, not arbitrary sleep or networkidle alone. Inspect console/page errors and trace failed tests.

Adapt the bundled assets/browser-tests templates from the common bok-report-publishing skill (plugin source: ../../assets/browser-tests). Configure real route, locators and source-derived expected text. The template is a starting point, not complete chart/data verification. Extend it for the exact selected chart runtime: series types/axis assignments/point values and tick/unit/legend/annotation parity. Use a test-only adapter if Highcharts is module-scoped; do not expose production globals to satisfy tests.

Run mobile/tablet/PC and inherited breakpoint boundaries. Keep source-document comparison distinct from approved UI screenshot regression. Do not approve new snapshots or increase tolerances just to make a failing test green. Baseline creation requires actual visual inspection; owner acceptance remains separate. Verify that an intentionally incorrect expected note/label fails, then restore the correct expectation and rerun.

Record exact commands, selected units, viewport/browser, baseline provenance, screenshots/traces and pass/fail/pending in evidence.md. Tests that were not executable remain pending. Return to bok-verify for remaining source, visual and frozen-file checks; browser test success alone is not report acceptance.
