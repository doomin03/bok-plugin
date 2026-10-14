// Compare source-figure features (figure_features.py) with runtime features (figure-runtime.mjs).
// Each check is pass / fail / review with both values, so a reviewer sees the exact difference.
// 각주 번호(2))·띄어쓰기·괄호·HTML 차이는 같은 글자로 본다
const norm = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/[−–]/g, '-').replace(/\d+\)/g, '').replace(/[\s()（）·,]/g, '').toLowerCase();
// x축 라벨은 연도 생략 표기(23.7 ↔ 7)를 같은 것으로 본다
const ROMAN = { 'ⅰ': 'i', 'ⅱ': 'ii', 'ⅲ': 'iii', 'ⅳ': 'iv', 'Ⅰ': 'i', 'Ⅱ': 'ii', 'Ⅲ': 'iii', 'Ⅳ': 'iv' };
const xnorm = (s) => norm(s).replace(/[ⅰ-ⅳⅠ-Ⅳ]/g, (m) => ROMAN[m]).replace(/^\d{2}\.?(?=[^\d.])/, '').split('.').pop();
const clamp = (v) => Math.min(1, Math.max(0, v));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// 엑셀 범례 상자는 막대와 영역이 같은 모양이라 둘 다 허용한다
const MARK = { line: ['line', 'spline'], bar: ['column', 'bar', 'area', 'arearange'], 'line+marker': ['line', 'spline', 'scatter'], 'marker-only': ['scatter', 'line'] };

export function compareFigure(src, run) {
  const out = [], add = (feature, status, source, runtime, note = '') => out.push({ feature, status, source, runtime, note });
  const seen = {};
  for (const ax of src.yAxes) {
    // 같은 쪽 축이 여럿이면(다중 우축 ①②) 바깥으로 나가는 순서대로 짝짓는다
    const k = seen[ax.side] = (seen[ax.side] ?? -1) + 1, sides = run.yAxes.filter((a) => a.side === ax.side);
    const r = sides.filter((a) => !a.linked)[k] || sides[k] || sides[0];
    if (!r) { add(`y축(${ax.side})`, 'fail', ax.ticks, null, '구현에 이 쪽 축이 없음'); continue; }
    const same = ax.ticks.length === r.ticks.length && ax.ticks.every((t, i) => near(t, r.ticks[i], 1e-6));
    add(`y축(${ax.side}) 눈금`, same ? 'pass' : 'fail', ax.ticks, r.ticks);
  }
  // 두 줄 라벨은 원본에서 줄마다 따로 나오므로, 구현 라벨을 이어 붙인 글자 안에 있으면 같은 것으로 본다
  const srcX = src.xLabels.map((l) => xnorm(l.text)).filter(Boolean), runX = run.xLabels.map(xnorm);
  const runXJoined = run.xLabels.map(norm).join('|');
  const missX = srcX.filter((t) => !runX.includes(t) && !runXJoined.includes(t));
  const runTitles = [...run.yAxes.map((a) => a.title), ...run.texts].map(norm).join('|');
  for (const u of src.units || []) add(`y축 단위(${u.side}) 「${u.text}」`, runTitles.includes(norm(u.text)) ? 'pass' : 'fail', u.text,
    run.yAxes.filter((a) => a.side === u.side).map((a) => a.title), '');
  add('x축 라벨', missX.length ? 'fail' : 'pass', srcX, runX, missX.length ? `구현에 없는 라벨: ${missX.join(', ')}` : '');
  const legend = src.legend.filter((l) => l.mark);
  const runL = run.legend.map((l) => norm(l.text));
  legend.forEach((l, i) => {
    const k = runL.indexOf(norm(l.text));
    if (k < 0) return add(`범례 「${l.text}」`, 'fail', l.text, run.legend.map((x) => x.text), '구현 범례에 없음');
    const r = run.legend[k], kinds = MARK[l.mark] || [];
    const markOk = kinds.includes(r.type) && (l.mark !== 'line+marker' || r.marker || r.type === 'scatter')
      && (l.mark !== 'marker-only' || r.type === 'scatter' || r.marker);
    add(`범례 「${l.text}」 표시`, markOk ? 'pass' : 'fail', `${l.mark} ${l.dash || ''}`, `${r.type}${r.marker ? '+marker' : ''} ${r.dash}`);
    if (k !== i) add(`범례 「${l.text}」 순서`, 'review', i + 1, k + 1, '순서가 다름(범례 배치가 다르면 확인)');
  });
  add('막대 계열 수(색 기준)', src.bars.length === run.series.filter((s) => MARK.bar.includes(s.type)).length ? 'pass' : 'review',
    src.bars.map((b) => b.colour), run.series.filter((s) => MARK.bar.includes(s.type)).map((s) => s.name));
  const runB = run.bands.map((b) => ({ ...b, from: clamp(b.from), to: clamp(b.to) })).filter((b) => b.to - b.from > 0.005 && b.colour !== 'transparent');
  const bandOk = src.bands.length === runB.length && src.bands.every((b, i) => near(b.from, runB[i].from, 0.03) && near(b.to, runB[i].to, 0.03));
  add('음영 구간', bandOk ? 'pass' : 'fail', src.bands.map((b) => [b.from, b.to]), runB.map((b) => [b.from, b.to]), '색은 보고서 공통 음영색을 쓰므로 비교하지 않음');
  const left = src.yAxes.find((a) => a.side === 'left'), span = left ? (left.max - left.min) || 1 : 1;
  for (const ref of src.referenceLines.filter((r) => r.value != null)) {
    const hit = run.referenceLines.find((r) => near(r.value, ref.value, span * 0.02));
    add(`가로 기준선 ${ref.value}`, hit ? 'pass' : 'fail', `${ref.value} ${ref.dash}`, hit ? `${hit.value} ${hit.dash}` : null, hit ? '' : '구현에 같은 높이의 plotLine 없음');
  }
  add('세로선 수', src.verticalLines.length === run.verticalLines.length ? 'pass' : 'review', src.verticalLines.length, run.verticalLines.length);
  const runT = [...(run.allTexts || run.texts), ...run.yAxes.map((a) => a.title)].map(norm).join('');
  for (const n of src.notes) add(`플롯 안 글자 「${n.text}」`, runT.includes(norm(n.text)) ? 'pass' : 'fail', n.text, null, runT.includes(norm(n.text)) ? '' : '구현 플롯 안에 없음');
  return out;
}
