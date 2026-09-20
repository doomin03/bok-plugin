# Repository contract

Analysed reference: `C:\workspace\vue-project\bok-vue-web`, `origin/feature` at `0dc6d2fe7e6d897f587b08ef87e24271ad92588a` (2026-07-16). Re-check the target branch before implementation.

The app is Vue 3 and Vite. `report.html` mounts `src/report-main.js` and `ReportPage.vue`; report content is under `src/pages/report/components/toc`. Annual pages use `src/pages/annual/toc`. Shared chart utilities are `src/pages/lib/chartLib.js`, `chartCommon.js`, `chartDraw.js`, and `chartResponsive.js`.

Charts use Highcharts with `Highcharts.setOptions(chartDefaultOpt)`, then merge `chartOptions` with local options. Store data in adjacent `graphData/*.json`, import via `@`, and use the local LazyChart convention when neighbouring figures do. Preserve numbered section anchors and `reportTocData.js`; retain nulls. Build with `npm run build`, `npm run build:report:single`, or `npm run build:report:zip` as applicable. A build does not replace visual review.
