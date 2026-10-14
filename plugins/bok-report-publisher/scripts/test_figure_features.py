"""Self-check for figure_features: python test_figure_features.py (no files, synthetic records)."""
from figure_features import extract

TEXT = lambda x, y, t, w=None: {'type': 'text', 'x': x, 'y': y, 'text': t, 'width': w, 'colour': '#000000', 'font': {'size': 12}}
LINE = lambda pts, colour='#000000', dash='solid', w=1: {'type': 'polyline', 'points': pts, 'stroke': colour, 'dash': dash, 'width': w, 'fill': None}
FILL = lambda pts, colour: {'type': 'polygon', 'points': pts, 'stroke': None, 'dash': 'solid', 'width': 1, 'fill': colour}
BOX = lambda x0, y0, x1, y1: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

records = [
    LINE([(40, 300), (40, 100)]), LINE([(40, 300), (440, 300)]), LINE([(440, 300), (440, 100)]),  # frame
    *[LINE([(40, y), (44, y)]) for y in (300, 200, 100)],                                          # inside ticks
    TEXT(20, 295, '-5', 12), TEXT(20, 195, '0', 8), TEXT(20, 95, '5', 8),                           # left ticks
    TEXT(60, 310, '21', 14), TEXT(80, 310, '22', 14),                                               # x labels stay apart
    TEXT(100, 60, '명목GDP', 40), TEXT(141, 60, '(', 5), TEXT(147, 60, '좌축)', 25),                # legend runs
    LINE([(80, 60), (96, 60)], '#145faa', w=3),                                                     # legend sample
    LINE([(40, 200), (440, 200)]),                                                                  # 0 reference line
    *[FILL(BOX(240, y, 241, y + 4), '#000000') for y in range(100, 300, 8)],                        # dashed vertical line
    FILL(BOX(400, -50, 440, 300), '#c8c8c8'),                                                       # band drawn past the top
    LINE([(50, 250), (100, 220), (150, 180)], '#145faa', w=3),                                      # line series
    TEXT(410, 120, '④기', 20),                                                                      # note in plot
]
panel = extract(records, (0, 0, 480, 320))['panels'][0]
assert panel['yAxes'][0]['ticks'] == [-5, 0, 5] and panel['yAxes'][0]['tickPosition'] == 'inside', panel['yAxes']
assert [x['text'] for x in panel['xLabels']] == ['21', '22'], panel['xLabels']
assert panel['legend'][0]['text'] == '명목GDP(좌축)' and panel['legend'][0]['mark'] == 'line', panel['legend']
assert [r['value'] for r in panel['referenceLines']] == [0], panel['referenceLines']
assert panel['verticalLines'] and panel['verticalLines'][0]['dash'] == 'dash', panel['verticalLines']
assert panel['bands'] == [{'from': 0.9, 'to': 1.0, 'colour': '#c8c8c8'}], panel['bands']
assert panel['series'][0]['colour'] == '#145faa' and [n['text'] for n in panel['notes']] == ['④기']
print('figure_features self-check: OK')
