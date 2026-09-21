import importlib.util
import json
import csv
from pathlib import Path
import tempfile
import unittest
import sys
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('compare_images', Path(__file__).resolve().parents[1] / 'scripts/compare-images.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ComparisonTests(unittest.TestCase):
    def test_owner_targets_and_scope(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'docs').mkdir()
            (root / 'existing' / 'charts').mkdir(parents=True)
            (root / 'existing' / 'charts' / 'Chart.vue').write_text('<template/>', encoding='utf-8')
            (root / 'existing' / 'Outside.vue').write_text('<template/>', encoding='utf-8')
            targets = root / 'docs' / 'comparison-targets.json'
            targets.write_text(json.dumps({'targets': [{'id': 'old', 'projectPath': '../existing', 'description': '기존 차트', 'sourcePaths': ['charts']}]}), encoding='utf-8')
            manifest = root / 'input.json'
            entry = {'id': 'chart', 'targetId': 'old', 'targetSource': 'charts/Chart.vue'}
            manifest.write_text(json.dumps({'items': [entry]}), encoding='utf-8')
            result = module.generate(manifest, root / 'result', targets)
            self.assertEqual(result[0]['comparisonTarget']['description'], '기존 차트')
            self.assertEqual(result[0]['status'], 'pending')
            self.assertIn('Chart.vue', (root / 'result' / 'review.md').read_text(encoding='utf-8'))
            for changes in ({'targetId': 'unknown'}, {'targetSource': 'Outside.vue'}, {'targetSource': '../input.json'}):
                manifest.write_text(json.dumps({'items': [{**entry, **changes}]}), encoding='utf-8')
                with self.assertRaises(ValueError):
                    module.generate(manifest, root / 'invalid', targets)

    def test_metrics(self):
        white = Image.new('RGB', (800, 600), 'white')
        black = Image.new('RGB', (800, 600), 'black')
        self.assertEqual(module.compare(white, white)[0]['pixelSimilarityPercent'], 100)
        metrics = module.compare(white, black)[0]
        self.assertEqual(metrics['pixelSimilarityPercent'], 0)
        self.assertEqual(metrics['changedPixelPercent'], 100)

    def test_artifacts_missing_escape_and_preservation(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            Image.new('RGBA', (40, 20), (0, 0, 0, 0)).save(root / '원본.png')
            manifest = root / 'input.json'
            manifest.write_text(json.dumps({'items': [
                {'id': 'one', 'title': '<script>alert(1)</script>', 'reference': '원본.png', 'candidate': '원본.png', 'analysis': '축 차이 확인'},
                {'id': 'two', 'reference': '원본.png', 'candidate': 'missing.png'}
            ]}), encoding='utf-8')
            output = root / 'comparison-001'
            result = module.generate(manifest, output)
            self.assertEqual(result[0]['metrics']['pixelSimilarityPercent'], 100)
            self.assertEqual(result[1]['status'], 'pending')
            self.assertIsNone(result[1]['metrics'])
            document = (output / 'comparison.html').read_text(encoding='utf-8')
            self.assertNotIn('<script>alert(1)</script>', document)
            self.assertIn('id="apply-review-0"', document)
            self.assertIn('CSV 불러오기', document)
            self.assertIn('data:image/png;base64,', document)
            self.assertIn('type="range"', document)
            self.assertIn('축 차이 확인', (output / 'review.md').read_text(encoding='utf-8'))
            self.assertEqual(len(json.loads((output / 'metrics.json').read_text(encoding='utf-8'))['items']), 2)
            with (output / 'comparison-review.csv').open(encoding='utf-8-sig', newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(rows[0]['similarity_percent'], '100')
            self.assertEqual(rows[1]['similarity_percent'], '')
            self.assertEqual(rows[1]['status'], 'pending')
            self.assertEqual(rows[0]['evidence_id'], result[0]['evidenceId'])
            with self.assertRaises(FileExistsError):
                module.generate(manifest, output)


if __name__ == '__main__':
    unittest.main()
