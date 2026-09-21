# Existing UI is the contract

This report publisher is a source-content adapter, NOT a page designer. This requirement applies in every agent/session and to feedback fixes.

## Frozen structure

Read the target repository's instructions and the closest established section/chart/table/image before editing. Record their file paths and SHA256 in the chart spec. Established src/pages/lib, report shared components, global SCSS, and prior report components are read-only for report generation. Do not change an original to make a new chart pass.

Reuse page/report-area/report-section hierarchy, paragraph and heading classes, article.chart-wrap > .chart-inner > .chart-info + .chart-area + .chart-footnote, and the actual LazyChart component. Tables must use the existing table-wrap/table-info/table-scroll/depth-table/table-footnote pattern. Images use established img-wrap and lazy-image conventions. Do not introduce cards, borders, spacing, colors, toolbars, data-table disclosure, alternate loading UI, or scoped styles.

Copy the matched chart as baseline, preserve container shape, shared imports, chart defaults, legend, tooltip, labels, yAxis title alignment/x/y/offset, axis lines, date formatting, responsive rules and mobile label sizes. In percentage charts preserve the correct percentLeft/percentRight and mobile variants already used by the donor. A PMI/index chart is NOT a percentage chart; never invent a percent sign.

## Allowed content changes

Only new report IDs/anchors/imports, source body/caption/notes, adjacent graphData, and source-backed chart geometry (series types/data, axis assignment, categories/period, necessary bounds/ticks, source-supported forecast shading) may differ. Document every chart option change with evidence. Source-required units can change their TEXT, not the existing layout/positioning convention. When no structurally suitable prior chart exists, use the owner-approved NEW strategy: create a focused component using existing chartDraw/shared chart helpers and established conventions. An exact donor is not required for new construction; existing UI conventions remain required.

Do not copy obsolete forecast periods or old numeric captions. Record unresolved footnote/image mappings rather than inventing replacements. Source table rendering is allowed; an invented chart-data table is not.

## Gates

Follow notes-and-responsive-verification.md for body-note source mapping/click behavior, inherited table structure, source-image axis/series parity and the mobile/tablet/PC evidence matrix. Existing note UI is frozen shared structure too. Neither image similarity nor a frozen-file hash proves correct note behavior or responsive rendering.

For each chart, check donor-normalized template/style, frozen shared files, axis units (desktop/mobile), label/legend placement, lazy mount and cleanup, actual rendered values versus source cells and responsive screenshots. Record deviations explicitly. Build success alone is insufficient.

Use scripts/verify-fidelity.mjs with a reviewed inheritance contract when available. Its expected-source hash locks the approved component; update it only after reviewing the precise source-derived delta, not to silence failure. It is an integrity check, not a semantic/visual oracle.

Start artifacts and reference images are private development evidence, never automatically copied into public assets or published. Review IDs/feedback controls must remain development-only.
Statistical charts must be actual chart implementations. Never substitute an original figure image while claiming implementation or preview completion. Keep comparison images only in review evidence. Genuine source photos/diagrams are a distinct, explicitly classified content type.
