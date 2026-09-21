"""Create offline image comparison evidence. Requires Pillow; never grants approval."""
import argparse
import base64
import hashlib
import html
import io
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat
from comparison_targets import load_targets


def load_image(filename):
    with Image.open(filename) as image:
        image = ImageOps.exif_transpose(image).convert('RGBA')
        background = Image.new('RGBA', image.size, 'white')
        background.alpha_composite(image)
        return background.convert('RGB')


def data_uri(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


def compare(reference, candidate):
    # Preserve aspect ratio: never stretch images to produce a misleading match.
    size = (800, 600)
    a, b = [ImageOps.pad(im, size, method=Image.Resampling.LANCZOS, color='white')
            for im in (reference, candidate)]
    difference = ImageChops.difference(a, b)
    mae = sum(ImageStat.Stat(difference).mean) / 3
    red, green, blue = difference.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    changed = sum(maximum.histogram()[17:])
    metrics = {'pixelSimilarityPercent': round(100 * (1 - mae / 255), 2),
               'changedPixelPercent': round(100 * changed / (size[0] * size[1]), 2),
               'referenceSize': list(reference.size), 'candidateSize': list(candidate.size),
               'comparisonSize': list(size), 'differenceThreshold': 16}
    return metrics, a, b, difference.point(lambda p: min(255, p * 4))


def generate(manifest, output, targets_file=None):
    manifest, output = Path(manifest).resolve(), Path(output).resolve()
    config = json.loads(manifest.read_text(encoding='utf-8-sig'))
    targets = load_targets(targets_file) if targets_file else None
    entries = config.get('items')
    if not isinstance(entries, list) or not entries:
        raise ValueError('items must be a non-empty array')
    records, cards, reviews, ids = [], [], [], set()
    escape = lambda value: html.escape(str(value), quote=True)
    for entry in entries:
        identity = entry['id']
        if not isinstance(identity, str) or not identity.strip() or identity in ids:
            raise ValueError('Each item needs a unique non-empty id')
        ids.add(identity)
        title = str(entry.get('title', identity))
        record = {'id': identity, 'title': title, 'status': 'pending', 'metrics': None}
        if targets is not None:
            target_id = entry.get('targetId')
            if target_id not in targets:
                raise ValueError(f'{identity}: targetId must reference the owner target configuration')
            target = targets[target_id]
            source_value = entry.get('targetSource')
            if not isinstance(source_value, str) or not source_value.strip():
                raise ValueError(f'{identity}: targetSource is required')
            source = (Path(target['projectPath']) / source_value).resolve()
            if not source.is_file() or not any(source == Path(p) or (Path(p).is_dir() and source.is_relative_to(Path(p))) for p in target['sourcePaths']):
                raise ValueError(f'{identity}: targetSource must be a file within owner sourcePaths')
            record['comparisonTarget'] = {**target, 'selectedSource': str(source),
                                           'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest()}
        images = []
        for key in ('reference', 'candidate'):
            value = entry.get(key)
            filename = (manifest.parent / value).resolve() if value else None
            if filename and filename.is_file():
                images.append(load_image(filename))
                record[key] = {'path': str(filename), 'sha256': hashlib.sha256(filename.read_bytes()).hexdigest()}
            else:
                images.append(None)
                record[key] = {'path': str(filename) if filename else None, 'missing': True}
        note = str(entry.get('analysis') or '미검토: 계열·축·단위·기간·범례·주석·반응형 및 원본 셀 대조 필요')
        record['analysis'] = note
        heading = f'{identity} — {title}'
        body = f'<h2>{escape(heading)}</h2><p>{escape(note)}</p>'
        md = [f'## {heading.replace(chr(10), " ")}', '', note, '']
        if 'comparisonTarget' in record:
            target = record['comparisonTarget']
            description = f'기개발 프로젝트: {target["projectPath"]}\n오너 설명: {target["description"]}\n비교 소스: {target["selectedSource"]}\n소스 SHA256: {target["sourceSha256"]}\n요청 ref: {target.get("ref") or "현재 소스 상태"}'
            body += '<p>' + escape(description) + '</p>'
            md += [description, '']
        for key in ('reference', 'candidate'):
            md += [f'- {key}: {record[key]["path"] or "미제공"}',
                   f'  SHA256: {record[key].get("sha256", "미확인") }']
        if all(image is not None for image in images):
            metrics, a, b, diff = compare(*images)
            record.update(status='measured', metrics=metrics)
            summary = f'픽셀 유사도 {metrics["pixelSimilarityPercent"]}% / 차이 픽셀 {metrics["changedPixelPercent"]}%'
            body += f'<p>{summary}</p><div class="pair">'
            for label, image in zip(('원본', '비교 대상'), images):
                body += f'<figure><figcaption>{label}</figcaption><img alt="{label}" src="{data_uri(image)}"></figure>'
            body += '</div><details><summary>겹쳐 보기 / 차이 이미지 (4배 강조)</summary>'
            body += f'<label>대상 불투명도 <input aria-label="대상 불투명도" type="range" min="0" max="1" step="0.01" value="0.5" oninput="this.closest(\'details\').querySelector(\'.over\').style.opacity=this.value"></label>'
            body += f'<div class="overlay"><img alt="정규화 원본" src="{data_uri(a)}"><img class="over" alt="정규화 대상" src="{data_uri(b)}"></div><img alt="차이 이미지" src="{data_uri(diff)}"></details>'
            md += ['', summary, f'- 원본 크기: {images[0].size}, 대상 크기: {images[1].size}']
        else:
            body += '<p>미비교: 원본 또는 대상 이미지가 없습니다. 유사도 점수를 생성하지 않았습니다.</p>'
            md += ['', '미비교: 원본 또는 대상 이미지가 없습니다.']
        md += ['', '- 데이터 정확성: 미검증 (원본 셀·실제 차트 값 별도 대조)',
               '- 오너 수락: 미확인', '- 검토 의견 / 수정 필요 사항: 미작성', '']
        cards.append('<section>' + body + '</section>')
        reviews.append('\n'.join(md))
        records.append(record)
    method = ('유사도 = 100 × (1 − RGB 평균 절대 오차 / 255). 흰 배경 합성 후 종횡비를 유지해 '
              '800×600에 중앙 배치합니다. 차이 픽셀은 RGB 중 한 채널이라도 오차가 16을 넘는 픽셀입니다. '
              '여백·글꼴·캡처 배율의 영향을 받으며 의미적 유사도, 데이터 정확성, 재사용 승인 점수가 아닙니다.')
    document = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>차트·이미지 비교 리뷰</title><style>body{font:16px/1.6 system-ui;margin:24px auto;padding:0 16px;max-width:1200px;background:#f6f7f9;color:#202632}section{background:white;padding:20px;margin:24px 0;border:1px solid #ccd2db;border-radius:8px}img{max-width:100%;height:auto}figure{margin:0;min-width:0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.overlay{position:relative;max-width:800px}.overlay img{display:block;width:100%}.over{position:absolute;inset:0;opacity:.5}p{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){.pair{grid-template-columns:1fr}}</style><h1>차트·이미지 비교 리뷰</h1><p>' + escape(method) + '</p>' + ''.join(cards) + '</html>'
    # An evidence run is immutable: use a new output folder for every revision.
    output.mkdir(parents=True, exist_ok=False)
    (output / 'comparison.html').write_text(document, encoding='utf-8')
    (output / 'review.md').write_text('# 차트별 비교 리뷰\n\n[이미지 비교 HTML](comparison.html)\n\n' + method + '\n\n' + '\n'.join(reviews), encoding='utf-8')
    (output / 'metrics.json').write_text(json.dumps({'method': method, 'items': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='JSON manifest; image paths relative to manifest')
    parser.add_argument('--out', required=True, help='New evidence directory (must not exist)')
    parser.add_argument('--targets', help='Owner docs/comparison-targets.json; required for existing-project comparison')
    args = parser.parse_args()
    generate(args.input, args.out, args.targets)
    print(Path(args.out).resolve())
