import { spawn } from 'node:child_process';
import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioServer } from './studio-server.mjs';

const MIN_NODE_MAJOR = 26;
const READINESS_TIMEOUT_MS = 10_000;

export function assertSupportedNode(version = process.versions.node) {
  const major = Number.parseInt(String(version).split('.')[0], 10);
  if (!Number.isInteger(major) || major < MIN_NODE_MAJOR) {
    throw new Error(`Studio requires Node ${MIN_NODE_MAJOR} or newer. Found ${version || 'unknown'}.`);
  }
}

export function browserCommand(platform = process.platform, url) {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') return { command: 'cmd', args: ['/d', '/s', '/c', 'start', '', url] };
  return { command: 'xdg-open', args: [url] };
}

export function openBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const { command, args } = browserCommand(platform, url);
  const child = spawnImpl(command, args, { detached: true, stdio: 'ignore' });
  child.unref?.();
  return child;
}

export async function verifyStudioReady(url, fetchImpl = globalThis.fetch, timeoutMs = READINESS_TIMEOUT_MS) {
  const signal = AbortSignal.timeout(timeoutMs);
  const [page, capabilities] = await Promise.all([
    fetchImpl(url, { redirect: 'error', signal }),
    fetchImpl(new URL('/api/pipeline/capabilities', url), { redirect: 'error', signal })
  ]);
  if (!page.ok) throw new Error(`Studio page readiness failed with HTTP ${page.status}.`);
  if (!capabilities.ok) throw new Error(`Studio capability readiness failed with HTTP ${capabilities.status}.`);
  const capabilityJson = await capabilities.json();
  if (capabilityJson.dryRunOnly !== true || capabilityJson.secretsRequired !== false || capabilityJson.publicationSupported !== false) {
    throw new Error('Studio readiness refused: local safety capabilities are not fail-closed.');
  }
  return capabilityJson;
}

export async function launchStudio({
  startServer = startStudioServer,
  open = openBrowser,
  fetchImpl = globalThis.fetch,
  shouldOpen = true,
  keepAlive = true,
  log = console.log
} = {}) {
  assertSupportedNode();
  const server = await startServer({ port: 0 });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((done) => server.close(done));
    throw new Error('Studio launcher could not resolve the loopback port.');
  }
  const url = `http://127.0.0.1:${address.port}/apps/studio/`;

  try {
    await verifyStudioReady(url, fetchImpl);
    log(`Studio ready at ${url}`);
    if (shouldOpen) {
      try {
        const opener = open(url);
        opener?.once?.('error', (error) => log(`Could not open the browser automatically: ${error?.message || error}`));
      } catch (error) {
        log(`Could not open the browser automatically: ${error?.message || error}`);
      }
    }
    if (!keepAlive) {
      await new Promise((done) => server.close(done));
      return { url, server: null };
    }
    return { url, server };
  } catch (error) {
    await new Promise((done) => server.close(done));
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkOnly = process.argv.includes('--check');
  const noOpen = process.argv.includes('--no-open') || checkOnly;
  const { server } = await launchStudio({ shouldOpen: !noOpen, keepAlive: !checkOnly });
  if (checkOnly) process.exit(0);

  const stop = () => server?.close(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
