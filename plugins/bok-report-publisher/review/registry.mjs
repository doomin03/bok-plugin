import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const hash = text => createHash('sha256').update(text).digest('hex');
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
export function within(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw Error('Path outside project: ' + relative);
  return file;
}
function walk(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(e =>
    e.isSymbolicLink() ? [] : e.isDirectory() ? walk(path.join(root, e.name)) : [path.join(root, e.name)]);
}

// Persist IDs independently of display order. Deleted entries are retired, never recycled.
export function scan(repo) {
  repo = path.resolve(repo);
  const location = path.join(repo, '.bok-review/registry.json');
  const registry = fs.existsSync(location) ? readJSON(location) : { version: 1, nextSection: 1, items: [] };
  registry.items.forEach(item => { item.active = false; });
  const files = [
    ...walk(path.join(repo, 'src/pages/report/components/toc')),
    // 회차 전용 이관 트리(src/pages/reportYYYYMM)를 모두 스캔한다
    ...fs.readdirSync(path.join(repo, 'src/pages'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^report\d{6}$/.test(d.name)).flatMap((d) => walk(path.join(repo, 'src/pages', d.name))),
  ].filter(f => f.endsWith('.vue')).sort();
  const relative = f => path.relative(repo, f).replaceAll('\\', '/');
  const sources = new Map(files.map(f => [relative(f), fs.readFileSync(f, 'utf8')]));
  const importedVueTargets = sourceFile => {
    const code = sources.get(sourceFile) || '';
    return [...code.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+\.vue)["']/g)]
      .map(([, reference]) => reference.startsWith('@/')
        ? 'src/' + reference.slice(2)
        : relative(path.resolve(path.dirname(path.join(repo, sourceFile)), reference)))
      .filter(target => sources.has(target));
  };
  const sections = files.filter(f =>
    /[/\\]sections[/\\]Section[^/\\]+\.vue$/.test(f) ||
    /[/\\]toc[/\\]report\d{6}[/\\](Overview|PolicyConditions|PolicyDirection|IssueAnalysis|Appendix)\.vue$/.test(f) ||
    /[/\\]report\d{6}[/\\]main[/\\](Overview|PolicyConditions|PolicyDirection|IssueAnalysis|Appendix)\.vue$/.test(f)
  );
  for (const file of sections) {
    const key = relative(file);
    let section = registry.items.find(i => i.kind === 'section' && i.file === key);
    if (!section) {
      section = { id: 'S' + String(registry.nextSection++).padStart(3, '0'), kind: 'section', file: key, nextChart: 1 };
      registry.items.push(section);
    }
    section.active = true;
    section.title = path.basename(file, '.vue');
    // Follow explicit Vue imports recursively so composite report sections remain reviewable.
    const queue = [key];
    const visited = new Set();
    const chartTargets = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      for (const target of importedVueTargets(current)) {
        if (target.includes('/graph/')) chartTargets.add(target);
        else if (!visited.has(target)) queue.push(target);
      }
    }
    for (const target of [...chartTargets].sort()) {
      let chart = registry.items.find(i => i.kind === 'chart' && i.file === target && i.sectionId === section.id);
      if (!chart) {
        chart = { id: section.id + '-C' + String(section.nextChart++).padStart(3, '0'), kind: 'chart', sectionId: section.id, file: target };
        registry.items.push(chart);
      }
      chart.active = true;
      chart.title = path.basename(target, '.vue');
      chart.sourceHash = hash(sources.get(target));
    }
    section.sourceHash = hash(sources.get(key));
  }
  registry.unmapped = [...sources.keys()].filter(f => f.includes('/graph/') && !registry.items.some(i => i.active && i.file === f));
  writeJSON(location, registry);
  return registry;
}
