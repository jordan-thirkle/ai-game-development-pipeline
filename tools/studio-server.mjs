import { createServer } from 'node:http';
import { readFile, realpath, rm } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runPipeline, scaffoldSampleProject } from './run-pipeline.mjs';
import { applyStudioBrief, BriefError, normalizeStudioBrief } from './studio-brief.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LOOPBACK_HOST = '127.0.0.1';
const MAX_BRIEF_BYTES = 4096;
const JSON_FILES = [
  ['intake', 'intake.json'],
  ['registry', 'registry-selection.json'],
  ['build', 'build-result.json'],
  ['qa', 'qa-result.json'],
  ['releaseCandidate', 'release-candidate.json'],
  ['publishing', 'publishing-receipt.json'],
  ['run', 'pipeline-run.json']
];
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readEvidence(outputDir) {
  const entries = await Promise.all(JSON_FILES.map(async ([key, name]) => {
    try { return [key, JSON.parse(await readFile(resolve(outputDir, name), 'utf8'))]; }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  }));
  return Object.fromEntries(entries.filter(Boolean));
}

async function readBriefBody(request) {
  if (request.headers['transfer-encoding']) throw new BriefError('Chunked brief requests are not accepted');
  const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new BriefError('Brief requests must use application/json');
  const contentLength = Number(request.headers['content-length']);
  if (!Number.isInteger(contentLength) || contentLength < 2 || contentLength > MAX_BRIEF_BYTES) throw new BriefError(`Brief body must be between 2 and ${MAX_BRIEF_BYTES} bytes`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BRIEF_BYTES) throw new BriefError(`Brief body must be ${MAX_BRIEF_BYTES} bytes or fewer`);
    chunks.push(chunk);
  }
  if (bytes !== contentLength) throw new BriefError('Brief body length did not match Content-Length');
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new BriefError('Brief body must contain valid JSON'); }
  return normalizeStudioBrief(parsed);
}

export async function executeSampleRun({ brief, run = runPipeline, scaffold = scaffoldSampleProject, applyBrief = applyStudioBrief } = {}) {
  const workspace = await mkdtemp(resolve(tmpdir(), 'byjtt-studio-'));
  try {
    const projectDir = resolve(workspace, 'sample-game');
    const outputDir = resolve(workspace, 'evidence');
    await scaffold(projectDir);
    const normalizedBrief = brief ? await applyBrief(projectDir, brief) : null;
    const result = await run({ projectDir, outputDir, dryRun: true });
    const evidence = await readEvidence(outputDir);
    return {
      status: result.status,
      error: result.status === 'pass' ? null : result.record?.summary || 'Pipeline evidence did not pass.',
      brief: normalizedBrief,
      safety: evidence.publishing ? {
        dryRun: evidence.publishing.dryRun,
        publicationExecuted: evidence.publishing.executed,
        secretsUsed: evidence.publishing.secretsUsed,
        destination: evidence.publishing.destination
      } : null,
      evidence
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function staticFileFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/apps/studio/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const publicPaths = new Set([
    '/apps/studio/index.html',
    '/fixtures/control-plane/BYJTT-LAB-001.json',
    '/tools/control-plane-freshness.mjs'
  ]);
  if (!publicPaths.has(requested)) return null;
  const candidate = resolve(REPOSITORY_ROOT, `.${requested}`);
  const root = await realpath(REPOSITORY_ROOT);
  let file;
  try { file = await realpath(candidate); } catch { return null; }
  if (file !== root && !file.startsWith(`${root}${sep}`)) return null;
  return file;
}

function validLocalRequest(request) {
  const origin = request.headers.origin;
  const expectedHost = `${LOOPBACK_HOST}:${request.socket.localPort}`;
  const expectedOrigin = `http://${expectedHost}`;
  return request.headers.host === expectedHost && (!origin || origin === expectedOrigin);
}

export function createStudioServer({ execute = executeSampleRun } = {}) {
  let running = false;
  return createServer(async (request, response) => {
    try {
      if (request.url === '/api/pipeline/capabilities') {
        if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' });
        return sendJson(response, 200, { mode: 'local-briefed-sample', dryRunOnly: true, secretsRequired: false, publicationSupported: false, briefInputSupported: true, allowedTargets: ['web', 'desktop', 'mobile'] });
      }
      if (request.url === '/api/pipeline/runs') {
        if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
        if (!validLocalRequest(request)) return sendJson(response, 403, { error: 'Cross-origin pipeline runs are not allowed.' });
        const contentLength = request.headers['content-length'];
        if (request.headers['transfer-encoding'] || (contentLength !== undefined && contentLength !== '0')) return sendJson(response, 400, { error: 'The sample run accepts no request body.' });
        if (running) return sendJson(response, 409, { error: 'A local sample run is already in progress.' });
        running = true;
        try {
          const result = await execute();
          return sendJson(response, result.status === 'pass' ? 201 : 422, result);
        }
        catch (error) { return sendJson(response, 500, { error: error?.message || 'Pipeline run failed.' }); }
        finally { running = false; }
      }
      if (request.url === '/api/pipeline/brief-runs') {
        if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
        if (!validLocalRequest(request)) return sendJson(response, 403, { error: 'Cross-origin pipeline runs are not allowed.' });
        if (running) return sendJson(response, 409, { error: 'A local sample run is already in progress.' });
        let brief;
        try { brief = await readBriefBody(request); }
        catch (error) { if (error instanceof BriefError) return sendJson(response, 400, { error: error.message }); throw error; }
        running = true;
        try {
          const result = await execute({ brief });
          return sendJson(response, result.status === 'pass' ? 201 : 422, result);
        }
        catch (error) { return sendJson(response, 500, { error: error?.message || 'Pipeline run failed.' }); }
        finally { running = false; }
      }
      if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: 'Method not allowed' });
      const file = await staticFileFor(request.url);
      if (!file) return sendJson(response, 404, { error: 'Not found' });
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': MIME.get(extname(file)) || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      sendJson(response, 500, { error: error?.message || 'Studio service failed.' });
    }
  });
}

export async function startStudioServer({ port = 4173 } = {}) {
  const server = createStudioServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK_HOST, resolvePromise);
  });
  return server;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const portArg = process.argv.find((value) => value.startsWith('--port='));
  const port = portArg ? Number(portArg.slice('--port='.length)) : 4173;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid --port value');
  const server = await startStudioServer({ port });
  const address = server.address();
  console.log(`Studio ready at http://${LOOPBACK_HOST}:${address.port}/apps/studio/`);
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
