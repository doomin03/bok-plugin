"""Extract chart features from every vector figure (WMF/EMF) in a DOCX or a folder.

usage: python extract-figure-features.py --source <report.docx | folder> --out <features.json>
Output is evidence for chart specs (visualContract) and for verify-figure-features.mjs; it never
approves a chart. Raster images (png/jpg) are listed as needing manual feature entry.
"""
import argparse, json, zipfile
from pathlib import Path
from figure_records import read_wmf, read_emf
from figure_features import extract


def figures(source):
    src = Path(source)
    if src.suffix.lower() == '.docx':
        with zipfile.ZipFile(src) as z:
            for name in sorted(n for n in z.namelist() if n.startswith('word/media/')):
                yield name, z.read(name)
    else:
        for p in sorted(src.rglob('*')):
            if p.is_file():
                yield p.relative_to(src).as_posix(), p.read_bytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    result, summary = {}, {'vector': 0, 'raster': 0, 'failed': []}
    for name, data in figures(a.source):
        ext = name.rsplit('.', 1)[-1].lower()
        if ext not in ('wmf', 'emf'):
            result[name] = {'status': 'raster-manual'}; summary['raster'] += 1; continue
        try:
            records, window = (read_wmf if ext == 'wmf' else read_emf)(data)
            result[name] = {'status': 'extracted', 'window': window, **extract(records, window or (0, 0, 1, 1))}
            summary['vector'] += 1
        except Exception as exc:  # keep going; a failed figure is reported, not hidden
            result[name] = {'status': 'failed', 'error': str(exc)}; summary['failed'].append(name)
    Path(a.out).write_text(json.dumps({'summary': summary, 'figures': result}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
