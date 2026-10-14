"""Link each workbook sheet to its source figure and draft its visualContract from that figure's features.

Three independent signals; agreement decides, never a guess:
1. caption order - the sheet title (A4 without '<그림 Ⅲ-3>' or '2,' prefixes) appears in a body block whose media
   count equals the number of sheet titles found there, so the i-th title is the i-th figure.
2. legend - the figure's legend texts are contained in the sheet's series names (row 7).
3. data fit - the sheet's numbers lie inside the figure's y-axis range and fill a meaningful part of it.
"""
import re
import unicodedata

MARKS = re.compile(r'\d+\)|[①②③④⑤]|좌축|우축|[\s()（）·‧,.\-~/%<>]')


def key(text):
    return MARKS.sub('', unicodedata.normalize('NFKC', str(text))).casefold()


def title_key(title):
    title = re.sub(r'^\s*<[^>]*>\s*', '', str(title or ''))
    return key(re.sub(r'^\s*\d+\s*[.,]\s*', '', title))


def caption_links(blocks, contracts):
    """{sheet id: [media]} where a block's figure anchors and figures pair up one to one, in document order.

    Anchor = the caption label '그림 Ⅲ-4' when the sheet has a figure number (참고 boxes number their own
    panels, so they use the title), otherwise the sheet title.
    """
    def label(c):
        m = re.fullmatch(r'([IVX]+)-(\d+)', unicodedata.normalize('NFKC', c.get('figureCandidate') or ''))
        if not m or str(c.get('sheet', '')).startswith('참고'):
            return None
        return re.compile(r'그림\s*' + m.group(1) + r'\s*[-－]\s*' + m.group(2) + r'(?!\d)')
    labels = {c['id']: label(c) for c in contracts}
    titles = {c['id']: title_key(c['title']) for c in contracts if len(title_key(c['title'])) >= 4}
    links = {}
    for block in blocks:
        media = [r['target'] for r in block.get('references', []) if not r['external'] and '/media/' in r['target']]
        if not media:
            continue
        plain, text = unicodedata.normalize('NFKC', block['text']), key(block['text'])
        found = []
        for cid in {c['id'] for c in contracts}:
            hit = labels[cid] and labels[cid].search(plain)
            if hit:  # 캡션 번호 위치를 제목 위치와 같은 척도(정규화 글자 수)로 바꾼다
                found.append((len(key(plain[:hit.start()])), cid))
            elif not labels[cid] and cid in titles and titles[cid] in text:
                found.append((text.find(titles[cid]), cid))
        found.sort()
        if len(found) == len(media):
            for (_, cid), m in zip(found, media):
                links.setdefault(cid, []).append(m)
    return links


def legend_score(figure, series_names):
    names = key(' '.join(series_names))
    legend = [key(l['text']) for p in figure.get('panels', []) for l in p['legend'] if l.get('mark')]
    legend = [x for x in legend if len(x) >= 2]
    return round(sum(x in names for x in legend) / len(legend), 2) if names and legend else 0


def data_fit(figure, values):
    """True when every value sits inside the figure's y range (2% slack) and spans at least 20% of it."""
    axes = [a for p in figure.get('panels', []) for a in p['yAxes']]
    if not axes or not values:
        return False
    lo, hi = min(a['min'] for a in axes), max(a['max'] for a in axes)
    span = (hi - lo) or 1
    return all(lo - span * 0.02 <= v <= hi + span * 0.02 for v in values) and (max(values) - min(values)) / span >= 0.2


def link(contract, figures, captions, values):
    """Pick the figure two signals agree on: 'confirmed'; one unique signal: 'likely'; otherwise 'needs-owner'."""
    real = {m: f for m, f in figures.items() if f.get('status') == 'extracted'}
    names = set(captions.get(contract['id'], [])) | {m for m, f in real.items() if legend_score(f, contract['seriesNames']) >= 0.6}
    scored = []
    for m in names:
        f = real.get(m) or real.get(figures.get(m, {}).get('of'))
        signals = {'caption': m in captions.get(contract['id'], []),
                   'legend': legend_score(f, contract['seriesNames']) if f else 0,
                   'dataFit': data_fit(f, values) if f else False}
        votes = signals['caption'] + (signals['legend'] >= 0.6) + signals['dataFit']
        scored.append({'media': m, 'votes': votes, **signals})
    scored.sort(key=lambda s: (-s['votes'], -s['legend'], s['media']))
    top = scored[0] if scored else None
    tied = top and len(scored) > 1 and scored[1]['votes'] == top['votes']
    status = ('none' if not top else 'confirmed' if top['votes'] >= 2 and not tied
              else 'likely' if top['votes'] == 1 and not tied else 'needs-owner')
    return {'status': status, 'media': top['media'] if top and status != 'needs-owner' else None, 'candidates': scored}


def visual_contract(figure, media):
    """Draft visualContract straight from the source figure; the owner review confirms it, nothing is verified."""
    keep = ('yAxes', 'units', 'xLabels', 'xTicks', 'legend', 'bars', 'bands', 'referenceLines', 'verticalLines',
            'gridLines', 'notes', 'triangles')
    panels = [{k: p[k] for k in keep if p.get(k)} for p in figure.get('panels', [])]
    if not any(p.get('yAxes') for p in panels):  # EMF·도식: 축을 못 찾으면 잡음 대신 사람이 채울 칸으로 남긴다
        return {'status': 'pending-manual', 'sourceFigure': media, 'reason': '원본 그림에서 축을 찾지 못함(EMF·도식). 그림을 보고 기록'}
    return {'status': 'draft-from-source-figure', 'sourceFigure': media, 'panelCount': len(panels), 'panels': panels}


def summary(contract):
    """One line per panel for owner-review.md and comparison.html: the features the owner checks first."""
    vc = contract.get('visualContract') or {}
    lines = [f"자동 추출 없음: {vc['reason']}"] if vc.get('reason') else []
    for k, p in enumerate(vc.get('panels', []), 1):
        axes = ' / '.join(f"{a['side']}축 {a['min']:g}~{a['max']:g}({len(a['ticks'])}눈금)" for a in p.get('yAxes', []))
        legend = ', '.join(f"{l['text']}[{l.get('mark') or '?'}{'·' + l['dash'] if l.get('dash') not in (None, 'solid') else ''}]"
                           for l in p.get('legend', []))
        extra = [f"단위 {'·'.join(u['text'] for u in p.get('units', []))}" if p.get('units') else '',
                 f"음영 {len(p['bands'])}" if p.get('bands') else '',
                 f"기준선 {', '.join(str(r['value']) for r in p['referenceLines'])}" if p.get('referenceLines') else '',
                 f"플롯 글자 {', '.join(n['text'] for n in p['notes'][:6])}" if p.get('notes') else '']
        x = p.get('xLabels', [])
        xs = f"x축 {x[0]['text']}…{x[-1]['text']}({len(x)})" if x else ''
        lines.append(f"패널{k}: " + ' · '.join(s for s in [axes, xs, f'범례 {legend}' if legend else '', *extra] if s))
    return lines
