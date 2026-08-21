import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function terminateProcessTree(child) {
  if (!child.pid) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      killer.once('error', () => resolve());
      killer.once('close', () => resolve());
    });
  }
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch { child.kill('SIGKILL'); }
  return Promise.resolve();
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      await terminateProcessTree(child);
      reject(new Error(`Timed out: ${command} ${args.join(' ')}`));
    }, 20_000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

test('root macOS/shell entry delegates to the reviewed Studio launcher', async () => {
  const source = await read('START_STUDIO.command');
  assert.match(source, /apps\/studio\/launch-studio\.command/);
  assert.doesNotMatch(source, /studio-server\.mjs|npm install|curl |wget /);
});

test('root Windows entry delegates to the reviewed Studio launcher', async () => {
  const source = await read('START_STUDIO.cmd');
  assert.match(source, /apps\\studio\\launch-studio\.cmd/i);
  assert.doesNotMatch(source, /studio-server\.mjs|npm install|curl |powershell/i);
});

test('nested shell launcher forwards diagnostic arguments without bypassing Node gate', async () => {
  const source = await read('apps/studio/launch-studio.command');
  assert.match(source, /command -v node/);
  assert.match(source, /node tools\/studio-launcher\.mjs "\$@"/);
});

test('nested Windows launcher forwards diagnostic arguments after Node gate', async () => {
  const source = await read('apps/studio/launch-studio.cmd');
  assert.match(source, /where node/i);
  assert.match(source, /node tools\\studio-launcher\.mjs %\*/i);
});

test('root shell entry performs a real fail-closed Studio readiness check', async () => {
  const result = await run('sh', ['START_STUDIO.command', '--check'], { cwd: new URL('..', import.meta.url) });
  assert.equal(result.signal, null);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Studio ready at http:\/\/127\.0\.0\.1:\d+\/apps\/studio\//);
});
