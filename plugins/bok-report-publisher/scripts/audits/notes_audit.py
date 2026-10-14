# 차트 각주 번호(주: N)) 중 제목·차트 컴포넌트 어디에도 <sup>N)</sup> 표시가 없는 것을 찾는다.
# 사용: python notes_audit.py --report-dir <repo>/src/pages/reportYYYYMM
import re, glob, os, sys, json
B = sys.argv[sys.argv.index('--report-dir') + 1].replace('\\', '/').rstrip('/') + '/'
comp = {os.path.basename(p)[:-4]: p for p in glob.glob(B + '**/*Component.vue', recursive=True)}
out = []
checked = 0
for f in glob.glob(B + '**/*.vue', recursive=True):
    s = open(f, encoding='utf-8').read()
    for a in re.finditer(r'<article class="chart-wrap">(.*?)</article>', s, re.S):
        blk = a.group(1)
        cap = re.search(r'chart-info">\s*<span>(.*?)</span>', blk, re.S)
        foot = re.search(r'chart-footnote">(.*?)</div>', blk, re.S)
        if not cap or not foot:
            continue
        checked += 1
        notes = set(re.findall(r'(?:^|<br>|\s|<span>)(\d)\)', foot.group(1)))
        capsup = set(re.findall(r'<sup class="sup">(\d)\)</sup>', cap.group(1)))
        names = re.findall(r'<(SHEET\w+?Component|Sheet\d\w*)\b', blk)
        insup = set()
        for n in names:
            key = n if n.startswith('SHEET') else 'SHEET' + n[5:] + 'Component'
            p = comp.get(key)
            if p:
                insup |= set(re.findall(r'<sup[^>]*>(\d)\)', open(p, encoding='utf-8').read()))
        miss = sorted(notes - capsup - insup)
        if miss:
            out.append((os.path.basename(f), re.sub('<[^>]+>', '', cap.group(1)).strip()[:40], names, miss))
for o in out:
    print(o)
print(len(out))
# 측정 = 제목·주가 다 있는 그림 수(0이면 마크업 구조가 바뀐 것)
print(json.dumps({'audit': 'notes_audit', 'measured': checked, 'defects': len(out)}, ensure_ascii=False))
