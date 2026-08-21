import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyStudioBrief } from './studio-brief.mjs';
import { scaffoldSampleProject } from './run-pipeline.mjs';
import { executeSampleRun } from './studio-server.mjs';

const baseBrief = {
  name: 'Target Truth',
  objective: 'Prove the local starter without overstating requested-device execution.',
  mechanic: 'collect'
};

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

for (const requestedTarget of ['web', 'desktop', 'mobile']) {
  test(`Studio preserves ${requestedTarget} as request metadata while the local execution claim stays web`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-target-truth-'));
    const project = join(root, 'starter');
    try {
      await scaffoldSampleProject(project);
      await applyStudioBrief(project, { ...baseBrief, targetPlatform: requestedTarget });
      const manifest = await json(join(project, 'project.manifest.json'));
      assert.deepEqual(manifest.targetPlatforms, ['web']);
      assert.equal(manifest.starter.requestedTargetPlatform, requestedTarget);
      assert.equal(manifest.starter.executedTargetPlatform, 'web');
      assert.equal(
        manifest.starter.targetExecutionStatus,
        requestedTarget === 'web' ? 'executed-local-web' : 'requested-not-executed'
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('real mobile-requested Studio sample builds and QA-passes without becoming a mobile execution claim', async () => {
  const result = await executeSampleRun({ brief: { ...baseBrief, targetPlatform: 'mobile' } });
  assert.equal(result.status, 'pass');
  assert.equal(result.brief.targetPlatform, 'mobile');
  assert.deepEqual(result.evidence.run.scope.targetPlatforms, ['web']);
  assert.equal(result.evidence.build.executed, true);
  assert.equal(result.evidence.build.status, 'pass');
  assert.equal(result.evidence.qa.executed, true);
  assert.equal(result.evidence.qa.status, 'pass');
  assert.equal(result.evidence.releaseCandidate.dryRunOnly, true);
  assert.equal(result.evidence.publishing.executed, false);
  assert.equal(result.evidence.publishing.secretsUsed, false);
  assert.equal(result.safety.destination.kind, 'local');
});
