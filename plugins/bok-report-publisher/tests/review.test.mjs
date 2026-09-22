import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scan, hash, readJSON } from '../review/registry.mjs';
import { bokReview } from '../review/vite-plugin.mjs';
import { feedback } from '../scripts/review.mjs';

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-review-test-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const base = 'src/pages/report/components/toc/conditions/';
  const write = (name, value) => { const f = path.join(repo, base, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, value); return f; };
  const component = '<template><div id="chart1"></div></template><script>export default {}</script>';
  const chart = write('graph/Chart.vue', component);
  const section = write('sections/Section1_01.vue', '<template><p>Test</p></template><script>import Chart from "@/pages/report/components/toc/conditions/graph/Chart.vue";</script>');
  return { repo, write, chart, section, component };
}
test('persistent IDs survive insertion and retirement; no recycled numbers', t => {
  const f = fixture(t), first = scan(f.repo);
  assert.equal(first.items.find(i => i.kind === 'chart').id, 'S001-C001');
  f.write('sections/Section0_01.vue', '<template><p>Before</p></template>');
  assert.equal(scan(f.repo).items.find(i => i.file.endsWith('Section1_01.vue')).id, 'S001');
  fs.unlinkSync(f.section);
  assert.equal(scan(f.repo).items.find(i => i.id === 'S001-C001').active, false);
});
test('report-period sections discover charts through nested Vue imports', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bok-review-period-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const write = (relative, value) => {
    const file = path.join(repo, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
    return file;
  };
  write('src/pages/report/components/toc/report202609/Overview.vue', '<template><Composite /></template><script>import Composite from "./parts/Composite.vue";</script>');
  write('src/pages/report/components/toc/report202609/parts/Composite.vue', '<template><Chart /></template><script>import Chart from "@/pages/report/components/toc/overview/graph/report202609/SHEET002Component.vue";</script>');
  write('src/pages/report/components/toc/overview/graph/report202609/SHEET002Component.vue', '<template><div id="chart"></div></template>');
  const registry = scan(repo);
  const section = registry.items.find(item => item.active && item.file.endsWith('/report202609/Overview.vue'));
  const chart = registry.items.find(item => item.active && item.sectionId === section.id && item.file.endsWith('/SHEET002Component.vue'));
  assert.ok(section);
  assert.ok(chart);
  assert.deepEqual(registry.unmapped, []);
});
test('review transforms a Vue fragment and production plugin is entirely inactive', t => {
  const f = fixture(t), registry = scan(f.repo);
  const plugin = bokReview({ repo: f.repo, registry, enabled: true });
  const result = plugin.transform(f.component, f.chart);
  assert.match(result.code, /data-bok-review="S001-C001"/);
  assert.match(result.code, /id="chart1"/);
  assert.equal(plugin.transform(f.component, f.chart + '?vue&type=template'), null);
  const production = bokReview({ repo: f.repo, registry });
  assert.equal(production.transform(f.component, f.chart), null);
  assert.deepEqual(production.transformIndexHtml.handler(), []);
  assert.equal(production.resolveId('virtual:bok-review'), undefined);
});
test('review HTML excludes production-only BOK bootstrap scripts', t => {
  const f = fixture(t), registry = scan(f.repo);
  const plugin = bokReview({ repo: f.repo, registry, enabled: true });
  const html = '<script src="https://static-cdn.bok.or.kr/static/portal/js/mcp-report.js"></script><script type="module" src="https://static-cdn.bok.or.kr/static/portal/js/mcp-report-charts.js"></script><script src="/keep.js"></script>';
  const result = plugin.transformIndexHtml.handler(html);
  assert.doesNotMatch(result.html, /mcp-report(?:-charts)?\.js/);
  assert.match(result.html, /keep\.js/);
  assert.equal(result.tags.length, 1);
});
test('feedback preserves test conditions and creates independent OpenSpec changes', t => {
  const f = fixture(t); scan(f.repo);
  const input = { id: 'S001-C001', sourceHash: hash(f.component), feedback: '모바일 축 라벨 잘림', tests: ['375px에서 라벨 전체 표시', '원본 데이터 값 유지'] };
  const a = feedback(f.repo, input), b = feedback(f.repo, input);
  assert.notEqual(a.changeId, b.changeId);
  const dir = path.join(f.repo, 'openspec/changes', a.changeId);
  assert.deepEqual(readJSON(path.join(dir, 'review.json')).tests.map(t => t.text), input.tests);
  for (const file of ['proposal.md', 'design.md', 'tasks.md', 'specs/report-review/spec.md']) assert.ok(fs.existsSync(path.join(dir, file)));
  assert.ok(a.tests.every(t => t.status === 'pending'));
});
test('unknown IDs, absent tests and stale build feedback are rejected', t => {
  const f = fixture(t); scan(f.repo);
  const input = { id: 'S001-C001', sourceHash: hash(f.component), feedback: 'Fix', tests: ['Expected'] };
  assert.throws(() => feedback(f.repo, { ...input, id: '../../other' }), /Unknown/);
  assert.throws(() => feedback(f.repo, { ...input, tests: [] }), /test condition/);
  fs.appendFileSync(f.chart, '\n<!-- changed -->');
  assert.throws(() => feedback(f.repo, input), /Stale/);
});
