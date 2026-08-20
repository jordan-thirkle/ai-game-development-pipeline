import assert from 'node:assert/strict';
import test from 'node:test';
import { browserCommand, assertSupportedNode, launchStudio, verifyStudioReady } from './studio-launcher.mjs';
import { startStudioServer } from './studio-server.mjs';

function response({ ok = true, status = 200, json = {} } = {}) {
  return { ok, status, async json() { return json; } };
}

test('browser commands are argument-safe on supported desktop platforms', () => {
  const url = 'http://127.0.0.1:4173/apps/studio/';
  assert.deepEqual(browserCommand('darwin', url), { command: 'open', args: [url] });
  assert.deepEqual(browserCommand('linux', url), { command: 'xdg-open', args: [url] });
  assert.deepEqual(browserCommand('win32', url), { command: 'cmd', args: ['/d', '/s', '/c', 'start', '', url] });
});

test('Node version gate rejects unsupported and malformed runtimes', () => {
  assert.doesNotThrow(() => assertSupportedNode('26.0.0'));
  assert.doesNotThrow(() => assertSupportedNode('27.1.2'));
  assert.throws(() => assertSupportedNode('25.9.0'), /Node 26 or newer/);
  assert.throws(() => assertSupportedNode('unknown'), /Node 26 or newer/);
});

test('readiness rejects a page failure', async () => {
  let call = 0;
  await assert.rejects(
    () => verifyStudioReady('http://127.0.0.1:1/apps/studio/', async () => ++call === 1 ? response({ ok: false, status: 500 }) : response()),
    /page readiness failed/
  );
});

test('readiness rejects unsafe capability projection', async () => {
  await assert.rejects(
    () => verifyStudioReady('http://127.0.0.1:1/apps/studio/', async (url) => String(url).includes('capabilities')
      ? response({ json: { dryRunOnly: false, secretsRequired: false, publicationSupported: false } })
      : response()),
    /safety capabilities are not fail-closed/
  );
});

test('launcher dogfoods the real Studio server on an ephemeral loopback port without opening a browser', async () => {
  const logs = [];
  const result = await launchStudio({
    startServer: startStudioServer,
    shouldOpen: false,
    keepAlive: false,
    log: (line) => logs.push(line)
  });
  assert.equal(result.server, null);
  assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+\/apps\/studio\/$/);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^Studio ready at http:\/\/127\.0\.0\.1:/);
});

test('launcher refuses readiness and closes the server when capability verification fails', async () => {
  let closed = false;
  const fakeServer = {
    address() { return { port: 45678 }; },
    close(done) { closed = true; done(); }
  };
  await assert.rejects(
    () => launchStudio({
      startServer: async () => fakeServer,
      shouldOpen: false,
      keepAlive: false,
      fetchImpl: async (url) => String(url).includes('capabilities')
        ? response({ json: { dryRunOnly: true, secretsRequired: true, publicationSupported: false } })
        : response(),
      log() {}
    }),
    /safety capabilities are not fail-closed/
  );
  assert.equal(closed, true);
});

test('browser-open failure does not turn a verified local server into a false failure', async () => {
  const fakeServer = {
    address() { return { port: 45679 }; },
    close(done) { done(); }
  };
  const logs = [];
  const { server } = await launchStudio({
    startServer: async () => fakeServer,
    open() { throw new Error('no desktop opener'); },
    fetchImpl: async (url) => String(url).includes('capabilities')
      ? response({ json: { dryRunOnly: true, secretsRequired: false, publicationSupported: false } })
      : response(),
    log: (line) => logs.push(line)
  });
  assert.equal(server, fakeServer);
  assert.match(logs.join('\n'), /Could not open the browser automatically/);
});
