import { createHash } from 'node:crypto';
import { chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const candidateRoot = path.resolve('.');
const distDir = path.join(candidateRoot, 'dist');
const artifactsDir = path.join(candidateRoot, 'artifacts', 'human-alpha');
const packageDir = path.join(artifactsDir, 'package');
const siteDir = path.join(packageDir, 'site');
const sourceRevision = process.env.CANDIDATE_HEAD_SHA || process.env.GITHUB_SHA || 'local-unrecorded';

async function requireDirectory(directory, label) {
  const info = await stat(directory).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`${label} is missing: ${directory}`);
}

async function walkFiles(root, relative = '') {
  const current = path.join(root, relative);
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files.sort();
}

async function sha256(file) {
  const bytes = await readFile(file);
  return createHash('sha256').update(bytes).digest('hex');
}

await requireDirectory(distDir, 'Vite production output');
await rm(packageDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(distDir, siteDir, { recursive: true });

const serverSource = `import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const host = valueAfter('--host', '127.0.0.1');
const port = Number(valueAfter('--port', '4175'));
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon']
]);

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', \\`http://\\${host}:\\${port}\\`);
    const decoded = decodeURIComponent(requestUrl.pathname);
    const normalized = path.posix.normalize(decoded).replace(/^\\/+(\\.\\.\\/)+/, '/');
    let target = path.resolve(root, '.' + normalized);
    if (!target.startsWith(path.resolve(root) + path.sep) && target !== path.resolve(root)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = path.join(target, 'index.html');
    info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      target = path.join(root, 'index.html');
      info = await stat(target).catch(() => null);
    }
    if (!info?.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': types.get(path.extname(target).toLowerCase()) || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => console.log(\\`BYJTT Three.js human alpha: http://\\${host}:\\${port}\\`));
`;

const playtest = `# BYJTT-LAB-001 Three.js/WebGPU local alpha\n\nThis package is the exact production build tested by the human-alpha gate. It has **not** been publicly published and a green automation result is **not** a human playability verdict.\n\n## Start\n\n- macOS/Linux: double-click or run \`./START.command\`\n- Windows: double-click \`START.cmd\`\n- manual: \`node serve.mjs\` then open http://127.0.0.1:4175\n\nNode is only used as a local static-file server; gameplay runs in the browser.\n\n## Controls\n\n- WASD: move\n- Shift: sprint\n- Space: attack\n- E: interact/select upgrade\n- P: save when the game exposes the normal save action\n\n## Human test focus\n\nComplete the visible loop normally and record anything confusing, broken, unfair, visually poor, or unpleasant. Do not use developer tools to manufacture gameplay state.\n`;

const startCommand = `#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nnode serve.mjs\n`;
const startCmd = `@echo off\r\ncd /d "%~dp0"\r\nnode serve.mjs\r\n`;
const manifest = {
  schema_version: 1,
  benchmark_id: 'BYJTT-LAB-001',
  candidate_id: 'three-webgpu',
  artifact_kind: 'human-testable-local-alpha',
  source_revision: sourceRevision,
  publication_state: 'not-published',
  human_tested: false,
  production_assets_proven: false,
  generated_at: new Date().toISOString()
};

await writeFile(path.join(packageDir, 'serve.mjs'), serverSource, 'utf8');
await writeFile(path.join(packageDir, 'PLAYTEST.md'), playtest, 'utf8');
await writeFile(path.join(packageDir, 'START.command'), startCommand, 'utf8');
await chmod(path.join(packageDir, 'START.command'), 0o755);
await writeFile(path.join(packageDir, 'START.cmd'), startCmd, 'utf8');
await writeFile(path.join(packageDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const filesBeforeManifest = (await walkFiles(packageDir)).filter((file) => file !== 'SHA256SUMS.txt');
const sums = [];
for (const relative of filesBeforeManifest) {
  sums.push(`${await sha256(path.join(packageDir, relative))}  ${relative.replaceAll(path.sep, '/')}`);
}
await writeFile(path.join(packageDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');

const result = {
  ...manifest,
  package_files: (await walkFiles(packageDir)).length,
  site_files: (await walkFiles(siteDir)).length,
  package_ready: true
};
await writeFile(path.join(artifactsDir, 'package-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result));
