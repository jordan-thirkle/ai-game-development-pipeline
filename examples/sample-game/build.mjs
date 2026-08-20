import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve(dirname(new URL(import.meta.url).pathname), 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'game.txt'), 'sample-game build artifact\n', 'utf8');
await writeFile(resolve(output, 'build.json'), JSON.stringify({ name: 'Pipeline Sample Game', format: 'local-demo', version: 1 }, null, 2) + '\n', 'utf8');
console.log(`built ${output}`);
