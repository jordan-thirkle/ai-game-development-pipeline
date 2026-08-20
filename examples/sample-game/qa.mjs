import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const artifact = resolve(process.argv[2] || '');
const game = await readFile(resolve(artifact, 'game.txt'), 'utf8');
const metadata = JSON.parse(await readFile(resolve(artifact, 'build.json'), 'utf8'));
const playable = await readFile(resolve(artifact, 'index.html'), 'utf8');
if (basename(artifact) !== 'dist' || game !== 'sample-game build artifact\n' || metadata.format !== 'local-demo' || !playable.includes('<canvas id="game">') || !playable.includes('requestAnimationFrame(frame)')) {
  console.error('sample artifact contract failed');
  process.exitCode = 1;
  process.exit();
}
console.log(`QA passed for ${artifact}`);
