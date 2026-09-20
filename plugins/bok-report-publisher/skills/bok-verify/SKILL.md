---
name: bok-verify
description: Verify selected BOK report charts against source cells, previous-report UI conventions, live Highcharts rendering and desktop/mobile evidence.
---

# Verify selected units
Read ../bok-chart/references/monetary-policy-patterns.md and ../bok-report-publishing/references/fidelity-contract.md.
Keep four outcomes separate: source data parity, runtime/visual verification, frozen source integrity, owner acceptance.
Read the approved OpenSpec, donor commit, DOCX figure and XLSX cell range. Confirm every mapped value/date/null and any unit conversion.
In the browser assert expected series count/type/axis and live point values; inspect yAxis dataMin/dataMax against bounds and stacked/range semantics. Treat intentional empty legend-only series separately from missing data.
Check upper-axis units, x labels, legends, forecast/period shading, source note and chartDraw annotation placement at desktop and 375px. Preserve existing conventions; do not add % to PMI/index charts.
Verify LazyChart mount, route cleanup/re-entry, unique container IDs, no chart-image fallback or invented data table. Run applicable Vite build, source parity tests and frozen-file checks.
Record commands, results, unresolved checks and screenshots in evidence.md. Build success alone is not completion. Only owner response marks accepted.
