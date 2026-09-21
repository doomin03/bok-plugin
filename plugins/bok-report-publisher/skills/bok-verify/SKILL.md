---
name: bok-verify
description: Verify selected BOK report charts against source cells, previous-report UI conventions, live Highcharts rendering and desktop/mobile evidence.
---

# Verify selected units
Mandatory: read ../bok-report-publishing/references/notes-and-responsive-verification.md and execute every applicable check for the selected units. Include 375px mobile, 768px tablet portrait, 1024px tablet landscape and 1440px PC, plus inherited breakpoint boundaries; record actual container widths and screenshots. Click every mapped body note and compare full source text in the existing popup/panel; verify table structure/scrolling and both Y-axis units, X ticks, series, legends and annotations against source images and runtime values. Missing browser evidence is pending, never pass. This applies to body, notes and table units as well as charts.
Read ../bok-chart/references/monetary-policy-patterns.md and ../bok-report-publishing/references/fidelity-contract.md.
Keep four outcomes separate: source data parity, runtime/visual verification, frozen source integrity, owner acceptance.
Read the approved OpenSpec, donor commit, DOCX figure and XLSX cell range. Confirm every mapped value/date/null and any unit conversion.
In the browser assert expected series count/type/axis and live point values; inspect yAxis dataMin/dataMax against bounds and stacked/range semantics. Treat intentional empty legend-only series separately from missing data.
Check upper-axis units, x labels, legends, forecast/period shading, source note and chartDraw annotation placement at desktop and 375px. Preserve existing conventions; do not add % to PMI/index charts.
Verify LazyChart mount, route cleanup/re-entry, unique container IDs, no chart-image fallback or invented data table. Run applicable Vite build, source parity tests and frozen-file checks.
Record commands, results, unresolved checks and screenshots in evidence.md. Build success alone is not completion. Only owner response marks accepted.
Follow ../bok-report-publishing/references/image-comparison.md for each selected chart: compare the source image with desktop and 375px captures as separate items, write observed differences in analysis, generate comparison.html, review.md and metrics.json, and link all three in evidence.md. Keep missing captures pending and data parity separate from pixel similarity. Use a new output directory on each run to preserve written reviews.
Also compare the implemented chart with the owner-configured existing project source/UI using the docs target configuration and --targets. Keep this separate from report-source parity. Check the approved configuration snapshot and donor evidence; changed targets require an updated owner comparison review before changing the implementation strategy.
