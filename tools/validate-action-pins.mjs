import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const workflowDir = '.github/workflows';
const files = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name));
const failures = [];

for (const name of files) {
  const path = join(workflowDir, name);
  const source = await readFile(path, 'utf8');
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*-?\s*uses:\s*['"]?([^'"\s#]+)['"]?/);
    if (!match) continue;
    const target = match[1];
    if (target.startsWith('./') || target.startsWith('docker://')) continue;
    const at = target.lastIndexOf('@');
    const ref = at >= 0 ? target.slice(at + 1) : '';
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      failures.push(`${path}:${index + 1}: external action must use an immutable 40-character commit SHA: ${target}`);
    }
  }
}

if (failures.length) {
  console.error('GitHub Action pin validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`GitHub Action pin validation passed (${files.length} workflows).`);
