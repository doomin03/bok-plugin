# Chart specification

A spec is an implementation contract grounded in the source package. It must identify figure ID, report section, title/caption, workbook/sheet, attribution, header and data ranges, unit, period, and source column for every series. Declare chart type, axis, colour, precision, null policy and forecast/display rule for each output series. Declare data file, component and container ID under expectations.

For transformations, record the formula and independently test it. Do not change revisions, footnotes, provisional markers, or missing values without a documented rule. Add visual checks for dual axes, stacked totals, forecast boundaries, index base, labels or any figure-specific behaviour.

## Source features

Fill visualContract from the figure's entry in figure-features.json (references/source-features.md) instead of reading the picture by eye. Record the figure media name in source.referenceImage. Features not extracted there (tooltips, data values, note text, mobile layout) still need their own evidence.

## Series mark (required feature)

Every series MUST record its visual mark, read from the source image's plot shapes and legend symbol, not guessed from the data: `bar` (grouped or stacked), `line`, `line+marker`, `marker-only` (no connecting line), or `area`. For markers also record the symbol (diamond, circle, triangle, square) plus fill and outline. Record it in `series[].mark` and `visualContract.seriesAppearance`.

The implementation MUST produce the same *effective* mark after Highcharts option merging. Known trap: `plotOptions.series.lineWidth > 0` overrides scatter's default `lineWidth: 0`, so a marker-only scatter draws connecting lines unless the series sets `lineWidth: 0`. Also check `chart.type` defaults and `plotOptions.series.marker.enabled: false`.

When comparing against a donor/previously built chart (bok-start similarity, reuse), the per-series mark list MUST be identical; a mark mismatch means the donor is not a reuse candidate, whatever the pixel score. Pixel similarity MUST NOT pass a chart whose series marks differ from the source.

For stacked series also record the source stack order bottom→top. Highcharts' default `yAxis.reversedStacks: true` draws the *first* series on top; BOK figures usually list the bottom segment first in the legend, so set `reversedStacks: false` (or reorder) and verify the rendered order against the source. Record line style too (solid, dashed, lighter tint), since a dashed line and a light solid line are different marks.

Feature extraction is not limited to marks. Also record from the source image, per series and per chart: data labels (position inside/above/right, colour, weight, and value source; use the source total column rather than the computed stack sum when one exists), annotations (boxed text, arrows, text colour), legend placement and layout, and axis label format (thousands separators, line breaks). A chart is a match only when every recorded feature matches, not only the features of the current audit.

Record bar width as a ratio of the category width and axis tick label format (thousands separators) from the source. A mirrored right axis (`linkedTo`) must show the same ticks as its parent and get the same margin as the left axis; `linkedTo` does not copy `tickPositions`. Put column-only options such as `borderRadius: 0` under `plotOptions.column` or the series, never under `chart`. After any bulk option change, run a browser audit at 1440/768/375 for clipped axis labels, mismatched mirror ticks and rounded bars.

The x-axis must end where the source figure ends (last label and bar). Never widen `xAxis.min/max` to stretch a forecast band; overshoot only the band's `to` (for example `toPlotEnd(lastX)`), because column axes already add half a category of padding and a widened max shows an empty, data-less slot.

Line series whose source figure is continuous must set `connectNulls: true`; this is mandatory when quarterly or half-year data sits on a monthly axis. Record intentionally broken lines (period averages, reference segments, band helpers) explicitly. In `isDoubleChart` layouts each panel is narrower than 400px even on desktop, so a `maxWidth: 400` responsive rule is a panel rule, not a mobile rule: verify its margins and font sizes at desktop width too.
