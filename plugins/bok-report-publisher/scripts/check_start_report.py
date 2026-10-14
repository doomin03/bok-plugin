"""End-to-end self-check for start-report.py with a tiny generated DOCX (TOC table, figure paragraph, WMF) and XLSX.
usage: python check_start_report.py"""
import json, struct, subprocess, sys, tempfile, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
W, R = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


def rec(fn, payload):
    payload += b'\0' * (len(payload) & 1)
    return struct.pack('<IH', (6 + len(payload)) // 2, fn) + payload


def wmf():
    pen = lambda colour, width: rec(0x02FA, struct.pack('<HhhI', 0, width, 0, colour))
    line = lambda *pts: rec(0x0325, struct.pack('<h', len(pts)) + b''.join(struct.pack('<hh', *p) for p in pts))
    text = lambda x, y, s: rec(0x0521, struct.pack('<h', len(s.encode('cp949'))) + s.encode('cp949') + b'\0' * (len(s.encode('cp949')) & 1) + struct.pack('<hh', y, x))
    body = (rec(0x020C, struct.pack('<hh', 320, 480)) + pen(0, 1) + rec(0x012D, struct.pack('<H', 0))
            + line((40, 300), (40, 100)) + line((40, 300), (440, 300))
            + pen(0xAA5F14, 3) + rec(0x012D, struct.pack('<H', 1)) + line((80, 60), (96, 60))
            + text(100, 60, '명목GDP(좌축)') + struct.pack('<IH', 3, 0))
    return struct.pack('<IHhhhhHIH', 0x9AC6CDD7, 0, 0, 0, 480, 320, 1440, 0, 0) + struct.pack('<HHHIHIH', 1, 9, 0x300, 0, 2, 0, 0) + body


def docx(path):
    tc = lambda t: f'<w:tc><w:p><w:r><w:t>{t}</w:t></w:r></w:p></w:tc>'
    doc = (f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body><w:tbl><w:tr>{tc("Ⅰ")}{tc("1")}{tc("세계경제")}</w:tr></w:tbl>'
           '<w:p><w:r><w:t>그림 Ⅰ-1. 시험 그림</w:t></w:r><w:r><w:drawing><blip r:embed="rId1"/></w:drawing></w:r></w:p></w:body></w:document>')
    rels = ('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="image" Target="media/image1.wmf"/></Relationships>')
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('word/document.xml', doc); z.writestr('word/_rels/document.xml.rels', rels); z.writestr('word/media/image1.wmf', wmf())


def xlsx(path):
    cell = lambda ref, v: f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>'
    rows = {2: [('A2', '세계경제')], 4: [('A4', '1. 시험 그림')], 7: [('A7', '항목'), ('B7', '명목GDP(좌축)')]}
    sheet = f'<worksheet xmlns="{S}"><sheetData>' + ''.join(f'<row r="{n}">' + ''.join(cell(*c) for c in cs) + '</row>' for n, cs in rows.items()) + '</sheetData></worksheet>'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('xl/workbook.xml', f'<workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="Ⅰ-1" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', sheet)


with tempfile.TemporaryDirectory() as tmp:
    repo = Path(tmp) / 'repo'; (repo / 'src').mkdir(parents=True)
    subprocess.run(['git', 'init', '-q', str(repo)], check=True)
    subprocess.run(['git', '-C', str(repo), '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], check=True)
    docx(Path(tmp) / 'r.docx'); xlsx(Path(tmp) / 'r.xlsx')
    out = subprocess.run([sys.executable, str(HERE / 'start-report.py'), '--repo', str(repo), '--report', '2099-01',
                          '--docx', str(Path(tmp) / 'r.docx'), '--xlsx', str(Path(tmp) / 'r.xlsx'), '--toc-table', '0'],
                         capture_output=True, text=True, encoding='utf-8')
    assert out.returncode == 0, out.stderr
    change = next((repo / 'openspec' / 'changes').glob('bol-start-2099-01-*'))
    features = json.loads((change / 'figure-features.json').read_text(encoding='utf-8'))
    legend = features['word/media/image1.wmf']['panels'][0]['legend']
    assert legend[0]['text'] == '명목GDP(좌축)' and legend[0]['mark'] == 'line' and legend[0]['colour'] == '#145faa', legend
    chart = json.loads((change / 'charts' / 'SHEET001.json').read_text(encoding='utf-8'))
    assert chart['seriesNames'] == ['명목GDP(좌축)'], chart['seriesNames']
    assert chart['legendMatchCandidates'][0]['media'] == 'word/media/image1.wmf', chart['legendMatchCandidates']
    assert chart['referenceImageCandidates'] == ['word/media/image1.wmf'], chart['referenceImageCandidates']
    # 캡션 순서와 범례가 같은 그림을 가리키면 확정, 특징 요약이 오너 리뷰용으로 붙는다(축 없는 그림은 사람이 채울 칸)
    assert chart['figureLink']['status'] == 'confirmed' and chart['figureLink']['media'] == 'word/media/image1.wmf', chart['figureLink']
    assert chart['visualContract']['status'] == 'pending-manual' and chart['featureSummary'][0].startswith('자동 추출 없음'), chart
print('start-report self-check: OK')
