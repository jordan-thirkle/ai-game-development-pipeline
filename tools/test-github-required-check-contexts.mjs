import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const validator = resolve('tools/validate-github-config.mjs');

function runValidator(cwd) {
  return spawnSync(process.execPath, [validator], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
}

test('current governance uses GitHub Actions job names as required check contexts', () => {
  const result = runValidator(process.cwd());
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy workflow-slash-job required contexts fail closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'byjtt-required-checks-'));
  try {
    await cp('.github', join(root, '.github'), { recursive: true });
    await cp('config', join(root, 'config'), { recursive: true });

    const governancePath = join(root, 'config/github-governance.json');
    const governance = JSON.parse(await readFile(governancePath, 'utf8'));
    governance.requiredChecks[0].context = 'Validate lab structure / validate';
    governance.requiredChecks[1].context = 'Control plane browser QA / browser-qa';
    await writeFile(governancePath, `${JSON.stringify(governance, null, 2)}\n`, 'utf8');

    const result = runValidator(root);
    assert.equal(result.status, 1, 'legacy impossible contexts must be rejected');
    assert.match(result.stderr, /context must be validate/);
    assert.match(result.stderr, /context must be browser-qa/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
