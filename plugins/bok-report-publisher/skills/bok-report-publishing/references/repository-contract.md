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
- Report-local hooks live in `src/pages/report<YYYYMM>/main/` and are imported once by the page: `columnGap.js` (minimum gap between bars at narrow widths)
  and `sectionChartPause.js` (hides charts of far TOC sections to avoid reflow lag). Browser audits must scroll section by section or they measure 0 charts.
  `columnGap.js` registers a global `afterColumnTranslate` handler without a `data-report` check: once the page is loaded it also acts on other reports in the same SPA session,
  and it can shrink bars below the source bar-width ratio. Measure bar width per slot (`scripts/audits/bar-gap-audit.mjs`) after any change.

## Starting the next report

1. Create `src/pages/report<YYYYMM>/` and the route; set `data-report="<YYYYMM>"` on the page root.
2. The lib hooks above match `SCOPE = '[data-report="202609"]'` literally. Add the new id to each SCOPE (one shared selector list is the smallest change),
   otherwise the new report silently gets none of the 2026-09 fixes (axis-title alignment, text fit, inner legend, mobile balance, responsive padding).
3. Decide per report-local hook whether to copy it into the new `main/` folder; add a `data-report` guard when copying `columnGap.js`.
4. Install or refresh the skills (`scripts/install-project-skills.ps1 -Project <repo>`), then run bok-start: features first, owner similarity review second.

## Build and branches

- `npm run build`, `npm run build:report:single`, `npm run build:report:zip`. A build does not replace visual review.
- Branches: agent work on `agent/*` worktrees → `feature` → `develop` (see ../../bok-land/SKILL.md). Never push `develop` directly.
