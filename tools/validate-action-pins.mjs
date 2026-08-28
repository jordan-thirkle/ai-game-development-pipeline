import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const workflowDir = '.github/workflows';
const files = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name));
const failures = [];

// Temporary, exact exception only for the workflow currently owned by draft PR #99.
// PR #99 already replaces these three refs with immutable SHAs. Remove this exception
// immediately when #99 lands or is superseded; no other mutable external action is allowed.
const temporaryPr99Exception = new Set([
  'actions/checkout@v7.0.1',
  'actions/setup-node@v7.0.0',
  'actions/upload-artifact@v4'
]);
const temporaryPr99Path = '.github/workflows/benchmark-001-three-webgpu.yml';
let temporaryExceptionCount = 0;

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
    if (/^[0-9a-f]{40}$/i.test(ref)) continue;
    if (path === temporaryPr99Path && temporaryPr99Exception.has(target)) {
      temporaryExceptionCount += 1;
      continue;
    }
    failures.push(`${path}:${index + 1}: external action must use an immutable 40-character commit SHA: ${target}`);
  }
}

if (temporaryExceptionCount !== 3) {
  failures.push(`${temporaryPr99Path}: expected exactly 3 temporary mutable refs owned by PR #99, found ${temporaryExceptionCount}; remove or repair the exception instead of broadening it`);
}

if (failures.length) {
  console.error('GitHub Action pin validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`GitHub Action pin validation passed (${files.length} workflows; 3 exact temporary refs remain isolated to PR #99).`);
