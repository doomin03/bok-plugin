"""Interpret raw figure records as chart features: axes, ticks, legend, series marks, bands, lines, notes.

Heuristic but evidence-backed: every feature keeps the source coordinates it came from, and anything
not classified stays in `unclassified` so a reviewer sees it instead of losing it.
"""
import re

NUM = re.compile(r'^[-−+]?\d{1,3}(,\d{3})*(\.\d+)?$|^[-−+]?\d+(\.\d+)?$')
NEUTRAL = {'#000000', '#ffffff', '#808080', '#7f7f7f', '#bfbfbf', '#d9d9d9', '#a6a6a6', '#595959', '#404040', '#262626'}


def merge_text(records):
    """Join text runs on one baseline whose gap is under ~0.6 em ('(' '좌축' ')' -> '(좌축)')."""
    texts = [r for r in records if r['type'] == 'text']
    runs = sorted((r for r in texts if not r['font'].get('vertical')), key=lambda r: (round(r['y'] / 3), r['x']))
    lines, vertical = [], vertical_text([r for r in texts if r['font'].get('vertical')])
    for r in runs:
        size = r['font'].get('size') or 12
        width = r.get('width') or len(r['text']) * size * 0.62
        last = lines[-1] if lines else None
        # 숫자끼리는 소수점·천 단위로 이어질 때만 붙인다(축 라벨 21·22·23 이 한 덩어리가 되지 않게)
        numeric_pair = last and NUM.match(last['text']) and r['text'][:1].isdigit()
        if last and not numeric_pair and abs(last['y'] - r['y']) <= 2 and -size * 0.5 <= r['x'] - last['x1'] <= size * 0.8:
            last['text'] += r['text']; last['x1'] = r['x'] + width
        else:
            lines.append({'text': r['text'], 'x': r['x'], 'x1': r['x'] + width, 'y': r['y'],
                          'size': size, 'weight': r['font'].get('weight'), 'colour': r['colour']})
    return lines + vertical


def vertical_text(runs):
    """Vertical-font labels are one glyph per record stacked downwards: join a column into one line."""
    lines = []
    for r in sorted(runs, key=lambda r: (r['x'], r['y'])):
        size = r['font'].get('size') or 12
        last = lines[-1] if lines else None
        if last and abs(last['x'] - r['x']) <= 2 and 0 <= r['y'] - last['y1'] <= size * 1.5:
            last['text'] += r['text']; last['y1'] = r['y']
        else:
            lines.append({'text': r['text'], 'x': r['x'], 'x1': r['x'] + size, 'y': r['y'], 'y1': r['y'],
                          'size': size, 'weight': r['font'].get('weight'), 'colour': r['colour']})
    return lines


def bbox(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def frame(shapes, window):
    """Plot frame from the longest vertical (y axes) and horizontal (x axis) strokes."""
    w, h = window[2] or 1, window[3] or 1
    vert = [s for s in shapes if s['type'] == 'polyline' and len(s['points']) == 2 and s['points'][0][0] == s['points'][1][0]
            and abs(s['points'][0][1] - s['points'][1][1]) > h * 0.4]
    horiz = [s for s in shapes if s['type'] == 'polyline' and len(s['points']) == 2 and s['points'][0][1] == s['points'][1][1]
             and abs(s['points'][0][0] - s['points'][1][0]) > w * 0.4]
    xs = sorted({s['points'][0][0] for s in vert})
    left, right = (xs[0], xs[-1]) if xs else (0, w)
    tops = [min(p[1] for p in s['points']) for s in vert]
    bottom = max((s['points'][0][1] for s in horiz), default=h)
    end = max((max(p[0] for p in s['points']) for s in horiz), default=w)
    return {'left': left, 'right': right if right != left else None, 'end': end, 'top': min(tops, default=0), 'bottom': bottom,
            'axisLines': len(vert) + len(horiz)}


def number(text):
    return float(text.replace(',', '').replace('−', '-')) if NUM.match(text) else None


def columns(texts, gap=12):
    """Group axis labels into columns by their left edge (one column = one axis)."""
    cols = []
    for t in sorted(texts, key=lambda t: t['x']):
        if cols and t['x'] - cols[-1][-1]['x'] <= gap:
            cols[-1].append(t)
        else:
            cols.append([t])
    return cols


def lattice(ticks):
    """Keep the longest evenly spaced run of tick values; data labels beside the axis break the spacing."""
    vals = sorted({v for _, v in ticks})
    if len(vals) < 3:
        return ticks
    diffs = [round(b - a, 6) for a, b in zip(vals, vals[1:])]
    step = max(set(diffs), key=diffs.count)
    def run(v):
        chain = [v]
        while any(abs(chain[-1] + step - x) < 1e-6 for x in vals):
            chain.append(chain[-1] + step)
        return chain
    chain = max((run(v) for v in vals), key=len)
    keep = [v for v in vals if any(abs(v - c) < 1e-6 for c in chain)]
    return [(y, v) for y, v in ticks if v in keep]


def axis_scale(ticks):
    """Linear y->value map from numeric tick labels (None if fewer than 2)."""
    if len(ticks) < 2:
        return None
    (y0, v0), (y1, v1) = ticks[0], ticks[-1]
    return (lambda y: round(v0 + (y - y0) * (v1 - v0) / (y1 - y0), 4)) if y1 != y0 else None


def features(records, shapes, f):
    texts = merge_text(records)
    # 오른쪽 축선이 없는 그림은 x축 선 끝이 플롯 오른쪽 끝이다
    L, R, T, B = f['left'], f['right'] or f.get('end') or f['left'], f['top'], f['bottom']
    pw, ph = max(1, R - L), max(1, B - T)
    rel = lambda x: round((x - L) / pw, 4)
    used, out = set(), {'frame': f, 'yAxes': [], 'xLabels': [], 'legend': [], 'series': [], 'bars': [],
                         'bands': [], 'referenceLines': [], 'verticalLines': [], 'notes': [], 'markers': {}, 'triangles': [], 'unclassified': []}
    # 우축선이 없는 그림도 플롯 오른쪽 숫자 열은 우축 눈금이다
    for side, test in (('left', lambda t: t['x1'] <= L + 2), ('right', lambda t: t['x'] >= R - 2)):
        cand = [t for t in texts if test(t) and T - 20 <= t['y'] <= B + 10 and number(t['text']) is not None]
        used |= {id(t) for t in cand}
        # 오른쪽은 숫자 열마다 축 하나(다중 우축 ①②, 왼쪽 정렬이라 x 가 정확하다)
        for col in (columns(cand) if side == 'right' else [cand]):
            ticks = lattice(sorted((t['y'], number(t['text'])) for t in col))
            out['unclassified'] += [t['text'] for t in col if number(t['text']) not in {v for _, v in ticks}]
            if len(ticks) >= (3 if side == 'right' and any(a['side'] == 'right' for a in out['yAxes']) else 2):  # 덧붙은 우축 열은 눈금 3개 이상
                vals = sorted(set(v for _, v in ticks))  # 같은 눈금을 두 번 그린 그림이 있다
                out['yAxes'].append({'side': side, 'ticks': vals, 'min': min(vals), 'max': max(vals), 'scale': axis_scale(ticks)})
    for t in texts:
        if id(t) in used:
            continue
        if t['y'] > B + 2 and L - pw * 0.03 <= (t['x'] + t['x1']) / 2 <= R + pw * 0.03:  # 축 밖 숫자는 y축 눈금이다
            out['xLabels'].append({'text': t['text'], 'at': rel((t['x'] + t['x1']) / 2)}); used.add(id(t))
        elif t['y'] < T - 2:
            out['legend'].append({'text': t['text'], 'x': t['x'], 'x1': t['x1'], 'y': t['y'], 'size': t['size']}); used.add(id(t))
        elif L < t['x'] < R and number(t['text']) is None:
            out['notes'].append({'text': t['text'], 'at': [rel(t['x']), round((t['y'] - T) / ph, 4)]}); used.add(id(t))
        else:
            out['unclassified'].append(t['text'])
    return out, shapes, (L, R, T, B, pw, ph, rel)


def tick_marks(shapes, x, horizontal=True):
    """Short strokes touching an axis line: positions and whether they point inside the plot."""
    marks = []
    for s in shapes:
        (x0, y0), (x1, y1) = (s['points'] + [s['points'][-1]])[:2]
        if s['type'] == 'polyline' and len(s['points']) == 2 and horizontal and y0 == y1 and abs(x1 - x0) <= 10 and x in (x0, x1):
            marks.append((y0, max(x0, x1) > x))
        if s['type'] == 'polyline' and len(s['points']) == 2 and not horizontal and x0 == x1 and abs(y1 - y0) <= 10 and x in (y0, y1):
            marks.append((x0, min(y0, y1) < x))
    return sorted(set(marks))


def classify_shapes(out, shapes, geo):
    L, R, T, B, pw, ph, rel = geo
    for ax in out['yAxes']:
        axis_x = L if ax['side'] == 'left' else R
        marks = tick_marks(shapes, axis_x)
        ys = [y for y, _ in marks]
        if len(ys) == len(ax['ticks']) >= 2:  # top tick = max value
            ax['scale'] = axis_scale(sorted(zip(ys, sorted(ax['ticks'], reverse=True))))
        ax['tickPosition'] = ('inside' if all(i == (ax['side'] == 'left') for _, i in marks) else 'outside') if marks else None
    xmarks = tick_marks(shapes, B, horizontal=False)
    out['xTicks'] = {'count': len(xmarks), 'at': [rel(x) for x, _ in xmarks]}
    left = next((a['scale'] for a in out['yAxes'] if a['side'] == 'left' and a['scale']), None)
    colours = {}
    for s in shapes:
        x0, y0, x1, y1 = bbox(s['points'])
        inside = L - 3 <= x0 and x1 <= R + 3 and T - 3 <= y0 and y1 <= B + 3  # 음영·막대가 축선 밖으로 1~2px 나오는 그림이 있다
        colour = s['fill'] or s['stroke']
        # 음영은 잘라내기 영역에 기대 플롯 위로 넘치게 그린 그림이 있다: 플롯 높이로 잘라서 판정
        clipped = min(y1, B) - max(y0, T)
        if s['type'] in ('polygon', 'rect') and s['fill'] and L - 3 <= x0 and x1 <= R + 3 and clipped >= ph * 0.9 and x1 - x0 < pw * 0.98:
            out['bands'].append({'from': rel(x0), 'to': rel(x1), 'colour': s['fill']})
        elif s['type'] == 'polyline' and inside and y0 == y1 and x1 - x0 >= pw * 0.8 and y0 != B:
            out['referenceLines'].append({'value': left(y0) if left else None, 'y': rel_y(y0, T, ph), 'colour': s['stroke'], 'dash': s['dash']})
        elif s['type'] == 'polyline' and inside and x0 == x1 and y1 - y0 >= ph * 0.8 and x0 not in (L, R):
            out['verticalLines'].append({'at': rel(x0), 'colour': s['stroke'], 'dash': s['dash'], 'width': s['width']})
        elif s['type'] == 'polyline' and len(seen := [p for p in s['points'] if L - 3 <= p[0] <= R + 3 and T - 3 <= p[1] <= B + 3]) >= 3                 and s['stroke'] not in NEUTRAL:
            # 잘라내기 영역에 기대 플롯 밖에서 시작하는 선이 있다: 플롯 안 꼭짓점만 센다
            out['series'].append({'mark': 'line', 'colour': s['stroke'], 'dash': s['dash'], 'width': s['width'],
                                  'points': len(seen), 'from': rel(min(p[0] for p in seen)), 'to': rel(max(p[0] for p in seen))})
        elif s['type'] == 'polygon' and s['fill'] and inside and len({tuple(p) for p in s['points']}) == 3 and (x1 - x0) <= 14 and (y1 - y0) <= 14:
            out['triangles'].append({'at': [rel((x0 + x1) / 2), rel_y((y0 + y1) / 2, T, ph)], 'colour': s['fill']})
        elif s['type'] == 'polyline' and inside and len(s['points']) == 2 and x0 != x1 and y0 != y1 and s['stroke'] in NEUTRAL:
            out.setdefault('leaders', []).append({'from': [rel(s['points'][0][0]), rel_y(s['points'][0][1], T, ph)], 'to': [rel(s['points'][1][0]), rel_y(s['points'][1][1], T, ph)]})
        elif s['type'] in ('polygon', 'rect') and s['fill'] and inside and (x1 - x0) <= 12 and (y1 - y0) <= 12 and s['fill'] in NEUTRAL | {s['stroke']}:
            out['markers'][colour] = out['markers'].get(colour, 0) + 1
        elif s['type'] in ('polygon', 'rect') and s['fill'] and inside and s['fill'] not in NEUTRAL:
            colours.setdefault(s['fill'], []).append(rel((x0 + x1) / 2))
        elif s['type'] == 'ellipse' and inside:
            out['markers'][colour] = out['markers'].get(colour, 0) + 1
    out['bands'].sort(key=lambda b: b['from'])
    # 눈금마다 그은 가로선은 기준선이 아니라 격자선이다(값이 눈금과 3개 이상 겹치면)
    ticks = [t for ax in out['yAxes'] if ax['side'] == 'left' for t in ax['ticks']]
    span = (max(ticks) - min(ticks)) if len(ticks) >= 2 else 0
    grid = [r for r in out['referenceLines'] if r['value'] is not None and span and any(abs(r['value'] - t) <= span * 0.02 for t in ticks)]
    style = max({(r['dash'], r['colour']) for r in grid}, key=lambda k: sum((r['dash'], r['colour']) == k for r in grid), default=None)
    grid = [r for r in grid if (r['dash'], r['colour']) == style]  # 0 선처럼 모양이 다른 선은 기준선으로 남긴다
    if len(grid) >= 3:
        out['gridLines'] = {'count': len(grid), 'dash': grid[0]['dash'], 'colour': grid[0]['colour']}
        out['referenceLines'] = [r for r in out['referenceLines'] if r not in grid]
    out['bars'] = [{'colour': c, 'count': len(v), 'from': min(v), 'to': max(v)} for c, v in colours.items()]
    return out


def rel_y(y, T, ph):
    return round((y - T) / ph, 4)


def legend_marks(out, shapes, geo):
    """Attach the sample symbol left of each legend text: line / bar / line+marker, colour, dash."""
    L, R, T, B, pw, ph, rel = geo
    samples = [s for s in shapes if bbox(s['points'])[3] < T - 1 and (bbox(s['points'])[2] - bbox(s['points'])[0]) <= 40]
    for item in out['legend']:
        # 글자 y 는 기준선(Excel WMF)이라 글자 가운데는 그보다 약 0.35em 위다. 두 줄 범례에서 윗줄 견본을 잡지 않게 한다
        mid = item['y'] - item['size'] * 0.35
        near = [s for s in samples if abs((bbox(s['points'])[1] + bbox(s['points'])[3]) / 2 - mid) <= max(6, item['size'] * 0.7)
                and 0 <= item['x'] - bbox(s['points'])[2] <= 12]
        # 짧은 점선 견본은 높이 1~3px 사각형 여러 개로 그려진다: 점선 한 줄로 본다
        thin = [s for s in near if s['type'] != 'polyline' and bbox(s['points'])[3] - bbox(s['points'])[1] <= 3]
        dashed = None
        if thin:
            xs = [x for s in thin for x in (bbox(s['points'])[0], bbox(s['points'])[2])]
            dashed = {'type': 'polyline', 'points': [(min(xs), bbox(thin[0]['points'])[1]), (max(xs), bbox(thin[0]['points'])[1])],
                      'stroke': thin[0]['fill'], 'dash': 'dash' if len(thin) >= 2 or max(xs) - min(xs) < 15 else 'solid'}
            near = [s for s in near if s not in thin]
        # 닫힌 꺾은선은 범례 상자의 테두리이지 선 견본이 아니다
        line = dashed or min((s for s in near if s['type'] == 'polyline' and s['points'][0] != s['points'][-1]), key=lambda s: item['x'] - bbox(s['points'])[2], default=None)
        box = min((s for s in near if s['type'] != 'polyline' or s['points'][0] == s['points'][-1]), key=lambda s: item['x'] - bbox(s['points'])[2], default=None)
        cx = box and (bbox(box['points'])[0] + bbox(box['points'])[2]) / 2
        cy = box and (bbox(box['points'])[1] + bbox(box['points'])[3]) / 2
        on_line = line and box and bbox(line['points'])[0] <= cx <= bbox(line['points'])[2] and abs(cy - bbox(line['points'])[1]) <= 3
        # 막대 견본: 모든 꼭짓점이 상자 모서리(±2px)에 있다. 마름모·삼각형 마커는 변 가운데에 꼭짓점이 있다
        bx = box and bbox(box['points'])
        upright = box and box['type'] == 'rect' or box and all(min(abs(p[0] - bx[0]), abs(p[0] - bx[2])) <= 2
                                                              and min(abs(p[1] - bx[1]), abs(p[1] - bx[3])) <= 2 for p in box['points'])
        item['mark'] = ('line+marker' if on_line else 'line' if line and not box else
                        ('bar' if upright else 'marker-only') if box else 'line' if line else None)
        item['colour'] = (line or {}).get('stroke') or (box or {}).get('fill')
        item['dash'] = (line or {}).get('dash')
    order = sorted(out['legend'], key=lambda i: (round(i['y'] / 8), i['x']))
    # 견본 없이 괄호로 싼 글자(「(전년동기대비, %)」)는 범례가 아니라 축 단위다
    unit = lambda i: not i['mark'] and re.fullmatch(r'\(.*\)', i['text'])
    out['units'] = []
    for i in filter(unit, order):
        # 좌·우 단위가 한 줄(「(%)      (%)」, 「(연%)(%p)」)로 읽히면 나눈다. 플롯 폭만큼 벌어져 있으면 왼쪽·오른쪽
        parts = [p for p in re.split(r'\s{2,}|(?<=\))(?=\()', i['text']) if p]
        wide = len(parts) == 2 and i['x1'] - i['x'] > pw * 0.6
        for k, part in enumerate(parts):
            side = ('left', 'right')[k] if wide else 'left' if (i['x'] + i['x1']) / 2 < L + pw / 2 else 'right'
            out['units'].append({'text': part, 'side': side})
    # 견본 없는 숫자는 다른 패널의 눈금이다
    out['unclassified'] += [i['text'] for i in order if NUM.match(i['text'])]
    out['legend'] = [{k: v for k, v in i.items() if k not in ('x', 'x1', 'y', 'size')} for i in order
                     if not unit(i) and not NUM.match(i['text'])]
    return out


def extract(records, window):
    """Features per panel. Records are assigned to the nearest panel frame (multi-panel figures)."""
    shapes = join_dashes([r for r in records if r['type'] != 'text'])
    found = frames(shapes, window) or [frame(shapes, window)]
    def centre(r):
        x0, y0, x1, y1 = bbox(r['points']) if 'points' in r else (r['x'], r['y'], r['x'], r['y'])
        return (x0 + x1) / 2, (y0 + y1) / 2
    def owner(r):
        cx, cy = centre(r)
        gap = lambda f: max(f['left'] - cx, 0, cx - (f['right'] or f['left'])) + max(f['top'] - cy, 0, cy - f['bottom'])
        return min(range(len(found)), key=lambda k: gap(found[k]))
    texts = [r for r in records if r['type'] == 'text']
    panels = []
    for k, f in enumerate(found):
        mine = [r for r in texts if owner(r) == k] if len(found) > 1 else texts
        own_shapes = [s for s in shapes if owner(s) == k] if len(found) > 1 else shapes
        out, _, geo = features(mine, own_shapes, f)
        classify_shapes(out, own_shapes, geo)
        legend_marks(out, own_shapes, geo)
        for ax in out['yAxes']:
            ax.pop('scale', None)
        panels.append(out)
    return {'panelCount': len(panels), 'panels': panels}


def join_dashes(shapes):
    """Excel exports dashed lines as runs of 1-2px rectangles; rebuild them as one dashed stroke."""
    runs, rest = {}, []
    for s in shapes:
        x0, y0, x1, y1 = bbox(s['points'])
        thin_v = s['type'] == 'polygon' and x1 - x0 <= 2 and 0 < y1 - y0 <= 8
        thin_h = s['type'] == 'polygon' and y1 - y0 <= 2 and 0 < x1 - x0 <= 8
        if thin_v or thin_h:
            runs.setdefault(('v', x0, s['fill']) if thin_v else ('h', y0, s['fill']), []).append((x0, y0, x1, y1, s))
        else:
            rest.append(s)
    for (axis, at, colour), parts in runs.items():
        if len(parts) < 5:
            rest.extend(p[4] for p in parts); continue
        lo = min(p[1] if axis == 'v' else p[0] for p in parts); hi = max(p[3] if axis == 'v' else p[2] for p in parts)
        pts = [(at, lo), (at, hi)] if axis == 'v' else [(lo, at), (hi, at)]
        rest.append({'type': 'polyline', 'points': pts, 'stroke': colour, 'dash': 'dash', 'width': 1, 'fill': None})
    return rest


def frames(shapes, window):
    """One frame per x-axis line that has a y-axis line standing on its left end (multi-panel aware)."""
    w = window[2] or 1
    # 축선은 실선만: 점선(연도 경계 등)을 축으로 잡으면 플롯 끝이 안쪽으로 잘린다
    lines = [s for s in shapes if s['type'] == 'polyline' and len(s['points']) == 2 and s['stroke'] not in (None, '#ffffff') and s['dash'] == 'solid']
    horiz = [bbox(s['points']) for s in lines if s['points'][0][1] == s['points'][1][1] and bbox(s['points'])[2] - bbox(s['points'])[0] > w * 0.25]
    vert = [bbox(s['points']) for s in lines if s['points'][0][0] == s['points'][1][0] and bbox(s['points'])[3] - bbox(s['points'])[1] > 40]
    out = []
    for x0, y, x1, _ in sorted(horiz, key=lambda b: (b[1], b[0])):
        stand = [v for v in vert if x0 - 1 <= v[0] <= x1 + 1 and abs(v[3] - y) <= 1]
        if any(abs(v[0] - x0) <= 1 for v in stand) and not any(abs(f['bottom'] - y) <= 1 and abs(f['left'] - x0) <= 1 for f in out):
            xs = sorted(v[0] for v in stand)
            out.append({'left': x0, 'right': xs[-1] if xs[-1] > x0 + 1 else None, 'end': x1, 'top': min(v[1] for v in stand), 'bottom': y, 'axisLines': len(stand) + 1})
    return out
