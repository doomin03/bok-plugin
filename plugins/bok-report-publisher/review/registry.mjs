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
  const files = walk(path.join(repo, 'src/pages/report/components/toc')).filter(f => f.endsWith('.vue')).sort();
  const relative = f => path.relative(repo, f).replaceAll('\\', '/');
  const sources = new Map(files.map(f => [relative(f), fs.readFileSync(f, 'utf8')]));
  const sections = files.filter(f => /[/\\]sections[/\\]Section[^/\\]+\.vue$/.test(f));
  for (const file of sections) {
    const key = relative(file);
    let section = registry.items.find(i => i.kind === 'section' && i.file === key);
    if (!section) {
      section = { id: 'S' + String(registry.nextSection++).padStart(3, '0'), kind: 'section', file: key, nextChart: 1 };
      registry.items.push(section);
    }
    section.active = true;
    section.title = path.basename(file, '.vue');
    // Explicit import relationships, not visual order or economic figure-number guesses.
    const imports = [...sources.get(key).matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+\/graph\/[^"']+\.vue)["']/g)];
    for (const [, reference] of imports) {
      const target = reference.startsWith('@/') ? 'src/' + reference.slice(2) : relative(path.resolve(path.dirname(file), reference));
      if (!sources.has(target)) continue;
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
