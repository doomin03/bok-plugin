---
name: bok-chart
description: Build one selected BOK Highcharts chart using approved previous-report reuse or a new chart built with the project's chartDraw and shared chart conventions.
---

# Implement one approved chart
Read ../bok-report-publishing/references/fidelity-contract.md and [monetary policy patterns](references/monetary-policy-patterns.md).
Run the workflow gate for the exact selected unit. Read its owner decision, source cells, comparison and OpenSpec.
For reuse: git show the recorded commit/path, copy to the new report, retain wrapper/defaults/legend/axis-title positioning/responsive rules; change source-backed internals only. Record all differences.
For new: record why candidates do not fit, compose a new focused Vue component from existing Highcharts defaults and chartDraw helpers where needed. Lack of an exact donor is not a ban on new charts. Do not create a new design system.
Use adjacent graphData JSON and exact null/date/unit handling. Declare conversions such as units of 10,000 explicitly. Compare rendered series to original source cells, not only generated JSON.
Follow ../bok-report-publishing/references/notes-and-responsive-verification.md. Record both Y-axis units/bounds/ticks and series-to-axis assignment, X ticks/date formatting, series appearance/order and legend/annotations from the source figure. Preserve inherited breakpoint/reflow rules; verify mobile, tablet portrait/landscape and PC plus actual breakpoint boundaries. Do not remove units/series or clip data to fit a viewport. Record source-image differences and pending checks explicitly.
Images are comparison evidence only; no image fallback for a statistical chart. If blocked, leave implementation pending outside the page rather than presenting an image as a completed chart.
Use ../bok-verify/SKILL.md. Stop after the selected chart and request owner review.
