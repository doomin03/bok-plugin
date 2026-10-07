# Repository contract

Analysed reference: bok-vue-web `origin/develop` (2026-10-07). This file describes structure, not a commit to trust:
re-check the target branch (`git ls-tree`) before implementation and update this file when it drifts.

## Pages and routes

- Vue 3 + Vite, vue-router (`src/router/index.js`): `/` → `ReportPage.vue` (previous report, March), `/report/<YYYY-MM>` → `Report<YYYYMM>Page.vue`, `/annual` → annual report.
- Previous report content: `src/pages/report/components/toc/**` (sections, `graph/*Component.vue`, adjacent `graphData/*.json`, side TOC `components/side/reportTocData.js`).
- A new report lives in its own tree `src/pages/report<YYYYMM>/` (2026-09: `overview`, `conditions`, `direction`, `issue`, `main`), with its TOC in `main/reportTocData.js`.
  Its page root carries `data-report="<YYYYMM>"`; report-scoped shared behaviour must check this attribute.
- Shared side TOC component `src/pages/report/components/side/TocSidebarComponent.vue` serves every report; TOC items use `href` + `external` + `fileType` for PDFs and data downloads.

## Charts

- Highcharts: `Highcharts.setOptions(chartDefaultOpt)`, then merge `chartOptions` with local options. Data in adjacent `graphData/*.json`, imported via `@`. Use LazyChart where neighbouring figures do. Retain nulls.
- Shared utilities in `src/pages/lib/`: `chartLib.js`, `chartCommon.js` (colours, titles, tooltips, formatters), `chartDraw.js`, `chartResponsive.js`, `chartPanel.js`, `lazyLoadQueue.js`, `tooltipToggleLib.js`.
- Report-scoped render hooks added for 2026-09 (all guarded by `data-report`): `axisTitleAlign.js`, `chartTextFit.js`, `innerLegendFit.js`, `linkedAxisTicks.js`, `mobileSideBalance.js`, `mobileTextDefaults.js`, `responsiveArrayPad.js`.
  Changing them affects every chart of that report: follow the shared-change protocol in fidelity-contract.md.

## Build and branches

- `npm run build`, `npm run build:report:single`, `npm run build:report:zip`. A build does not replace visual review.
- Branches: agent work on `agent/*` worktrees → `feature` → `develop` (see ../../bok-land/SKILL.md). Never push `develop` directly.
