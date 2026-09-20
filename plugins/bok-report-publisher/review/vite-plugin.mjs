import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

export function bokReview({ repo, registry, enabled = false }) {
  const virtual = 'virtual:bok-review', resolved = '\0' + virtual;
  return {
    name: 'bok-report-review', enforce: 'pre',
    resolveId(id) { if (enabled && id === virtual) return resolved; },
    load(id) {
      if (enabled && id === resolved) return fs.readFileSync(fileURLToPath(new URL('./runtime.js', import.meta.url)), 'utf8');
    },
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return enabled ? [{ tag: 'script', attrs: { type: 'module' }, children: `import '${virtual}'`, injectTo: 'body' }] : [];
      },
    },
    transform(code, id) {
      if (!enabled || id.includes('?') || !id.endsWith('.vue')) return null;
      const file = path.relative(repo, id).replaceAll('\\', '/');
      const items = registry.items.filter(i => i.active && i.file === file);
      if (!items.length) return null;
      // No wrapper: Vue fragments and existing Highcharts container sizing stay intact.
      const buttons = items.map(item => `<button type="button" class="bok-review-id" data-bok-review="${item.id}" data-bok-hash="${item.sourceHash}">${item.kind === 'section' ? '목차' : '차트'} ${item.id}</button>`).join('');
      return { code: code.replace(/<template(?:\s[^>]*)?>/, match => match + '\n' + buttons + '\n'), map: null };
    },
  };
}
