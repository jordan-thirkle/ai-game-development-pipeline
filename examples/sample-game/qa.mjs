import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const artifact = resolve(process.argv[2] || '');
const manifest = JSON.parse(await readFile(resolve(artifact, '..', 'project.manifest.json'), 'utf8'));
const game = await readFile(resolve(artifact, 'game.txt'), 'utf8');
const metadata = JSON.parse(await readFile(resolve(artifact, 'build.json'), 'utf8'));
const playable = await readFile(resolve(artifact, 'index.html'), 'utf8');
const executedTargets = manifest.targetPlatforms;
const executionIsLocalWeb = Array.isArray(executedTargets) && executedTargets.length === 1 && executedTargets[0] === 'web';
const executedTarget = 'web';
const requestedTarget = manifest.starter?.requestedTargetPlatform || executedTarget;
if (
  !executionIsLocalWeb ||
  basename(artifact) !== 'dist' ||
  game !== 'sample-game build artifact\n' ||
  metadata.format !== 'local-demo' ||
  metadata.version !== 3 ||
  metadata.name !== manifest.name ||
  metadata.objective !== manifest.objective ||
  metadata.target !== requestedTarget ||
  metadata.executedTarget !== executedTarget ||
  metadata.mechanic !== manifest.starter.mechanic ||
  !playable.includes('<canvas id="game">') ||
  !playable.includes('requestAnimationFrame(frame)') ||
  !playable.includes('<div class="objective">') ||
  !playable.includes(`Target: ${requestedTarget} (requested) · Local execution: ${executedTarget}`)
) {
  console.error('sample artifact contract failed');
  process.exitCode = 1;
  process.exit();
}
console.log(`QA passed for ${artifact}; requested target=${requestedTarget}; executed target=${executedTarget}`);
