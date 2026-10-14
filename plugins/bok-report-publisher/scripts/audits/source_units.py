"""회귀 검증용 원문 단위 목록. 렌더러·추출기 로직과 독립적으로 DOCX XML 을 그대로 훑는다.

모든 w:p(본문·텍스트 상자·표 셀) 와 각주 문단을 원문 순서대로 한 단위씩 뽑는다(mc:Fallback 사본 제외).
usage: python source_units.py <docx> <out.json>
결과 source-units.json 은 regression·footnote-map·reverse-text·audit 의 --units 입력이다.
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
MC = '{http://schemas.openxmlformats.org/markup-compatibility/2006}'


def paragraphs(el, where, out):
    """el 아래 w:p 를 문서 순서로. 문단 자체 글자는 텍스트 상자 글자를 제외하고 센다."""
    for ch in el:
        if ch.tag == MC + 'Fallback':
            continue
        if ch.tag == W + 'p':
            out.append((where, own_text(ch), ch))
            for box in boxes(ch):
                paragraphs(box, 'box', out)
        elif ch.tag == W + 'tc':
            paragraphs(ch, 'cell', out)
        else:
            paragraphs(ch, where, out)
    return out


def own_text(p):
    text = []
    def walk(el):
        for ch in el:
            if ch.tag in (MC + 'Fallback', W + 'txbxContent'):
                continue
            if ch.tag == W + 't':
                text.append(ch.text or '')
            walk(ch)
    walk(p)
    return re.sub(r'\s+', ' ', ''.join(text).replace('　', ' ')).strip()


def boxes(p):
    found = []
    def walk(el):
        for ch in el:
            if ch.tag == MC + 'Fallback':
                continue
            if ch.tag == W + 'txbxContent':
                found.append(ch)
            else:
                walk(ch)
    walk(p)
    return found


def main(docx, out_path):
    z = zipfile.ZipFile(docx)
    body = ET.fromstring(z.read('word/document.xml')).find(W + 'body')
    units = []
    for i, child in enumerate(body):
        for where, text, _ in paragraphs([child], 'main' if child.tag == W + 'p' else 'cell', []):
            if text:
                units.append({'block': f'B{i + 1:04d}', 'where': where, 'text': text})
    for fn in ET.fromstring(z.read('word/footnotes.xml')).findall(W + 'footnote'):
        if int(fn.get(W + 'id')) >= 1:
            for where, text, _ in paragraphs(fn, 'footnote', []):
                if text:
                    units.append({'block': 'FN' + fn.get(W + 'id'), 'where': where, 'text': text})
    json.dump(units, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(json.dumps({'units': len(units), **{w: sum(1 for u in units if u['where'] == w) for w in ('main', 'box', 'cell', 'footnote')}}))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
