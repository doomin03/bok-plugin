import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const hash = data => createHash('sha256').update(data).digest('hex');
export function verify(repo, contract) {
  const failures = [];
  let frozen = { ...(contract.frozen || {}) };
  if (contract.frozenFile) {
    const manifest = path.resolve(repo, contract.frozenFile);
    if (!manifest.startsWith(path.resolve(repo) + path.sep)) throw Error('Unsafe path');
    if (!contract.frozen?.[contract.frozenFile] || hash(fs.readFileSync(manifest)) !== contract.frozen[contract.frozenFile])
      throw Error('Frozen manifest changed');
    frozen = { ...JSON.parse(fs.readFileSync(manifest, 'utf8')), ...frozen };
  }
  for (const [file, expected] of Object.entries(frozen)) {
    const absolute = path.resolve(repo, file);
    if (!absolute.startsWith(path.resolve(repo) + path.sep)) throw Error('Unsafe path');
    if (!fs.existsSync(absolute) || hash(fs.readFileSync(absolute)) !== expected)
      failures.push('Frozen source changed: ' + file);
  }
  for (const item of contract.components || []) {
    const file = path.resolve(repo, item.target);
    if (!file.startsWith(path.resolve(repo) + path.sep)) throw Error('Unsafe path');
    if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== item.sha256)
      failures.push('Unreviewed inherited UI/content change: ' + item.target);
  }
  if (failures.length) throw Error(failures.join('\n'));
  return { result: 'PASS', frozenFiles: Object.keys(frozen).length, components: contract.components?.length || 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node verify-fidelity.mjs <repo> <contract.json>');
    console.log(JSON.stringify(verify(process.argv[2], JSON.parse(fs.readFileSync(process.argv[3], 'utf8')))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
