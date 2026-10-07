// Runs inside the report page: read what Highcharts actually rendered, in the same vocabulary as
// figure_features.py (axes, x labels, legend, series marks, bands, reference lines, plot texts).
export function collectRuntime(id) {
  const c = window.Highcharts?.charts.find((x) => x?.renderTo?.id === id);
  if (!c) return null;
  const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const x = c.xAxis[0], rel = (v) => +((v - x.min) / ((x.max - x.min) || 1)).toFixed(4);
  const box = c.container.getBoundingClientRect();
  const inPlot = (r) => r.left - box.left >= c.plotLeft - 2 && r.right - box.left <= c.plotLeft + c.plotWidth + 2
    && r.top - box.top >= c.plotTop - 2 && r.bottom - box.top <= c.plotTop + c.plotHeight + 2;
  const skip = '.highcharts-axis-labels,.highcharts-legend,.highcharts-tooltip,.highcharts-axis-title,.highcharts-credits,.highcharts-data-labels';
  return {
    yAxes: c.yAxis.filter((a) => a.visible !== false && a.tickPositions?.length).map((a) => ({
      side: a.opposite ? 'right' : 'left', ticks: [...a.tickPositions], min: a.min, max: a.max, linked: a.options.linkedTo != null,
      title: plain(a.axisTitle?.textStr) })),
    xLabels: Object.values(x.ticks).map((t) => plain(t.label?.textStr ?? t.label?.element?.textContent)).filter(Boolean),
    legend: (c.legend?.allItems || []).filter((i) => i.options.showInLegend !== false).map((i) => ({
      text: plain(i.name), type: i.type, colour: i.color, dash: i.options.dashStyle || 'Solid',
      marker: i.options.marker?.enabled ?? false })),
    series: c.series.filter((s) => s.visible && s.options.showInLegend !== false || s.visible && s.points?.length > 1).map((s) => ({
      name: plain(s.name), type: s.type, colour: s.color, dash: s.options.dashStyle || 'Solid', points: s.points.length,
      lineWidth: s.options.lineWidth ?? s.graph?.attr('stroke-width'), marker: s.options.marker?.enabled ?? null })),
    bands: (x.plotLinesAndBands || []).filter((b) => b.options.from != null).map((b) => ({
      from: rel(b.options.from), to: rel(b.options.to), colour: b.options.color, label: plain(b.options.label?.text) })),
    referenceLines: c.yAxis.flatMap((a) => (a.plotLinesAndBands || []).filter((p) => p.options.value != null).map((p) => ({
      side: a.opposite ? 'right' : 'left', value: p.options.value, dash: p.options.dashStyle || 'Solid' }))),
    verticalLines: (x.plotLinesAndBands || []).filter((p) => p.options.value != null).map((p) => ({ at: rel(p.options.value), dash: p.options.dashStyle || 'Solid' })),
    // 플롯 안 글자: 원본 주석이 구현에서 플롯 밖(제목 줄 등)으로 옮겨져도 찾도록 컨테이너 전체 글자를 함께 둔다
    texts: [...c.container.querySelectorAll('svg text, div span')].filter((t) => !t.closest(skip)).map((t) => plain(t.textContent)).filter(Boolean),
    textsInPlot: [...c.container.querySelectorAll('svg text')].filter((t) => !t.closest(skip) && inPlot(t.getBoundingClientRect())).map((t) => plain(t.textContent)).filter(Boolean),
  };
}
