# Inspected monetary-policy implementation

Baseline: local feature / origin/feature commit 0dc6d2fe7e6d897f587b08ef87e24271ad92588a, March 2026 monetary-policy report. This is the inspected local reference, not a claim that the remote is current. Resolve and record the owner's chosen prior period each time.

## Concrete paths
- src/pages/report/components/toc/conditions/sections/Section1_01.vue: chart-wrap > chart-inner > chart-info, chart-area > LazyChart, chart-footnote.
- conditions/graph/Graph0To1_01Component.vue: three monthly line series, OECD index left, manufacturing/services PMI right; no percent unit. Adjacent graphData/graph0To1_01Data.json.
- conditions/graph/Graph0To1_03Component.vue: mixed daily oil line and monthly inventory column; independent dates must be preserved.
- conditions/graph/Graph0To1_18Component.vue: stacked contributions plus CPI; an empty legend-only series is intentional.
- conditions/graph/Graph0To1_33Component.vue: chartDraw arrows/labels for financial conditions. Do not copy old annotation coordinates without source review.
Paths above are relative to src/pages/report/components/toc unless fully prefixed.

## Shared functions, not new abstractions
src/pages/lib/chartLib.js provides chartOptions, chartDefaultOpt, toUTC (YYYYQn, YYYYHn, YYYYMnn, ISO), ticks and axis helpers.
chartCommon.js provides established colors, percent/bp unit title positioning, date/tooltip builders and mobileLegend.
chartDraw.js includes arrowUp/Down, drawMultilineLabel, rightLabel/leftLabel, drawArrow, drawDashedRadiusBox, drawDoubleArrowWithLabel, drawVerticalGuideWithLabel, drawZoomConnectorBox, drawYAxisValueLine and inner legend builders.
Use chart events load/render for necessary annotations; destroy previous renderer elements before redraw. Keep chart instance cleanup in the new component. Shared libraries and prior-period source stay unchanged.

## Reuse vs new
Compare semantic identity, count and type of series, axis assignment, unit scale, observation cadence, forecast vs actual, stack/range behavior and annotations.
Reuse when structure matches and deltas can be explicitly source-backed. Otherwise build new using the same component lifecycle/defaults/drawing/response conventions. Record the decision in both owner review and OpenSpec.
Do not automatically accept the closest numeric match. Never carry old forecast bands, axis limits or fixed annotation dates unexamined.

## Regression lessons to test
Raw spreadsheet maxima may exceed old fixed ticks: compare rendered bounds, not just build success.
Quarter strings are not Excel date serials. Daily/monthly dual-series can have independent date columns.
Null source cells are not zeros. Blank caches require resolution, not invented values.
Original figure images live only in review evidence. Site img tags are only for genuine owner-approved photos/diagrams, never an unfinished statistical chart.
